import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SellerNotes } from '@/components/SellerNotes'
import { StageBadge } from '@/components/StageBadge'
import { getSellerDetail } from '@/db/sellers-view'
import type { ListingRow } from '@/db/list'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/dates'
import { callOutcome, EVENT_LABELS, fieldsLabel } from '@/lib/events'
import { cars, formatNumber, formatUsd } from '@/lib/format'
import { looksLikeDealer, SELLER_TYPE_LABELS } from '@/lib/sellers'
import { userNames } from '@/lib/users'

export const metadata = { title: 'Продавець' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Сторінка продавця. Усе про людину в одному місці: скільки авто продає, за
 * скільки, як часто знижує ціни, і вся історія наших розмов з ним — по всіх
 * його авто однією стрічкою, а не розкидана по картках.
 */
export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const { author } = await requireSession()
  const detail = await getSellerDetail(id)
  if (!detail) notFound()

  const { seller, stats, cars: list, events, sameAs } = detail
  const names = userNames()
  const dealer = looksLikeDealer(stats)

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <Link
        href="/sellers"
        className="t-micro tap inline-flex text-faint hover:text-ink"
      >
        ← Продавці
      </Link>

      <section className="surface p-3">
        <div className="flex items-baseline gap-2">
          <h1 className="t-title min-w-0 truncate">
            {seller.name ?? 'Без імені'}
          </h1>
          {dealer ? (
            <span className="t-micro shrink-0 rounded-chip border border-warn px-1.5 py-1 text-warn">
              схоже на перекупа
            </span>
          ) : null}
        </div>

        {/* Юзернейм зʼявиться разом із інгестом постів: колонка описана в SPEC,
            але заповнювати її поки нічим. */}
        <p className="t-body mt-1 text-faint">{SELLER_TYPE_LABELS[seller.type]}</p>

        {seller.phones.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {seller.phones.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone}`}
                className="btn tap t-num px-3 text-[14px]"
              >
                {phone}
              </a>
            ))}
          </div>
        ) : (
          <p className="t-body mt-2 text-faint">Номера ще немає — його вводять на картці авто.</p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-edge pt-3">
          <Stat label="Продає зараз" value={`${stats.active} з ${stats.total} ${cars(stats.total)}`} />
          <Stat label="Середня ціна" value={formatUsd(stats.avgPrice)} />
          <Stat
            label="Знижував ціну"
            value={stats.drops > 0 ? `${formatNumber(stats.drops)} разів` : '—'}
          />
          <Stat
            label="Останній контакт"
            value={stats.lastContact ? formatDate(stats.lastContact) : 'ще не говорили'}
          />
        </dl>

        {sameAs.length > 0 ? (
          <p className="t-body sunken rib mt-3 border-l-warn px-3 py-2 text-muted">
            Той самий номер є в: {sameAs.map((other) => other.name ?? 'без імені').join(', ')}.
            Можливо, це та сама людина.
          </p>
        ) : null}
      </section>

      <SellerNotes sellerId={seller.id} notes={seller.notes ?? ''} />

      <section className="surface p-3">
        <h2 className="t-micro text-faint">Його авто</h2>

        {list.length === 0 ? (
          <p className="t-body mt-2 text-faint">Жодного авто не привʼязано.</p>
        ) : (
          <ul className="mt-2 divide-y divide-edge">
            {list.map((row) => (
              <li key={row.listing.id} className="py-2 first:pt-0 last:pb-0">
                <Link href={`/listing/${row.listing.id}`} className="flex items-baseline gap-2">
                  <span className="t-body min-w-0 flex-1 truncate font-semibold">
                    {row.listing.title ?? 'Без назви'}
                    {row.listing.year ? (
                      <span className="t-num ml-1 text-[12px] text-faint">
                        {row.listing.year}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 t-num text-[14px]">
                    {formatUsd(row.listing.priceUsd)}
                  </span>
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <StageBadge stage={row.stage} />
                  <span className="t-micro text-faint">{statusLabel(row)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface p-3">
        <h2 className="t-micro text-faint">Історія розмов</h2>

        {events.length === 0 ? (
          <p className="t-body mt-2 text-faint">З цим продавцем ще не говорили.</p>
        ) : (
          <ol className="mt-1">
            {events.map(({ event, listingId, listingTitle }) => (
              <li key={event.id} className="border-t border-edge py-2.5 first:border-t-0">
                <div className="flex items-baseline gap-2">
                  <span className="t-micro text-accent-lit">{EVENT_LABELS[event.type]}</span>
                  <Link
                    href={`/listing/${listingId}`}
                    className="t-body min-w-0 flex-1 truncate text-muted hover:text-ink"
                  >
                    {listingTitle ?? 'Без назви'}
                  </Link>
                  <span className="t-num shrink-0 text-[11px] text-faint">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>

                <EventText event={event} />

                <p className="mt-0.5 text-[11px] text-muted">
                  {event.author === author ? 'Я' : names[event.author]}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="t-micro self-center text-faint">{label}</dt>
      <dd className="t-body font-semibold">{value}</dd>
    </div>
  )
}

/** «активне / знято / куплено» — те, що людина хоче побачити одним словом. */
function statusLabel(row: ListingRow): string {
  if (row.stage === 'won') return 'куплено'
  if (row.stage === 'lost') return 'відпало'
  if (row.listing.status === 'removed') return 'знято з продажу'
  if (row.listing.status === 'pending') return 'читаю оголошення'
  if (row.listing.status === 'failed') return 'не прочиталось'
  return row.listing.archived ? 'прибране з черги' : 'активне'
}

function EventText({ event }: { event: { type: string; payload: Record<string, unknown> | null } }) {
  const payload = (event.payload ?? {}) as {
    text?: string
    outcome?: string
    fields?: string[]
    old_price?: number
    new_price?: number
  }

  if (event.type === 'price_change') {
    return (
      <p className="t-num mt-1 text-[14px]">
        <span className="text-faint line-through decoration-1">{formatUsd(payload.old_price)}</span>{' '}
        <span className="font-semibold text-ok">{formatUsd(payload.new_price)}</span>
      </p>
    )
  }

  if (event.type === 'edit') {
    return <p className={cn('t-body mt-1')}>{fieldsLabel(payload.fields) ?? '—'}</p>
  }

  const outcome = callOutcome(payload.outcome)

  return (
    <div className="mt-1">
      {payload.text ? <p className="t-body">{payload.text}</p> : null}
      {outcome ? <p className="t-body text-faint">{outcome}</p> : null}
    </div>
  )
}
