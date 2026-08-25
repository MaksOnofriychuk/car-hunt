import * as cheerio from 'cheerio'

import { extractPhotos } from './photos'
import { extractSeller, type AutoRiaSeller } from './seller'
import type { ListingSnapshot } from '../types'

/**
 * Три шари, як вимагає SPEC. Кожен наступний лише **доповнює** порожні поля,
 * ніколи не затирає знайдене раніше:
 *
 *   1. <script type="application/ld+json"> — назва, марка, модель, рік, пробіг,
 *      ціна, повний опис продавця, місто (з BreadcrumbList), VIN, паливо,
 *      коробка, колір
 *   2. window.__PINIA__ — стан сторінки; звідти дата публікації
 *      («Оголошення створене DD.MM.YYYY») і продавець (імʼя, id, тип)
 *   3. cheerio по DOM — останній рубіж, якщо перші два шари щось не дали
 */

type Draft = Omit<ListingSnapshot, 'raw' | 'html'>

const EMPTY: Draft = {}

function fillGaps(target: Draft, extra: Draft): Draft {
  const merged: Draft = { ...target }
  for (const [key, value] of Object.entries(extra) as [keyof Draft, unknown][]) {
    const current = merged[key]
    const missing =
      current === undefined ||
      current === null ||
      (Array.isArray(current) && current.length === 0)
    if (missing && value !== undefined && value !== null) {
      Object.assign(merged, { [key]: value })
    }
  }
  return merged
}

/* ------------------------------- шар 1: ld+json ------------------------------ */

type JsonRecord = Record<string, unknown>

function ldJsonBlocks(html: string): JsonRecord[] {
  const blocks: JsonRecord[] = []
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  for (const match of html.matchAll(pattern)) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim())
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (item && typeof item === 'object') blocks.push(item as JsonRecord)
      }
    } catch {
      // Один зіпсований блок не має валити решту.
    }
  }
  return blocks
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const digits = value.replace(/[^\d.]/g, '')
    const parsed = Number.parseFloat(digits)
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return null
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nested(source: unknown, key: string): unknown {
  return source && typeof source === 'object' ? (source as JsonRecord)[key] : undefined
}

/**
 * У ld+json назва вже містить рік («Audi A6 2015»), а картка показує рік
 * окремим елементом моноширинним. Прибираємо дубль.
 */
function stripYear(name: string | null, year: number | null): string | null {
  if (!name || !year) return name
  return name.replace(new RegExp(`\\s+${year}\\s*$`), '').trim() || name
}

function fromLdJson(blocks: JsonRecord[]): Draft {
  let draft: Draft = { ...EMPTY }

  const vehicle = blocks.find((block) => block['@type'] === 'Vehicle' && 'name' in block)
  if (vehicle) {
    const offers = vehicle.offers
    const price = nested(offers, 'priceCurrency') === 'USD' ? asNumber(nested(offers, 'price')) : null

    const year = asNumber(vehicle.productionDate)

    draft = fillGaps(draft, {
      title: stripYear(typeof vehicle.name === 'string' ? vehicle.name : null, year),
      brand: typeof nested(vehicle.brand, 'name') === 'string' ? String(nested(vehicle.brand, 'name')) : null,
      model: typeof vehicle.model === 'string' ? vehicle.model : null,
      year,
      mileageKm: asNumber(nested(vehicle.mileageFromOdometer, 'value')),
      priceUsd: price,
      descriptionText: typeof vehicle.description === 'string' ? vehicle.description.trim() : null,
      vin: asText(vehicle.vehicleIdentificationNumber),
      fuelType: asText(vehicle.fuelType) ?? asText(nested(vehicle.vehicleEngine, 'fuelType')),
      transmission: asText(vehicle.vehicleTransmission),
      color: asText(vehicle.color),
    })
  }

  // Місто живе в хлібних крихтах: /uk/legkovie/city/chernovczy/ → «Чернівці»
  const breadcrumbs = blocks.find((block) => block['@type'] === 'BreadcrumbList')
  const items = Array.isArray(breadcrumbs?.itemListElement) ? breadcrumbs.itemListElement : []
  for (const entry of items) {
    const item = nested(entry, 'item')
    const id = nested(item, '@id')
    const name = nested(item, 'name')
    if (typeof id === 'string' && /\/city\/[^/]+\/?$/.test(id) && typeof name === 'string') {
      draft = fillGaps(draft, { city: name })
    }
  }

  return draft
}

/* ------------------------------ шар 2: __PINIA__ ----------------------------- */

export function piniaState(html: string): unknown {
  const match = html.match(/window\.__PINIA__\s*=\s*([\s\S]*?);?\s*<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

/** Усі текстові вузли SDUI — там лежить те, чого немає в структурованих полях. */
function sduiTexts(state: unknown): string[] {
  const texts: string[] = []
  const seen = new Set<unknown>()

  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 40 || seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }

    const record = node as JsonRecord
    if (record.type === 'Text' && typeof record.content === 'string') texts.push(record.content)
    for (const value of Object.values(record)) walk(value, depth + 1)
  }

  walk(state, 0)
  return texts
}

/** «Оголошення створене 09.08.2026» → Date. Опівдні, щоб не зʼїхати на добу. */
function parseCreatedAt(texts: string[]): Date | null {
  for (const text of texts) {
    const match = text.match(/створене\s+(\d{2})\.(\d{2})\.(\d{4})/i)
    if (!match) continue
    const [, day, month, year] = match
    const date = new Date(`${year}-${month}-${day}T12:00:00+03:00`)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

function fromPinia(state: unknown, seller: AutoRiaSeller): Draft {
  if (!state) return { ...EMPTY }
  const texts = sduiTexts(state)
  return fillGaps(
    { ...EMPTY },
    {
      publishedAt: parseCreatedAt(texts),
      sellerName: seller.name,
      sellerSourceId: seller.userId,
      sellerType: seller.type,
    },
  )
}

/* -------------------------------- шар 3: DOM --------------------------------- */

function fromDom(html: string): Draft {
  const $ = cheerio.load(html)
  const text = (selector: string) => $(selector).first().text().trim() || null

  const priceRaw = text('[data-currency="USD"]') ?? text('.price_value strong')
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() ?? null

  return {
    title: text('h1.head') ?? text('h1') ?? ogTitle,
    priceUsd: priceRaw ? asNumber(priceRaw) : null,
    city: text('#userInfoBlock .item_inner') ?? null,
    descriptionText: $('meta[name="description"]').attr('content')?.trim() ?? null,
  }
}

/* --------------------------------- збірка ------------------------------------ */

export function parseListingHtml(html: string): ListingSnapshot {
  const blocks = ldJsonBlocks(html)
  const state = piniaState(html)
  const seller = extractSeller(state)

  let draft = fromLdJson(blocks)
  draft = fillGaps(draft, fromPinia(state, seller))
  draft = fillGaps(draft, { photos: extractPhotos(html) })

  // Шар 3 вмикаємо тільки якщо перші два лишили дірки — cheerio недешевий.
  const stillMissing = !draft.title || !draft.priceUsd || !draft.city || !draft.descriptionText
  if (stillMissing) draft = fillGaps(draft, fromDom(html))

  return {
    ...draft,
    // Розібрані поля як є: sourceRaw для listings.snapshot_raw.
    // `seller` кладемо цілком: номера телефону на сторінці немає, але userId
    // і маска знадобляться на кроці «Продавці, склейка по телефону».
    raw: { parser: 'html', ldJson: blocks, seller, fields: draft },
    html,
  }
}
