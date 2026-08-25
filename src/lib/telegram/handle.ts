import { sendMessage } from './api'
import { inboxKeyOf, processGroup, stage, sweepStaleInbox } from './inbox'
import { addedMessage, helpMessage, listingUrl, postSavedMessage, todayMessage } from './messages'
import { classify, type TelegramMessage, type TelegramUpdate } from './update'

import { db } from '@/db'
import { recordComment } from '@/db/events'
import { bucketByContact, getListings } from '@/db/list'
import { listings } from '@/db/schema'
import { getSettings } from '@/db/settings'
import { listingForBotMessage, rememberBotMessage } from '@/db/tg-messages'
import { ingestUrl, parseListing } from '@/lib/ingest'
import { DEFAULT_QUERY } from '@/lib/list-query'
import { notifyComment } from '@/lib/telegram/notify'
import type { Author } from '@/lib/users'
import { eq } from 'drizzle-orm'

/**
 * Що робити з тим, що прийшло. Вебхук лишається тонким: він перевіряє секрет,
 * кладе апдейт у чергу і одразу відповідає 200 — уся робота тут, у фоні.
 *
 * Кожна відповідь бота про конкретне авто запамʼятовується (`tg_messages`):
 * реплай на неї стане коментарем саме до того авто.
 */

export type Handled = { kind: string; listingId?: string }

export async function handleMessage(
  update: TelegramUpdate,
  message: TelegramMessage,
  author: Author,
): Promise<Handled> {
  const chatId = String(message.chat.id)
  const route = classify(message)

  // Заразом добираємо групи, які хтось узяв і не доробив: без цього загубився б
  // останній переслай за вечір, після якого апдейтів більше не буде.
  void sweepStaleInbox(1).catch(() => undefined)

  if (route.kind === 'reply') {
    const listingId = await listingForBotMessage(chatId, route.replyTo)

    if (listingId && route.text.trim()) {
      await recordComment(listingId, author, route.text.trim())
      await notifyComment(listingId, author, route.text.trim())
      await reply(chatId, message.message_id, 'Записав.', listingId)
      return { kind: 'comment', listingId }
    }

    await reply(
      chatId,
      message.message_id,
      'Не знаю, до якого авто це. Відповідай реплаєм на моє повідомлення про конкретну картку.',
    )
    return { kind: 'reply-unknown' }
  }

  if (route.kind === 'command') return handleCommand(route.command, chatId, message, author)

  if (route.kind === 'link') {
    return handleLink(route.url, chatId, message.message_id, author)
  }

  if (route.kind === 'post') {
    await stage(update, message)
    const result = await processGroup(inboxKeyOf(update, message), author)

    if (!result) return { kind: 'post-queued' }

    const settings = await getSettings(author)

    if (result.kind === 'unknown') {
      await reply(
        chatId,
        message.message_id,
        'У пості немає ні посилання, ні тексту, ні джерела — не знаю, що це за авто. ' +
          'Перешли ще раз із показом джерела.',
      )
      return { kind: 'post-unknown' }
    }

    if (result.kind === 'duplicate') {
      await reply(chatId, message.message_id, 'Цей пост уже є — нічого не дублюю.', result.listingId)
      return { kind: 'post-duplicate', listingId: result.listingId }
    }

    const text = postSavedMessage(result.title, result.priceUsd, settings.currency, {
      created: result.created,
      duplicate: false,
      phones: [],
      sameAs: [],
    })
    await reply(chatId, message.message_id, text, result.listingId)
    return { kind: 'post-saved', listingId: result.listingId }
  }

  return { kind: 'ignored' }
}

async function handleCommand(
  command: string,
  chatId: string,
  message: TelegramMessage,
  author: Author,
): Promise<Handled> {
  if (command === '/today') {
    const settings = await getSettings(author)
    const { rows } = await getListings({ ...DEFAULT_QUERY, per: 'all' })
    const buckets = bucketByContact(rows)

    const cars = [
      ...buckets.overdue.map((row) => ({ row, overdue: true })),
      ...buckets.today.map((row) => ({ row, overdue: false })),
    ].map(({ row, overdue }) => ({
      id: row.listing.id,
      title: row.listing.title,
      priceUsd: row.listing.priceUsd,
      priceUah: row.listing.priceUah,
      overdue,
    }))

    await reply(chatId, message.message_id, todayMessage(cars, settings.currency))
    return { kind: 'today' }
  }

  await reply(chatId, message.message_id, helpMessage(chatId))
  return { kind: 'help' }
}

/** Кинуте посилання: картка створюється, парсер доганяє, відповідь — з назвою. */
async function handleLink(
  url: string,
  chatId: string,
  replyTo: number,
  author: Author,
): Promise<Handled> {
  const result = await ingestUrl(url, author)
  if (!result.duplicate) await parseListing(result.id)

  const [listing] = await db.select().from(listings).where(eq(listings.id, result.id)).limit(1)
  if (!listing) return { kind: 'link-failed' }

  const settings = await getSettings(author)
  await reply(
    chatId,
    replyTo,
    addedMessage(listing, settings.currency, result.duplicate),
    listing.id,
  )

  return { kind: result.duplicate ? 'link-duplicate' : 'link-added', listingId: listing.id }
}

/**
 * Відповідь бота. Якщо вона про конкретне авто — запамʼятовуємо, щоб реплай на
 * неї став коментарем саме до нього.
 */
async function reply(
  chatId: string,
  replyTo: number,
  text: string,
  listingId?: string,
): Promise<void> {
  try {
    const sent = await sendMessage(chatId, text, {
      replyTo,
      button: listingId ? { text: 'Відкрити картку', url: listingUrl(listingId) } : undefined,
    })
    if (listingId) await rememberBotMessage(chatId, sent.message_id, listingId)
  } catch (error) {
    console.warn('[telegram] відповідь не пішла:', (error as Error).message)
  }
}
