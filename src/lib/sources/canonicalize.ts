import { isProvisionalTelegramId, parseTelegramId, telegramRef } from './telegram'
import type { ListingRef } from './types'

import { getChat } from '@/lib/telegram/api'

/**
 * СЕРВЕРНИЙ модуль: ходить у Bot API і читає TELEGRAM_BOT_TOKEN.
 * Навмисно не реекспортується з `./index` — інакше він поїхав би в клієнтський
 * бандл разом з реєстром. Клієнту потрібен лише `./links`.
 */

/** @username → chat_id. Значення незмінне, тому тримаємо на час життя процесу. */
const chatIdCache = new Map<string, number>()

export type CanonicalRef = {
  ref: ListingRef
  /** false — канонізувати не вдалось, у базу піде тимчасова форма. */
  canonical: boolean
  reason?: string
}

/**
 * Зводить ref до канонічної форми перед вставкою в базу.
 * Сьогодні це потрібно лише telegram: `@username:{msg}` → `{chat_id}:{msg}`.
 * Решта джерел віддає канонічний id одразу.
 */
export async function canonicalizeRef(ref: ListingRef): Promise<CanonicalRef> {
  if (ref.source !== 'telegram' || !isProvisionalTelegramId(ref.id)) {
    return { ref, canonical: true }
  }

  const parsed = parseTelegramId(ref.id)
  if (!parsed) return { ref, canonical: false, reason: 'не розібрали id' }

  const cached = chatIdCache.get(parsed.chat)
  if (cached !== undefined) {
    return { ref: telegramRef(cached, parsed.messageId), canonical: true }
  }

  try {
    const chat = await getChat(parsed.chat)
    chatIdCache.set(parsed.chat, chat.id)
    return { ref: telegramRef(chat.id, parsed.messageId), canonical: true }
  } catch (error) {
    // Канал приватний, зник або мережа лягла — не привід губити посилання.
    return { ref, canonical: false, reason: (error as Error).message }
  }
}
