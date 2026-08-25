import { eq } from 'drizzle-orm'

import { hasBotToken, sendMessage, sendPhoto } from './api'
import {
  callMessage,
  commentMessage,
  listingUrl,
  newListingMessage,
  priceMessage,
  stageMessage,
  type NotificationKind,
} from './messages'

import { db } from '@/db'
import { getSettings } from '@/db/settings'
import { rememberBotMessage } from '@/db/tg-messages'
import { listings, type Listing } from '@/db/schema'
import { timeInKyiv } from '@/lib/dates'
import type { Settings } from '@/lib/settings'
import { signedFileUrl } from '@/lib/storage/signed'
import { otherAuthor, userNames, type Author } from '@/lib/users'
import type { Stage } from '@/lib/stages'

/**
 * Вихідні сповіщення — SPEC, «Telegram-бот».
 *
 * Три правила, які тут не міняються:
 *
 *   1. **пишемо іншому, не автору дії.** Свої ж дзвінки й коментарі назад не
 *      прилітають — це не стрічка новин, а спосіб не питати «ну що там»;
 *   2. **перемикачі з налаштувань отримувача.** Кожен вирішує сам, що його
 *      турбує, і валюту в повідомленні теж бере зі своїх налаштувань;
 *   3. **сповіщення ніколи не ламає дію.** Телеграм не відповів, токена немає,
 *      чат не заданий — подія все одно записана, а в лог іде попередження.
 *
 * Тихі години не глушать повідомлення, а знімають з нього звук
 * (`disable_notification`): загубити запис про дзвінок гірше, ніж тихо його
 * доставити.
 */

/** Який перемикач у налаштуваннях відповідає за цей тип. */
const TOGGLES: Record<NotificationKind, keyof Settings> = {
  new: 'notifyNew',
  call: 'notifyComment',
  comment: 'notifyComment',
  stage: 'notifyStage',
  price: 'notifyPrice',
}

function chatIdFor(author: Author): string | null {
  const value = author === 'me' ? process.env.TELEGRAM_CHAT_ID_ME : process.env.TELEGRAM_CHAT_ID_DAD
  return value?.trim() || null
}

/**
 * Тихі години. Проміжок може переходити через північ (22:00 → 08:00), тому
 * порівняння рядкове й двоскладове — так само, як його читає людина.
 */
export function isQuietNow(settings: Settings, now: string = timeInKyiv()): boolean {
  const { quietFrom, quietTo } = settings
  if (quietFrom === quietTo) return false

  return quietFrom < quietTo
    ? now >= quietFrom && now < quietTo
    : now >= quietFrom || now < quietTo
}

/**
 * Фото для повідомлення. Спершу наша копія — вона нікуди не дінеться і живе в
 * нашому сховищі; посилання до неї підписане й дійсне годину. Якщо копії ще
 * немає, беремо адресу з майданчика.
 */
function photoFor(listing: Listing): string | null {
  const key = listing.photosLocal[0] ?? listing.photosManual[0]
  if (key) {
    const signed = signedFileUrl(key)
    if (signed) return signed
  }

  const remote = listing.photos[0]
  return remote?.startsWith('http') ? remote : null
}

type Recipient = { author: Author; chatId: string; settings: Settings }

/** Кому насправді йде повідомлення цього типу — з урахуванням його перемикача. */
async function recipient(author: Author, kind: NotificationKind): Promise<Recipient | null> {
  if (!hasBotToken()) return null

  const chatId = chatIdFor(author)
  if (!chatId) return null

  const settings = await getSettings(author)
  if (!settings[TOGGLES[kind]]) return null

  return { author, chatId, settings }
}

/**
 * Одна доставка. Фото — окремим повідомленням із підписом, якщо воно є.
 *
 * Кожне надіслане повідомлення запамʼятовується разом з авто: відповідь
 * реплаєм на нього стане коментарем у стрічці саме цього авто.
 */
async function deliver(
  to: Recipient,
  listingId: string,
  text: string,
  photoUrl: string | null,
): Promise<void> {
  const silent = isQuietNow(to.settings)
  const button = { text: 'Відкрити картку', url: listingUrl(listingId) }

  let sent: { message_id: number } | null = null

  if (photoUrl) {
    try {
      sent = await sendPhoto(to.chatId, photoUrl, text, { silent, button })
    } catch (error) {
      // Telegram не дістав картинку (локальний APP_URL, зниклий CDN) — це не
      // привід ковтати саме повідомлення.
      console.warn('[telegram] фото не пішло, шлю текстом:', (error as Error).message)
    }
  }

  if (!sent) sent = await sendMessage(to.chatId, text, { silent, button })

  await rememberBotMessage(to.chatId, sent.message_id, listingId)
}

/** Спільна обгортка: сповіщення не має права зламати дію, яка його породила. */
async function safely(what: string, send: () => Promise<void>): Promise<void> {
  try {
    await send()
  } catch (error) {
    console.warn(`[telegram] ${what}: ${(error as Error).message}`)
  }
}

async function listingById(listingId: string): Promise<Listing | null> {
  const [row] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1)
  return row ?? null
}

/* -------------------------------------------------------------------------- */
/*  Події                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Нове авто. Викликається **після** парсингу: у повідомленні мають бути назва і
 * ціна, а не порожня картка з посиланням.
 */
export async function notifyNewListing(listingId: string, actor: Author): Promise<void> {
  await safely('нове авто', async () => {
    const to = await recipient(otherAuthor(actor), 'new')
    if (!to) return

    const listing = await listingById(listingId)
    if (!listing) return

    const text = newListingMessage(listing, userNames()[actor], to.settings.currency)
    await deliver(to, listing.id, text, photoFor(listing))
  })
}

export async function notifyCall(
  listingId: string,
  actor: Author,
  call: { outcome: string; text: string | null; offeredPrice: number | null },
): Promise<void> {
  await safely('дзвінок', async () => {
    const to = await recipient(otherAuthor(actor), 'call')
    if (!to) return

    const listing = await listingById(listingId)
    if (!listing) return

    await deliver(to, listing.id, callMessage(listing, userNames()[actor], to.settings.currency, call), null)
  })
}

export async function notifyComment(
  listingId: string,
  actor: Author,
  text: string,
): Promise<void> {
  await safely('коментар', async () => {
    const to = await recipient(otherAuthor(actor), 'comment')
    if (!to) return

    const listing = await listingById(listingId)
    if (!listing) return

    await deliver(
      to,
      listing.id,
      commentMessage(listing, userNames()[actor], to.settings.currency, text),
      null,
    )
  })
}

export async function notifyStage(listingId: string, actor: Author, stage: Stage): Promise<void> {
  await safely('етап', async () => {
    const to = await recipient(otherAuthor(actor), 'stage')
    if (!to) return

    const listing = await listingById(listingId)
    if (!listing) return

    await deliver(
      to,
      listing.id,
      stageMessage(listing, userNames()[actor], to.settings.currency, stage),
      null,
    )
  })
}

/**
 * Ціна змінилась між двома постами. На відміну від ціни в оголошенні, тут є
 * автор дії — той, хто переслав, — тому діє звичне правило «пишемо іншому».
 */
export async function notifyPostPrice(
  listing: Listing,
  actor: Author,
  change: { oldPrice: number; newPrice: number },
): Promise<void> {
  await safely('ціна з поста', async () => {
    const to = await recipient(otherAuthor(actor), 'price')
    if (!to) return

    await deliver(to, listing.id, priceMessage(listing, to.settings.currency, change), null)
  })
}

/**
 * Зміна ціни в оголошенні. Єдиний випадок, коли пишемо **обом**: діяв не
 * користувач, а продавець, і «автора дії», якого треба обійти, тут немає.
 */
export async function notifyPriceChange(
  listing: Listing,
  change: { oldPrice: number; newPrice: number },
): Promise<void> {
  await safely('зміна ціни', async () => {
    for (const author of ['me', 'dad'] as const) {
      const to = await recipient(author, 'price')
      if (!to) continue

      await deliver(to, listing.id, priceMessage(listing, to.settings.currency, change), null)
    }
  })
}
