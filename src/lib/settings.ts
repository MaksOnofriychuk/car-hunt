import type { SortField } from '@/lib/list-query'

/**
 * Робочі налаштування і сповіщення. На відміну від вигляду, ці живуть у базі на
 * користувача: «дзвонити через три дні» і «не писати мені вночі» — це про
 * людину, а не про пристрій, з якого вона зайшла.
 */

export const CURRENCIES = ['usd', 'uah', 'both'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_LABELS: Record<Currency, string> = {
  usd: 'Долар',
  uah: 'Гривня',
  both: 'Обидві',
}

/** Скільки днів до наступного контакту ставити після записаного дзвінка. */
export const FOLLOWUP_DAYS = [0, 3, 7, 14] as const

export const FOLLOWUP_LABELS: Record<number, string> = {
  0: 'Не ставити',
  3: 'Через 3 дні',
  7: 'Через тиждень',
  14: 'Через два тижні',
}

/** Сортування черги за замовчуванням — те, що діє, поки в URL нічого не обрано. */
export const DEFAULT_SORTS = ['contact', 'added', 'price', 'days'] as const
export type DefaultSort = (typeof DEFAULT_SORTS)[number]

export const SORT_LABELS: Record<DefaultSort, string> = {
  contact: 'За датою контакту',
  added: 'Спершу нові',
  price: 'За ціною',
  days: 'Хто довше висить',
}

export type Settings = {
  callFollowupDays: number
  /** Скільки днів в оголошенні вважати «довго висить» — від цього підсвічування. */
  longStandingDays: number
  currency: Currency
  defaultSort: DefaultSort
  notifyNew: boolean
  notifyComment: boolean
  notifyPrice: boolean
  notifyStage: boolean
  /** Оголошення зникло з майданчика — найчастіше це продаж. */
  notifyRemoved: boolean
  /** Час ранкового зведення, HH:MM за Києвом. */
  digestAt: string
  quietFrom: string
  quietTo: string
}

export const DEFAULT_SETTINGS: Settings = {
  callFollowupDays: 3,
  longStandingDays: 60,
  currency: 'usd',
  defaultSort: 'contact',
  notifyNew: true,
  notifyComment: true,
  notifyPrice: true,
  notifyStage: true,
  notifyRemoved: true,
  digestAt: '08:00',
  quietFrom: '22:00',
  quietTo: '08:00',
}

/** Сортування за замовчуванням у вигляді, зрозумілому списку. */
export function defaultSortField(settings: Settings): SortField {
  return settings.defaultSort
}

/** Чи типове воно — від цього залежить, показувати секції черги чи плоский список. */
export function isContactSort(settings: Settings): boolean {
  return settings.defaultSort === 'contact'
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isTime(value: string): boolean {
  return TIME.test(value)
}
