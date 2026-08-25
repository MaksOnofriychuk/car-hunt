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

  // Telegram і manual оновлювати нізвідки: у telegramSource.fetch() стоїть
  // SourceNotReadyError, і без цієї перевірки картка навічно лишалась би
  // `pending` — а це вічний поллінг на головній і марний прогін крону щогодини.
  if (!source.refreshable) {
    if (listing.status === 'pending') {
      await db.update(listings).set({ status: 'active' }).where(eq(listings.id, listing.id))
    }
    return
  }

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
          // Жодного `?? listing.x`: рядок прочитаний ДО мережевого запиту, який
          // триває секунди, і за цей час у колонки міг щось дописати пост із
          // Telegram. Повертати туди старе значення означало б затирати його
          // чужою чернеткою. `undefined` drizzle просто не кладе в UPDATE —
          // парсер чіпає рівно те, що сам знайшов.
          title: snapshot.title ?? undefined,
          brand: snapshot.brand ?? undefined,
          model: snapshot.model ?? undefined,
          year: snapshot.year ?? undefined,
          mileageKm: snapshot.mileageKm ?? undefined,
          priceUsd: price ?? undefined,
          city: snapshot.city ?? undefined,
          vin: snapshot.vin ?? undefined,
          fuelType: snapshot.fuelType ?? undefined,
          transmission: snapshot.transmission ?? undefined,
          color: snapshot.color ?? undefined,
          engineVolume: snapshot.engineVolume ?? undefined,
          driveType: snapshot.driveType ?? undefined,
          bodyType: snapshot.bodyType ?? undefined,
          plateNumber: snapshot.plateNumber ?? undefined,
          priceUah: money.priceUah ?? undefined,
          publishedAt: snapshot.publishedAt ?? undefined,
          photos: snapshot.photos?.length ? snapshot.photos : undefined,
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
          // `source: 'listing'` — щоб відрізнити від змін, які приходять між
          // двома постами: 9500 у пості проти 9799 в оголошенні це знижка, а не
          // падіння ціни, і в черзі воно не має рахуватись падінням.
          payload: { old_price: previousPrice, new_price: price, source: 'listing' },
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
