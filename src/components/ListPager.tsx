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
    <nav className="surface flex items-center gap-2 p-3">
      <span className="t-num text-[12px] text-faint">
        {from}–{to} з {total}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {per === null ? (
          <Link
            href={listHref({ ...query, per: PER_PAGE, page: 1 })}
            className="chip"
          >
            По {PER_PAGE}
          </Link>
        ) : (
          <>
            <PageLink query={query} page={query.page - 1} disabled={query.page <= 1}>
              ←
            </PageLink>
            <span className="t-num text-[12px]">
              {query.page} / {pages}
            </span>
            <PageLink query={query} page={query.page + 1} disabled={query.page >= pages}>
              →
            </PageLink>
            <Link
              href={listHref({ ...query, per: 'all', page: 1 })}
              className="t-micro ml-1 text-accent-lit"
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
      <span className="chip w-9 opacity-40">{children}</span>
    )
  }

  return (
    <Link
      href={listHref({ ...query, page })}
      className={cn('chip tap w-9')}
    >
      {children}
    </Link>
  )
}
