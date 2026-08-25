import { createHash } from 'node:crypto'

import {
  BRANDS,
  CITIES,
  DRIVE_TYPES,
  FUEL_TYPES,
  JUNK_LINE,
  JUNK_LINK,
  normalizeWord,
} from './post-dictionaries'

import { normalizePhone } from '@/lib/phone'

/**
 * Розбір тексту поста — чиста функція, без бази й мережі (SPEC, «Пост без
 * посилання»).
 *
 * Головне правило: **що не розпізналось — лишається порожнім**. Ніяких «схоже
 * на Passat B7, отже 2015 рік»: порожня колонка чесна, вигадана — ні, за нею
 * поїдуть на огляд. Тому в колонки йде тільки те, що впізнається однозначно:
 * посилання, VIN, телефон, ціна **зі знаком валюти**, рік, пробіг, привід,
 * паливо і збіг зі словником марок або міст.
 *
 * Ненадійне (колір, кузов, коробка, потужність, комплектація, ціна без валюти)
 * лишається в `parsed` і на картку колонками не потрапляє.
 */

export type PostPrice = { amount: number; currency: 'USD' | 'UAH' }

export type ParsedPost = {
  title: string | null
  brand: string | null
  model: string | null
  year: number | null
  mileageKm: number | null
  city: string | null
  driveType: string | null
  fuelType: string | null
  engineVolume: number | null
  vin: string | null
  /** Ціна продавця — та, за яку він готовий віддати. */
  price: PostPrice | null
  /** Ціна в дужках («ріа 9799$»): лише звірка з оголошенням, у колонки не йде. */
  referencePrice: PostPrice | null
  phones: string[]
  username: string | null
  links: string[]
  /** Потужність та інше ненадійне — довідково, колонки для цього немає. */
  power: string | null
  /** Рядки, які нічого не дали, — вони і є опис. */
  descriptionText: string | null
}

const CURRENT_YEAR = new Date().getUTCFullYear()

const URL_RE = /https?:\/\/[^\s<>"']+/gi
const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/gi
const USERNAME_RE = /(?:^|[\s(])@([A-Za-z][\w]{3,31})\b/
const PHONE_RE = /(?:\+?38)?[\s(]*0\d{2}[)\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/g
const EMOJI_RE = /[\p{Extended_Pictographic}️⃣]/gu

/** Ціна: число зі знаком валюти. Без знака не беремо — SPEC вважає це ненадійним. */
const USD_RE = /(\d[\d\s.,]{2,})\s*(?:\$|usd|дол)|[$]\s*(\d[\d\s.,]{2,})/i
const UAH_RE = /(\d[\d\s.,]{3,})\s*(?:грн|₴|uah)/i

export function parsePostText(raw: string): ParsedPost {
  const text = raw.replace(/\r/g, '')
  const lines = text.split('\n').map((line) => line.trim())

  const links = uniq(text.match(URL_RE) ?? []).map(trimTail)
  const used = new Set<number>()

  const result: ParsedPost = {
    title: null,
    brand: null,
    model: null,
    year: null,
    mileageKm: null,
    city: null,
    driveType: null,
    fuelType: null,
    engineVolume: null,
    vin: null,
    price: null,
    referencePrice: null,
    phones: [],
    username: null,
    links,
    power: null,
    descriptionText: null,
  }

  lines.forEach((line, index) => {
    const clean = line.replace(EMOJI_RE, '').trim()
    if (!clean) {
      used.add(index)
      return
    }
    // Сміття не розбираємо, але й у опис не тягнемо.
    if (JUNK_LINE.test(clean)) {
      used.add(index)
      return
    }

    // Рядок, який складається з посилання, свою роль уже відіграв.
    if (URL_RE.test(clean) && clean.replace(URL_RE, '').trim().length < 3) {
      used.add(index)
      URL_RE.lastIndex = 0
      return
    }
    URL_RE.lastIndex = 0

    const vin = firstVin(clean)
    if (vin && !result.vin) {
      result.vin = vin
      used.add(index)
      return
    }

    const phones = phonesIn(clean)
    if (phones.length > 0) {
      result.phones = uniq([...result.phones, ...phones])
      used.add(index)
      if (clean.replace(PHONE_RE, '').replace(EMOJI_RE, '').trim().length < 3) return
      PHONE_RE.lastIndex = 0
    }

    const username = clean.match(USERNAME_RE)
    if (username && !result.username) {
      result.username = `@${username[1]}`
      used.add(index)
      return
    }

    const price = priceIn(clean)
    if (price && !result.price) {
      result.price = price.price
      result.referencePrice = price.reference
      used.add(index)
      return
    }

    const year = yearIn(clean)
    if (year && !result.year) {
      result.year = year
      used.add(index)
      return
    }

    const mileage = mileageIn(clean)
    if (mileage && !result.mileageKm) {
      result.mileageKm = mileage
      used.add(index)
      return
    }

    const engine = engineIn(clean)
    if (engine && !result.fuelType) {
      result.engineVolume = result.engineVolume ?? engine.volume
      result.fuelType = engine.fuel
      result.power = result.power ?? engine.power
      used.add(index)
      return
    }

    const drive = dictionaryHit(clean, DRIVE_TYPES)
    if (drive && !result.driveType) {
      result.driveType = drive
      used.add(index)
      return
    }

    const city = dictionaryHit(clean, CITIES)
    if (city && !result.city) {
      result.city = city
      used.add(index)
      return
    }

    // Перший змістовний рядок — назва. Марку беремо лише за словником.
    if (!result.title && /\p{L}/u.test(clean)) {
      result.title = clean
      const brand = brandIn(clean)
      if (brand) {
        result.brand = brand.brand
        result.model = brand.model
      }
      used.add(index)
    }
  })

  const rest = lines
    .filter((line, index) => !used.has(index) && line.length > 0)
    .join('\n')
    .trim()
  result.descriptionText = rest.length > 0 ? rest : null

  return result
}

/**
 * Чи схоже це повідомлення на пост із групи, а не на просто кинуте посилання.
 * Від цього залежить, чи заводити рядок у `telegram_posts`: у постів є те, чого
 * в оголошенні немає — телефон, реальна ціна, VIN, контакт продавця.
 */
export function looksLikePost(text: string): boolean {
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length < 2) return false

  const parsed = parsePostText(text)
  return Boolean(parsed.price || parsed.phones.length > 0 || parsed.vin || parsed.username)
}

/**
 * Відбиток тексту. Потрібен для одного випадку: пересилач сховав джерело, і
 * `chat_id` доводиться брати з нашого ж чату — тоді той самий пост упізнається
 * саме за текстом.
 */
export function textHashOf(text: string): string | null {
  const normalized = text
    .split('\n')
    // Підпис каналу й реклама в пересланому пості часто інші — по них не можна
    // впізнавати той самий пост.
    .filter((line) => !JUNK_LINE.test(line))
    .join(' ')
    .replace(EMOJI_RE, '')
    .replace(URL_RE, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length < 24) return null
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32)
}

/**
 * VIN із поста. Свідомо **без перевірки контрольного розряду**: це
 * північноамериканський стандарт, і європейські номери (WVWZZZ…, VF3…) його
 * зазвичай не проходять — сувора перевірка викидала б справжні VIN. Маску RIA
 * (`1HGCR2650EA7XXXXX`) відсікаємо окремо.
 */
export function isFullVin(value: string | null | undefined): boolean {
  if (!value) return false
  const vin = value.toUpperCase()
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false
  if (/X{3,}/.test(vin)) return false
  if (/\*/.test(vin)) return false
  return /\d/.test(vin) && /[A-Z]/.test(vin)
}

/* --------------------------------- деталі --------------------------------- */

function uniq(values: string[]): string[] {
  return [...new Set(values)]
}

function trimTail(url: string): string {
  return url.replace(/[.,;:!?)\]}»"'>]+$/, '')
}

function firstVin(line: string): string | null {
  const matches = line.toUpperCase().match(VIN_RE) ?? []
  for (const candidate of matches) {
    if (isFullVin(candidate)) return candidate
  }
  return null
}

function phonesIn(line: string): string[] {
  const found = line.match(PHONE_RE) ?? []
  return found
    .map((raw) => normalizePhone(raw))
    .filter((phone): phone is string => phone !== null)
}

function toAmount(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = Number(digits)
  return Number.isFinite(value) && value > 0 ? value : null
}

function priceOf(text: string): PostPrice | null {
  const usd = text.match(USD_RE)
  if (usd) {
    const amount = toAmount(usd[1] ?? usd[2] ?? '')
    if (amount && amount >= 100 && amount <= 500_000) return { amount, currency: 'USD' }
  }

  const uah = text.match(UAH_RE)
  if (uah) {
    const amount = toAmount(uah[1])
    if (amount && amount >= 10_000) return { amount, currency: 'UAH' }
  }

  return null
}

/** «💰9500$ (ріа 9799$)» — перше число наше, у дужках лише довідка. */
function priceIn(line: string): { price: PostPrice; reference: PostPrice | null } | null {
  const bracket = line.match(/\(([^)]*)\)/)
  const outside = bracket ? line.replace(bracket[0], ' ') : line

  const price = priceOf(outside)
  if (!price) return null

  return { price, reference: bracket ? priceOf(bracket[1]) : null }
}

function yearIn(line: string): number | null {
  // Не `\b`: у JS це межа слова за [A-Za-z0-9_], і після кирилиці її просто
  // немає — «2015 р.» не збігалося б узагалі. Тому межу пишемо явно.
  const clean = line.replace(/(?<![а-яіїєґa-z])(рік|року|год|р|г)(?![а-яіїєґa-z])\.?/giu, '').trim()
  if (!/^\d{4}$/.test(clean)) return null

  const year = Number(clean)
  return year >= 1980 && year <= CURRENT_YEAR + 1 ? year : null
}

function mileageIn(line: string): number | null {
  // Знову без `\b`: після «км» межі слова не існує (кирилиця не \w), і вираз
  // не збігався б ні з «245 тис км», ні з «186000 км».
  const match = line.match(/(\d[\d\s.,]*)\s*(тис\.?|тыс\.?|k)?\s*(км|km)(?![а-яіїєґa-z])/iu)
  if (!match) return null

  const base = toAmount(match[1])
  if (!base) return null

  const value = match[2] ? base * 1000 : base
  return value >= 100 && value <= 3_000_000 ? value : null
}

function engineIn(line: string): { volume: number | null; fuel: string; power: string | null } | null {
  const fuel = dictionaryHit(line, FUEL_TYPES)
  if (!fuel) return null

  const volume = line.match(/(\d[.,]\d)\s*(?:л|l|\b)/i)
  const power = line.match(/(\d{2,4})\s*(?:к\.?\s?с|л\.?\s?с|hp)/i)

  return {
    volume: volume ? Number(volume[1].replace(',', '.')) : null,
    fuel,
    power: power ? `${power[1]} к.с.` : null,
  }
}

/** Збіг зі словником по цілому слову — «Києві» не має ставати «Київ». */
function dictionaryHit(line: string, dictionary: Record<string, string>): string | null {
  const normalized = normalizeWord(line.replace(EMOJI_RE, ''))
  if (dictionary[normalized]) return dictionary[normalized]

  for (const [key, value] of Object.entries(dictionary)) {
    const pattern = new RegExp(`(^|[\\s,./|(])${escapeRe(key)}($|[\\s,./|)])`, 'i')
    if (pattern.test(normalized)) return value
  }
  return null
}

function brandIn(title: string): { brand: string; model: string | null } | null {
  const normalized = normalizeWord(title.replace(EMOJI_RE, ''))

  // Спершу довші ключі: «land rover» має вигравати в «ленд».
  const keys = Object.keys(BRANDS).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    const pattern = new RegExp(`(^|[\\s,.])${escapeRe(key)}($|[\\s,.])`, 'i')
    if (!pattern.test(normalized)) continue

    const rest = normalized.replace(pattern, ' ').replace(/\s+/g, ' ').trim()
    return { brand: BRANDS[key], model: rest.length > 0 ? titleCase(rest) : null }
  }
  return null
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word.toUpperCase()))
    .join(' ')
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Посилання, за яким має сенс створювати картку: не t.me, не реферальне. */
export function isCarLink(url: string): boolean {
  return !JUNK_LINK.test(url)
}
