import { z } from 'zod'

import { looksLikePost } from './post-parse'

import { findListingLink } from '@/lib/sources/links'
import { isAuthor, type Author } from '@/lib/users'

/**
 * Розбір апдейта Telegram і рішення, що це взагалі було.
 *
 * Схема навмисно вузька: беремо лише те, що вміємо читати. Сирий апдейт
 * зберігається окремо (`telegram_posts.raw`), тому нічого не губиться — для
 * telegram це те саме, чим для оголошення є `html_raw`.
 */

const chatSchema = z.object({
  id: z.number(),
  type: z.string().optional(),
  title: z.string().optional(),
  username: z.string().optional(),
})

const photoSizeSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  file_size: z.number().optional(),
})

/** Bot API 7+ віддає forward_origin; старіші поля лишились для сумісності. */
const forwardOriginSchema = z.object({
  type: z.string(),
  date: z.number().optional(),
  chat: chatSchema.optional(),
  sender_chat: chatSchema.optional(),
  message_id: z.number().optional(),
  sender_user_name: z.string().optional(),
})

const messageSchema = z.object({
  message_id: z.number(),
  date: z.number(),
  chat: chatSchema,
  text: z.string().optional(),
  caption: z.string().optional(),
  photo: z.array(photoSizeSchema).optional(),
  media_group_id: z.string().optional(),
  reply_to_message: z.object({ message_id: z.number() }).optional(),
  forward_origin: forwardOriginSchema.optional(),
  forward_from_chat: chatSchema.optional(),
  forward_from_message_id: z.number().optional(),
  forward_date: z.number().optional(),
  entities: z
    .array(z.object({ type: z.string(), url: z.string().optional() }))
    .optional(),
  caption_entities: z
    .array(z.object({ type: z.string(), url: z.string().optional() }))
    .optional(),
})

export const updateSchema = z.object({
  update_id: z.number(),
  message: messageSchema.optional(),
})

export type TelegramMessage = z.infer<typeof messageSchema>
export type TelegramUpdate = z.infer<typeof updateSchema>

/** Текст повідомлення: у фото він лежить у підписі. */
export function messageText(message: TelegramMessage): string {
  const own = message.text ?? message.caption ?? ''
  // Посилання під текстом (entity url) в самому тексті не видно — дописуємо їх,
  // інакше пост із кнопкою-посиланням виглядав би як пост без посилання.
  const hidden = [...(message.entities ?? []), ...(message.caption_entities ?? [])]
    .map((entity) => entity.url)
    .filter((url): url is string => Boolean(url))

  return [own, ...hidden].filter(Boolean).join('\n')
}

/**
 * Хто це пише. Приймаємо тільки приватні чати нас двох — усе інше отримує тиху
 * 200 і не обробляється, щоб Telegram не ретраїв те, чого ми не приймаємо.
 */
export function authorForChat(chatId: number | string): Author | null {
  const id = String(chatId)
  if (id === process.env.TELEGRAM_CHAT_ID_ME?.trim()) return 'me'
  if (id === process.env.TELEGRAM_CHAT_ID_DAD?.trim()) return 'dad'
  return null
}

export type Route =
  /** Відповідь на наше повідомлення — стане коментарем до того авто. */
  | { kind: 'reply'; replyTo: number; text: string }
  | { kind: 'command'; command: string }
  /** Переслений пост із групи: у ньому є те, чого немає в оголошенні. */
  | { kind: 'post' }
  | { kind: 'link'; url: string }
  | { kind: 'ignore' }

/**
 * Що робити з повідомленням. Порядок перевірок і є пріоритетом.
 *
 * Постом вважаємо не будь-який багаторядковий текст, а лише той, у якому є
 * ознака поста: фото, альбом, походження або хоч щось із того, заради чого
 * пости й потрібні — ціна з валютою, телефон, VIN, контакт продавця. Інакше
 * «глянь \n <посилання>» заводило б рядок у telegram_posts.
 */
export function classify(message: TelegramMessage): Route {
  const text = messageText(message).trim()

  if (message.reply_to_message) {
    return { kind: 'reply', replyTo: message.reply_to_message.message_id, text }
  }

  if (text.startsWith('/')) {
    return { kind: 'command', command: text.split(/[\s@]/)[0].toLowerCase() }
  }

  const forwarded = Boolean(message.forward_origin ?? message.forward_from_chat ?? message.forward_date)
  const hasPhoto = Boolean(message.photo?.length) || Boolean(message.media_group_id)

  if (hasPhoto || forwarded || looksLikePost(text)) return { kind: 'post' }

  const link = findListingLink(text)
  if (link) return { kind: 'link', url: link }

  return { kind: 'ignore' }
}

export type Origin = {
  chatId: string
  messageId: number
  title: string | null
  postedAt: Date | null
  hidden: boolean
}

/**
 * Звідки пост. Числовий `chat.id` групи походження — це і є канонічна половина
 * `source_id`. Пересилач сховав джерело — беремо наш же чат і позначаємо
 * `hidden`: далі пост упізнаватиметься за відбитком тексту.
 */
export function originOf(message: TelegramMessage): Origin {
  const origin = message.forward_origin
  const chat = origin?.chat ?? origin?.sender_chat ?? message.forward_from_chat
  const messageId = origin?.message_id ?? message.forward_from_message_id
  const date = origin?.date ?? message.forward_date

  if (chat && messageId) {
    return {
      chatId: String(chat.id),
      messageId,
      title: chat.title ?? (chat.username ? `@${chat.username}` : null),
      postedAt: date ? new Date(date * 1000) : null,
      hidden: false,
    }
  }

  return {
    chatId: String(message.chat.id),
    messageId: message.message_id,
    title: null,
    postedAt: date ? new Date(date * 1000) : new Date(message.date * 1000),
    hidden: true,
  }
}

export { isAuthor }
