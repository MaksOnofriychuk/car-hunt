import Link from 'next/link'

import { cn } from '@/lib/cn'
import { listHref, toggleSort, type ListQuery, type SortField } from '@/lib/list-query'

/**
 * Сортування списку. У режимі таблиці те саме роблять заголовки колонок, тут —
 * короткий ряд для телефона.
 *
 * Типове сортування (за датою контакту) окремою кнопкою не потрібне: воно
 * повертається третім кліком по активному полю.
 */

const FIELDS: { field: SortField; label: string }[] = [
  { field: 'price', label: 'ціна' },
  { field: 'days', label: 'днів' },
  { field: 'mileage', label: 'пробіг' },
  { field: 'year', label: 'рік' },
  { field: 'added', label: 'додано' },
]

export function SortBar({ query }: { query: ListQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Сортувати
      </span>

      {FIELDS.map(({ field, label }) => {
        const active = query.sort?.field === field
        return (
          <Link
            key={field}
            href={listHref(toggleSort(query, field))}
            className={cn('text-[12px]', active ? 'font-semibold' : 'text-muted')}
          >
            {label}
            {active ? (query.sort?.dir === 'asc' ? ' ↑' : ' ↓') : null}
          </Link>
        )
      })}

      {query.sort ? (
        <Link
          href={listHref({ ...query, sort: null, page: 1 })}
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-plate"
        >
          Типове
        </Link>
      ) : null}
    </div>
  )
}
