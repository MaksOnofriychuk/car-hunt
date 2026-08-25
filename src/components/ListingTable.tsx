'use client'

import {
  columnOrderingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { StageBadge } from './StageBadge'

import type { ListingRow } from '@/db/list'
import type { Author, SourceName } from '@/db/schema'
import { cn } from '@/lib/cn'
import { daysOnSale } from '@/lib/dates'
import { contactLabel, formatKm, formatUsd } from '@/lib/format'
import { listHref, toggleSort, type ListQuery, type SortField } from '@/lib/list-query'
import {
  COLUMN_LABELS,
  visibleColumns,
  writeViewPrefs,
  type ColumnId,
  type ViewPrefs,
} from '@/lib/view-prefs'

/**
 * Таблиця для широкого екрана. Порівнювати десяток авто між собою в списку
 * незручно — колонки для цього й потрібні.
 *
 * TanStack Table тут headless: він тримає колонки, їхній порядок і видимість,
 * а верстка наша. Сортування і сторінки лишаються в URL і рахуються в SQL —
 * таблиця про них лише малює стрілку.
 */

export type TableRow = {
  row: ListingRow
  /** Готовий URL мініатюри: сервер уже розібрався, локальна вона чи віддалена. */
  photo: string | null
}

const features = tableFeatures({ columnVisibilityFeature, columnOrderingFeature })
const helper = createColumnHelper<typeof features, TableRow>()

const SOURCE_LABELS: Record<SourceName, string> = {
  autoria: 'RIA',
  olx: 'OLX',
  telegram: 'TG',
  manual: 'руками',
}

/** Колонка → поле сортування. Фото сортувати нічим. */
const SORTABLE: Partial<Record<ColumnId, SortField>> = {
  title: 'title',
  price: 'price',
  target: 'target',
  diff: 'diff',
  days: 'days',
  mileage: 'mileage',
  city: 'city',
  stage: 'stage',
  contact: 'contact',
  seller: 'seller',
  source: 'source',
  comment: 'comment',
}

type Context = {
  query: ListQuery
  today: string
  search: string
  viewer: Author
  names: Record<Author, string>
}

export function ListingTable({
  rows,
  prefs,
  context,
}: {
  rows: TableRow[]
  prefs: ViewPrefs
  context: Context
}) {
  const columns = useMemo(() => buildColumns(context), [context])

  const columnVisibility = useMemo(
    () => Object.fromEntries(prefs.order.map((id) => [id, !prefs.hidden.includes(id)])),
    [prefs.order, prefs.hidden],
  )

  const table = useTable({
    features,
    columns,
    data: rows,
    state: { columnVisibility, columnOrder: prefs.order },
  })

  return (
    <div className="space-y-2">
      <ColumnSettings prefs={prefs} />

      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-line">
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-line last:border-b-0',
                  contactLabel(row.original.row.listing.nextContactAt, context.today).overdue &&
                    'border-l-[3px] border-l-signal',
                )}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1.5 align-middle">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* -------------------------------- колонки ---------------------------------- */

function buildColumns(context: Context) {
  const { query, today, search, viewer, names } = context

  const head = (id: ColumnId) => {
    const field = SORTABLE[id]
    const label = COLUMN_LABELS[id]

    // Заголовок — це посилання: сортування живе в URL, а не в стані таблиці.
    function HeaderCell() {
      if (!field) return <span>{label}</span>

      const active = query.sort?.field === field
      return (
        <Link href={listHref(toggleSort(query, field))} className={cn(active && 'text-ink')}>
          {label}
          {active ? (query.sort?.dir === 'asc' ? ' ↑' : ' ↓') : null}
        </Link>
      )
    }

    return HeaderCell
  }

  const href = (id: string) =>
    search ? `/listing/${id}?from=${encodeURIComponent(search)}` : `/listing/${id}`

  return helper.columns([
    helper.display({
      id: 'photo',
      header: head('photo'),
      cell: ({ row }) =>
        row.original.photo ? (
          <Image
            src={row.original.photo}
            alt=""
            width={48}
            height={36}
            className="h-9 w-12 rounded-card object-cover"
          />
        ) : (
          <span className="flex h-9 w-12 items-center justify-center rounded-card bg-concrete font-mono text-[10px] uppercase text-muted">
            {(row.original.row.listing.brand ?? '?').slice(0, 3)}
          </span>
        ),
    }),

    helper.display({
      id: 'title',
      header: head('title'),
      cell: ({ row }) => {
        const { listing } = row.original.row
        return (
          <Link href={href(listing.id)} className="block min-w-[180px] max-w-[280px] truncate">
            {listing.title ?? 'Без назви'}
            {listing.year ? (
              <span className="ml-1 font-mono text-[12px] text-muted">{listing.year}</span>
            ) : null}
          </Link>
        )
      },
    }),

    helper.display({
      id: 'price',
      header: head('price'),
      cell: ({ row }) => {
        const { listing, priceDrop } = row.original.row
        return (
          <span className="whitespace-nowrap font-mono tabular-nums">
            {formatUsd(listing.priceUsd)}
            {priceDrop ? <span className="ml-1 text-plate">↓{formatUsd(priceDrop)}</span> : null}
          </span>
        )
      },
    }),

    helper.display({
      id: 'target',
      header: head('target'),
      cell: ({ row }) => (
        <span className="font-mono tabular-nums text-muted">
          {formatUsd(row.original.row.listing.targetPriceUsd)}
        </span>
      ),
    }),

    helper.display({
      id: 'diff',
      header: head('diff'),
      cell: ({ row }) => {
        const { priceUsd, targetPriceUsd } = row.original.row.listing
        if (priceUsd === null || targetPriceUsd === null) {
          return <span className="text-muted">—</span>
        }
        const diff = priceUsd - targetPriceUsd
        return (
          <span className={cn('font-mono tabular-nums', diff <= 0 && 'font-semibold text-plate')}>
            {diff > 0 ? '+' : ''}
            {formatUsd(diff)}
          </span>
        )
      },
    }),

    helper.display({
      id: 'days',
      header: head('days'),
      cell: ({ row }) => {
        const days = daysOnSale(row.original.row.listing.publishedAt)
        return (
          <span className={cn('font-mono tabular-nums', days !== null && days > 60 && 'text-plate')}>
            {days ?? '—'}
          </span>
        )
      },
    }),

    helper.display({
      id: 'mileage',
      header: head('mileage'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono tabular-nums">
          {formatKm(row.original.row.listing.mileageKm)}
        </span>
      ),
    }),

    helper.display({
      id: 'city',
      header: head('city'),
      cell: ({ row }) => <span>{row.original.row.listing.city ?? '—'}</span>,
    }),

    helper.display({
      id: 'stage',
      header: head('stage'),
      cell: ({ row }) => <StageBadge stage={row.original.row.stage} />,
    }),

    helper.display({
      id: 'contact',
      header: head('contact'),
      cell: ({ row }) => {
        const contact = contactLabel(row.original.row.listing.nextContactAt, today)
        return (
          <span className={cn('whitespace-nowrap', contact.overdue ? 'font-semibold' : 'text-muted')}>
            {contact.text}
          </span>
        )
      },
    }),

    helper.display({
      id: 'seller',
      header: head('seller'),
      cell: ({ row }) => {
        const seller = row.original.row.seller
        if (!seller) return <span className="text-muted">—</span>
        return (
          <Link href={`/sellers/${seller.id}`} className="block max-w-[160px] truncate">
            {seller.name ?? 'Без імені'}
          </Link>
        )
      },
    }),

    helper.display({
      id: 'source',
      header: head('source'),
      cell: ({ row }) => (
        <span className="text-[12px] text-muted">
          {SOURCE_LABELS[row.original.row.listing.source]}
        </span>
      ),
    }),

    helper.display({
      id: 'comment',
      header: head('comment'),
      cell: ({ row }) => {
        const note = row.original.row.lastNote ?? row.original.row.lastEvent
        if (!note) return <span className="text-muted">—</span>
        return (
          <span className="block max-w-[260px] truncate text-muted">
            {note.author === viewer ? 'Я' : names[note.author]}: {note.text ?? '—'}
          </span>
        )
      },
    }),
  ])
}

/* ------------------------------ вибір колонок ------------------------------ */

function ColumnSettings({ prefs }: { prefs: ViewPrefs }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(prefs)

  const save = (next: ViewPrefs) => {
    setDraft(next)
    writeViewPrefs(next)
  }

  const move = (id: ColumnId, delta: number) => {
    const order = [...draft.order]
    const index = order.indexOf(id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    save({ ...draft, order })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="h-8 rounded-card border border-line px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        Колонки · {visibleColumns(draft).length}
      </button>

      {open ? (
        <div className="rounded-card border border-line bg-white p-2">
          <ul className="flex flex-wrap gap-1.5">
            {draft.order.map((id) => {
              const shown = !draft.hidden.includes(id)
              return (
                <li key={id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      save({
                        ...draft,
                        hidden: shown
                          ? [...draft.hidden, id]
                          : draft.hidden.filter((item) => item !== id),
                      })
                    }
                    className={cn(
                      'h-7 rounded-card border px-2 text-[12px]',
                      shown ? 'border-ink' : 'border-line text-muted line-through',
                    )}
                  >
                    {COLUMN_LABELS[id]}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, -1)}
                    aria-label={`${COLUMN_LABELS[id]} лівіше`}
                    className="px-0.5 text-[11px] text-muted"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, 1)}
                    aria-label={`${COLUMN_LABELS[id]} правіше`}
                    className="px-0.5 text-[11px] text-muted"
                  >
                    →
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
