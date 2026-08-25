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
import { contactLabel, formatKm, formatPrice, formatUsd } from '@/lib/format'
import { DENSITY_CLASSES, type Density } from '@/lib/look'
import type { Currency } from '@/lib/settings'
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
  currency: Currency
  longStandingDays: number
  density: Density
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

      {/* Рядок = картка: стан підсвічується лівим ребром і тоном, а не
          окремими бейджами (аркуш 06). */}
      <div className="surface overflow-x-auto">
        <table className="t-body w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-edge">
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      't-micro whitespace-nowrap px-2 py-2.5 text-faint',
                      NUMERIC.has(header.column.id) ? 'text-right' : 'text-left',
                    )}
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
                  'border-b border-edge transition-colors duration-(--t-instant) last:border-b-0 hover:bg-[color:color-mix(in_oklab,var(--color-ink)_4%,transparent)]',
                  rowTone(row.original.row, context.today),
                )}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      'px-2 align-middle',
                      NUMERIC.has(cell.column.id) && 'text-right',
                      DENSITY_CLASSES[context.density].row,
                    )}
                  >
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

/** Колонки з числами: у макеті вони вирівняні праворуч, розряд під розрядом. */
const NUMERIC = new Set(['price', 'target', 'diff', 'days', 'mileage'])

/** Стан рядка — лівим ребром і тоном, як стан картки в списку. */
function rowTone(row: ListingRow, today: string): string {
  if (row.stage === 'won') return 'border-l-[3px] border-l-ok bg-ok/6'
  if (row.stage === 'lost' || row.listing.status === 'removed') return 'text-faint opacity-60'
  if (row.listing.status === 'failed') return 'border-l-[3px] border-l-warn'
  if (contactLabel(row.listing.nextContactAt, today).overdue) {
    return 'border-l-[3px] border-l-danger bg-danger/6'
  }
  return 'border-l-[3px] border-l-transparent'
}

/* -------------------------------- колонки ---------------------------------- */

function buildColumns(context: Context) {
  const { query, today, search, viewer, names, currency, longStandingDays } = context

  const head = (id: ColumnId) => {
    const field = SORTABLE[id]
    const label = COLUMN_LABELS[id]

    // Заголовок — це посилання: сортування живе в URL, а не в стані таблиці.
    function HeaderCell() {
      if (!field) return <span>{label}</span>

      const active = query.sort?.field === field
      return (
        <Link
          href={listHref(toggleSort(query, field))}
          className={cn(active ? 'text-accent-lit' : 'hover:text-ink')}
        >
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
            className="h-9 w-12 rounded-chip object-cover"
          />
        ) : (
          <span className="t-micro sunken flex h-9 w-12 items-center justify-center text-faint">
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
              <span className="t-num ml-1 text-[12px] text-faint">{listing.year}</span>
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
          <span className="whitespace-nowrap t-num">
            {formatPrice(listing.priceUsd, listing.priceUah, currency)}
            {priceDrop ? <span className="ml-1 text-ok">↓{formatUsd(priceDrop)}</span> : null}
          </span>
        )
      },
    }),

    helper.display({
      id: 'target',
      header: head('target'),
      cell: ({ row }) => (
        <span className="t-num text-muted">
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
          <span className={cn('t-num', diff <= 0 && 'font-semibold text-accent-lit')}>
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
          <span
            className={cn(
              't-num',
              days !== null && days > longStandingDays && 'text-accent-lit',
            )}
          >
            {days ?? '—'}
          </span>
        )
      },
    }),

    helper.display({
      id: 'mileage',
      header: head('mileage'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap t-num">
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
        <span className="t-micro text-faint">
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
        className="chip tap"
      >
        Колонки · {visibleColumns(draft).length}
      </button>

      {open ? (
        <div className="surface p-2">
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
                    className={cn('chip', shown ? 'chip-on' : 'line-through')}
                  >
                    {COLUMN_LABELS[id]}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, -1)}
                    aria-label={`${COLUMN_LABELS[id]} лівіше`}
                    className="tap px-1 text-faint hover:text-ink"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, 1)}
                    aria-label={`${COLUMN_LABELS[id]} правіше`}
                    className="tap px-1 text-faint hover:text-ink"
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
