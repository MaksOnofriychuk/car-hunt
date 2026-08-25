import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EventFeed } from '@/components/EventFeed'
import { PlateStrip } from '@/components/PlateStrip'
import { PriceChart } from '@/components/PriceChart'
import { SellerPhones } from '@/components/SellerPhones'
import { StageBadge } from '@/components/StageBadge'
import { getListingDetail } from '@/db/queries'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { daysOnSale, formatDate } from '@/lib/dates'
import { contactLabel, formatKm, formatUsd } from '@/lib/format'
import { displayPhotos } from '@/lib/photos'
import { sellerHint } from '@/lib/seller-hint'
import { todayInKyiv } from '@/lib/dates'
import { userNames } from '@/lib/users'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELLER_TYPES: Record<string, string> = {
  owner: 'Власник',
  dealer: 'Перекуп',
  showroom: 'Автосалон',
  unknown: 'Невідомо',
}

/** Кнопки «коли дзвонити» зі SPEC: сьогодні / +3 / +7 / +14 днів. */
const CONTACT_PRESETS = ['сьогодні', '+3 дні', '+7 днів', '+14 днів']

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const { author } = await requireSession()
  const detail = await getListingDetail(id)
  if (!detail) notFound()

  const { listing, seller, sameAs, stage, events, prices } = detail
  const hint = sellerHint(listing.snapshotRaw)
  const names = userNames()
  const photos = displayPhotos(listing)
  const contact = contactLabel(listing.nextContactAt, todayInKyiv())

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        ← Черга
      </Link>

      {photos.length > 0 ? (
        <div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card border border-line bg-concrete">
            <Image
              src={photos[0]}
              alt=""
              fill
              sizes="(max-width: 560px) 100vw, 560px"
              className="object-cover"
              priority
            />
          </div>
          {photos.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {photos.slice(1).map((photo) => (
                <Image
                  key={photo}
                  src={photo}
                  alt=""
                  width={72}
                  height={54}
                  className="h-[54px] w-[72px] shrink-0 rounded-card border border-line object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-card border border-line bg-white p-3">
        <h1 className="text-[19px] font-semibold leading-tight">
          {listing.title ?? 'Без назви'}{' '}
          {listing.year ? (
            <span className="font-mono text-[16px] font-normal text-muted">{listing.year}</span>
          ) : null}
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          <span className="font-mono tabular-nums">{formatKm(listing.mileageKm)}</span>
          {listing.city ? ` · ${listing.city}` : null}
          {listing.publishedAt ? ` · опубліковано ${formatDate(listing.publishedAt)}` : null}
        </p>

        <div className="mt-3 flex items-baseline gap-2">
          <span
            className={cn(
              'font-mono text-[28px] font-semibold leading-none tabular-nums',
              listing.status === 'removed' && 'text-muted line-through decoration-1',
            )}
          >
            {formatUsd(listing.priceUsd)}
          </span>
          <StageBadge stage={stage} className="ml-auto" />
        </div>

        <PlateStrip days={daysOnSale(listing.publishedAt)} className="mt-3" />

        {listing.status === 'removed' ? (
          <p className="mt-2 text-[12px] text-muted">
            Оголошення зняте з AUTO.RIA. Дані лишаються тут назавжди.
          </p>
        ) : null}

        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block truncate font-mono text-[11px] text-plate underline underline-offset-2"
        >
          {listing.url}
        </a>
      </section>

      {/* Два поля, які редагуються в один тап — SPEC, «Інтерфейс». Вмикаємо на кроці «Події». */}
      <section className="rounded-card border border-line bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Цільова ціна
          </span>
          <button
            type="button"
            disabled
            className="font-mono text-[16px] font-semibold tabular-nums text-ink underline decoration-line underline-offset-4 disabled:opacity-70"
          >
            {formatUsd(listing.targetPriceUsd)}
          </button>
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Коли дзвонити
            </span>
            <span className={cn('text-[13px]', contact.overdue ? 'font-semibold' : 'text-muted')}>
              {contact.text}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {CONTACT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled
                className="h-9 rounded-card border border-line text-[11px] font-semibold text-muted disabled:opacity-60"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </section>

      {prices.length > 1 ? (
        <section className="rounded-card border border-line bg-white p-3">
          <PriceChart points={prices} />
        </section>
      ) : null}

      {/* Секція є завжди: номер вводиться руками, і без неї його нікуди вписати. */}
      <section className="rounded-card border border-line bg-white p-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Продавець
        </span>
        <p className="mt-1 text-[15px] font-semibold">
          {seller?.name ?? hint.name ?? 'Без імені'}
        </p>
        <p className="text-[12px] text-muted">
          {SELLER_TYPES[seller?.type ?? hint.type ?? 'unknown']}
        </p>

        <SellerPhones
          listingId={listing.id}
          phones={seller?.phones ?? []}
          masked={hint.phoneMasked}
          sharedWith={sameAs}
        />

        {seller?.notes ? <p className="mt-2 text-[13px] leading-snug">{seller.notes}</p> : null}
      </section>

      <section className="rounded-card border border-line bg-white p-3">
        <div className="flex gap-1.5">
          {['Дзвінок', 'Коментар', 'Змінити етап'].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              title="Зʼявиться на кроці «Події і робоча черга»"
              className="h-10 flex-1 rounded-card border border-ink text-[11px] font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>

        <h2 className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Стрічка подій
        </h2>
        <EventFeed events={events} viewer={author} names={names} />
      </section>
    </div>
  )
}
