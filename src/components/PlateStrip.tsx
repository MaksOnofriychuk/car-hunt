import { cn } from '@/lib/cn'
import { days as pluralDays } from '@/lib/format'

/**
 * Підпис проєкту зі SPEC: смуга в стилі українського номерного знака.
 * Синій блок з «UA» ліворуч — євросмуга справжнього знака, далі кількість днів,
 * які авто висить в оголошенні. Це головна метрика для торгу.
 */

const SIZES = {
  sm: { box: 'h-6', ua: 'w-[18px] text-[8px]', value: 'text-[13px]', label: 'text-[9px]' },
  md: { box: 'h-7', ua: 'w-[22px] text-[9px]', value: 'text-[16px]', label: 'text-[10px]' },
  lg: { box: 'h-11', ua: 'w-8 text-[11px]', value: 'text-[20px]', label: 'text-[11px]' },
} as const

/** Понад два місяці в продажу — продавець уже втомився, підсвічуємо акцентом. */
const LONG_STANDING_DAYS = 60

type Props = {
  days?: number | null
  label?: string
  size?: keyof typeof SIZES
  className?: string
}

export function PlateStrip({ days, label, size = 'md', className }: Props) {
  const s = SIZES[size]
  const longStanding = typeof days === 'number' && days > LONG_STANDING_DAYS

  return (
    <div
      className={cn(
        'flex items-stretch overflow-hidden rounded-card border border-ink bg-white',
        s.box,
        className,
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center bg-plate font-mono font-semibold leading-none text-white',
          s.ua,
        )}
      >
        UA
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
        {label ? (
          <span className={cn('truncate font-mono font-semibold uppercase tracking-[0.16em]', s.value)}>
            {label}
          </span>
        ) : (
          <>
            <span
              className={cn(
                'font-mono font-semibold leading-none tabular-nums',
                s.value,
                longStanding && 'text-plate',
              )}
            >
              {days ?? '—'}
            </span>
            <span className={cn('truncate uppercase leading-none tracking-[0.08em] text-muted', s.label)}>
              {days == null ? 'дата публікації невідома' : `${pluralDays(days)} в оголошенні`}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
