import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from './index'
import { events, listings, priceHistory, sellers } from './schema'
import type { Author, Event, EventType, Listing, PricePoint, Seller } from './schema'
import { getStages } from './stage'

import { todayInKyiv } from '@/lib/dates'
import { DEFAULT_STAGE, type Stage } from '@/lib/stages'

export type LastEvent = {
  author: Author
  type: EventType
  text: string | null
  createdAt: Date
}

export type QueueCard = {
  listing: Listing
  stage: Stage
  /** Остання подія будь-якого типу — для підпису «хто і коли». */
  lastEvent: LastEvent | null
  /** Остання подія з текстом — для цитати. Зміна етапу тексту не має. */
  lastNote: LastEvent | null
  /** На скільки впала ціна в останній зміні. Причина подзвонити саме сьогодні. */
  priceDrop: number | null
}

export type Queue = {
  overdue: QueueCard[]
  today: QueueCard[]
  later: QueueCard[]
}

/**
 * Остання подія по кожному авто — один запит, DISTINCT ON.
 * `withTextOnly` бере лише події з непорожнім payload.text: після дзвінка одразу
 * йде зміна етапу, і без цього фільтра картка ніколи не показала б, що саме сказали.
 */
async function getLastEvents(
  ids: string[],
  withTextOnly = false,
): Promise<Map<string, LastEvent>> {
  if (ids.length === 0) return new Map()

  const scope = withTextOnly
    ? and(inArray(events.listingId, ids), sql`coalesce(${events.payload}->>'text', '') <> ''`)
    : inArray(events.listingId, ids)

  const rows = await db
    .selectDistinctOn([events.listingId], {
      listingId: events.listingId,
      author: events.author,
      type: events.type,
      payload: events.payload,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(scope)
    .orderBy(events.listingId, desc(events.createdAt))

  return new Map(
    rows.map((row) => [
      row.listingId,
      { author: row.author, type: row.type, text: row.payload?.text ?? null, createdAt: row.createdAt },
    ]),
  )
}

/** Останнє падіння ціни по кожному авто. */
async function getPriceDrops(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()

  const rows = await db
    .selectDistinctOn([events.listingId], {
      listingId: events.listingId,
      payload: events.payload,
    })
    .from(events)
    .where(and(eq(events.type, 'price_change'), inArray(events.listingId, ids)))
    .orderBy(events.listingId, desc(events.createdAt))

  const drops = new Map<string, number>()
  for (const row of rows) {
    const { old_price: oldPrice, new_price: newPrice } = row.payload ?? {}
    if (typeof oldPrice === 'number' && typeof newPrice === 'number' && newPrice < oldPrice) {
      drops.set(row.listingId, oldPrice - newPrice)
    }
  }
  return drops
}

/**
 * Робоча черга головного екрана: «Прострочено» / «Сьогодні» / «Далі».
 * Архівні не показуємо. Авто без дати контакту падають у «Далі».
 */
export async function getQueue(): Promise<Queue> {
  const rows = await db
    .select()
    .from(listings)
    .where(eq(listings.archived, false))
    .orderBy(sql`${listings.nextContactAt} asc nulls last`, desc(listings.createdAt))

  const ids = rows.map((row) => row.id)
  const [stages, lastEvents, lastNotes, priceDrops] = await Promise.all([
    getStages(ids),
    getLastEvents(ids),
    getLastEvents(ids, true),
    getPriceDrops(ids),
  ])

  const today = todayInKyiv()
  const queue: Queue = { overdue: [], today: [], later: [] }

  for (const listing of rows) {
    const card: QueueCard = {
      listing,
      stage: stages.get(listing.id) ?? DEFAULT_STAGE,
      lastEvent: lastEvents.get(listing.id) ?? null,
      lastNote: lastNotes.get(listing.id) ?? null,
      priceDrop: priceDrops.get(listing.id) ?? null,
    }

    if (listing.nextContactAt && listing.nextContactAt < today) queue.overdue.push(card)
    else if (listing.nextContactAt === today) queue.today.push(card)
    else queue.later.push(card)
  }

  // Щойно закинуті посилання і те, що не розпарсилось, — на початок «Далі».
  const needsAttention = (card: QueueCard) =>
    card.listing.status === 'pending' || card.listing.status === 'failed'
  queue.later.sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)))

  return queue
}

export type ListingDetail = {
  listing: Listing
  seller: Seller | null
  stage: Stage
  events: Event[]
  prices: PricePoint[]
}

export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1)
  if (!listing) return null

  const [seller, feed, prices] = await Promise.all([
    listing.sellerId
      ? db
          .select()
          .from(sellers)
          .where(eq(sellers.id, listing.sellerId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db.select().from(events).where(eq(events.listingId, id)).orderBy(desc(events.createdAt)),
    db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.listingId, id))
      .orderBy(asc(priceHistory.seenAt)),
  ])

  const stages = await getStages([id])

  return { listing, seller, stage: stages.get(id) ?? DEFAULT_STAGE, events: feed, prices }
}

export type SellerRow = { seller: Seller; listingCount: number }

export async function getSellers(): Promise<SellerRow[]> {
  const rows = await db
    .select({
      seller: sellers,
      listingCount: sql<number>`count(${listings.id})::int`,
    })
    .from(sellers)
    .leftJoin(listings, eq(listings.sellerId, sellers.id))
    .groupBy(sellers.id)
    .orderBy(desc(sql`count(${listings.id})`), asc(sellers.name))

  return rows
}
