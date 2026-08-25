import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { listings, type Listing } from '@/db/schema'
import { politeFetch } from '@/lib/sources/http'
import { storageKeyPrefix } from '@/lib/sources'
import { contentTypeFor, storage } from '@/lib/storage'
import type { ListingSnapshot } from '@/lib/sources/types'

/**
 * Повний архів оголошення — SPEC, «Повний архів оголошення».
 * html_raw, description_text і photos_local пишуться ОДИН раз і не
 * перезаписуються; archived_at ставиться, лише коли зібрано геть усе.
 */

/**
 * 27 фото × 2 с паузи = майже хвилина, а це впритул до ліміту тривалості
 * функції. Тому один прогін бере скільки встигає, решту добере cron —
 * рівно той сценарій, який SPEC і описує.
 */
const DEFAULT_BUDGET_MS = 40_000

/**
 * Ключ фото у сховищі. Експортується, бо перепарсинг (`scripts/reparse.ts`)
 * має вміти порахувати ключ старого фото, щоб прибрати чуже.
 */
export function photoKey(listing: Listing, url: string, index: number): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 8)
  const prefix = storageKeyPrefix({ source: listing.source, id: listing.sourceId })
  return `${prefix}/${String(index).padStart(2, '0')}-${hash}.${extFor(url)}`
}

/**
 * Розширення шукаємо **в останньому сегменті шляху**, а не в усьому URL: у OLX
 * адреса закінчується на `/image;s=1000x750`, і по крапці з домену в ключ лізло
 * б сміття (`.com:4`), а `/api/files` віддавав би такий файл із неправильним
 * типом. Немає розширення — jpg, саме його віддає CDN OLX.
 */
function extFor(url: string): string {
  const path = url.split('?')[0].split('#')[0]
  const name = path.slice(path.lastIndexOf('/') + 1)
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  return /^[a-z0-9]{2,4}$/.test(ext) ? ext : 'jpg'
}

export type ArchiveResult = {
  savedPhotos: number
  totalPhotos: number
  complete: boolean
}

/**
 * Догортає архів настільки, наскільки встигає за відведений час.
 * Викликається і з інгесту, і з cron — має бути безпечним при повторі.
 */
export async function archiveListing(
  listing: Listing,
  snapshot?: Pick<ListingSnapshot, 'html' | 'descriptionText'>,
  budgetMs = DEFAULT_BUDGET_MS,
): Promise<ArchiveResult> {
  const deadline = Date.now() + budgetMs
  const files = storage()

  // 1. HTML сторінки: gzip → base64, бо сирі байти в колонку text не покласти.
  if (!listing.htmlRaw && snapshot?.html) {
    await db
      .update(listings)
      .set({ htmlRaw: gzipSync(Buffer.from(snapshot.html, 'utf8')).toString('base64') })
      .where(eq(listings.id, listing.id))
  }

  // 2. Опис продавця окремим полем.
  if (!listing.descriptionText && snapshot?.descriptionText) {
    await db
      .update(listings)
      .set({ descriptionText: snapshot.descriptionText })
      .where(eq(listings.id, listing.id))
  }

  // 3. Фото — інкрементально, лише ті, яких ще немає.
  const saved = [...listing.photosLocal]
  const total = listing.photos.length

  for (const [index, url] of listing.photos.entries()) {
    if (Date.now() > deadline) break

    const key = photoKey(listing, url, index)
    if (saved.includes(key)) continue

    try {
      if (!(await files.exists(key))) {
        const response = await politeFetch(url, { source: listing.source, kind: 'photo', accept: 'image/*' })
        if (!response.ok) continue
        const body = Buffer.from(await response.arrayBuffer())
        await files.put(key, body, response.headers.get('content-type') ?? contentTypeFor(key))
      }
      saved.push(key)
      await db.update(listings).set({ photosLocal: saved }).where(eq(listings.id, listing.id))
    } catch {
      // Одне зірване фото не валить архів: спробуємо наступного прогону.
    }
  }

  const [current] = await db.select().from(listings).where(eq(listings.id, listing.id)).limit(1)
  const complete = Boolean(
    current?.htmlRaw && current.photosLocal.length >= current.photos.length && current.photos.length > 0,
  )

  if (complete && !current?.archivedAt) {
    await db.update(listings).set({ archivedAt: new Date() }).where(eq(listings.id, listing.id))
  }

  return { savedPhotos: saved.length, totalPhotos: total, complete }
}
