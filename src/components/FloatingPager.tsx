import Link from 'next/link'

import { cn } from '@/lib/cn'
import { listHref, type ListQuery } from '@/lib/list-query'

/**
 * Плаваюча пагінація: дві кнопки в кутку екрана. Звичайна внизу лишається —
 * але щоб дійти до неї на сторінці з пʼятдесяти карток, треба прокрутити всі
 * пʼятдесят, а наступна сторінка потрібна саме тоді, коли вони набридли.
 */
export function FloatingPager({ query, total }: { query: ListQuery; total: number }) {
  if (query.per === 'all') return null

  const pages = Math.ceil(total / query.per)
  if (pages <= 1) return null

  return (
    <nav
      aria-label="Сторінки"
      className="fixed bottom-4 right-3 z-30 flex flex-col items-center gap-1.5"
    >
      <Arrow query={query} page={query.page - 1} disabled={query.page <= 1} label="Попередня">
        ↑
      </Arrow>

      <span className="surface t-num px-1.5 py-1 text-center text-[11px] leading-none text-faint">
        {query.page}/{pages}
      </span>

      <Arrow query={query} page={query.page + 1} disabled={query.page >= pages} label="Наступна">
        ↓
      </Arrow>
    </nav>
  )
}

function Arrow({
  query,
  page,
  disabled,
  label,
  children,
}: {
  query: ListQuery
  page: number
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="surface t-num flex h-11 w-11 items-center justify-center text-[16px] text-faint opacity-40">
        {children}
      </span>
    )
  }

  return (
    <Link
      href={listHref({ ...query, page })}
      aria-label={`${label} сторінка`}
      className={cn(
        'surface t-num flex h-11 w-11 items-center justify-center text-[16px] text-ink',
        'transition-colors duration-(--t-instant) hover:border-accent',
      )}
    >
      {children}
    </Link>
  )
}
