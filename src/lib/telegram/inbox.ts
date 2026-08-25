import { processPost, type BuiltPost } from './post-ingest'
import type { PhotoRef } from './post-photos'
import { messageText, originOf, type TelegramMessage, type TelegramUpdate } from './update'

import {
  claimGroup,
  markProcessed,
  newestReceivedAt,
  releaseClaim,
  stageUpdate,
  staleGroups,
  type InboxKey,
} from '@/db/telegram'
import type { Author } from '@/lib/users'

/**
 * Стейджинг і збирання альбому.
 *
 * Telegram шле альбом кількома апдейтами з одним `media_group_id`, і підпис
 * кладе, як правило, у перше повідомлення. Обробити кожен апдейт окремо
 * означало б створити картку без фото і чотири сироти поруч.
 *
 * На Vercel процес не живе між запитами, тому буфер — у базі: апдейт лягає в
 * `telegram_inbox`, вебхук одразу відповідає 200, а вже потім `after()` чекає
 * коротку паузу і обробляє **всю групу разом**. Атомарний claim гарантує, що
 * обробник рівно один, скільки б апдейтів не прилетіло.
 */

/** Скільки чекати решту альбому. Налаштовується: мережа буває повільною. */
function albumDelayMs(): number {
  const value = Number(process.env.TELEGRAM_ALBUM_DELAY_MS)
  return Number.isFinite(value) && value >= 0 ? value : 3000
}

/** Якщо останнє повідомлення групи прилетіло щойно — альбом ще йде. */
const QUIET_MS = 1200

export function inboxKeyOf(update: TelegramUpdate, message: TelegramMessage): InboxKey {
  return {
    chatId: String(message.chat.id),
    mediaGroupId: message.media_group_id ?? null,
    updateId: update.update_id,
  }
}

/** Покласти апдейт у чергу. Кидає — вебхук має відповісти 500, щоб Telegram повторив. */
export async function stage(update: TelegramUpdate, message: TelegramMessage): Promise<boolean> {
  return stageUpdate({
    updateId: update.update_id,
    chatId: String(message.chat.id),
    messageId: message.message_id,
    mediaGroupId: message.media_group_id ?? null,
    payload: message,
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Дочекатись решти альбому і обробити групу. `null` — робити нічого: або групу
 * забрав інший інстанс, або альбом ще їде.
 */
export async function processGroup(key: InboxKey, forwardedBy: Author) {
  await sleep(albumDelayMs())
  return claimAndProcess(key, forwardedBy)
}

async function claimAndProcess(key: InboxKey, forwardedBy: Author) {
  const rows = await claimGroup(key)
  if (rows.length === 0) return null

  // Альбом ще їде — відпускаємо: обробить той апдейт, який прийде останнім.
  const newest = await newestReceivedAt(key)
  if (newest && Date.now() - newest.getTime() < QUIET_MS) {
    await releaseClaim(rows.map((row) => row.updateId))
    return null
  }

  const messages = rows.map((row) => row.payload as TelegramMessage)
  const post = buildPost(messages, forwardedBy)

  const result = await processPost(post)
  await markProcessed(rows.map((row) => row.updateId))

  return result
}

/**
 * Зібрати пост із кількох повідомлень. Текст беремо з будь-якого, де він є:
 * підпис не завжди в першому. Якір групи — **найменший** message_id
 * походження, і він ніколи не змінюється: інакше повторне пересилання обрало б
 * інший, а посилання t.me/c/{chat}/{msg} вказувало б на випадковий елемент
 * альбому.
 */
export function buildPost(messages: TelegramMessage[], forwardedBy: Author): BuiltPost {
  const origins = messages.map((message) => originOf(message))
  const anchor = origins.reduce((min, origin) => (origin.messageId < min.messageId ? origin : min))

  const text = messages.map((message) => messageText(message)).find((value) => value.trim()) ?? ''

  const photos: PhotoRef[] = messages
    .map((message) => message.photo?.at(-1))
    .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
    .map((photo) => ({ fileId: photo.file_id, fileUniqueId: photo.file_unique_id }))

  return {
    chatId: anchor.chatId,
    messageId: anchor.messageId,
    originMessageIds: [...new Set(origins.map((origin) => origin.messageId))].sort((a, b) => a - b),
    originTitle: origins.find((origin) => origin.title)?.title ?? null,
    mediaGroupId: messages.find((message) => message.media_group_id)?.media_group_id ?? null,
    originHidden: anchor.hidden,
    postedAt: origins.find((origin) => origin.postedAt)?.postedAt ?? null,
    text,
    photos,
    raw: messages,
    forwardedBy,
  }
}

/**
 * Підмітання. Інстанс міг померти між claim і обробкою — тоді група висить
 * необробленою, а пост губиться. Викликається і з крону, і опортуністично на
 * кожному вхідному апдейті: без цього загубився б останній переслай за вечір.
 */
export async function sweepStaleInbox(limit = 3): Promise<number> {
  const keys = await staleGroups(limit)
  let handled = 0

  for (const key of keys) {
    try {
      const rows = await claimGroup(key)
      if (rows.length === 0) continue

      const messages = rows.map((row) => row.payload as TelegramMessage)
      // Хто переслав — з першого ж повідомлення групи: чат і є людина.
      const author = authorOfChat(key.chatId)
      if (!author) {
        await markProcessed(rows.map((row) => row.updateId))
        continue
      }

      await processPost(buildPost(messages, author))
      await markProcessed(rows.map((row) => row.updateId))
      handled += 1
    } catch (error) {
      console.warn('[telegram] застрягла група не обробилась:', (error as Error).message)
    }
  }

  return handled
}

/** Наш приватний чат → людина. Групи походження сюди не потрапляють. */
function authorOfChat(chatId: string): Author | null {
  if (chatId === process.env.TELEGRAM_CHAT_ID_ME?.trim()) return 'me'
  if (chatId === process.env.TELEGRAM_CHAT_ID_DAD?.trim()) return 'dad'
  return null
}
