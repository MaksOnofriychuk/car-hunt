import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from './index'
import { listWhere, listOrderBy, listRange, type ListJoins } from './list-filters'
import { events, listings, priceHistory, sellers } from './schema'
import type { Author, EventType, Listing, SellerType } from './schema'

import { todayInKyiv } from '@/lib/dates'
import { MAX_PER_PAGE, type ListQuery } from '@/lib/list-query'
import { DEFAULT_STAGE, isStage, type Stage } from '@/lib/stages'

/**
 * Один запит, з якого живе весь список авто: черга, таблиця і сторінка продавця.
 *
 * Дві речі, заради яких він написаний окремо від `queries.ts`:
 *
 *   1. **проєкція.** Стара `getQueue()` робила `select()` без переліку колонок,
 *      тобто тягла з бази `html_raw` (стиснена сторінка оголошення, сотні
 *      кілобайт) і `snapshot_raw` на кожну картку списку — а `PendingPoller`
 *      перемальовує чергу раз на півтори секунди;
 *   2. **етап, коментар і падіння ціни в SQL.** Вони живуть у подіях, і поки
 *      їх діставали окремими запитами, фільтрувати й сортувати за ними було
 *      нічим.
 */

/** Колонки, які показує список. Решта — лише на картці авто. */
export type ListingSummary = Pick<
  Listing,
  | 'id'
  | 'source'
  | 'url'
  | 'status'
  | 'title'
  | 'brand'
  | 'model'
  | 'year'
  | 'mileageKm'
  | 'priceUsd'
  | 'priceUah'
  | 'city'
  | 'targetPriceUsd'
  | 'nextContactAt'
  | 'publishedAt'
  | 'photos'
  | 'photosLocal'
  | 'photosManual'
  | 'archived'
  | 'createdAt'
  | 'sellerId'
>

export type RowEvent = {
  author: Author
  type: EventType
  text: string | null
  createdAt: Date
}

export type ListingRow = {
  listing: ListingSummary
  stage: Stage
  seller: { id: string; name: string | null; type: SellerType; phones: string[] } | null
  /** Остання подія будь-якого типу — для підпису «хто і коли». */
  lastEvent: RowEvent | null
  /** Остання подія з текстом — для цитати. Зміна етапу тексту не має. */
  lastNote: RowEvent | null
  /** На скільки впала ціна від першого спостереження. Причина подзвонити. */
  priceDrop: number | null
  /** За скільки днів вона впала — без цього число «−700» ні про що. */
  priceDropDays: number | null
}

export type ListPage = {
  rows: ListingRow[]
  /** Скільки всього підходить під фільтри — для пагінації. */
  total: number
}

const summaryColumns = {
  id: listings.id,
  source: listings.source,
  url: listings.url,
  status: listings.status,
  title: listings.title,
  brand: listings.brand,
  model: listings.model,
  year: listings.year,
  mileageKm: listings.mileageKm,
  priceUsd: listings.priceUsd,
  priceUah: listings.priceUah,
  city: listings.city,
  targetPriceUsd: listings.targetPriceUsd,
  nextContactAt: listings.nextContactAt,
  publishedAt: listings.publishedAt,
  photos: listings.photos,
  photosLocal: listings.photosLocal,
  photosManual: listings.photosManual,
  archived: listings.archived,
  createdAt: listings.createdAt,
  sellerId: listings.sellerId,
}

/** Останній етап, останні події і останнє падіння ціни — підзапитами DISTINCT ON. */
function subqueries() {
  const stageOf = db.$with('stage_of').as(
    db
      .selectDistinctOn([events.listingId], {
        listingId: events.listingId,
        stage: sql<string | null>`${events.payload} ->> 'stage'`.as('stage'),
      })
      .from(events)
      .where(eq(events.type, 'stage_change'))
      .orderBy(events.listingId, desc(events.createdAt)),
  )

  const lastEvent = db.$with('last_event').as(
    db
      .selectDistinctOn([events.listingId], {
        listingId: events.listingId,
        author: events.author,
        type: events.type,
        text: sql<string | null>`${events.payload} ->> 'text'`.as('event_text'),
        createdAt: events.createdAt,
      })
      .from(events)
      .orderBy(events.listingId, desc(events.createdAt)),
  )

  const lastNote = db.$with('last_note').as(
    db
      .selectDistinctOn([events.listingId], {
        listingId: events.listingId,
        author: events.author,
        type: events.type,
        text: sql<string | null>`${events.payload} ->> 'text'`.as('note_text'),
        createdAt: events.createdAt,
      })
      .from(events)
      .where(sql`coalesce(${events.payload} ->> 'text', '') <> ''`)
      .orderBy(events.listingId, desc(events.createdAt)),
  )

  /**
   * Падіння ціни за весь час спостережень, а не в останньому кроці: на картці
   * стоїть «↓ 700 за 12 днів», і обидва числа мусять бути про один період.
   * Зростання падінням не рахуємо — тоді чипа просто немає.
   */
  const priceDrop = db.$with('price_drop').as(
    db
      .select({
        listingId: priceHistory.listingId,
        drop: sql<number | null>`
          nullif(
            greatest(
              (array_agg(${priceHistory.priceUsd} order by ${priceHistory.seenAt}))[1]
                - (array_agg(${priceHistory.priceUsd} order by ${priceHistory.seenAt} desc))[1],
              0
            ),
            0
          )
        `.as('drop'),
        dropDays: sql<number | null>`
          date_part('day', now() - min(${priceHistory.seenAt}))::int
        `.as('drop_days'),
      })
      .from(priceHistory)
      .groupBy(priceHistory.listingId),
  )

  return { stageOf, lastEvent, lastNote, priceDrop }
}

export async function getListings(
  query: ListQuery,
  scope?: {
    /** Звузити до авто одного продавця — цим живе його сторінка. */
    sellerId?: string
    /** Тільки прибрані з черги — секція архіву внизу черги. */
    archivedOnly?: boolean
  },
): Promise<ListPage> {
  const { stageOf, lastEvent, lastNote, priceDrop } = subqueries()

  const joins: ListJoins = {
    stage: sql`${stageOf.stage}`,
    commentAt: sql`${lastNote.createdAt}`,
  }
  const filters = listWhere(query, joins)
  const narrowed = [
    filters,
    scope?.sellerId ? eq(listings.sellerId, scope.sellerId) : undefined,
    scope?.archivedOnly ? eq(listings.archived, true) : undefined,
  ].filter((part) => part !== undefined)
  const where = narrowed.length > 0 ? and(...narrowed) : undefined
  const { limit, offset } = listRange(query, MAX_PER_PAGE)

  const rowsQuery = db
    .with(stageOf, lastEvent, lastNote, priceDrop)
    .select({
      listing: summaryColumns,
      stage: stageOf.stage,
      sellerId: sellers.id,
      sellerName: sellers.name,
      sellerType: sellers.type,
      sellerPhones: sellers.phones,
      lastAuthor: lastEvent.author,
      lastType: lastEvent.type,
      lastText: lastEvent.text,
      lastAt: lastEvent.createdAt,
      noteAuthor: lastNote.author,
      noteType: lastNote.type,
      noteText: lastNote.text,
      noteAt: lastNote.createdAt,
      drop: priceDrop.drop,
      dropDays: priceDrop.dropDays,
    })
    .from(listings)
    .leftJoin(sellers, eq(sellers.id, listings.sellerId))
    .leftJoin(stageOf, eq(stageOf.listingId, listings.id))
    .leftJoin(lastEvent, eq(lastEvent.listingId, listings.id))
    .leftJoin(lastNote, eq(lastNote.listingId, listings.id))
    .leftJoin(priceDrop, eq(priceDrop.listingId, listings.id))
    .where(where)
    .orderBy(...listOrderBy(query, joins))
    .limit(limit)
    .offset(offset)

  const totalQuery = db
    .with(stageOf)
    .select({ total: count() })
    .from(listings)
    .leftJoin(sellers, eq(sellers.id, listings.sellerId))
    .leftJoin(stageOf, eq(stageOf.listingId, listings.id))
    .where(where)

  const [rows, totals] = await Promise.all([rowsQuery, totalQuery])

  return {
    rows: rows.map((row) => ({
      listing: row.listing,
      stage: isStage(row.stage) ? row.stage : DEFAULT_STAGE,
      seller: row.sellerId
        ? {
            id: row.sellerId,
            name: row.sellerName,
            type: row.sellerType ?? 'unknown',
            phones: row.sellerPhones ?? [],
          }
        : null,
      lastEvent: row.lastAt
        ? { author: row.lastAuthor!, type: row.lastType!, text: row.lastText, createdAt: row.lastAt }
        : null,
      lastNote: row.noteAt
        ? { author: row.noteAuthor!, type: row.noteType!, text: row.noteText, createdAt: row.noteAt }
        : null,
      priceDrop: row.drop ?? null,
      priceDropDays: row.dropDays ?? null,
    })),
    total: totals[0]?.total ?? 0,
  }
}

export type Buckets = {
  overdue: ListingRow[]
  today: ListingRow[]
  later: ListingRow[]
}

/**
 * Три секції черги. Працюють лише при типовому сортуванні — при будь-якому
 * іншому вони брехали б, тому список тоді лишається плоским.
 */
export function bucketByContact(rows: ListingRow[]): Buckets {
  const today = todayInKyiv()
  const buckets: Buckets = { overdue: [], today: [], later: [] }

  for (const row of rows) {
    const date = row.listing.nextContactAt
    if (date && date < today) buckets.overdue.push(row)
    else if (date === today) buckets.today.push(row)
    else buckets.later.push(row)
  }

  // Щойно закинуті посилання тримаємо вгорі «Далі»: людина чекає, поки вони
  // розберуться, і має бачити результат одразу.
  buckets.later.sort((a, b) => rank(a) - rank(b))
  return buckets
}

function rank(row: ListingRow): number {
  return row.listing.status === 'pending' || row.listing.status === 'failed' ? 0 : 1
}

/** Міста, які реально є в базі, — для підказки у фільтрі. */
export async function listCities(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ city: listings.city })
    .from(listings)
    .where(isNotNull(listings.city))
    .orderBy(listings.city)

  return rows.map((row) => row.city).filter((city): city is string => city !== null)
}
