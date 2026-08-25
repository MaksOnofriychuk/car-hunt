import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Description } from '@/components/Description'
import { EventFeed } from '@/components/EventFeed'
import { ListingActions } from '@/components/ListingActions'
import { ManualFields } from '@/components/ManualFields'
import { Odometer } from '@/components/Odometer'
import { ArchiveToggle, ContactDate, TargetPrice } from '@/components/ListingFields'
import { PhotoGallery } from '@/components/PhotoGallery'
import { DaysBadge } from '@/components/DaysBadge'
import { PriceChart } from '@/components/PriceChart'
import { SellerPhones } from '@/components/SellerPhones'
import { Specs } from '@/components/Specs'
import { TelegramPosts } from '@/components/TelegramPosts'
import { getListingDetail } from '@/db/queries'
import { getSettings } from '@/db/settings'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { daysOnSale, todayInKyiv } from '@/lib/dates'
import { contactLabel, formatNumber, formatPrice, formatUah, formatUsd } from '@/lib/format'
import { displayPhotos } from '@/lib/photos'
import { sellerHint } from '@/lib/seller-hint'
import { listingSpecs } from '@/lib/specs'
import { STAGES, STAGE_LABELS, stageIndex } from '@/lib/stages'
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
  /** `from` — фільтри списку, з якого сюди прийшли: щоб «←» повертала туди ж. */
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

  const { listing, seller, sameAs, stage, events, prices, posts } = detail
  const hint = sellerHint(listing.snapshotRaw)
  const names = userNames()
  const photos = displayPhotos(listing, posts.flatMap((post) => post.photosLocal))
  const specs = listingSpecs(listing.snapshotRaw)
  const contact = contactLabel(listing.nextContactAt, todayInKyiv())
  const days = daysOnSale(listing.publishedAt)

  // «Віддає» — остання ціна, яку продавець назвав у розмові. Це не поле, а
  // найсвіжіший дзвінок із проставленою сумою: торг живе в стрічці.
  const offered = events.find((event) => event.payload?.offered_price)?.payload?.offered_price
  // Скільки скинули від першого спостереження. Рахуємо по всій історії, а не
  // від попереднього кроку: важливо, наскільки авто подешевшало взагалі.
  const drop =
    prices.length > 1 && listing.priceUsd ? prices[0].priceUsd - listing.priceUsd : null

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-3">
      {/* Шапка: назад, назва, джерело і знак із днями на продажі. */}
      <header className="surface flex items-center gap-2.5 p-2">
        <Link
          href={backHref}
          aria-label="Назад до списку"
          className="btn btn-quiet tap w-11 shrink-0 text-[16px]"
        >
          ←
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="t-title truncate">
            {listing.title ?? 'Без назви'}{' '}
            {listing.year ? <span className="t-num text-muted">{listing.year}</span> : null}
          </h1>
          {listing.url ? (
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="t-num block truncate text-[11px] text-faint hover:text-accent-lit"
            >
              {shortUrl(listing.url)} ↗
            </a>
          ) : (
            <span className="t-micro block text-faint">Заведено руками</span>
          )}
        </div>

        <DaysBadge days={days} longStanding={settings.longStandingDays} />
      </header>

      <PhotoGallery photos={photos} title={listing.title ?? 'Авто'} />

      {/* Головне число екрана і те, що з ним відбувається: наша ціль, скільки
          просить продавець зараз і як ціна рухалась. */}
      <section className="surface p-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Odometer
              value={formatPrice(listing.priceUsd, listing.priceUah, settings.currency)}
              className={cn(
                't-display block truncate',
                listing.status === 'removed' && 'text-faint line-through decoration-1',
              )}
            />
            {listing.priceUah && settings.currency !== 'uah' ? (
              <p className="t-num mt-0.5 text-[12px] text-faint">{formatUah(listing.priceUah)}</p>
            ) : null}
            {drop && drop > 0 ? (
              <p className="t-micro mt-1.5 inline-flex items-center gap-1 rounded-chip border border-ok px-1.5 py-0.5 text-ok">
                ↓ {formatNumber(drop)} всього
              </p>
            ) : null}
          </div>

          <dl className="shrink-0 text-right">
            {listing.priceFromPost ? (
              <div className="mb-2">
                <dt className="t-micro text-faint">З поста</dt>
                <dd className="t-num text-[17px] text-accent-lit">
                  {formatNumber(listing.priceFromPost)}
                </dd>
                {listing.priceUsd && listing.priceFromPost < listing.priceUsd ? (
                  <dd className="t-micro text-ok">
                    −{formatNumber(listing.priceUsd - listing.priceFromPost)} до оголошення
                  </dd>
                ) : null}
              </div>
            ) : null}
            {offered ? (
              <div className="mb-2">
                <dt className="t-micro text-faint">Віддає</dt>
                <dd className="t-num text-[17px]">{formatUsd(offered)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="t-micro text-faint">Ціль</dt>
              <dd>
                <TargetPrice listingId={listing.id} value={listing.targetPriceUsd} />
              </dd>
            </div>
          </dl>
        </div>

        {prices.length > 1 ? <PriceChart points={prices} /> : null}

        {listing.status === 'removed' ? (
          <p className="t-body mt-3 text-muted">
            Оголошення зняте з продажу. Дані лишаються тут назавжди.
          </p>
        ) : null}
      </section>

      {/* Смуга стану: де ми у воронці й коли наступний контакт. */}
      <section className="surface px-3 py-2.5">
        <StageProgress stage={stage} />
        <div className="mt-2 flex items-baseline gap-2">
          <span className="t-micro text-accent-lit">{STAGE_LABELS[stage]}</span>
          <span
            className={cn(
              't-body ml-auto shrink-0',
              contact.overdue ? 'font-semibold text-danger' : 'text-muted',
            )}
          >
            {contact.text}
          </span>
        </div>
      </section>

      <ManualFields listingId={listing.id} fields={listing.manualFields} />

      <Specs listing={listing} specs={specs} />

      {listing.descriptionText ? (
        <section className="surface p-3">
          <h2 className="t-micro text-faint">Опис від продавця</h2>
          <div className="mt-2">
            <Description text={listing.descriptionText} />
          </div>
        </section>
      ) : null}

      {/* Секція є завжди: номер вводиться руками, і без неї його нікуди вписати. */}
      <section className="surface p-3">
        <h2 className="t-micro text-faint">Продавець</h2>

        <div className="mt-2 flex items-center gap-2.5">
          <span className="t-num sunken flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-[15px] text-muted">
            {initialOf(seller?.name ?? hint.name)}
          </span>

          <div className="min-w-0 flex-1">
            {/* Клік по продавцю веде на його сторінку: там усі його авто і вся
                історія розмов, а не тільки це оголошення. */}
            <p className="t-body truncate font-semibold">
              {seller ? (
                <Link href={`/sellers/${seller.id}`} className="hover:text-accent-lit">
                  {seller.name ?? 'Без імені'}
                </Link>
              ) : (
                (hint.name ?? 'Без імені')
              )}
            </p>
            <p className="t-micro truncate text-faint">
              {SELLER_TYPES[seller?.type ?? hint.type ?? 'unknown']}
              {specs.sellerRating ? ` · ${specs.sellerRating} з 5` : null}
              {specs.sellerOtherCars
                ? ` · ${formatNumber(specs.sellerOtherCars)} оголошень`
                : null}
            </p>
          </div>

          {seller ? (
            <Link
              href={`/sellers/${seller.id}`}
              aria-label="Сторінка продавця"
              className="btn btn-quiet tap w-11 shrink-0 text-[16px]"
            >
              →
            </Link>
          ) : null}
        </div>

        <SellerPhones
          listingId={listing.id}
          phones={seller?.phones ?? []}
          masked={hint.phoneMasked}
          sharedWith={sameAs}
        />

        {seller?.notes ? <p className="t-body mt-2 text-muted">{seller.notes}</p> : null}
      </section>

      {/* Робочі поля картки: коли дзвонити і чи тримати в черзі. */}
      <section className="surface p-3">
        <h2 className="t-micro text-faint">Коли дзвонити</h2>
        <div className="mt-2">
          <ContactDate listingId={listing.id} hasDate={listing.nextContactAt !== null} />
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-edge pt-3">
          <ArchiveToggle listingId={listing.id} archived={listing.archived} />
          <Link
            href={`/listing/${listing.id}/edit`}
            className="t-micro ml-auto shrink-0 text-accent-lit"
          >
            Редагувати
          </Link>
        </div>
      </section>

      <TelegramPosts posts={posts} currency={settings.currency} />

      <section className="surface p-3">
        <h2 className="t-micro text-faint">{feedTitle(events)}</h2>
        <EventFeed events={events} viewer={author} names={names} />
      </section>

      {/* Панель дій липне до низу екрана: записати дзвінок можна з будь-якого
          місця картки, не гортаючи вниз. */}
      <ListingActions listingId={listing.id} stage={stage} phones={seller?.phones ?? []} />
    </div>
  )
}

/** Воронка сімома рисками. «Відпало» — не крок уперед, тому окремим тоном. */
function StageProgress({ stage }: { stage: (typeof STAGES)[number] }) {
  const current = stageIndex(stage)
  const lost = stage === 'lost'
  const steps = STAGES.filter((value) => value !== 'lost')

  return (
    <div className="flex gap-1" aria-hidden>
      {steps.map((value, index) => (
        <span
          key={value}
          className={cn(
            'h-[3px] flex-1 rounded-full transition-colors duration-(--t-base)',
            lost
              ? 'bg-edge'
              : index <= current
                ? stage === 'won'
                  ? 'bg-ok'
                  : 'bg-accent'
                : 'bg-edge',
          )}
        />
      ))}
    </div>
  )
}

function feedTitle(events: { type: string }[]) {
  const calls = events.filter((event) => event.type === 'call').length
  const comments = events.filter((event) => event.type === 'comment').length
  const parts = [
    calls > 0 ? `${calls} ${plural(calls, 'дзвінок', 'дзвінки', 'дзвінків')}` : null,
    comments > 0 ? `${comments} ${plural(comments, 'коментар', 'коментарі', 'коментарів')}` : null,
  ].filter(Boolean)

  return parts.length > 0 ? `Стрічка · ${parts.join(' · ')}` : 'Стрічка'
}

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** Перша літера імені — плитка замість аватарки, якої в нас ніде немає. */
function initialOf(name: string | null | undefined) {
  const letter = name?.trim()[0]
  return letter ? letter.toUpperCase() : '—'
}

/** Адреса без протоколу і без хвоста: у шапці важливо джерело, не рядок. */
function shortUrl(url: string) {
  try {
    const { host, pathname } = new URL(url)
    const clean = host.replace(/^www\./, '')
    const tail = pathname.replace(/\/$/, '').split('/').pop()
    return tail ? `${clean}/…/${tail.slice(0, 24)}` : clean
  } catch {
    return url
  }
}
