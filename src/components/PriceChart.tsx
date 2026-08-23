import type { PricePoint } from '@/db/schema'
import { formatDate } from '@/lib/dates'
import { formatUsd } from '@/lib/format'

/**
 * Спарклайн зміни ціни. Ступінчаста лінія, а не пряма між точками: ціна тримається
 * незмінною до наступного спостереження, тому інтерполяція тут була б брехнею.
 * Одна серія → легенда не потрібна, підписані перша й остання точки.
 * Табличний еквівалент — стрічка подій нижче, там кожна зміна ціни окремим записом.
 */

const W = 320
const H = 96
const LEFT = 12
const RIGHT = W - 12
const TOP = 32
const BOTTOM = 68

export function PriceChart({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return null

  const prices = points.map((p) => p.priceUsd)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1

  const t0 = points[0].seenAt.getTime()
  const tSpan = points[points.length - 1].seenAt.getTime() - t0 || 1

  const x = (point: PricePoint) => LEFT + ((point.seenAt.getTime() - t0) / tSpan) * (RIGHT - LEFT)
  const y = (price: number) => BOTTOM - ((price - min) / span) * (BOTTOM - TOP)

  // Ступінчастий шлях: ціна тримається, потім стрибає.
  let path = `M ${x(points[0])} ${y(points[0].priceUsd)}`
  for (let i = 1; i < points.length; i += 1) {
    path += ` L ${x(points[i])} ${y(points[i - 1].priceUsd)} L ${x(points[i])} ${y(points[i].priceUsd)}`
  }

  const first = points[0]
  const last = points[points.length - 1]

  return (
    <figure className="mt-3">
      <figcaption className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Ціна в оголошенні
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label="Графік зміни ціни">
        <path d={path} fill="none" stroke="#0057B8" strokeWidth={2} strokeLinejoin="round" />

        {points.map((point, index) => (
          <circle
            key={point.id}
            cx={x(point)}
            cy={y(point.priceUsd)}
            r={4}
            fill="#FFFFFF"
            stroke="#0057B8"
            strokeWidth={2}
          >
            <title>
              {formatDate(point.seenAt)} — {formatUsd(point.priceUsd)}
              {index === 0 ? ' (перше спостереження)' : ''}
            </title>
          </circle>
        ))}

        <text x={LEFT} y={TOP - 14} className="fill-[#16181A] font-mono text-[11px] font-semibold">
          {formatUsd(first.priceUsd)}
        </text>
        <text
          x={RIGHT}
          y={TOP - 14}
          textAnchor="end"
          className="fill-[#16181A] font-mono text-[11px] font-semibold"
        >
          {formatUsd(last.priceUsd)}
        </text>

        <text x={LEFT} y={H - 6} className="fill-[#6B7075] font-mono text-[10px]">
          {formatDate(first.seenAt)}
        </text>
        <text x={RIGHT} y={H - 6} textAnchor="end" className="fill-[#6B7075] font-mono text-[10px]">
          {formatDate(last.seenAt)}
        </text>
      </svg>
    </figure>
  )
}
