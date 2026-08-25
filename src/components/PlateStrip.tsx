import { cn } from '@/lib/cn'

/**
 * Знак проєкту: український номерний. Синій блок з «UA» ліворуч — євросмуга
 * справжнього знака, далі світле поле з написом.
 *
 * Поле знака світле в **обох** темах (`--color-plate-face`): номерний знак не
 * буває чорним, і саме цим він упізнається на темному екрані.
 */

const SIZES = {
  sm: { box: 'h-7', band: 'w-[22px]', ua: 'text-[8px]', label: 'text-[13px]' },
  md: { box: 'h-9', band: 'w-[26px]', ua: 'text-[9px]', label: 'text-[16px]' },
  lg: { box: 'h-12', band: 'w-[34px]', ua: 'text-[11px]', label: 'text-[22px]' },
} as const

type Props = {
  label: string
  size?: keyof typeof SIZES
  className?: string
  /** Сховати поле знака на вузькому екрані, лишивши тільки синій блок UA. */
  compactBelow?: boolean
}

export function PlateStrip({ label, size = 'md', className, compactBelow = false }: Props) {
  const s = SIZES[size]

  return (
    <div
      className={cn(
        'flex items-stretch overflow-hidden rounded-plate border border-edge bg-plate-face',
        s.box,
        className,
      )}
    >
      <div
        className={cn(
          'flex shrink-0 flex-col items-center justify-center gap-[2px] bg-plate-band px-1 text-white',
          s.band,
        )}
      >
        {/* Дві риски — спрощені зорі євросмуги: у цьому розмірі коло зірок
            перетворюється на пляму, а риски лишаються рисками. */}
        <span className="h-[2px] w-2/3 rounded-full bg-white/70" aria-hidden />
        <span className={cn('t-num font-semibold leading-none', s.ua)}>UA</span>
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 items-center px-2.5',
          compactBelow && 'hidden sm:flex',
        )}
      >
        <span
          className={cn(
            't-num truncate font-semibold uppercase tracking-[0.22em] text-[color:var(--color-plate-ink)]',
            s.label,
          )}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
