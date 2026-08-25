const KYIV = 'Europe/Kyiv'

/** Сьогодні за Києвом у форматі YYYY-MM-DD — саме так лежить next_contact_at. */
export function todayInKyiv(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KYIV }).format(new Date())
}

/** Котра зараз у Києві, у форматі HH:MM — у такому ж лежать тихі години. */
export function timeInKyiv(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: KYIV,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
}

/** Дата через N днів від сьогодні, теж за Києвом. Для кнопок «+3 / +7 / +14 днів». */
export function kyivDatePlus(days: number): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: KYIV }).format(now)
}

/** Різниця в цілих днях між двома YYYY-MM-DD. Додатна — друга дата в майбутньому. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** Скільки днів авто висить в оголошенні — головна метрика для торгу. */
export function daysOnSale(publishedAt: Date | null): number | null {
  if (!publishedAt) return null
  const days = Math.floor((Date.now() - publishedAt.getTime()) / 86_400_000)
  return days < 0 ? 0 : days
}

/** Скільки днів минуло з моменту події. */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: KYIV,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDate(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(`${date}T12:00:00Z`) : date
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: KYIV,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(value)
}

/** Дата за Києвом у форматі YYYY-MM-DD — саме його розуміє `<input type="date">`. */
export function kyivIsoDay(date: Date | null | undefined): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: KYIV }).format(date)
}
