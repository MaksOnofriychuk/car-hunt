import Image from 'next/image'
import Link from 'next/link'

import { CardMenu } from './CardMenu'
import { DaysBadge, daysWord } from './DaysBadge'
import { Odometer } from './Odometer'
import { QuickActions } from './QuickActions'

import type { ListingRow, ListingSummary } from '@/db/list'
import type { Author } from '@/db/schema'
import { cn } from '@/lib/cn'
import { daysOnSale, daysSince, formatDate } from '@/lib/dates'
import {
  contactLabel,
  contactShort,
  formatKm,
  formatNumber,
  formatPrice,
  splitPrice,
} from '@/lib/format'
import { DENSITY_CLASSES, type Density } from '@/lib/look'
import { displayPhotos } from '@/lib/photos'
import type { Currency } from '@/lib/settings'
import { SOURCE_LABELS, SOURCE_SHORT } from '@/lib/sources/labels'
import { STAGES, STAGE_LABELS, stageIndex } from '@/lib/stages'

/**
 * Картка авто в черзі — аркуш 04 із `design/`, напрямок 1c «Світні краї».
 * Сім станів, і кожен читається з відстані витягнутої руки: тон поверхні й
 * ребро зліва кажуть, що з авто, ще до того, як очі дійдуть до тексту.
 *
 * Порядок усередині картки теж із макета: назва і знак із днями → рядок
 * «рік · пробіг · місто · джерело» → ціна з ціллю праворуч → драбина етапів →
 * цитата → дії.
 */

type Props = {
  row: ListingRow
  today: string
  viewer: Author
  names: Record<Author, string>
  /** Поточні фільтри — щоб з картки авто повернутись у той самий список. */
  search: string
  display: { currency: Currency; longStandingDays: number }
  density: Density
  /**
   * `compact` — секція «Далі» й архів: там авто ще (або вже) не на часі, і
   * кожне з них не варте двох великих кнопок. Один рядок замість картки.
   */
  variant?: 'full' | 'compact'
}

/** Що саме показувати. Порядок перевірок і є пріоритетом станів. */
type CardState = 'pending' | 'failed' | 'won' | 'lost' | 'removed' | 'overdue' | 'normal'

function stateOf(row: ListingRow, today: string): CardState {
  if (row.listing.status === 'pending') return 'pending'
  if (row.listing.status === 'failed') return 'failed'
  if (row.stage === 'won') return 'won'
  if (row.stage === 'lost') return 'lost'
  if (row.listing.status === 'removed') return 'removed'
  return contactLabel(row.listing.nextContactAt, today).overdue ? 'overdue' : 'normal'
}

export function ListingCard({
  row,
  today,
  viewer,
  names,
  search,
  display,
  density,
  variant = 'full',
}: Props) {
  const state = stateOf(row, today)
  const { listing } = row

  const href = search
    ? `/listing/${listing.id}?from=${encodeURIComponent(search)}`
    : `/listing/${listing.id}`

  // «Не актуально» згортається в рядок: нічого не видаляється, але й місця в
  // робочій черзі не займає (аркуш 04, «не актуально — згорнута в рядок»).
  if (state === 'lost') {
    return <CollapsedRow row={row} href={href} viewer={viewer} names={names} display={display} />
  }

  // Компактний рядок з'їдає всі стани: в архіві й у «Далі» велика картка з
  // кнопками просить уваги, якої ці авто не варті.
  if (variant === 'compact') {
    return <CompactCard row={row} href={href} today={today} display={display} state={state} />
  }

  if (state === 'pending') return <PendingCard listing={listing} density={density} />
  if (state === 'failed') return <FailedCard listing={listing} density={density} />

  const contact = contactShort(listing.nextContactAt, today)
  const note = row.lastNote ?? row.lastEvent
  const pad = DENSITY_CLASSES[density].card
  const dim = state === 'removed'
  const photo = displayPhotos(listing, postKeys(row))[0] ?? null

  return (
    <article
      className={cn(
        'card-in surface rib',
        state === 'overdue' && 'surface-danger pulse-danger border-l-danger',
        state === 'won' && 'surface-ok border-l-ok',
        state === 'normal' && 'border-l-accent',
        dim && 'border-l-edge opacity-60',
        pad,
      )}
    >
      <Link href={href} className="block">
        <div className="flex gap-2.5">
          {/* Одне фото: авто впізнають оком, а не назвою — «Passat B7» їх три
              в списку, а срібний універсал серед них один. */}
          {photo ? (
            <Image
              src={photo}
              alt=""
              width={132}
              height={99}
              className={cn(
                'h-[66px] w-[88px] shrink-0 rounded-chip border border-edge object-cover',
                dim && 'opacity-60',
              )}
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <header className="flex items-start gap-2">
              {/* Два рядки, а не обрізання: «Volkswagen Passat B7 2.0 TDI» на
                  390px інакше перетворюється на «Volkswagen Passat ...». */}
              <h2
                className={cn(
                  't-title line-clamp-2 min-w-0 flex-1 break-words',
                  dim && 'text-muted',
                )}
              >
                {listing.title ?? 'Без назви'}
              </h2>

              {state === 'won' ? (
                <span className="t-micro shrink-0 rounded-chip border border-ok px-2 py-1 text-ok">
                  Куплено
                </span>
              ) : (
                <DaysBadge
                  days={daysOnSale(listing.publishedAt)}
                  longStanding={display.longStandingDays}
                  tone={state === 'overdue' ? 'overdue' : state === 'removed' ? 'past' : 'normal'}
                />
              )}
            </header>

            {/* Рядок упізнавання: рік, пробіг, місто, джерело — саме в цьому порядку. */}
            <p className="t-num mt-1 truncate text-[12px] text-faint">
              {[
                listing.year ? String(listing.year) : null,
                listing.mileageKm ? formatKm(listing.mileageKm) : null,
                listing.city,
                SOURCE_SHORT[listing.source] ?? listing.source,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-end gap-3">
          <Price
            listing={listing}
            currency={display.currency}
            struck={dim}
            label={state === 'won' ? 'Взяли за' : null}
          />

          <dl className="shrink-0 text-right">
            {state === 'won' && row.priceDrop ? (
              <>
                <dt className="t-micro text-faint">Збили</dt>
                <dd className="t-num text-[17px] text-ok">−{formatNumber(row.priceDrop)}</dd>
              </>
            ) : listing.targetPriceUsd ? (
              <>
                <dt className="t-micro text-faint">Ціль</dt>
                <dd className="t-num text-[17px]">{formatNumber(listing.targetPriceUsd)}</dd>
              </>
            ) : null}
          </dl>
        </div>

        {row.priceDrop && state !== 'won' ? (
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="chip-ok t-num rounded-chip px-1.5 py-0.5 text-[12px]">
              ↓ {formatNumber(row.priceDrop)}
            </span>
            {row.priceDropDays ? (
              <span className="t-body text-faint">за {row.priceDropDays} дн.</span>
            ) : null}
          </p>
        ) : null}

        {state === 'overdue' ? (
          // Прострочене не пояснює, на якому воно етапі, — воно каже, що по
          // ньому мали подзвонити і коли саме.
          <p className="mt-2.5 flex items-baseline gap-2 rounded-chip bg-danger/12 px-2 py-1.5">
            <span className="t-micro text-danger">
              Прострочено {contact.text?.replace('−', '')}
            </span>
            <span className="t-body ml-auto shrink-0 text-muted">
              мали дзвонити {listing.nextContactAt ? formatDate(listing.nextContactAt) : '—'}
            </span>
          </p>
        ) : dim ? (
          <p className="mt-2.5 flex items-baseline gap-2">
            <span className="t-micro rounded-chip border border-edge px-1.5 py-1 text-faint">
              Знято з продажу
            </span>
            <span className="t-body ml-auto text-faint">історія збережена</span>
          </p>
        ) : (
          <div className="mt-2.5">
            <StageLadder stage={row.stage} />
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className={cn('t-micro', state === 'won' ? 'text-ok' : 'text-accent-lit')}>
                Етап {stageIndex(row.stage) + 1} · {STAGE_LABELS[row.stage]}
              </span>
              {contact.text ? (
                <span className="t-body ml-auto shrink-0 text-faint">контакт — {contact.text}</span>
              ) : null}
            </p>
          </div>
        )}

        {note?.text ? (
          <blockquote className="sunken mt-2.5 px-2.5 py-2">
            <p className="t-body line-clamp-2">«{note.text}»</p>
            <p className="mt-1 flex items-center gap-1.5">
              <span className="t-micro rounded-chip border border-edge px-1 py-0.5 text-faint">
                {(note.author === viewer ? 'Я' : names[note.author]).slice(0, 1).toUpperCase()}
              </span>
              <span className="t-micro text-faint">
                {note.author === viewer ? '' : `${names[note.author]} · `}
                {agoLabel(daysSince(note.createdAt))}
              </span>
            </p>
          </blockquote>
        ) : null}
      </Link>

      {dim ? null : (
        <QuickActions
          listingId={listing.id}
          overdue={state === 'overdue'}
          archived={listing.archived}
          title={listing.title ?? 'Без назви'}
          phones={row.seller?.phones ?? []}
        />
      )}
    </article>
  )
}

/* --------------------------------- частини -------------------------------- */

/** Ціна: знак валюти дрібний і тьмяний, число — головне на екрані. */
function Price({
  listing,
  currency,
  struck,
  label,
}: {
  listing: ListingSummary
  currency: Currency
  struck?: boolean
  label?: string | null
}) {
  const price = splitPrice(listing.priceUsd, listing.priceUah, currency)

  return (
    <div className="min-w-0 flex-1">
      {label ? <p className="t-micro text-faint">{label}</p> : null}
      <p
        className={cn(
          'flex items-baseline gap-1.5',
          struck && 'text-faint line-through decoration-1',
        )}
      >
        {price.prefix ? <span className="t-num text-[17px] text-faint">{price.prefix}</span> : null}
        <Odometer value={price.value} className="t-display truncate" />
        {price.suffix ? <span className="t-num text-[17px] text-faint">{price.suffix}</span> : null}
      </p>
      {price.second ? <p className="t-num text-[12px] text-faint">{price.second}</p> : null}
    </div>
  )
}

/** Драбина етапів: пройдені сегменти акцентні, решта — волосінь. */
function StageLadder({ stage }: { stage: ListingRow['stage'] }) {
  const steps = STAGES.filter((value) => value !== 'lost')
  const current = stageIndex(stage)

  return (
    <div className="flex gap-1" aria-hidden>
      {steps.map((value, index) => (
        <span
          key={value}
          className={cn(
            'h-[3px] flex-1 rounded-full transition-colors duration-(--t-base)',
            index <= current ? (stage === 'won' ? 'bg-ok' : 'bg-accent') : 'bg-edge',
          )}
        />
      ))}
    </div>
  )
}

/* --------------------------------- стани ---------------------------------- */

/** Щойно закинули посилання: поля наливаються даними. */
function PendingCard({ listing, density }: { listing: ListingSummary; density: Density }) {
  return (
    <article className={cn('card-in surface rib border-l-edge', DENSITY_CLASSES[density].card)}>
      <p className="t-micro text-faint">
        Парсинг {SOURCE_LABELS[listing.source] ?? listing.source}
      </p>

      <div className="mt-2 space-y-2">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton h-3 w-2/3" />
      </div>

      <p className="t-num mt-2 truncate text-[11px] text-faint">{listing.url}</p>
    </article>
  )
}

/** Парсер не впорався. Посилання не губиться ніколи — його видно і його чинять. */
function FailedCard({ listing, density }: { listing: ListingSummary; density: Density }) {
  return (
    <article
      className={cn('card-in surface surface-warn rib border-l-warn', DENSITY_CLASSES[density].card)}
    >
      <p className="t-micro flex items-center gap-1.5 text-warn">
        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
        Не розпізналось
      </p>

      <p className="t-num sunken mt-2 truncate p-2 text-[12px] text-muted">{listing.url}</p>

      <p className="t-body mt-2 text-muted">
        Сторінка без знайомої структури. Можна заповнити руками — посилання нікуди не дінеться.
      </p>

      <div className="mt-3 flex gap-2">
        <Link href={`/listing/${listing.id}/edit`} className="btn tap flex-1 border-warn text-warn">
          Заповнити вручну
        </Link>
        <a href={listing.url} target="_blank" rel="noreferrer" className="btn tap btn-quiet shrink-0">
          Відкрити
        </a>
      </div>
    </article>
  )
}

/**
 * «Не актуально» — згорнутий рядок. Живе внизу черги: нічого не видаляється,
 * але й уваги більше не просить (аркуш 04).
 */
function CollapsedRow({
  row,
  href,
  viewer,
  names,
  display,
}: {
  row: ListingRow
  href: string
  viewer: Author
  names: Record<Author, string>
  display: { currency: Currency; longStandingDays: number }
}) {
  const { listing } = row
  const note = row.lastNote ?? row.lastEvent

  return (
    <Link
      href={href}
      className="surface rib flex items-center gap-2.5 border-l-edge px-3 py-2.5 opacity-60 transition-opacity duration-(--t-instant) hover:opacity-100"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />

      <span className="min-w-0 flex-1">
        <span className="t-body block truncate text-muted">
          {listing.title ?? 'Без назви'}
          {note?.text ? ` — ${note.text}` : null}
        </span>
        <span className="t-micro text-faint">
          {note ? `${note.author === viewer ? 'Я' : names[note.author]} · ` : null}
          {note ? formatDate(note.createdAt) : 'відпало'}
        </span>
      </span>

      <span className="t-num shrink-0 text-[13px] text-faint line-through decoration-1">
        {formatPrice(listing.priceUsd, listing.priceUah, display.currency)}
      </span>
    </Link>
  )
}

/** Один рядок замість картки — для «Далі» й архіву. */
function CompactCard({
  row,
  href,
  today,
  display,
  state,
}: {
  row: ListingRow
  href: string
  today: string
  display: { currency: Currency; longStandingDays: number }
  state: CardState
}) {
  const { listing } = row
  const contact = contactShort(listing.nextContactAt, today)
  const days = daysOnSale(listing.publishedAt)
  const hasPrice = listing.priceUsd !== null || listing.priceUah !== null
  const photo = displayPhotos(listing, postKeys(row))[0] ?? null

  return (
    // Меню — сусід посилання, а не його вміст: кнопка всередині <a> ламає і
    // розмітку, і клавіатуру.
    <div
      className={cn(
        'surface rib flex items-center gap-2.5 pl-3 pr-2 transition-colors duration-(--t-instant) hover:border-l-accent',
        state === 'overdue' && 'border-l-danger',
        state === 'won' && 'border-l-ok',
        state === 'failed' && 'border-l-warn',
        state !== 'overdue' && state !== 'won' && state !== 'failed' && 'border-l-edge',
      )}
    >
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-2.5 py-2">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={72}
            height={54}
            className="h-9 w-12 shrink-0 rounded-chip border border-edge object-cover"
          />
        ) : null}

        <span className="min-w-0 flex-1">
          <span className="t-body block truncate font-semibold">
            {listing.title ?? hostOf(listing.url)}
          </span>
          <span className={cn('t-micro', state === 'failed' ? 'text-warn' : 'text-faint')}>
            {contact.text ? `${contact.text} · ` : null}
            {state === 'failed'
              ? 'Не розпізналось'
              : state === 'pending'
                ? 'Читаємо…'
                : STAGE_LABELS[row.stage]}
          </span>
        </span>

        <span className="t-num shrink-0 text-[15px]">
          {hasPrice ? formatPrice(listing.priceUsd, listing.priceUah, display.currency) : '—'}
        </span>

        <span
          className={cn(
            't-num w-8 shrink-0 text-right text-[12px]',
            days !== null && days > display.longStandingDays ? 'text-accent-lit' : 'text-faint',
          )}
        >
          {days ?? '—'}д
        </span>
      </Link>

      <CardMenu
        listingId={listing.id}
        archived={listing.archived}
        title={listing.title ?? 'Без назви'}
        className="shrink-0"
      />
    </div>
  )
}

/* --------------------------------- дрібне --------------------------------- */

/** Фото з поста — запасний варіант для карток, у яких своїх фото немає. */
function postKeys(row: ListingRow): string[] {
  return row.postPhoto ? [row.postPhoto] : []
}

/** Домен замість назви, коли парсер не дійшов до неї. */
function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function agoLabel(daysAgo: number) {
  if (daysAgo <= 0) return 'сьогодні'
  if (daysAgo === 1) return 'вчора'
  return `${daysAgo} ${daysWord(daysAgo)} тому`
}
