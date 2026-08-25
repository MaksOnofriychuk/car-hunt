import { cn } from '@/lib/cn'

/**
 * Скільки днів авто висить в оголошенні — головна метрика для торгу, тому це
 * знак, а не підпис: велике моноширинне число і два рядки дрібним (аркуш 04).
 */

type Tone = 'normal' | 'overdue' | 'past'

export function DaysBadge({
  days,
  longStanding,
  tone = 'normal',
  className,
}: {
  days: number | null
  /** Поріг «довго висить» із налаштувань. */
  longStanding: number
  tone?: Tone
  className?: string
}) {
  const long = days !== null && days > longStanding

  return (
    <span
      className={cn(
        'rib flex shrink-0 items-center gap-1.5 rounded-chip border border-edge py-1 pl-2 pr-2.5',
        tone === 'overdue' ? 'border-l-danger' : 'border-l-accent',
        className,
      )}
    >
      <span
        className={cn(
          't-num text-[17px] font-semibold leading-none',
          tone === 'overdue' ? 'text-danger' : long ? 'text-accent-lit' : 'text-ink',
        )}
      >
        {days ?? '—'}
      </span>
      <span className="t-micro leading-[1.15] text-faint">
        {daysWord(days)}
        <br />
        {tone === 'past' ? 'було' : 'в продажу'}
      </span>
    </span>
  )
}

export function daysWord(days: number | null) {
  if (days === null) return 'днів'
  const mod10 = days % 10
  const mod100 = days % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дні'
  return 'днів'
}
