import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from './index'
import { getListings, type ListingRow } from './list'
import { events, listings, sellers } from './schema'
import type { Event, Seller } from './schema'

import { DEFAULT_QUERY } from '@/lib/list-query'

/**
 * Продавці з цифрами. Сторінка має відповідати на одне питання — що це за
 * людина і чи варто з нею говорити, — а для цього самого імені мало.
 */

export type SellerStats = {
  /** Скільки авто в нього всього було. */
  total: number
  /** Скільки продає зараз. */
  active: number
  avgPrice: number | null
  /** Скільки разів знижував ціни по всіх своїх авто. */
  drops: number
  lastContact: Date | null
}

/** Авто продавця коротким рядком — стільки, скільки треба картці в списку. */
export type SellerCar = {
  id: string
  title: string | null
  priceUsd: number | null
  publishedAt: Date | null
  removed: boolean
}

export type SellerListRow = SellerStats & { seller: Seller; cars: SellerCar[] }

export type SellersSort = 'cars' | 'contact'

/** Події по всіх авто продавця, зведені в одну стрічку. */
export type SellerEvent = { event: Event; listingId: string; listingTitle: string | null }

export type SellerDetail = {
  seller: Seller
  stats: SellerStats
  cars: ListingRow[]
  events: SellerEvent[]
  /** Інші продавці з тим же номером — привід підозрювати, що це та сама людина. */
  sameAs: { id: string; name: string | null }[]
}

/**
 * Агрегат над часом повертається з драйвера рядком, а не датою — на відміну від
 * звичайної колонки. Зводимо до `Date` тут, щоб сторінка про це не думала.
 */
function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

/** Дзвінки, коментарі й огляди — те, що ми справді робили, а не парсер. */
const CONTACT_TYPES = ['call', 'comment', 'viewing'] as const

/** Падіння цін і час останнього контакту — по всіх авто продавця одразу. */
function statsSubquery() {
  return db
    .select({
      sellerId: listings.sellerId,
      drops: sql<number>`count(*) filter (
        where ${events.type} = 'price_change'
          and (${events.payload} ->> 'new_price')::int < (${events.payload} ->> 'old_price')::int
      )::int`.as('drops'),
      lastContact: sql<Date | null>`max(${events.createdAt}) filter (
        where ${events.type} in ('call', 'comment', 'viewing')
      )`.as('last_contact'),
    })
    .from(events)
    .innerJoin(listings, eq(listings.id, events.listingId))
    .where(isNotNull(listings.sellerId))
    .groupBy(listings.sellerId)
    .as('seller_stats')
}

export async function getSellerRows(sort: SellersSort): Promise<SellerListRow[]> {
  const stats = statsSubquery()

  const rows = await db
    .select({
      seller: sellers,
      total: count(listings.id),
      active: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active' and ${listings.archived} = false
      )::int`,
      avgPrice: sql<number | null>`avg(${listings.priceUsd})::int`,
      drops: sql<number | null>`max(${stats.drops})::int`,
      lastContact: sql<Date | null>`max(${stats.lastContact})`,
    })
    .from(sellers)
    .leftJoin(listings, eq(listings.sellerId, sellers.id))
    .leftJoin(stats, eq(stats.sellerId, sellers.id))
    .groupBy(sellers.id)
    .orderBy(
      ...(sort === 'contact'
        ? [sql`max(${stats.lastContact}) desc nulls last`]
        : [desc(count(listings.id))]),
      sql`${sellers.name} asc nulls last`,
    )

  // Авто всіх продавців одним запитом: на кожній картці має бути видно, що
  // саме людина продає, а не тільки скільки штук (аркуш 07).
  const cars = await db
    .select({
      sellerId: listings.sellerId,
      id: listings.id,
      title: listings.title,
      priceUsd: listings.priceUsd,
      publishedAt: listings.publishedAt,
      status: listings.status,
    })
    .from(listings)
    .where(isNotNull(listings.sellerId))
    .orderBy(desc(listings.priceUsd))

  const bySeller = new Map<string, SellerCar[]>()
  for (const car of cars) {
    const list = bySeller.get(car.sellerId!) ?? []
    list.push({
      id: car.id,
      title: car.title,
      priceUsd: car.priceUsd,
      publishedAt: car.publishedAt,
      removed: car.status === 'removed',
    })
    bySeller.set(car.sellerId!, list)
  }

  return rows.map((row) => ({
    seller: row.seller,
    total: row.total,
    active: row.active,
    avgPrice: row.avgPrice,
    drops: row.drops ?? 0,
    lastContact: asDate(row.lastContact),
    cars: bySeller.get(row.seller.id) ?? [],
  }))
}

export async function getSellerDetail(id: string): Promise<SellerDetail | null> {
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1)
  if (!seller) return null

  const [cars, feed, stats, sameAs] = await Promise.all([
    // Усі авто продавця, включно з архівними: історія важливіша за чистоту черги.
    getListings({ ...DEFAULT_QUERY, archived: true, per: 'all' }, { sellerId: id }),
    sellerEvents(id),
    sellerStats(id),
    sellersWithSamePhone(seller),
  ])

  return { seller, stats, cars: cars.rows, events: feed, sameAs }
}

async function sellerEvents(sellerId: string): Promise<SellerEvent[]> {
  const rows = await db
    .select({ event: events, listingId: listings.id, listingTitle: listings.title })
    .from(events)
    .innerJoin(listings, eq(listings.id, events.listingId))
    .where(eq(listings.sellerId, sellerId))
    .orderBy(desc(events.createdAt))
    .limit(60)

  return rows
}

async function sellerStats(sellerId: string): Promise<SellerStats> {
  const stats = statsSubquery()

  const [row] = await db
    .select({
      total: count(listings.id),
      active: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active' and ${listings.archived} = false
      )::int`,
      avgPrice: sql<number | null>`avg(${listings.priceUsd})::int`,
      drops: sql<number | null>`max(${stats.drops})::int`,
      lastContact: sql<Date | null>`max(${stats.lastContact})`,
    })
    .from(listings)
    .leftJoin(stats, eq(stats.sellerId, listings.sellerId))
    .where(eq(listings.sellerId, sellerId))

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    avgPrice: row?.avgPrice ?? null,
    drops: row?.drops ?? 0,
    lastContact: asDate(row?.lastContact),
  }
}

async function sellersWithSamePhone(seller: Seller): Promise<{ id: string; name: string | null }[]> {
  if (seller.phones.length === 0) return []

  return db
    .select({ id: sellers.id, name: sellers.name })
    .from(sellers)
    .where(
      and(
        sql`${sellers.phones} && ${seller.phones}`,
        sql`${sellers.id} <> ${seller.id}`,
      ),
    )
}

export { CONTACT_TYPES }
