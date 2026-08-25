import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Description } from '@/components/Description'
import { EventFeed } from '@/components/EventFeed'
import { ListingActions } from '@/components/ListingActions'
import { ManualFields } from '@/components/ManualFields'
import { ArchiveToggle, ContactDate, TargetPrice } from '@/components/ListingFields'
import { PhotoGallery } from '@/components/PhotoGallery'
import { PlateStrip } from '@/components/PlateStrip'
import { PriceChart } from '@/components/PriceChart'
import { SellerPhones } from '@/components/SellerPhones'
import { Specs } from '@/components/Specs'
import { StageBadge } from '@/components/StageBadge'
import { getListingDetail } from '@/db/queries'
import { getSettings } from '@/db/settings'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { daysOnSale, formatDate } from '@/lib/dates'
import { contactLabel, formatKm, formatNumber, formatUah, formatUsd } from '@/lib/format'
import { displayPhotos } from '@/lib/photos'
import { sellerHint } from '@/lib/seller-hint'
import { listingSpecs } from '@/lib/specs'
import { todayInKyiv } from '@/lib/dates'
import { userNames } from '@/lib/users'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELLER_TYPES: Record<string, string> = {
  owner: 'Власник',
  dealer: 'Перекуп',
  showroom: 'Автосалон',
  unknown: 'Невідомо',
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  /** `from` — фільтри списку, з якого сюди прийшли: щоб «← Черга» повертала туди ж. */
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const { author } = await requireSession()
  const settings = await getSettings(author)
  const { from } = await searchParams
  const detail = await getListingDetail(id)
  if (!detail) notFound()

  const backHref = from ? `/?${from}` : '/'

  const { listing, seller, sameAs, stage, events, prices } = detail
  const hint = sellerHint(listing.snapshotRaw)
  const names = userNames()
  const photos = displayPhotos(listing)
  const specs = listingSpecs(listing.snapshotRaw)
  const contact = contactLabel(listing.nextContactAt, todayInKyiv())

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      <Link
        href={backHref}
        className="inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        ← Черга
      </Link>

      <PhotoGallery photos={photos} title={listing.title ?? 'Авто'} />

      <section className="rounded-card border border-line bg-card p-3">
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
            {settings.currency === 'uah' && listing.priceUah
              ? formatUah(listing.priceUah)
              : formatUsd(listing.priceUsd)}
          </span>
          {listing.priceUah && settings.currency !== 'uah' ? (
            <span className="font-mono text-[13px] leading-none tabular-nums text-muted">
              {formatUah(listing.priceUah)}
            </span>
          ) : null}
          <StageBadge stage={stage} className="ml-auto" />
        </div>

        <PlateStrip
          days={daysOnSale(listing.publishedAt)}
          longStandingDays={settings.longStandingDays}
          className="mt-3"
        />

        {listing.status === 'removed' ? (
          <p className="mt-2 text-[12px] text-muted">
            Оголошення зняте з AUTO.RIA. Дані лишаються тут назавжди.
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-3">
          {listing.url ? (
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-[11px] text-plate underline underline-offset-2"
            >
              {listing.url}
            </a>
          ) : (
            <span className="min-w-0 flex-1 text-[11px] text-muted">Заведено руками</span>
          )}
          <Link
            href={`/listing/${listing.id}/edit`}
            className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-plate"
          >
            Редагувати
          </Link>
        </div>
      </section>

      <ManualFields listingId={listing.id} fields={listing.manualFields} />

      <Specs listing={listing} specs={specs} />

      {listing.descriptionText ? (
        <section className="rounded-card border border-line bg-card p-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Опис від продавця
          </h2>
          <div className="mt-2">
            <Description text={listing.descriptionText} />
          </div>
        </section>
      ) : null}

      {/* Два поля, які редагуються в один тап — SPEC, «Інтерфейс». */}
      <section className="rounded-card border border-line bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Цільова ціна
          </span>
          <TargetPrice listingId={listing.id} value={listing.targetPriceUsd} />
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
          <div className="mt-2">
            <ContactDate listingId={listing.id} hasDate={listing.nextContactAt !== null} />
          </div>
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <ArchiveToggle listingId={listing.id} archived={listing.archived} />
        </div>
      </section>

      {prices.length > 1 ? (
        <section className="rounded-card border border-line bg-card p-3">
          <PriceChart points={prices} />
        </section>
      ) : null}

      {/* Секція є завжди: номер вводиться руками, і без неї його нікуди вписати. */}
      <section className="rounded-card border border-line bg-card p-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Продавець
        </span>
        {/* Клік по продавцю веде на його сторінку: там усі його авто і вся
            історія розмов, а не тільки це оголошення. */}
        <p className="mt-1 text-[15px] font-semibold">
          {seller ? (
            <Link href={`/sellers/${seller.id}`} className="underline decoration-line underline-offset-4">
              {seller.name ?? 'Без імені'}
            </Link>
          ) : (
            (hint.name ?? 'Без імені')
          )}
        </p>
        <p className="text-[12px] text-muted">
          {SELLER_TYPES[seller?.type ?? hint.type ?? 'unknown']}
          {specs.sellerRating ? ` · рейтинг ${specs.sellerRating} з 5` : null}
          {specs.sellerReviews ? ` · ${formatNumber(specs.sellerReviews)} відгуків` : null}
        </p>
        {specs.sellerOtherCars || specs.sellerSince ? (
          <p className="text-[12px] text-muted">
            {[
              specs.sellerOtherCars ? `${formatNumber(specs.sellerOtherCars)} оголошень` : null,
              specs.sellerSince,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}

        <SellerPhones
          listingId={listing.id}
          phones={seller?.phones ?? []}
          masked={hint.phoneMasked}
          sharedWith={sameAs}
        />

        {seller?.notes ? <p className="mt-2 text-[13px] leading-snug">{seller.notes}</p> : null}
      </section>

      <section className="rounded-card border border-line bg-card p-3">
        <ListingActions listingId={listing.id} stage={stage} />

        <h2 className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Стрічка подій
        </h2>
        <EventFeed events={events} viewer={author} names={names} />
      </section>
    </div>
  )
}
