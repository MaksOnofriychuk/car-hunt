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

export const metadata = { title: 'Продавець — Car Hunt' }

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
        className="inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        ← Продавці
      </Link>

      <section className="rounded-card border border-line bg-card p-3">
        <div className="flex items-baseline gap-2">
          <h1 className="min-w-0 truncate text-[19px] font-semibold leading-tight">
            {seller.name ?? 'Без імені'}
          </h1>
          {dealer ? (
            <span className="shrink-0 rounded-card border border-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
              схоже на перекупа
            </span>
          ) : null}
        </div>

        {/* Юзернейм зʼявиться разом із інгестом постів: колонка описана в SPEC,
            але заповнювати її поки нічим. */}
        <p className="mt-1 text-[12px] text-muted">{SELLER_TYPE_LABELS[seller.type]}</p>

        {seller.phones.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {seller.phones.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone}`}
                className="h-9 rounded-card border border-ink px-2.5 font-mono text-[13px] leading-9 tabular-nums"
              >
                {phone}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-muted">Номера ще немає — його вводять на картці авто.</p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-3">
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
          <p className="mt-3 border-l-[3px] border-signal bg-card py-2 pl-3 text-[13px]">
            Той самий номер є в: {sameAs.map((other) => other.name ?? 'без імені').join(', ')}.
            Можливо, це та сама людина.
          </p>
        ) : null}
      </section>

      <SellerNotes sellerId={seller.id} notes={seller.notes ?? ''} />

      <section className="rounded-card border border-line bg-card p-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Його авто
        </h2>

        {list.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Жодного авто не привʼязано.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {list.map((row) => (
              <li key={row.listing.id} className="py-2 first:pt-0 last:pb-0">
                <Link href={`/listing/${row.listing.id}`} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {row.listing.title ?? 'Без назви'}
                    {row.listing.year ? (
                      <span className="ml-1 font-mono text-[12px] text-muted">
                        {row.listing.year}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[14px] tabular-nums">
                    {formatUsd(row.listing.priceUsd)}
                  </span>
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <StageBadge stage={row.stage} />
                  <span className="text-[11px] text-muted">{statusLabel(row)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-card p-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Історія розмов
        </h2>

        {events.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">З цим продавцем ще не говорили.</p>
        ) : (
          <ol className="mt-1">
            {events.map(({ event, listingId, listingTitle }) => (
              <li key={event.id} className="border-t border-line py-2.5 first:border-t-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {EVENT_LABELS[event.type]}
                  </span>
                  <Link
                    href={`/listing/${listingId}`}
                    className="min-w-0 flex-1 truncate text-[12px] text-plate"
                  >
                    {listingTitle ?? 'Без назви'}
                  </Link>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
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
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-[14px]">{value}</dd>
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
      <p className="mt-1 font-mono text-[13px] tabular-nums">
        <span className="text-muted line-through decoration-1">{formatUsd(payload.old_price)}</span>{' '}
        <span className="font-semibold">{formatUsd(payload.new_price)}</span>
      </p>
    )
  }

  if (event.type === 'edit') {
    return <p className={cn('mt-1 text-[13px]')}>{fieldsLabel(payload.fields) ?? '—'}</p>
  }

  const outcome = callOutcome(payload.outcome)

  return (
    <div className="mt-1">
      {payload.text ? <p className="text-[13px] leading-snug">{payload.text}</p> : null}
      {outcome ? <p className="text-[12px] text-muted">{outcome}</p> : null}
    </div>
  )
}
