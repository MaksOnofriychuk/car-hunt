import './load-env'

import { gunzipSync } from 'node:zlib'

import { eq } from 'drizzle-orm'

import { client, db } from '../src/db'
import { listings, type Listing } from '../src/db/schema'
import { archiveListing, photoKey } from '../src/lib/archive'
import { PARSER_VERSION } from '../src/lib/ingest'
import { parseListingHtml } from '../src/lib/sources/autoria/parse'
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
 *   npm run reparse -- 40318196  — одне оголошення за source_id
 */

const args = process.argv.slice(2)
const dryRun = args.includes('--dry')
const withArchive = args.includes('--archive')
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

async function reparse(listing: Listing): Promise<Report | null> {
  if (!listing.htmlRaw) return null

  const html = gunzipSync(Buffer.from(listing.htmlRaw, 'base64')).toString('utf8')
  const snapshot = parseListingHtml(html)
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
    'грн': snapshot.priceUah ? snapshot.priceUah.toLocaleString('uk-UA') : '—',
  }

  if (dryRun) return report

  await db
    .update(listings)
    .set({
      title: snapshot.title ?? listing.title,
      brand: snapshot.brand ?? listing.brand,
      model: snapshot.model ?? listing.model,
      year: snapshot.year ?? listing.year,
      mileageKm: snapshot.mileageKm ?? listing.mileageKm,
      priceUsd: snapshot.priceUsd ?? listing.priceUsd,
      city: snapshot.city ?? listing.city,
      vin: snapshot.vin ?? listing.vin,
      fuelType: snapshot.fuelType ?? listing.fuelType,
      transmission: snapshot.transmission ?? listing.transmission,
      color: snapshot.color ?? listing.color,
      engineVolume: snapshot.engineVolume ?? listing.engineVolume,
      driveType: snapshot.driveType ?? listing.driveType,
      bodyType: snapshot.bodyType ?? listing.bodyType,
      plateNumber: snapshot.plateNumber ?? listing.plateNumber,
      priceUah: snapshot.priceUah ?? listing.priceUah,
      publishedAt: snapshot.publishedAt ?? listing.publishedAt,
      descriptionText: listing.descriptionText ?? snapshot.descriptionText ?? null,
      photos,
      photosLocal,
      snapshotRaw: snapshot.raw,
      // Архів знову неповний, якщо якогось фото ще немає у сховищі — cron добере.
      archivedAt: photosLocal.length >= photos.length ? (listing.archivedAt ?? new Date()) : null,
      parsedAt: new Date(),
      parserVersion: PARSER_VERSION,
    })
    .where(eq(listings.id, listing.id))

  return report
}

async function main(): Promise<void> {
  const rows = await db.select().from(listings)
  const targets = rows.filter(
    (row) => row.htmlRaw && (only.length === 0 || only.includes(row.sourceId)),
  )

  if (targets.length === 0) {
    console.log('Нічого перерозбирати: жодного оголошення зі збереженим HTML.')
    return
  }


  console.log(
    `${dryRun ? 'Пробний прогін' : 'Перерозбір'}: ${targets.length} оголошень зі збереженого HTML\n`,
  )

  const reports: Report[] = []
  for (const listing of targets) {
    const report = await reparse(listing)
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
