import Image from 'next/image'
import Link from 'next/link'

import { PlateStrip } from './PlateStrip'
import { QuickActions } from './QuickActions'
import { StageBadge } from './StageBadge'

import type { ListingRow, ListingSummary } from '@/db/list'
import type { Author } from '@/db/schema'
import { cn } from '@/lib/cn'
import { daysOnSale, daysSince } from '@/lib/dates'
import { contactLabel, formatKm, formatUsd, shortAgo } from '@/lib/format'
import { displayPhotos } from '@/lib/photos'

type Props = {
  row: ListingRow
  today: string
  viewer: Author
  names: Record<Author, string>
  /** Поточні фільтри — щоб з картки авто повернутись у той самий список. */
  search: string
}

export function ListingCard({ row, today, viewer, names, search }: Props) {
  const { listing, stage, lastEvent, lastNote, priceDrop } = row
  const href = search
    ? `/listing/${listing.id}?from=${encodeURIComponent(search)}`
    : `/listing/${listing.id}`
  // Підпис «хто і коли» беремо з тієї ж події, що й цитата, — інакше вони розʼїжджаються.
  const meta = lastNote ?? lastEvent
  const contact = contactLabel(listing.nextContactAt, today)
  const removed = listing.status === 'removed'

  return (
    <article
      className={cn(
        'card-in overflow-hidden rounded-card border border-line bg-white',
        contact.overdue && 'border-l-[3px] border-l-signal',
        removed && 'opacity-70',
      )}
    >
      {listing.status === 'pending' ? (
        <PendingBody listing={listing} />
      ) : listing.status === 'failed' ? (
        <FailedBody listing={listing} />
      ) : (
        <Link href={href} className="block p-3">
          <header className="flex gap-3">
            <Thumbnail listing={listing} />
            <div className="min-w-0 flex-1">
              {/* Рік окремим елементом: інакше довга назва зʼїдає його разом з обрізанням. */}
              <h2 className="flex items-baseline gap-1.5 text-[16px] font-semibold leading-tight">
                <span className="min-w-0 truncate">{listing.title ?? 'Без назви'}</span>
                {listing.year ? (
                  <span className="shrink-0 font-mono text-[14px] font-normal text-muted">
                    {listing.year}
                  </span>
                ) : null}
              </h2>
              <p className="mt-1 truncate text-[13px] text-muted">
                <span className="font-mono tabular-nums">{formatKm(listing.mileageKm)}</span>
                {listing.city ? ` · ${listing.city}` : null}
              </p>
              {removed ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Знято з продажу
                </p>
              ) : null}
            </div>
          </header>

          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                'font-mono text-[22px] font-semibold leading-none tabular-nums',
                removed && 'line-through decoration-1',
              )}
            >
              {formatUsd(listing.priceUsd)}
            </span>
            {priceDrop ? (
              <span className="font-mono text-[13px] leading-none text-plate tabular-nums">
                ↓ {formatUsd(priceDrop)}
              </span>
            ) : null}
            {listing.targetPriceUsd ? (
              <span className="ml-auto font-mono text-[13px] leading-none text-muted tabular-nums">
                ціль {formatUsd(listing.targetPriceUsd)}
              </span>
            ) : null}
          </div>

          <PlateStrip days={daysOnSale(listing.publishedAt)} className="mt-3" />

          <div className="mt-3 flex items-center gap-2">
            <StageBadge stage={stage} />
            {meta ? (
              <span className="ml-auto shrink-0 text-[12px] text-muted">
                {meta.author === viewer ? 'Я' : names[meta.author]} ·{' '}
                <span className="font-mono tabular-nums">{shortAgo(daysSince(meta.createdAt))}</span>
              </span>
            ) : null}
          </div>

          {lastNote?.text ? (
            <p className="mt-1 truncate text-[13px] text-muted">«{lastNote.text}»</p>
          ) : null}
        </Link>
      )}

      <QuickActions
        listingId={listing.id}
        contactText={contact.text}
        overdue={contact.overdue}
      />
    </article>
  )
}

function Thumbnail({ listing }: { listing: ListingSummary }) {
  const photo = displayPhotos(listing)[0]

  if (!photo) {
    return (
      <div className="flex h-[63px] w-[84px] shrink-0 items-center justify-center rounded-card bg-concrete">
        <span className="font-mono text-[11px] font-semibold uppercase text-muted">
          {(listing.brand ?? '?').slice(0, 3)}
        </span>
      </div>
    )
  }

  return (
    <Image
      src={photo}
      alt=""
      width={84}
      height={63}
      className="h-[63px] w-[84px] shrink-0 rounded-card object-cover"
    />
  )
}

/** Щойно закинули посилання, парсер ще читає оголошення. */
function PendingBody({ listing }: { listing: ListingSummary }) {
  return (
    <div className="p-3">
      <div className="flex gap-3">
        <div className="h-[63px] w-[84px] shrink-0 rounded-card bg-concrete" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-4 w-3/4 rounded-card bg-concrete" />
          <div className="h-3 w-1/2 rounded-card bg-concrete" />
        </div>
      </div>
      <div className="mt-3 h-6 w-32 rounded-card bg-concrete" />
      <PlateStrip label="читаю оголошення" className="mt-3" />
      <p className="mt-2 truncate font-mono text-[11px] text-muted">{listing.url}</p>
    </div>
  )
}

/** Парсер не впорався. Посилання не губиться ніколи — SPEC. */
function FailedBody({ listing }: { listing: ListingSummary }) {
  return (
    <div className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        Не вдалось прочитати оголошення
      </p>
      <a
        href={listing.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block truncate font-mono text-[12px] text-plate underline underline-offset-2"
      >
        {listing.url}
      </a>
      <Link
        href={`/listing/${listing.id}/edit`}
        className="mt-3 inline-flex h-8 items-center rounded-card border border-ink px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
      >
        Заповнити вручну
      </Link>
    </div>
  )
}
