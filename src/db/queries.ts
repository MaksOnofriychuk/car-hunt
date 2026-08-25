import { and, arrayOverlaps, asc, desc, eq, ne, sql } from 'drizzle-orm'

import { db } from './index'
import { events, listings, priceHistory, sellers } from './schema'
import type { Event, Listing, PricePoint, Seller } from './schema'
import { getStages } from './stage'

import { DEFAULT_STAGE, type Stage } from '@/lib/stages'

export type ListingDetail = {
  listing: Listing
  seller: Seller | null
  /** Інші продавці з тим же номером — привід підозрювати, що це та сама людина. */
  sameAs: { id: string; name: string | null }[]
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

  const [stages, sameAs] = await Promise.all([getStages([id]), sellersSharingPhones(seller)])

  return { listing, seller, sameAs, stage: stages.get(id) ?? DEFAULT_STAGE, events: feed, prices }
}

/**
 * Номер записаний одразу в кількох продавців. Не зливаємо їх самі — просто
 * показуємо попередження щоразу, поки хтось не розбереться руками.
 */
async function sellersSharingPhones(seller: Seller | null) {
  if (!seller || seller.phones.length === 0) return []
  const rows = await db
    .select({ id: sellers.id, name: sellers.name })
    .from(sellers)
    .where(and(arrayOverlaps(sellers.phones, seller.phones), ne(sellers.id, seller.id)))
  return rows
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
