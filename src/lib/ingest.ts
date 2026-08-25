import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { events, listings, priceHistory, type Author, type Listing } from '@/db/schema'
import { linkSeller } from '@/db/sellers'
import { dropManual } from '@/db/listings'
import { archiveListing } from '@/lib/archive'
import { bothPrices } from '@/lib/rates'
import { canonicalizeRef } from '@/lib/sources/canonicalize'
import { refForInput, sourceFor } from '@/lib/sources'
import { QuotaExceededError } from '@/lib/sources/http'
import { notifyPriceChange } from '@/lib/telegram/notify'
import { ListingGoneError, SourceBlockedError, SourceNotReadyError } from '@/lib/sources/types'

/** Версія розбору. Піднімати, коли парсер став діставати щось нове. */
export const PARSER_VERSION = 2

/**
 * Інгест — SPEC, «Інгест посилання». Головне правило: посилання не губиться
 * ніколи. Невідомий домен, збій парсера, вичерпана квота — картка все одно є.
 */

export type IngestResult = {
  id: string
  duplicate: boolean
  /** false — домен не розпізнали, картка створена як manual/failed. */
  recognized: boolean
}

export async function ingestUrl(rawUrl: string, author: Author): Promise<IngestResult> {
  const url = rawUrl.trim()
  const { ref: draft, recognized } = refForInput(url)

  // Telegram зводимо до числової форми, поки не пізно: інакше той самий пост,
  // що прилетить вебхуком, створить другу картку.
  const { ref } = await canonicalizeRef(draft)

  const [existing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.source, ref.source), eq(listings.sourceId, ref.id)))
    .limit(1)

  if (existing) return { id: existing.id, duplicate: true, recognized }

  const [created] = await db
    .insert(listings)
    .values({
      source: ref.source,
      sourceId: ref.id,
      url,
      // Невідомий домен одразу failed: парсити нічим, далі заповнюють руками.
      status: recognized ? 'pending' : 'failed',
      createdBy: author,
    })
    .returning({ id: listings.id })

  return { id: created.id, duplicate: false, recognized }
}

/** Парсинг і архівація. Викликається у фоні через after() і з cron. */
export async function parseListing(listingId: string): Promise<void> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1)
  if (!listing) return

  const source = sourceFor(listing.source)
  if (!source) return

  try {
    const snapshot = await source.fetch(listing.url, {
      source: listing.source,
      id: listing.sourceId,
    })

    // Майданчик дає ціну в одній валюті — другу доводимо за курсом.
    const money = await bothPrices(snapshot)
    const previousPrice = listing.priceUsd
    const price = money.priceUsd

    // «Ціна змінилась» рахуємо у валюті оголошення: для OLX вона в гривні,
    // і перерахунок у долари смикав би подію від курсу, а не від продавця.
    const currency = snapshot.priceCurrency ?? 'USD'
    const nativeBefore = currency === 'UAH' ? listing.priceUah : listing.priceUsd
    const nativeAfter = currency === 'UAH' ? money.priceUah : money.priceUsd

    await db
      .update(listings)
      .set(
        dropManual(listing, {
          status: 'active',
          title: snapshot.title ?? listing.title,
          brand: snapshot.brand ?? listing.brand,
          model: snapshot.model ?? listing.model,
          year: snapshot.year ?? listing.year,
          mileageKm: snapshot.mileageKm ?? listing.mileageKm,
          priceUsd: price ?? listing.priceUsd,
          city: snapshot.city ?? listing.city,
          vin: snapshot.vin ?? listing.vin,
          fuelType: snapshot.fuelType ?? listing.fuelType,
          transmission: snapshot.transmission ?? listing.transmission,
          color: snapshot.color ?? listing.color,
          engineVolume: snapshot.engineVolume ?? listing.engineVolume,
          driveType: snapshot.driveType ?? listing.driveType,
          bodyType: snapshot.bodyType ?? listing.bodyType,
          plateNumber: snapshot.plateNumber ?? listing.plateNumber,
          priceUah: money.priceUah ?? listing.priceUah,
          publishedAt: snapshot.publishedAt ?? listing.publishedAt,
          photos: snapshot.photos?.length ? snapshot.photos : listing.photos,
          snapshotRaw: snapshot.raw,
          parsedAt: new Date(),
          parserVersion: PARSER_VERSION,
        }),
      )
      .where(eq(listings.id, listing.id))

    if (price !== null) {
      await db.insert(priceHistory).values({ listingId: listing.id, priceUsd: price })

      // Подія лише про справжню зміну, а не про перший запис ціни.
      if (previousPrice !== null && nativeBefore !== null && nativeBefore !== nativeAfter) {
        await db.insert(events).values({
          listingId: listing.id,
          author: listing.createdBy,
          type: 'price_change',
          payload: { old_price: previousPrice, new_price: price },
        })

        // Ціну змінив продавець, а не хтось із нас, — тому пишемо обом.
        await notifyPriceChange(
          { ...listing, priceUsd: price, priceUah: money.priceUah ?? listing.priceUah },
          { oldPrice: previousPrice, newPrice: price },
        )
      }
    }

    // Склейка продавців: основний ключ — id продавця в джерелі, телефон додатковий.
    // Уже проставлений seller_id не чіпаємо: його могли виправити руками.
    const sellerId = await linkSeller(listing, snapshot)
    if (sellerId && !listing.sellerId) {
      await db.update(listings).set({ sellerId }).where(eq(listings.id, listing.id))
    }

    const [fresh] = await db.select().from(listings).where(eq(listings.id, listing.id)).limit(1)
    if (fresh) await archiveListing(fresh, snapshot)
  } catch (error) {
    await handleFailure(listing, error)
  }
}

async function handleFailure(listing: Listing, error: unknown): Promise<void> {
  // Оголошення зняли — тільки статус, нічого не видаляємо і не перезаписуємо.
  if (error instanceof ListingGoneError) {
    await db.update(listings).set({ status: 'removed' }).where(eq(listings.id, listing.id))
    return
  }

  // Квота вичерпана або майданчик не пустив — це черга, а не помилка:
  // лишаємо pending, cron добере.
  if (
    error instanceof QuotaExceededError ||
    error instanceof SourceNotReadyError ||
    error instanceof SourceBlockedError
  ) {
    console.warn(`[ingest] ${listing.id} лишається в черзі: ${(error as Error).message}`)
    return
  }

  console.error(`[ingest] ${listing.id} не розпарсився:`, error)
  await db.update(listings).set({ status: 'failed' }).where(eq(listings.id, listing.id))
}
