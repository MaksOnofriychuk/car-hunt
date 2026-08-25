import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from './index'
import { listWhere, listOrderBy, listRange, type ListJoins } from './list-filters'
import { events, listings, sellers } from './schema'
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
  seller: { id: string; name: string | null; type: SellerType } | null
  /** Остання подія будь-якого типу — для підпису «хто і коли». */
  lastEvent: RowEvent | null
  /** Остання подія з текстом — для цитати. Зміна етапу тексту не має. */
  lastNote: RowEvent | null
  /** На скільки впала ціна в останній зміні. Причина подзвонити саме сьогодні. */
  priceDrop: number | null
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

  const priceDrop = db.$with('price_drop').as(
    db
      .selectDistinctOn([events.listingId], {
        listingId: events.listingId,
        // Зростання ціни падінням не рахуємо — на картці це підпис «↓».
        drop: sql<number | null>`
          case
            when (${events.payload} ->> 'new_price')::int < (${events.payload} ->> 'old_price')::int
            then (${events.payload} ->> 'old_price')::int - (${events.payload} ->> 'new_price')::int
          end
        `.as('drop'),
      })
      .from(events)
      .where(eq(events.type, 'price_change'))
      .orderBy(events.listingId, desc(events.createdAt)),
  )

  return { stageOf, lastEvent, lastNote, priceDrop }
}

export async function getListings(
  query: ListQuery,
  /** Звузити до авто одного продавця — цим живе його сторінка. */
  scope?: { sellerId?: string },
): Promise<ListPage> {
  const { stageOf, lastEvent, lastNote, priceDrop } = subqueries()

  const joins: ListJoins = {
    stage: sql`${stageOf.stage}`,
    commentAt: sql`${lastNote.createdAt}`,
  }
  const filters = listWhere(query, joins)
  const where = scope?.sellerId
    ? and(filters, eq(listings.sellerId, scope.sellerId))
    : filters
  const { limit, offset } = listRange(query, MAX_PER_PAGE)

  const rowsQuery = db
    .with(stageOf, lastEvent, lastNote, priceDrop)
    .select({
      listing: summaryColumns,
      stage: stageOf.stage,
      sellerId: sellers.id,
      sellerName: sellers.name,
      sellerType: sellers.type,
      lastAuthor: lastEvent.author,
      lastType: lastEvent.type,
      lastText: lastEvent.text,
      lastAt: lastEvent.createdAt,
      noteAuthor: lastNote.author,
      noteType: lastNote.type,
      noteText: lastNote.text,
      noteAt: lastNote.createdAt,
      drop: priceDrop.drop,
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
        ? { id: row.sellerId, name: row.sellerName, type: row.sellerType ?? 'unknown' }
        : null,
      lastEvent: row.lastAt
        ? { author: row.lastAuthor!, type: row.lastType!, text: row.lastText, createdAt: row.lastAt }
        : null,
      lastNote: row.noteAt
        ? { author: row.noteAuthor!, type: row.noteType!, text: row.noteText, createdAt: row.noteAt }
        : null,
      priceDrop: row.drop ?? null,
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
