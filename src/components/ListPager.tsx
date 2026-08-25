import Link from 'next/link'

import { cn } from '@/lib/cn'
import { listHref, MAX_PER_PAGE, PER_PAGE, type ListQuery } from '@/lib/list-query'

/**
 * Пагінація. Серверна: сторінка живе в URL, а не в памʼяті вкладки, тому
 * посилання на другу сторінку теж працює.
 */
export function ListPager({ query, total }: { query: ListQuery; total: number }) {
  const per = query.per === 'all' ? null : query.per
  const pages = per ? Math.ceil(total / per) : 1

  if (total === 0 || (pages <= 1 && total <= PER_PAGE)) return null

  const from = per ? (query.page - 1) * per + 1 : 1
  const to = per ? Math.min(query.page * per, total) : Math.min(total, MAX_PER_PAGE)

  return (
    <nav className="flex items-center gap-2 rounded-card border border-line bg-white p-3">
      <span className="font-mono text-[12px] tabular-nums text-muted">
        {from}–{to} з {total}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {per === null ? (
          <Link
            href={listHref({ ...query, per: PER_PAGE, page: 1 })}
            className="h-8 rounded-card border border-line px-2.5 text-[11px] font-semibold uppercase leading-8 tracking-[0.08em] text-muted"
          >
            По {PER_PAGE}
          </Link>
        ) : (
          <>
            <PageLink query={query} page={query.page - 1} disabled={query.page <= 1}>
              ←
            </PageLink>
            <span className="font-mono text-[12px] tabular-nums">
              {query.page} / {pages}
            </span>
            <PageLink query={query} page={query.page + 1} disabled={query.page >= pages}>
              →
            </PageLink>
            <Link
              href={listHref({ ...query, per: 'all', page: 1 })}
              className="ml-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-plate"
            >
              Показати всі
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

function PageLink({
  query,
  page,
  disabled,
  children,
}: {
  query: ListQuery
  page: number
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="h-8 w-8 rounded-card border border-line text-center text-[13px] leading-8 text-muted opacity-40">
        {children}
      </span>
    )
  }

  return (
    <Link
      href={listHref({ ...query, page })}
      className={cn('h-8 w-8 rounded-card border border-ink text-center text-[13px] leading-8')}
    >
      {children}
    </Link>
  )
}
