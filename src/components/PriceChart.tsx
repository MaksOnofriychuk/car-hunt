import type { PricePoint } from '@/db/schema'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { formatNumber } from '@/lib/format'

/**
 * Історія ціни стовпчиками. Не лінія: спостережень зазвичай три-чотири, і між
 * ними ціна не «росте плавно» — вона тримається, поки продавець її не змінить.
 * Стовпчик = одне спостереження, останній підсвічений акцентом.
 *
 * Табличний еквівалент — стрічка подій нижче: там кожна зміна ціни окремим
 * записом із датою й обома сумами.
 */

/** Більше шести стовпчиків на 390px — це вже частокіл. Показуємо останні. */
const MAX_BARS = 6
/** Найнижчий стовпчик не сходить нанівець: інакше не видно, що він узагалі є. */
const MIN_HEIGHT = 18

export function PriceChart({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return null

  const shown = points.slice(-MAX_BARS)
  const prices = shown.map((point) => point.priceUsd)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1

  return (
    <figure className="mt-3">
      <figcaption className="t-micro text-faint">
        Ціна в оголошенні
        {points.length > shown.length ? ` · останні ${shown.length} з ${points.length}` : null}
      </figcaption>

      <div className="mt-2 flex items-end gap-1.5">
        {shown.map((point, index) => {
          const last = index === shown.length - 1
          const previous = index > 0 ? shown[index - 1].priceUsd : null
          const down = previous !== null && point.priceUsd < previous

          return (
            <div key={point.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  'w-full rounded-t-[3px]',
                  last ? 'bg-accent' : down ? 'bg-ok/40' : 'bg-edge',
                )}
                style={{ height: `${MIN_HEIGHT + ((point.priceUsd - min) / span) * 46}px` }}
              />
              <span
                className={cn(
                  't-num text-[11px] leading-none',
                  last ? 'text-ink' : 'text-faint',
                )}
              >
                {formatNumber(point.priceUsd)}
              </span>
              <span className="t-num text-[10px] leading-none text-faint">
                {formatDate(point.seenAt).slice(0, 5)}
              </span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
