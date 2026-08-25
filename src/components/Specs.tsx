import type { ReactNode } from 'react'

import { CopyValue } from './CopyValue'

import type { Listing } from '@/db/schema'
import { formatLiters, formatNumber } from '@/lib/format'
import type { ListingSpecs } from '@/lib/specs'

/**
 * Характеристики авто. Головне — в колонках `listings` (по них колись шукати),
 * решта приходить із `snapshot_raw.specs` списком «як на сторінці».
 */

type Row = { label: string; value: ReactNode }

/** Підписи, які вже показані зверху, — у списку «ще з оголошення» не дублюємо. */
const SHOWN = /двигун|коробка|привід|колір|покоління/i

function join(parts: (string | null | undefined)[]): string | null {
  const clean = parts.filter((part): part is string => Boolean(part))
  return clean.length > 0 ? clean.join(' · ') : null
}

export function Specs({ listing, specs }: { listing: Listing; specs: ListingSpecs }) {
  const rows: Row[] = []
  const add = (label: string, value: string | null | undefined) => {
    if (value) rows.push({ label, value })
  }

  add(
    'Кузов',
    join([
      listing.bodyType,
      specs.doors ? `${specs.doors} дверей` : null,
      specs.seats ? `${specs.seats} місць` : null,
    ]),
  )
  add('Двигун', join([listing.fuelType, formatLiters(listing.engineVolume), specs.power]))
  add('Коробка', listing.transmission)
  add('Привід', listing.driveType)
  add('Колір', listing.color)
  add('Покоління', join([specs.generation, specs.equipment]))
  add('Номер', listing.plateNumber)

  if (listing.vin) {
    rows.push({ label: 'VIN', value: <CopyValue value={listing.vin} label="VIN" /> })
  }

  const extra = specs.pairs.filter((pair) => !SHOWN.test(pair.label))
  const stats = join([
    specs.views ? `${formatNumber(specs.views)} переглядів` : null,
    specs.favorites ? `${formatNumber(specs.favorites)} в обраному` : null,
  ])

  if (rows.length === 0 && extra.length === 0 && specs.checks.length === 0) return null

  return (
    <section className="rounded-card border border-line bg-white p-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Характеристики
      </h2>

      {rows.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-[12px] text-muted">{row.label}</dt>
              <dd className="text-[14px]">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {specs.badges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {specs.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-card border border-line px-1.5 py-0.5 text-[11px] text-muted"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      {extra.length > 0 ? (
        <dl className="mt-3 space-y-2 border-t border-line pt-3">
          {extra.map((pair) => (
            <div key={pair.label}>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                {pair.label}
              </dt>
              <dd className="text-[13px] leading-snug">{pair.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {specs.checks.length > 0 ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Перевірка за держреєстрами
          </p>
          <ul className="mt-1 space-y-0.5">
            {specs.checks.map((check) => (
              <li key={check} className="text-[13px] leading-snug">
                {check}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stats ? <p className="mt-3 text-[12px] text-muted">{stats}</p> : null}
    </section>
  )
}
