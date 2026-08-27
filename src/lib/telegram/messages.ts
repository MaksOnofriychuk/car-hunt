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
export type NotificationKind = 'new' | 'call' | 'comment' | 'stage' | 'price' | 'removed'

const ICONS: Record<NotificationKind, string> = {
  new: '🚗',
  call: '📞',
  comment: '💬',
  stage: '📌',
  price: '💸',
  removed: '🏁',
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

/**
 * Оголошення зникло з майданчика. Найчастіше це продаж — але буває і зняття «до
 * весни», тому в тексті «зняли», а не «продали»: стверджувати те, чого ми не
 * бачили, повідомлення не має. Ціна тут остання відома, і це важливо: картка
 * лишається в архіві назавжди, і саме за цією ціною авто зійшло з дистанції.
 */
export function removedMessage(listing: Listing, currency: Currency): string {
  const { title, specs, price } = head(listing, currency)

  return [
    `${ICONS.removed} <b>${title}</b> — оголошення зняли`,
    specs || null,
    `Схоже, продали. Остання ціна <b>${price}</b>`,
    `<a href="${listingUrl(listing.id)}">картка</a>`,
  ]
    .filter(Boolean)
    .join('\n')
}

/* -------------------------------------------------------------------------- */
/*  Відповіді бота на вхідні                                                   */
/* -------------------------------------------------------------------------- */

/** Коротка довідка. Заразом показує chat.id — щоб не діставати його курлом. */
export function helpMessage(chatId: number | string): string {
  return [
    '<b>Car Hunt</b> — трекер пошуку авто.',
    '',
    'Що вмію:',
    '• кинь посилання на AUTO.RIA або OLX — заведу картку;',
    '• перешли пост із групи — витягну телефон, ціну і VIN, а якщо в пості є',
    '  посилання на оголошення, доклею до тієї ж картки, а не створю другу;',
    '• відповідай реплаєм на моє повідомлення — запишу коментар до того авто;',
    '• /today — кому дзвонити сьогодні.',
    '',
    `Твій chat id: <code>${chatId}</code>`,
  ].join('\n')
}

export type TodayCar = {
  id: string
  title: string | null
  priceUsd: number | null
  priceUah: number | null
  overdue: boolean
}

/** «Сьогодні дзвонити» — прострочене вгорі, бо саме воно і горить. */
export function todayMessage(cars: TodayCar[], currency: Currency, limit = 20): string {
  if (cars.length === 0) return '📋 На сьогодні дзвонити нема кому. Черга порожня.'

  const lines = cars.slice(0, limit).map((car) => {
    const price = formatPrice(car.priceUsd, car.priceUah, currency)
    const mark = car.overdue ? '❗️' : '•'
    return `${mark} <a href="${listingUrl(car.id)}">${escapeHtml(car.title ?? 'Без назви')}</a> — ${price}`
  })

  const tail = cars.length > limit ? [`… і ще ${cars.length - limit}`] : []

  return [`📋 <b>Сьогодні дзвонити: ${cars.length}</b>`, ...lines, ...tail].join('\n')
}

/** Відповідь на кинуте посилання. */
export function addedMessage(
  listing: Pick<Listing, 'id' | 'title' | 'priceUsd' | 'priceUah'>,
  currency: Currency,
  duplicate: boolean,
): string {
  const title = escapeHtml(listing.title ?? 'Без назви')
  const price = formatPrice(listing.priceUsd, listing.priceUah, currency)

  return duplicate
    ? `Це авто вже є: <b>${title}</b> — ${price}`
    : `Додав: <b>${title}</b> — ${price}`
}

/** Відповідь на переслений пост: що саме з нього дістали. */
export function postSavedMessage(
  title: string | null,
  priceUsd: number | null,
  currency: Currency,
  options: { created: boolean; duplicate: boolean; phones: string[]; sameAs: string[] },
): string {
  if (options.duplicate) return `Цей пост уже є — нічого не дублюю.`

  const head = options.created
    ? `Завів: <b>${escapeHtml(title ?? 'Без назви')}</b>`
    : `Доклеїв пост до <b>${escapeHtml(title ?? 'Без назви')}</b>`

  const parts = [head]
  if (priceUsd) parts.push(`ціна з поста ${formatPrice(priceUsd, null, currency)}`)
  if (options.phones.length > 0) parts.push(`телефон ${options.phones.join(', ')}`)

  const warning =
    options.sameAs.length > 0
      ? `\n⚠️ Цей номер уже записаний у ${options.sameAs.map(escapeHtml).join(', ')} — може, та сама людина.`
      : ''

  return parts.join(' · ') + warning
}
