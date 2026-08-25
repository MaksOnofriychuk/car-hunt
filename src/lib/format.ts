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

export function formatUah(value: number | null | undefined): string {
  return value == null ? '—' : `${groupDigits(value)}${NBSP}₴`
}

/** Обʼєм двигуна: 2.36 → «2.36 л», 2 → «2 л». Нулі в хвості не потрібні. */
export function formatLiters(value: number | null | undefined): string | null {
  if (value == null) return null
  const text = value.toFixed(2).replace(/\.?0+$/, '')
  return `${text}${NBSP}л`
}

/**
 * Ціна у валюті, обраній у налаштуваннях. `both` показує обидві — так видно і
 * звичну доларову ціну, і те, що реально скаже продавець по телефону.
 */
export function formatPrice(
  usd: number | null | undefined,
  uah: number | null | undefined,
  currency: 'usd' | 'uah' | 'both',
): string {
  if (currency === 'uah') return uah != null ? formatUah(uah) : formatUsd(usd)
  if (currency === 'both' && uah != null && usd != null) {
    return `${formatUsd(usd)}${NBSP}·${NBSP}${formatUah(uah)}`
  }
  return formatUsd(usd)
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
