import type { Listing } from '@/db/schema'
import { daysOnSale } from '@/lib/dates'
import { CALL_OUTCOMES } from '@/lib/events'
import { formatKm, formatNumber, formatPrice } from '@/lib/format'
import type { Currency } from '@/lib/settings'
import { SOURCE_LABELS } from '@/lib/sources/labels'
import { STAGE_LABELS, type Stage } from '@/lib/stages'

/**
 * Тексти вихідних повідомлень. SPEC: «коротко, з назвою авто, ціною і прямим
 * посиланням на картку».
 *
 * Тут немає ні мережі, ні бази — на вхід готові дані, на вихід рядок. Ціну
 * форматуємо у валюті **отримувача**: у нас у кожного своя в налаштуваннях.
 */

/** Що саме сталось. Від типу залежить і значок, і перемикач у налаштуваннях. */
export type NotificationKind = 'new' | 'call' | 'comment' | 'stage' | 'price'

const ICONS: Record<NotificationKind, string> = {
  new: '🚗',
  call: '📞',
  comment: '💬',
  stage: '📌',
  price: '💸',
}

/** Розмітка в назвах авто трапляється: «Passat B7 <2.0 TDI>» зламав би HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Пряме посилання на картку. Без `APP_URL` посилання не буде — і це помітно. */
export function listingUrl(listingId: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, '') ?? ''
  return `${base}/listing/${listingId}`
}

/** Цитата в один рядок: у повідомленні розлогий коментар займе весь екран. */
function quote(text: string | null | undefined, limit = 180): string | null {
  const clean = text?.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return `«${escapeHtml(clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean)}»`
}

type Head = { title: string; specs: string; price: string }

function head(listing: Listing, currency: Currency): Head {
  const days = daysOnSale(listing.publishedAt)

  return {
    title: escapeHtml(listing.title ?? 'Без назви'),
    specs: [
      listing.year ? String(listing.year) : null,
      listing.mileageKm ? formatKm(listing.mileageKm) : null,
      listing.city,
      days !== null ? `${days} дн. в продажу` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    price: formatPrice(listing.priceUsd, listing.priceUah, currency),
  }
}

/** Спільний хвіст усіх повідомлень: ціна і посилання на картку. */
function tail(listing: Listing, currency: Currency): string {
  const { price } = head(listing, currency)
  return `${price} · <a href="${listingUrl(listing.id)}">картка</a>`
}

export function newListingMessage(
  listing: Listing,
  actorName: string,
  currency: Currency,
): string {
  const { title, specs, price } = head(listing, currency)
  const source = SOURCE_LABELS[listing.source] ?? listing.source

  return [
    `${ICONS.new} <b>${title}</b>`,
    specs || null,
    `<b>${price}</b> · ${escapeHtml(source)}`,
    `Додав ${escapeHtml(actorName)} · <a href="${listingUrl(listing.id)}">картка</a>`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function callMessage(
  listing: Listing,
  actorName: string,
  currency: Currency,
  call: { outcome: string; text: string | null; offeredPrice: number | null },
): string {
  const { title } = head(listing, currency)
  const outcome = CALL_OUTCOMES[call.outcome] ?? call.outcome
  const offered = call.offeredPrice ? `віддає $${formatNumber(call.offeredPrice)}` : null

  return [
    `${ICONS.call} <b>${title}</b>`,
    `${escapeHtml(actorName)} дзвонив: ${escapeHtml(outcome)}${offered ? ` · ${offered}` : ''}`,
    quote(call.text),
    tail(listing, currency),
  ]
    .filter(Boolean)
    .join('\n')
}

export function commentMessage(
  listing: Listing,
  actorName: string,
  currency: Currency,
  text: string,
): string {
  const { title } = head(listing, currency)

  return [
    `${ICONS.comment} <b>${title}</b>`,
    `${escapeHtml(actorName)} записав:`,
    quote(text, 400),
    tail(listing, currency),
  ]
    .filter(Boolean)
    .join('\n')
}

export function stageMessage(
  listing: Listing,
  actorName: string,
  currency: Currency,
  stage: Stage,
): string {
  const { title } = head(listing, currency)

  return [
    `${ICONS.stage} <b>${title}</b>`,
    `${escapeHtml(actorName)}: етап «${STAGE_LABELS[stage]}»`,
    tail(listing, currency),
  ].join('\n')
}

/**
 * Зміна ціни. Стрілка й слово — за напрямком: у списку сповіщень має бути
 * видно з першого погляду, дешевшає авто чи дорожчає.
 */
export function priceMessage(
  listing: Listing,
  currency: Currency,
  change: { oldPrice: number; newPrice: number },
): string {
  const { title, specs } = head(listing, currency)
  const down = change.newPrice < change.oldPrice
  const delta = Math.abs(change.newPrice - change.oldPrice)

  return [
    `${ICONS.price} <b>${title}</b> — ${down ? 'подешевшало' : 'подорожчало'}`,
    `$${formatNumber(change.oldPrice)} → <b>$${formatNumber(change.newPrice)}</b> (${
      down ? '−' : '+'
    }$${formatNumber(delta)})`,
    specs || null,
    `<a href="${listingUrl(listing.id)}">картка</a>`,
  ]
    .filter(Boolean)
    .join('\n')
}
