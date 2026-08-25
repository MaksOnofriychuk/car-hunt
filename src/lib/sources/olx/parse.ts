import * as cheerio from 'cheerio'

import { extractParams, type SpecPair } from './params'
import { extractPhotos } from './photos'
import { adFromState, prerenderedState, type JsonRecord } from './state'
import { extractOlxId } from './url'
import { fillGaps, type Draft } from '../draft'
import { ListingGoneError, type ListingSnapshot } from '../types'

/**
 * Розбір сторінки OLX. Три шари, як і в AUTO.RIA — наступний лише доповнює
 * порожнє, ніколи не затирає знайдене раніше:
 *
 *   1. `window.__PRERENDERED_STATE__` → `ad.ad` — стан застосунку. Там усе:
 *      назва, опис, ціна з валютою, список характеристик, фото, продавець
 *      і точний час публікації (на сторінці він показаний відносно —
 *      «Сьогодні о 14:32», — але в стані лежить повний ISO);
 *   2. `<script type="application/ld+json">` — марка, модель, рік, колір, ціна;
 *   3. cheerio по DOM — останній рубіж, коли перших двох шарів немає.
 */

const EMPTY: Draft = {}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return null
}

/* ------------------------------- шар 1: стан -------------------------------- */

/** Оголошення зняте або продане — сторінка ще є, але авто вже немає. */
export function adIsActive(ad: JsonRecord | null): boolean {
  if (!ad) return true
  if (ad.isActive === false) return false
  const status = text(ad.status)
  return !status || status === 'active'
}

/** Ціна в стані одна, але з валютою: у OLX це здебільшого гривня. */
function price(ad: JsonRecord | null): {
  priceUsd: number | null
  priceUah: number | null
  priceCurrency: 'UAH' | 'USD' | undefined
} {
  const regular = record(record(ad?.price)?.regularPrice)
  const value = number(regular?.value)
  const currency = text(regular?.currencyCode)?.toUpperCase()

  if (value === null) return { priceUsd: null, priceUah: null, priceCurrency: undefined }
  if (currency === 'USD') return { priceUsd: value, priceUah: null, priceCurrency: 'USD' }
  if (currency === 'UAH') return { priceUsd: null, priceUah: value, priceCurrency: 'UAH' }

  return { priceUsd: null, priceUah: null, priceCurrency: undefined }
}

function publishedAt(ad: JsonRecord | null): Date | null {
  const raw = text(ad?.createdTime)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** «Київська область, Біла Церква» — місто окремо, область у specs. */
function city(ad: JsonRecord | null): string | null {
  return text(record(ad?.location)?.cityName)
}

function fromAd(ad: JsonRecord | null, params: ReturnType<typeof extractParams>): Draft {
  if (!ad) return { ...EMPTY }

  const user = record(ad.user)
  const money = price(ad)

  return {
    title: text(ad.title),
    model: params.model,
    year: params.year,
    mileageKm: params.mileageKm,
    city: city(ad),
    publishedAt: publishedAt(ad),
    descriptionText: text(ad.description),
    fuelType: params.fuelType,
    transmission: params.transmission,
    driveType: params.driveType,
    bodyType: params.bodyType,
    color: params.color,
    engineVolume: params.engineVolume,
    vin: params.vin,
    sellerName: text(user?.name),
    sellerSourceId: user?.id != null ? String(user.id) : null,
    // OLX сам ділить продавців на приватних і бізнес; тип «перекуп» тут не видно.
    sellerType: ad.isBusiness === true ? 'showroom' : 'owner',
    ...money,
  }
}

/* ------------------------------ шар 2: ld+json ------------------------------ */

function ldJsonBlocks(html: string): JsonRecord[] {
  const blocks: JsonRecord[] = []
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  for (const match of html.matchAll(pattern)) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim())
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        const block = record(item)
        if (block) blocks.push(block)
      }
    } catch {
      // Один зіпсований блок не має валити решту.
    }
  }
  return blocks
}

function fromLdJson(blocks: JsonRecord[]): Draft {
  const vehicle = blocks.find((block) => block['@type'] === 'Vehicle') ?? blocks[0]
  if (!vehicle) return { ...EMPTY }

  const offers = record(vehicle.offers)
  const currency = text(offers?.priceCurrency)?.toUpperCase()
  const value = number(offers?.price)

  return {
    title: text(vehicle.name),
    brand: text(vehicle.brand) ?? text(record(vehicle.brand)?.name),
    model: text(vehicle.model),
    year: number(vehicle.productionDate),
    color: text(vehicle.color),
    descriptionText: text(vehicle.description),
    priceUsd: currency === 'USD' ? value : null,
    priceUah: currency === 'UAH' ? value : null,
    priceCurrency: currency === 'USD' || currency === 'UAH' ? currency : undefined,
  }
}

/* -------------------------------- шар 3: DOM -------------------------------- */

function fromDom(html: string): Draft {
  const $ = cheerio.load(html)
  const meta = (name: string) =>
    $(`meta[property="${name}"]`).attr('content')?.trim() ||
    $(`meta[name="${name}"]`).attr('content')?.trim() ||
    null

  return {
    title: meta('og:title') ?? ($('h4').first().text().trim() || null),
    descriptionText: meta('description'),
    photos: meta('og:image') ? [meta('og:image') as string] : [],
  }
}

/* --------------------------------- збірка ----------------------------------- */

export function parseListingOlx(
  html: string,
  options: { url: string; expectId?: string },
): ListingSnapshot {
  const { url, expectId } = options
  const state = prerenderedState(html)
  const ad = adFromState(state)

  // Оголошення зняте: далі нічого не чіпаємо, картка лишається з тим, що вже є.
  if (!adIsActive(ad)) throw new ListingGoneError('olx', url)

  // OLX редіректить будь-який слаг на канонічну адресу, тож перевіряємо, що
  // приїхало саме те оголошення: інакше в картку лягло б чуже авто.
  const canonical = text(ad?.url)
  if (expectId && canonical) {
    const id = extractOlxId(canonical)
    if (id && id !== expectId) throw new ListingGoneError('olx', url)
  }

  const params = extractParams(ad?.params)
  const blocks = ldJsonBlocks(html)

  let draft = fromAd(ad, params)
  draft = fillGaps(draft, fromLdJson(blocks))
  draft = fillGaps(draft, {
    photos: extractPhotos(ad, blocks.find((block) => Array.isArray(block.image))?.image),
  })

  const stillMissing = !draft.title || !draft.descriptionText || !draft.photos?.length
  if (stillMissing) draft = fillGaps(draft, fromDom(html))

  return {
    ...draft,
    // `ad` кладемо цілком (це лише ~10 КБ), але без решти стану: там довідник
    // категорій на 900 КБ, який до оголошення не стосується.
    raw: { parser: 'olx', ad, ldJson: blocks, specs: specsFor(ad, params.pairs), fields: draft },
    html,
  }
}

/**
 * Те, під що колонок немає: решта характеристик, область і позначки оголошення.
 * Формат — той самий, що читає `src/lib/specs.ts`, тому картка показує це
 * наявним блоком «Ще з оголошення».
 */
function specsFor(ad: JsonRecord | null, pairs: SpecPair[]) {
  const location = record(ad?.location)
  const money = record(record(ad?.price)?.regularPrice)

  const badges: string[] = []
  if (ad?.isBusiness === true) badges.push('Бізнес-продавець')
  if (money?.negotiable === true) badges.push('Торг')
  if (record(ad?.price)?.exchange === true) badges.push('Обмін')

  return {
    geo: [text(location?.regionName), text(location?.cityName)].filter(Boolean).join(', ') || null,
    pairs,
    badges,
  }
}
