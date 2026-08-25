/**
 * Характеристики з `snapshot_raw.specs` — те, що показуємо на картці, але під
 * що не заводимо колонок: комплектація, стан, безпека, бейджі, держреєстр.
 * Читаємо обережно: у базі лежить довільний JSON, а рядки бувають старі.
 */

export type SpecPair = { label: string; value: string }

export type ListingSpecs = {
  power: string | null
  generation: string | null
  equipment: string | null
  doors: number | null
  seats: number | null
  geo: string | null
  /** Блок характеристик як на сторінці: «Коробка передач → Автомат». */
  pairs: SpecPair[]
  badges: string[]
  /** Перевірка за держреєстрами: власники, розшук, остання операція. */
  checks: string[]
  views: number | null
  favorites: number | null
  sellerRating: number | null
  sellerReviews: number | null
  sellerSince: string | null
  sellerOtherCars: number | null
}

const EMPTY: ListingSpecs = {
  power: null,
  generation: null,
  equipment: null,
  doors: null,
  seats: null,
  geo: null,
  pairs: [],
  badges: [],
  checks: [],
  views: null,
  favorites: null,
  sellerRating: null,
  sellerReviews: null,
  sellerSince: null,
  sellerOtherCars: null,
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(str).filter((item): item is string => item !== null)
}

function pairs(value: unknown): SpecPair[] {
  if (!Array.isArray(value)) return []
  const out: SpecPair[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const label = str(record.label)
    const pairValue = str(record.value)
    if (label && pairValue) out.push({ label, value: pairValue })
  }
  return out
}

export function listingSpecs(snapshotRaw: unknown): ListingSpecs {
  if (!snapshotRaw || typeof snapshotRaw !== 'object') return EMPTY
  const specs = (snapshotRaw as Record<string, unknown>).specs
  if (!specs || typeof specs !== 'object') return EMPTY

  const record = specs as Record<string, unknown>
  return {
    power: str(record.power),
    generation: str(record.generation),
    equipment: str(record.equipment),
    doors: num(record.doors),
    seats: num(record.seats),
    geo: str(record.geo),
    pairs: pairs(record.pairs),
    badges: strings(record.badges),
    checks: strings(record.checks),
    views: num(record.views),
    favorites: num(record.favorites),
    sellerRating: num(record.sellerRating),
    sellerReviews: num(record.sellerReviews),
    sellerSince: str(record.sellerSince),
    sellerOtherCars: num(record.sellerOtherCars),
  }
}
