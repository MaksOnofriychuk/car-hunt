import { and, eq } from 'drizzle-orm'

import { db } from './index'
import { tgMessages } from './schema'

/**
 * Які наші повідомлення про яке авто. Потрібне рівно для одного: відповідь
 * реплаєм на сповіщення має стати коментарем до того самого авто — а Telegram
 * у реплаї дає лише `message_id`, і більше нічого.
 *
 * Таблиця маленька і росте повільно (одне повідомлення — один рядок), тому
 * чистити її нема потреби: рядки зникають разом із карткою по каскаду.
 */

/** Запамʼятати, що це повідомлення — про це авто. Дубль тихо ігнорується. */
export async function rememberBotMessage(
  chatId: string | number,
  messageId: number,
  listingId: string,
): Promise<void> {
  await db
    .insert(tgMessages)
    .values({ chatId: String(chatId), messageId, listingId })
    .onConflictDoNothing()
}

/** Про яке авто було це повідомлення. `null` — ми його не памʼятаємо. */
export async function listingForBotMessage(
  chatId: string | number,
  messageId: number,
): Promise<string | null> {
  const [row] = await db
    .select({ listingId: tgMessages.listingId })
    .from(tgMessages)
    .where(and(eq(tgMessages.chatId, String(chatId)), eq(tgMessages.messageId, messageId)))
    .limit(1)

  return row?.listingId ?? null
}
