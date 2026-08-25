import Link from 'next/link'

import { cn } from '@/lib/cn'
import { listHref, PER_OPTIONS, type ListQuery } from '@/lib/list-query'

/**
 * Скільки авто на сторінці. Стоїть там, де раніше було сортування — воно
 * переїхало в кнопку поруч із фільтрами.
 *
 * Це вибір, а не набір посилань, тому перемикач сегментами: активним може бути
 * тільки одне значення.
 */
export function PerPageBar({ query, total }: { query: ListQuery; total: number }) {
  // Поки все й так вміщається на одну сторінку, вибір нема про що робити.
  if (total <= PER_OPTIONS[0]) return null

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="t-micro text-faint">На сторінці</span>

      <div className="sunken ml-auto flex gap-1 rounded-control p-1">
        {PER_OPTIONS.map((per) => (
          <Segment key={per} query={query} value={per} active={query.per === per}>
            {per}
          </Segment>
        ))}
        <Segment query={query} value="all" active={query.per === 'all'}>
          усі
        </Segment>
      </div>
    </div>
  )
}

function Segment({
  query,
  value,
  active,
  children,
}: {
  query: ListQuery
  value: number | 'all'
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={listHref({ ...query, per: value, page: 1 })}
      className={cn(
        't-num flex h-9 min-w-11 items-center justify-center rounded-chip px-2.5 text-[13px]',
        active ? 'bg-accent font-semibold text-white' : 'text-muted hover:text-ink',
      )}
    >
      {children}
    </Link>
  )
}
