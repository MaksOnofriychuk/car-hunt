import { autoRiaSource } from './autoria'
import { olxSource } from './olx'
import { telegramSource } from './telegram'
import type { ListingRef, ListingSource, SourceName } from './types'

export * from './types'
export * from './links'
export { autoRiaSource, extractAutoRiaId } from './autoria'
export { olxSource, extractOlxId } from './olx'
export {
  telegramSource,
  extractTelegramId,
  telegramRef,
  provisionalTelegramRef,
  parseTelegramId,
  isProvisionalTelegramId,
  telegramAliases,
} from './telegram'
// canonicalizeRef навмисно НЕ тут: він ходить у Bot API і має лишатись серверним.
// Імпортуй його прямо з '@/lib/sources/canonicalize'.

/**
 * Реєстр джерел. Порядок має значення: беремо першу реалізацію,
 * у якої canHandle() дав true. Нове джерело — новий рядок тут.
 */
export const SOURCES: readonly ListingSource[] = [autoRiaSource, olxSource, telegramSource]

/** Джерело, яке впізнало вхід. null — жодне, отже картка буде manual. */
export function resolveSource(input: string): ListingSource | null {
  return SOURCES.find((source) => source.canHandle(input)) ?? null
}

export function sourceFor(name: SourceName): ListingSource | null {
  return SOURCES.find((source) => source.name === name) ?? null
}

/**
 * Головна функція розпізнавання: визначає сайт за доменом і витягує ідентифікатор.
 * null означає «не наш домен» або «домен наш, але id не дістали» — обидва випадки
 * ведуть до ручної картки, посилання не губиться.
 */
export function extractListingRef(input: string): ListingRef | null {
  for (const source of SOURCES) {
    if (!source.canHandle(input)) continue
    const ref = source.extractRef(input)
    if (ref) return ref
  }
  return null
}

/** Ручна картка: id генеруємо самі, бо ззовні його взяти нізвідки. */
export function manualRef(): ListingRef {
  return { source: 'manual', id: crypto.randomUUID() }
}

/**
 * Рішення інгесту одним викликом: або розпізнане джерело, або ручна картка.
 * `recognized: false` → рядок створюється зі status 'failed' і збереженим url.
 */
export function refForInput(input: string): { ref: ListingRef; recognized: boolean } {
  const ref = extractListingRef(input)
  return ref ? { ref, recognized: true } : { ref: manualRef(), recognized: false }
}

/** Чи можна це джерело перезавантажувати. Cron питає саме так. */
export function isRefreshable(name: SourceName): boolean {
  return sourceFor(name)?.refreshable ?? false
}

/** Безпечний шматок ключа у сховищі: у telegram-id є двокрапка. */
export function storageKeyPrefix(ref: ListingRef): string {
  return `listings/${ref.source}/${ref.id.replace(/[^A-Za-z0-9._-]/g, '_')}`
}
