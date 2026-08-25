import type { JsonRecord } from './state'

/**
 * Характеристики оголошення OLX. На відміну від AUTO.RIA тут немає окремих
 * полів «рік» і «пробіг» — усе лежить одним списком `params`, де кожен запис
 * підписаний людською назвою і машинним ключем.
 *
 * Ключі, під які в нас є колонки, розкладаємо по полях; решту («Розмитнена»,
 * «Технічний стан», «Умови продажу») лишаємо парами для `snapshot_raw.specs` —
 * блок «Ще з оголошення» на картці покаже їх без жодних правок.
 */

export type SpecPair = { label: string; value: string }

export type OlxParams = {
  year: number | null
  mileageKm: number | null
  fuelType: string | null
  transmission: string | null
  driveType: string | null
  bodyType: string | null
  color: string | null
  model: string | null
  engineVolume: number | null
  vin: string | null
  pairs: SpecPair[]
}

const EMPTY: OlxParams = {
  year: null,
  mileageKm: null,
  fuelType: null,
  transmission: null,
  driveType: null,
  bodyType: null,
  color: null,
  model: null,
  engineVolume: null,
  vin: null,
  pairs: [],
}

/** Ключі OLX, які лягають у колонки `listings`. Решта йде в пари. */
const MAPPED = new Set([
  'motor_year',
  'motor_mileage_thou',
  'fuel_type',
  'transmission_type',
  'drive_type',
  'car_body',
  'color',
  'model',
  'motor_engine',
  'engine_capacity',
  'vin',
])

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function digits(value: unknown): number | null {
  const raw = typeof value === 'number' ? String(value) : text(value)
  if (!raw) return null
  const parsed = Number.parseFloat(raw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Пробіг приходить у тисячах. Якщо після множення виходить дичина — краще
 * порожньо, ніж «220 км» на семирічному авто або мільйони від зміни формату.
 */
function saneMileage(thousands: number | null): number | null {
  if (thousands === null) return null
  const km = Math.round(thousands * 1000)
  return km >= 100 && km <= 3_000_000 ? km : null
}

export function extractParams(raw: unknown): OlxParams {
  if (!Array.isArray(raw)) return { ...EMPTY }

  const byKey = new Map<string, JsonRecord>()
  const pairs: SpecPair[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const param = item as JsonRecord
    const key = text(param.key)
    if (!key) continue

    byKey.set(key, param)

    const label = text(param.name)
    const value = text(param.value)
    if (label && value && !MAPPED.has(key)) pairs.push({ label, value })
  }

  const value = (key: string): string | null => text(byKey.get(key)?.value)
  const normalized = (key: string): unknown => byKey.get(key)?.normalizedValue

  // «220 тис.км.» — пробіг у OLX завжди в тисячах, і в значенні, і в normalizedValue.
  const mileage = digits(normalized('motor_mileage_thou')) ?? digits(value('motor_mileage_thou'))

  return {
    year: digits(normalized('motor_year')) ?? digits(value('motor_year')),
    mileageKm: saneMileage(mileage),
    fuelType: value('fuel_type'),
    transmission: value('transmission_type'),
    driveType: value('drive_type'),
    bodyType: value('car_body'),
    color: value('color'),
    model: value('model'),
    engineVolume: digits(value('motor_engine')) ?? digits(value('engine_capacity')),
    vin: value('vin'),
    pairs,
  }
}
