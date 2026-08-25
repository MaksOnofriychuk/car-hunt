import './load-env'

import { gunzipSync } from 'node:zlib'

import { eq } from 'drizzle-orm'

import { client, db } from '../src/db'
import { dropManual } from '../src/db/listings'
import { listings, type Listing } from '../src/db/schema'
import { archiveListing, photoKey } from '../src/lib/archive'
import { PARSER_VERSION, parseListing } from '../src/lib/ingest'
import { bothPrices } from '../src/lib/rates'
import { parseListingHtml } from '../src/lib/sources/autoria/parse'
import { parseListingOlx } from '../src/lib/sources/olx/parse'
import type { ListingSnapshot } from '../src/lib/sources/types'
import { storage } from '../src/lib/storage'

/**
 * Перерозбір оголошень з уже збереженого HTML — без жодного запиту до RIA.
 *
 * Навіщо: парсер помилявся і тягнув у галерею фото з блоку «інші пропозиції
 * продавця» (на Honda Accord — 6 чужих машин із 44 знімків). Архів у нас
 * повний, тому виправлений парсер проганяється по `html_raw`, а чужі файли
 * прибираються зі сховища.
 *
 *   npm run reparse              — усі оголошення з архівом
 *   npm run reparse -- --dry     — тільки показати, нічого не змінювати
 *   npm run reparse -- --archive — ще й дозавантажити фото, яких бракує
 *   npm run reparse -- --fetch   — сходити на майданчик заново (єдиний спосіб
 *                                  розібрати картку, у якої архіву ще немає)
 *   npm run reparse -- 40318196  — одне оголошення за source_id
 */

const args = process.argv.slice(2)
const dryRun = args.includes('--dry')
const withArchive = args.includes('--archive')
const withFetch = args.includes('--fetch')
const only = args.filter((arg) => !arg.startsWith('--'))

type Report = {
  авто: string
  'фото було': number
  'фото стало': number
  чужих: number
  'файлів прибрано': number
  VIN: string
  номер: string
  'грн': string
}

/** Парсер архіву за джерелом. Нове джерело — новий рядок тут. */
function parseArchived(listing: Listing, html: string): ListingSnapshot | null {
  if (listing.source === 'autoria') return parseListingHtml(html)
  if (listing.source === 'olx') {
    return parseListingOlx(html, { url: listing.url, expectId: listing.sourceId })
  }
  return null
}

async function reparse(listing: Listing): Promise<Report | null> {
  if (!listing.htmlRaw) return null

  const html = gunzipSync(Buffer.from(listing.htmlRaw, 'base64')).toString('utf8')
  const snapshot = parseArchived(listing, html)
  if (!snapshot) {
    console.warn(`[reparse] ${listing.sourceId}: для джерела «${listing.source}» парсера немає`)
    return null
  }

  const money = await bothPrices(snapshot)
  const photos = snapshot.photos ?? []
  if (photos.length === 0) {
    console.warn(`[reparse] ${listing.sourceId}: у HTML не знайшлось жодного фото — пропускаю`)
    return null
  }

  const files = storage()
  const kept = new Set(photos)
  const alien = listing.photos.filter((url) => !kept.has(url))

  // Ключі рахуються з (url, індекс) — тому для чужих фото беремо старий індекс,
  // а для своїх новий: після викидання чужих порядок міг зсунутись.
  const saved = new Set(listing.photosLocal)
  const photosLocal: string[] = []
  let removed = 0

  if (!dryRun) {
    for (const [index, url] of photos.entries()) {
      const oldIndex = listing.photos.indexOf(url)
      const oldKey = oldIndex >= 0 ? photoKey(listing, url, oldIndex) : null
      const newKey = photoKey(listing, url, index)

      if (oldKey && saved.has(oldKey)) {
        if (oldKey !== newKey) {
          // Файл на місці, змінився лише номер у назві — переносимо, не качаємо.
          const body = await files.get(oldKey)
          if (body) {
            await files.put(newKey, body, 'image/webp')
            await files.remove(oldKey)
          }
        }
        photosLocal.push(newKey)
        saved.delete(oldKey)
      }
    }

    // Усе, що лишилось у saved, — фото, якого в оголошенні більше немає.
    for (const key of saved) {
      await files.remove(key)
      removed += 1
    }
  }

  const report: Report = {
    авто: `${listing.title ?? listing.sourceId}`,
    'фото було': listing.photos.length,
    'фото стало': photos.length,
    чужих: alien.length,
    'файлів прибрано': removed,
    VIN: snapshot.vin ?? '—',
    номер: snapshot.plateNumber ?? '—',
    'грн': money.priceUah ? money.priceUah.toLocaleString('uk-UA') : '—',
  }

  if (dryRun) return report

  await db
    .update(listings)
    .set(
      dropManual(listing, {
        title: snapshot.title ?? undefined,
        brand: snapshot.brand ?? undefined,
        model: snapshot.model ?? undefined,
        year: snapshot.year ?? undefined,
        mileageKm: snapshot.mileageKm ?? undefined,
        priceUsd: money.priceUsd ?? undefined,
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
        descriptionText: listing.descriptionText ?? snapshot.descriptionText ?? null,
        photos,
        photosLocal,
        snapshotRaw: snapshot.raw,
        // Архів знову неповний, якщо якогось фото ще немає у сховищі — cron добере.
        archivedAt: photosLocal.length >= photos.length ? (listing.archivedAt ?? new Date()) : null,
        parsedAt: new Date(),
        parserVersion: PARSER_VERSION,
      }),
    )
    .where(eq(listings.id, listing.id))

  return report
}

async function main(): Promise<void> {
  const rows = await db.select().from(listings)
  const targets = rows.filter(
    (row) =>
      (withFetch || row.htmlRaw) && (only.length === 0 || only.includes(row.sourceId)),
  )

  if (targets.length === 0) {
    console.log('Нічого перерозбирати: жодного оголошення зі збереженим HTML.')
    return
  }

  // Сходити на майданчик — єдиний шлях для картки, яку ще жодного разу не
  // розібрали: архіву в неї немає, перерозбирати нічого.
  if (withFetch && !dryRun) {
    for (const listing of targets) {
      console.log(`[fetch] ${listing.sourceId} — йду на ${listing.source}…`)
      await parseListing(listing.id)
    }
  }

  console.log(
    `${dryRun ? 'Пробний прогін' : 'Перерозбір'}: ${targets.length} оголошень зі збереженого HTML\n`,
  )

  const fresh = withFetch ? await db.select().from(listings) : rows
  const reports: Report[] = []
  for (const listing of targets) {
    const current = fresh.find((row) => row.id === listing.id) ?? listing
    const report = await reparse(current)
    if (report) reports.push(report)
  }

  console.table(reports)
  if (dryRun) console.log('\n--dry: у базі і сховищі нічого не змінено.')

  // Після чистки фото частина архівів неповна — добираємо, як це робить cron.
  if (withArchive && !dryRun) {
    for (const listing of targets) {
      const [fresh] = await db.select().from(listings).where(eq(listings.id, listing.id)).limit(1)
      if (!fresh || fresh.photosLocal.length >= fresh.photos.length) continue

      const result = await archiveListing(fresh)
      console.log(
        `[архів] ${fresh.title ?? fresh.sourceId}: ${result.savedPhotos}/${result.totalPhotos} фото` +
          `${result.complete ? ', повний' : ''}`,
      )
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => client.end())
