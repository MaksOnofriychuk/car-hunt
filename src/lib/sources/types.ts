import type { SellerType, SourceName } from '@/db/schema'

export type { SellerType, SourceName }

/** Звідки оголошення і який у нього ідентифікатор усередині джерела. */
export type ListingRef = {
  source: SourceName
  id: string
}

/**
 * Що джерело витягло з оголошення. Поля мапляться на колонки listings;
 * усе опційне, бо різні майданчики дають різний набір.
 */
export type ListingSnapshot = {
  title?: string | null
  brand?: string | null
  model?: string | null
  year?: number | null
  mileageKm?: number | null
  priceUsd?: number | null
  city?: string | null
  publishedAt?: Date | null
  vin?: string | null
  fuelType?: string | null
  transmission?: string | null
  color?: string | null
  /** Обʼєм двигуна в літрах: 2.36. */
  engineVolume?: number | null
  driveType?: string | null
  bodyType?: string | null
  plateNumber?: string | null
  /** Ціна в гривні станом на парсинг — RIA показує обидві. */
  priceUah?: number | null
  photos?: string[]
  descriptionText?: string | null
  sellerName?: string | null
  sellerPhones?: string[]
  /** id продавця всередині джерела — основний ключ склейки продавців. */
  sellerSourceId?: string | null
  sellerType?: SellerType
  /** Сирий результат як є — лягає в snapshot_raw без обробки. */
  raw: unknown
  /** Повний HTML сторінки, якщо джерело його має. Стискається перед записом у html_raw. */
  html?: string | null
}

/**
 * Одне джерело оголошень. Додати новий майданчик = дописати один файл
 * і рядок у реєстрі (`src/lib/sources/index.ts`), більше нічого.
 */
export interface ListingSource {
  readonly name: SourceName

  /** Чи впізнає це джерело такий вхід. Перевірка за доменом, вхід може бути цілим текстом. */
  canHandle(input: string): boolean

  /** Витягти { source, id }. null означає «домен наче наш, але id не дістали». */
  extractRef(input: string): ListingRef | null

  /**
   * Чи має сенс перезавантажувати оголошення. Для telegram і manual — ні:
   * переслане повідомлення і заповнену руками картку оновлювати нізвідки.
   * Cron бере в роботу лише джерела з `true`.
   */
  readonly refreshable: boolean

  fetch(url: string, ref: ListingRef): Promise<ListingSnapshot>
}

/** Оголошення зникло з майданчика. Дані не чіпаємо, лише ставимо status: 'removed'. */
export class ListingGoneError extends Error {
  constructor(
    readonly source: SourceName,
    readonly url: string,
  ) {
    super(`Оголошення більше немає на ${source}: ${url}`)
    this.name = 'ListingGoneError'
  }
}

/** Джерело розпізнане, але читати оголошення воно ще не вміє. */
export class SourceNotReadyError extends Error {
  constructor(readonly source: SourceName) {
    super(`Джерело «${source}» поки не вміє читати оголошення — заповни картку вручну`)
    this.name = 'SourceNotReadyError'
  }
}

/** Хвостові розділові знаки, які прилипають до посилання в пересланому тексті. */
export function trimUrl(raw: string): string {
  return raw.replace(/[.,;:!?)\]}»"'>]+$/, '')
}

/** Перше посилання на вказаний домен десь усередині тексту. */
export function findUrl(input: string, hostPattern: string): URL | null {
  const match = input.match(new RegExp(`https?://(?:[\\w-]+\\.)*${hostPattern}/[^\\s<>"']*`, 'i'))
  if (!match) return null
  try {
    return new URL(trimUrl(match[0]))
  } catch {
    return null
  }
}
