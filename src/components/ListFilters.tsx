'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { SELLER_TYPES, SOURCE_NAMES, type SellerType, type SourceName } from '@/db/schema'
import { cn } from '@/lib/cn'
import {
  DEFAULT_QUERY,
  DUE_VALUES,
  listHref,
  withFilters,
  type Due,
  type ListQuery,
  type Range,
} from '@/lib/list-query'
import { STAGES, STAGE_LABELS, type Stage } from '@/lib/stages'

/**
 * Панель фільтрів. Стан живе в URL, а не тут: посилання з відфільтрованим
 * списком можна кинути іншому, і він побачить те саме.
 *
 * Панель згорнута, поки фільтрів немає. Активні завжди видно чипами — інакше
 * легко забути, чому список раптом порожній.
 */

const SOURCE_LABELS: Record<SourceName, string> = {
  autoria: 'AUTO.RIA',
  olx: 'OLX',
  telegram: 'Telegram',
  manual: 'Руками',
}

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
  const [draft, setDraft] = useState(query)

  // Після навігації (чип, пресет, «назад») URL — головніший за локальний стан.
  useEffect(() => setDraft(query), [query])

  const go = (next: ListQuery) => router.push(listHref(next))
  const patch = (part: Partial<ListQuery>) => setDraft((current) => ({ ...current, ...part }))

  const chips = activeChips(query)

  return (
    <section className="rounded-card border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            'h-8 rounded-card border px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
            open || chips.length > 0 ? 'border-ink' : 'border-line text-muted',
          )}
        >
          Фільтри{chips.length > 0 ? ` · ${chips.length}` : ''}
        </button>

        <span className="ml-auto font-mono text-[12px] tabular-nums text-muted">
          {total} авто
        </span>
      </div>

      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => go(withFilters(query, chip.clear))}
              className="rounded-card border border-ink px-1.5 py-0.5 text-[11px]"
            >
              {chip.label} ✕
            </button>
          ))}
          <button
            type="button"
            onClick={() => go({ ...DEFAULT_QUERY, sort: query.sort, per: query.per })}
            className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Скинути
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
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
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Місто
            </span>
            <input
              list="filter-cities"
              value={draft.city ?? ''}
              onChange={(event) => patch({ city: event.target.value || null })}
              placeholder="Будь-яке"
              className="mt-1 h-9 w-full rounded-card border border-line bg-card px-2.5 text-[14px] placeholder:text-muted"
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
              className="h-10 flex-1 rounded-card border border-ink bg-ink text-[11px] font-semibold uppercase tracking-[0.08em] text-white"
            >
              Показати
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 rounded-card border border-line px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
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
      className={cn(
        'h-8 rounded-card border px-2 text-[12px]',
        active ? 'border-ink bg-concrete font-semibold' : 'border-line text-muted',
      )}
    >
      {children}
    </button>
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1">
        <input
          inputMode="numeric"
          value={value.min ?? ''}
          onChange={(event) => set('min', event.target.value)}
          placeholder="від"
          className="h-9 w-full min-w-0 rounded-card border border-line bg-card px-2 font-mono text-[13px] tabular-nums placeholder:font-sans placeholder:text-muted"
        />
        <span className="text-[12px] text-muted">–</span>
        <input
          inputMode="numeric"
          value={value.max ?? ''}
          onChange={(event) => set('max', event.target.value)}
          placeholder="до"
          className="h-9 w-full min-w-0 rounded-card border border-line bg-card px-2 font-mono text-[13px] tabular-nums placeholder:font-sans placeholder:text-muted"
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
