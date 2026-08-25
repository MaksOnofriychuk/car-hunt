import type { ReactNode } from 'react'

import { CopyValue } from './CopyValue'

import type { Listing } from '@/db/schema'
import { formatKm, formatLiters, formatNumber } from '@/lib/format'
import type { ListingSpecs } from '@/lib/specs'

/**
 * Характеристики авто плитками: рік, пробіг і місто — те, за чим авто впізнають,
 * тому вони йдуть першими й читаються з одного погляду. Головне лежить у
 * колонках `listings` (по них колись шукати), решта приходить із
 * `snapshot_raw.specs` списком «як на сторінці».
 */

type Tile = { label: string; value: ReactNode }

/** Підписи, які вже показані плитками, — у списку «ще з оголошення» не дублюємо. */
const SHOWN = /двигун|коробка|привід|колір|покоління|пробіг|рік/i

function join(parts: (string | null | undefined)[]): string | null {
  const clean = parts.filter((part): part is string => Boolean(part))
  return clean.length > 0 ? clean.join(' · ') : null
}

export function Specs({ listing, specs }: { listing: Listing; specs: ListingSpecs }) {
  const tiles: Tile[] = []
  const add = (label: string, value: string | null | undefined, mono = false) => {
    if (value) tiles.push({ label, value: mono ? <span className="t-num">{value}</span> : value })
  }

  add('Рік', listing.year ? String(listing.year) : null, true)
  add('Пробіг', listing.mileageKm ? formatKm(listing.mileageKm) : null, true)
  add('Місто', listing.city)
  add('Двигун', join([formatLiters(listing.engineVolume), listing.fuelType]))
  add('КПП', listing.transmission)
  add('Привід', listing.driveType)
  add('Кузов', join([listing.bodyType, specs.doors ? `${specs.doors} дв.` : null]))
  add('Колір', listing.color)
  add('Потужність', specs.power)
  add('Номер', listing.plateNumber, true)

  if (listing.vin) {
    tiles.push({ label: 'VIN', value: <CopyValue value={listing.vin} label="VIN" /> })
  }

  const extra = specs.pairs.filter((pair) => !SHOWN.test(pair.label))
  const stats = join([
    specs.generation,
    specs.equipment,
    specs.views ? `${formatNumber(specs.views)} переглядів` : null,
    specs.favorites ? `${formatNumber(specs.favorites)} в обраному` : null,
  ])

  if (tiles.length === 0 && extra.length === 0 && specs.checks.length === 0) return null

  return (
    <section className="surface p-3">
      <h2 className="t-micro text-faint">Характеристики</h2>

      {tiles.length > 0 ? (
        // Три в рядок на 390px: плитка виходить ~112px — «214 000» вміщається,
        // а VIN займає всю ширину, бо інакше довелося б різати посередині.
        <dl className="mt-2 grid grid-cols-3 gap-1.5">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className={tile.label === 'VIN' ? 'sunken col-span-3 p-2' : 'sunken p-2'}
            >
              <dt className="t-micro text-faint">{tile.label}</dt>
              <dd className="t-body mt-0.5 truncate font-semibold">{tile.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {specs.badges.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {specs.badges.map((badge) => (
            <span
              key={badge}
              className="t-micro rounded-chip border border-edge px-1.5 py-1 text-muted"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      {extra.length > 0 ? (
        <dl className="mt-3 space-y-2 border-t border-edge pt-3">
          {extra.map((pair) => (
            <div key={pair.label}>
              <dt className="t-micro text-faint">{pair.label}</dt>
              <dd className="t-body">{pair.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {specs.checks.length > 0 ? (
        <div className="mt-3 border-t border-edge pt-3">
          <p className="t-micro text-faint">Перевірка за держреєстрами</p>
          <ul className="mt-1 space-y-0.5">
            {specs.checks.map((check) => (
              <li key={check} className="t-body">
                {check}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stats ? <p className="t-body mt-3 text-faint">{stats}</p> : null}
    </section>
  )
}
