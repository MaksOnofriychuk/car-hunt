import { daysBetween } from './dates'

const NBSP = ' '

/** Українська множина: 1 день, 2 дні, 5 днів. */
export function plural(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export const days = (n: number) => plural(n, ['день', 'дні', 'днів'])
export const cars = (n: number) => plural(n, ['авто', 'авто', 'авто'])

/** Числа розділяємо нерозривним пробілом, щоб ціна не ламалась навпіл. */
function groupDigits(value: number): string {
  return Math.round(value).toLocaleString('uk-UA').replace(/\s/g, NBSP)
}

export function formatUsd(value: number | null | undefined): string {
  return value == null ? '—' : `$${groupDigits(value)}`
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : groupDigits(value)
}

export function formatKm(value: number | null | undefined): string {
  return value == null ? '—' : `${groupDigits(value)}${NBSP}км`
}

/** Давність події коротко: «сьогодні», «1 д», «12 д». */
export function shortAgo(daysAgo: number): string {
  if (daysAgo <= 0) return 'сьогодні'
  return `${daysAgo}${NBSP}д`
}

/** Підпис «коли дзвонити» для картки і списку. */
export function contactLabel(nextContactAt: string | null, today: string) {
  if (!nextContactAt) return { text: 'дата не задана', overdue: false }

  const diff = daysBetween(today, nextContactAt)
  if (diff < 0) return { text: `прострочено ${-diff}${NBSP}${days(-diff)}`, overdue: true }
  if (diff === 0) return { text: 'сьогодні', overdue: false }
  if (diff === 1) return { text: 'завтра', overdue: false }
  return { text: `через ${diff}${NBSP}${days(diff)}`, overdue: false }
}
