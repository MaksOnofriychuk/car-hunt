import {
  SourceNotReadyError,
  trimUrl,
  type ListingRef,
  type ListingSnapshot,
  type ListingSource,
} from './types'

/**
 * Пости з Telegram-груп.
 *
 * Канонічний `source_id` — **числовий**: «{chat_id}:{message_id}». Числовий
 * `chat.id` є завжди, а @username лише в публічних каналів, тому канон саме такий.
 * Три входи сходяться в одну форму:
 *
 *   вебхук (chat.id = -1001005640892, msg 55) → `-1001005640892:55`
 *   t.me/c/1005640892/55                      → `-1001005640892:55`  (-100 + внутрішній id)
 *   t.me/telegram/55                          → `@telegram:55` → canonicalizeRef → `-1001005640892:55`
 *
 * Форма з `@` — тимчасова: чистий розбір посилання не може сходити в мережу,
 * тому числовий id підставляє `canonicalizeRef` уже в інгесті.
 */
const TME = /https?:\/\/(?:t|telegram)\.me\/(?:s\/)?(c\/\d+|[A-Za-z]\w{3,})\/(\d+)/i

const NUMERIC_CHAT = /^-?\d+$/
const USERNAME_CHAT = /^@[A-Za-z]\w{3,}$/

/** Канонічний ref із даних вебхука. Використовувати всюди, де є справжній chat.id. */
export function telegramRef(chatId: number | string, messageId: number | string): ListingRef {
  return { source: 'telegram', id: `${chatId}:${messageId}` }
}

/** Тимчасовий ref, поки відомий лише @username. Канонізується перед вставкою в базу. */
export function provisionalTelegramRef(username: string, messageId: number | string): ListingRef {
  const handle = username.startsWith('@') ? username : `@${username}`
  return { source: 'telegram', id: `${handle}:${messageId}` }
}

export function parseTelegramId(id: string): { chat: string; messageId: string } | null {
  const separator = id.lastIndexOf(':')
  if (separator < 1) return null

  const chat = id.slice(0, separator)
  const messageId = id.slice(separator + 1)
  if (!/^\d+$/.test(messageId)) return null
  if (!NUMERIC_CHAT.test(chat) && !USERNAME_CHAT.test(chat)) return null

  return { chat, messageId }
}

/** Рядок ще не канонізований: у ньому @username замість числового chat_id. */
export function isProvisionalTelegramId(id: string): boolean {
  return parseTelegramId(id)?.chat.startsWith('@') ?? false
}

/**
 * Усі форми, під якими той самий пост міг уже опинитись у базі.
 * Вебхук перевіряє їх усі й переписує знайдений тимчасовий рядок на канонічний,
 * а не створює другу картку.
 */
export function telegramAliases(
  chatId: number | string,
  messageId: number | string,
  username?: string | null,
): ListingRef[] {
  const refs = [telegramRef(chatId, messageId)]
  if (username) refs.push(provisionalTelegramRef(username, messageId))
  return refs
}

export function extractTelegramId(input: string): string | null {
  const match = trimUrl(input).match(TME)
  if (!match) return null

  const [, chat, messageId] = match
  const internal = chat.match(/^c\/(\d+)$/i)

  // t.me/c/<internal>/<msg> — це supergroup/channel, канонічний id = -100 + internal
  return internal ? `-100${internal[1]}:${messageId}` : `@${chat}:${messageId}`
}

export const telegramSource: ListingSource = {
  name: 'telegram',
  // Переслане повідомлення не перезавантажити — воно вже в нас цілком.
  refreshable: false,

  canHandle(input) {
    return TME.test(input)
  },

  extractRef(input) {
    const id = extractTelegramId(input)
    return id ? { source: 'telegram', id } : null
  },

  async fetch(): Promise<ListingSnapshot> {
    throw new SourceNotReadyError('telegram')
  },
}
