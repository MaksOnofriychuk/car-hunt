'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { SELLER_TYPES, SOURCE_NAMES, type SellerType } from '@/db/values'
import { SOURCE_LABELS } from '@/lib/sources/labels'
import { cn } from '@/lib/cn'
import {
  DEFAULT_QUERY,
  DUE_VALUES,
  listHref,
  QUICK_SORTS,
  SORT_LABELS,
  toggleSort,
  withFilters,
  type Due,
  type ListQuery,
  type Range,
  type SortField,
} from '@/lib/list-query'
import { STAGES, STAGE_LABELS, type Stage } from '@/lib/stages'

/**
 * Панель фільтрів. Стан живе в URL, а не тут: посилання з відфільтрованим
 * списком можна кинути іншому, і він побачить те саме.
 *
 * Панель згорнута, поки фільтрів немає. Активні завжди видно чипами — інакше
 * легко забути, чому список раптом порожній.
 */

const SELLER_LABELS: Record<SellerType, string> = {
  owner: 'Власник',
  dealer: 'Перекуп',
  showroom: 'Салон',
  unknown: 'Невідомо',
}

const DUE_LABELS: Record<Due, string> = {
  overdue: 'Прострочені',
  today: 'Сьогодні',
  week: 'Цього тижня',
}

export function ListFilters({
  query,
  cities,
  total,
}: {
  query: ListQuery
  cities: string[]
  total: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [draft, setDraft] = useState(query)

  // Після навігації (чип, пресет, «назад») URL — головніший за локальний стан.
  useEffect(() => setDraft(query), [query])

  const go = (next: ListQuery) => router.push(listHref(next))
  const patch = (part: Partial<ListQuery>) => setDraft((current) => ({ ...current, ...part }))

  const chips = activeChips(query)

  return (
    <section className="surface p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn('chip tap', (open || chips.length > 0) && 'chip-on')}
        >
          Фільтри{chips.length > 0 ? ` · ${chips.length}` : ''}
        </button>

        <button
          type="button"
          onClick={() => setSorting((value) => !value)}
          aria-expanded={sorting}
          className={cn('chip tap', (sorting || query.sort !== null) && 'chip-on')}
        >
          Сортувати{query.sort ? ` · ${SORT_LABELS[query.sort.field]}` : ''}
        </button>

        <span className="t-num ml-auto text-[12px] text-faint">{total} авто</span>
      </div>

      {sorting ? (
        // Вибір, а не набір посилань: перемикач із сегментів показує, що
        // активним може бути тільки одне поле (і один напрям).
        <div className="mt-2 space-y-2 border-t border-edge pt-2">
          {/* Один ряд сегментів, що гортається вбік: сітка з семи полів на
              390px розсипалась на три ряди різної висоти. */}
          <div className="sunken flex gap-1 overflow-x-auto rounded-control p-1">
            <SortSegment query={query} field={null} active={query.sort === null}>
              Типове
            </SortSegment>
            {QUICK_SORTS.map((field) => (
              <SortSegment
                key={field}
                query={query}
                field={field}
                active={query.sort?.field === field}
              >
                {SORT_LABELS[field]}
              </SortSegment>
            ))}
          </div>

          {query.sort ? (
            <div className="sunken flex gap-1 rounded-control p-1">
              {(['asc', 'desc'] as const).map((dir) => (
                <Link
                  key={dir}
                  href={listHref({ ...query, sort: { field: query.sort!.field, dir }, page: 1 })}
                  className={cn(
                    'flex h-9 flex-1 items-center justify-center rounded-chip text-[13px]',
                    query.sort?.dir === dir
                      ? 'bg-accent font-semibold text-white'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  {dir === 'asc' ? '↑ зростання' : '↓ спадання'}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => go(withFilters(query, chip.clear))}
              className="chip"
            >
              {chip.label} ✕
            </button>
          ))}
          <button
            type="button"
            onClick={() => go({ ...DEFAULT_QUERY, sort: query.sort, per: query.per })}
            className="t-micro tap px-1 text-faint hover:text-ink"
          >
            Скинути
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-3 border-t border-edge pt-3">
          <div className="grid grid-cols-2 gap-2">
            <RangeField
              label="Ціна, $"
              value={draft.price}
              onChange={(price) => patch({ price })}
            />
            <RangeField label="Рік" value={draft.year} onChange={(year) => patch({ year })} />
            <RangeField label="Пробіг, тис. км" value={draft.km} onChange={(km) => patch({ km })} />
            <RangeField
              label="Днів в оголошенні"
              value={draft.days}
              onChange={(days) => patch({ days })}
            />
          </div>

          <label className="block">
            <span className="t-micro text-faint">Місто</span>
            <input
              list="filter-cities"
              value={draft.city ?? ''}
              onChange={(event) => patch({ city: event.target.value || null })}
              placeholder="Будь-яке"
              className="field mt-1"
            />
            <datalist id="filter-cities">
              {cities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </label>

          <Group label="Коли дзвонити">
            {DUE_VALUES.map((due) => (
              <Chip
                key={due}
                active={draft.due === due}
                onClick={() => patch({ due: draft.due === due ? null : due })}
              >
                {DUE_LABELS[due]}
              </Chip>
            ))}
          </Group>

          <Group label="Етап">
            {STAGES.map((stage) => (
              <Chip
                key={stage}
                active={draft.stage.includes(stage)}
                onClick={() => patch({ stage: toggle(draft.stage, stage) })}
              >
                {STAGE_LABELS[stage]}
              </Chip>
            ))}
          </Group>

          <Group label="Джерело">
            {SOURCE_NAMES.map((source) => (
              <Chip
                key={source}
                active={draft.source.includes(source)}
                onClick={() => patch({ source: toggle(draft.source, source) })}
              >
                {SOURCE_LABELS[source]}
              </Chip>
            ))}
          </Group>

          <Group label="Продавець">
            {SELLER_TYPES.map((type) => (
              <Chip
                key={type}
                active={draft.sellerType.includes(type)}
                onClick={() => patch({ sellerType: toggle(draft.sellerType, type) })}
              >
                {SELLER_LABELS[type]}
              </Chip>
            ))}
          </Group>

          <Group label="Ціль і архів">
            <Chip
              active={draft.target === 'yes'}
              onClick={() => patch({ target: draft.target === 'yes' ? null : 'yes' })}
            >
              Є ціль
            </Chip>
            <Chip
              active={draft.target === 'no'}
              onClick={() => patch({ target: draft.target === 'no' ? null : 'no' })}
            >
              Без цілі
            </Chip>
            <Chip active={draft.cheaper} onClick={() => patch({ cheaper: !draft.cheaper })}>
              Дешевші за ціль
            </Chip>
            <Chip active={draft.archived} onClick={() => patch({ archived: !draft.archived })}>
              З архівними
            </Chip>
          </Group>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                go(withFilters(draft, {}))
                setOpen(false)
              }}
              className="btn btn-accent tap flex-1"
            >
              Показати
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 rounded-card border border-edge px-3 t-micro text-faint"
            >
              Згорнути
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/* -------------------------------- дрібниці --------------------------------- */

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="t-micro text-faint">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('chip tap', active && 'chip-on')}
    >
      {children}
    </button>
  )
}

/** Сегмент перемикача сортування. Порожнє поле — повернення до типового. */
function SortSegment({
  query,
  field,
  active,
  children,
}: {
  query: ListQuery
  field: SortField | null
  active: boolean
  children: React.ReactNode
}) {
  const href = field === null ? { ...query, sort: null, page: 1 } : toggleSort(query, field)

  return (
    <Link
      href={listHref(href)}
      className={cn(
        'flex h-9 shrink-0 items-center justify-center rounded-chip px-3 text-[13px]',
        active ? 'bg-accent font-semibold text-white' : 'text-muted hover:text-ink',
      )}
    >
      {children}
    </Link>
  )
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: Range
  onChange: (value: Range) => void
}) {
  const set = (key: 'min' | 'max', raw: string) => {
    const digits = raw.replace(/[^\d]/g, '')
    onChange({ ...value, [key]: digits ? Number.parseInt(digits, 10) : null })
  }

  return (
    <div>
      <span className="t-micro text-faint">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <input
          inputMode="numeric"
          value={value.min ?? ''}
          onChange={(event) => set('min', event.target.value)}
          placeholder="від"
          className="field field-num min-w-0 placeholder:font-sans placeholder:text-left"
        />
        <span className="t-body text-faint">–</span>
        <input
          inputMode="numeric"
          value={value.max ?? ''}
          onChange={(event) => set('max', event.target.value)}
          placeholder="до"
          className="field field-num min-w-0 placeholder:font-sans placeholder:text-left"
        />
      </div>
    </div>
  )
}

type ActiveChip = { label: string; clear: Partial<ListQuery> }

/** Активні фільтри чипами: кожен можна зняти окремо. */
function activeChips(query: ListQuery): ActiveChip[] {
  const chips: ActiveChip[] = []
  const range = (label: string, value: Range, key: keyof ListQuery, unit = '') => {
    if (value.min === null && value.max === null) return
    const text =
      value.min !== null && value.max !== null
        ? `${value.min}–${value.max}`
        : value.min !== null
          ? `від ${value.min}`
          : `до ${value.max}`
    chips.push({ label: `${label} ${text}${unit}`, clear: { [key]: { min: null, max: null } } })
  }

  range('Ціна', query.price, 'price', ' $')
  range('Рік', query.year, 'year')
  range('Пробіг', query.km, 'km')
  range('Днів', query.days, 'days')

  if (query.city) chips.push({ label: query.city, clear: { city: null } })
  if (query.due) chips.push({ label: DUE_LABELS[query.due], clear: { due: null } })
  if (query.stage.length) {
    chips.push({
      label: query.stage.map((stage: Stage) => STAGE_LABELS[stage]).join(', '),
      clear: { stage: [] },
    })
  }
  if (query.source.length) {
    chips.push({
      label: query.source.map((source) => SOURCE_LABELS[source]).join(', '),
      clear: { source: [] },
    })
  }
  if (query.sellerType.length) {
    chips.push({
      label: query.sellerType.map((type) => SELLER_LABELS[type]).join(', '),
      clear: { sellerType: [] },
    })
  }
  if (query.target) {
    chips.push({ label: query.target === 'yes' ? 'Є ціль' : 'Без цілі', clear: { target: null } })
  }
  if (query.cheaper) chips.push({ label: 'Дешевші за ціль', clear: { cheaper: false } })
  if (query.archived) chips.push({ label: 'З архівними', clear: { archived: false } })

  return chips
}
