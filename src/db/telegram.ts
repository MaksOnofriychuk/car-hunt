import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'

import { db } from './index'
import { listings, telegramInbox, telegramPosts } from './schema'
import type { NewTelegramPost, TelegramInboxRow, TelegramPost } from './schema'

import { parseTelegramId } from '@/lib/sources/telegram'
import type { ListingRef } from '@/lib/sources/types'

/**
 * Робота з трьома telegram-таблицями. Уся логіка «чий альбом і чи не обробляє
 * його вже хтось інший» тримається тут, бо це питання до бази, а не до коду:
 * на Vercel процес не живе між запитами, і два апдейти одного альбому легко
 * потрапляють у два різні інстанси.
 */

/** Скільки чекати, перш ніж вважати claim покинутим (інстанс міг померти). */
const STALE_MINUTES = 2

/* --------------------------------- inbox ---------------------------------- */

export type InboxKey = { chatId: string; mediaGroupId: string | null; updateId: number }

/**
 * Покласти апдейт у стейджинг. `false` — такий `update_id` уже лежить: Telegram
 * ретраїть апдейт, якщо не отримав 200 вчасно, і це нормальний шлях, а не збій.
 */
export async function stageUpdate(row: {
  updateId: number
  chatId: string
  messageId: number
  mediaGroupId: string | null
  payload: unknown
}): Promise<boolean> {
  const inserted = await db
    .insert(telegramInbox)
    .values({
      updateId: row.updateId,
      chatId: row.chatId,
      messageId: row.messageId,
      mediaGroupId: row.mediaGroupId,
      payload: row.payload,
    })
    .onConflictDoNothing()
    .returning({ updateId: telegramInbox.updateId })

  return inserted.length > 0
}

/** Умова «це рядки нашої групи»: альбом — за media_group_id, одинак — за update_id. */
function groupWhere(key: InboxKey) {
  return and(
    eq(telegramInbox.chatId, key.chatId),
    key.mediaGroupId
      ? or(
          eq(telegramInbox.mediaGroupId, key.mediaGroupId),
          eq(telegramInbox.updateId, key.updateId),
        )
      : eq(telegramInbox.updateId, key.updateId),
  )
}

/**
 * Атомарний claim. Обробник групи рівно один, скільки б апдейтів альбому не
 * прилетіло: `update … where claimed_at is null returning *` виконується
 * однією командою, і другий інстанс отримає порожній список.
 *
 * Покинутий claim (інстанс помер) через дві хвилини знову вільний — тому та
 * сама умова працює і для підмітання.
 */
export async function claimGroup(key: InboxKey): Promise<TelegramInboxRow[]> {
  return db
    .update(telegramInbox)
    .set({ claimedAt: new Date() })
    .where(
      and(
        groupWhere(key),
        isNull(telegramInbox.processedAt),
        or(
          isNull(telegramInbox.claimedAt),
          lt(telegramInbox.claimedAt, sql`now() - interval '${sql.raw(String(STALE_MINUTES))} minutes'`),
        ),
      ),
    )
    .returning()
}

/** Відпустити групу: приїхало ще одне повідомлення, хай дочекається наступний. */
export async function releaseClaim(updateIds: number[]): Promise<void> {
  if (updateIds.length === 0) return
  await db
    .update(telegramInbox)
    .set({ claimedAt: null })
    .where(inArray(telegramInbox.updateId, updateIds))
}

export async function markProcessed(updateIds: number[]): Promise<void> {
  if (updateIds.length === 0) return
  await db
    .update(telegramInbox)
    .set({ processedAt: new Date() })
    .where(inArray(telegramInbox.updateId, updateIds))
}

/** Коли до групи прилетіло останнє повідомлення — щоб не хапати альбом на льоту. */
export async function newestReceivedAt(key: InboxKey): Promise<Date | null> {
  const [row] = await db
    .select({ at: sql<Date>`max(${telegramInbox.receivedAt})` })
    .from(telegramInbox)
    .where(groupWhere(key))

  return row?.at ? new Date(row.at) : null
}

/** Групи, які хтось узяв і не доробив. Черга для підмітання. */
export async function staleGroups(limit = 3): Promise<InboxKey[]> {
  const rows = await db
    .select({
      updateId: telegramInbox.updateId,
      chatId: telegramInbox.chatId,
      mediaGroupId: telegramInbox.mediaGroupId,
    })
    .from(telegramInbox)
    .where(
      and(
        isNull(telegramInbox.processedAt),
        or(
          isNull(telegramInbox.claimedAt),
          lt(telegramInbox.claimedAt, sql`now() - interval '${sql.raw(String(STALE_MINUTES))} minutes'`),
        ),
        lt(telegramInbox.receivedAt, sql`now() - interval '${sql.raw(String(STALE_MINUTES))} minutes'`),
      ),
    )
    .orderBy(asc(telegramInbox.receivedAt))
    .limit(limit)

  return rows
}

/** Оброблені апдейти старші за добу — сміття, воно вже в telegram_posts.raw. */
export async function deleteOldInbox(days = 1): Promise<number> {
  const rows = await db
    .delete(telegramInbox)
    .where(lt(telegramInbox.processedAt, sql`now() - interval '${sql.raw(String(days))} days'`))
    .returning({ updateId: telegramInbox.updateId })

  return rows.length
}

/* --------------------------------- пости ---------------------------------- */

/**
 * Знайти пост, до якого належить це повідомлення. Порядок навмисний: альбом
 * упізнається за `media_group_id` (якір міг зʼїхати, якщо перше повідомлення
 * прийшло пізніше), поодинокий пост — за якорем.
 */
export async function findPost(key: {
  chatId: string
  mediaGroupId?: string | null
  messageId?: number | null
}): Promise<TelegramPost | null> {
  if (key.mediaGroupId) {
    const [byGroup] = await db
      .select()
      .from(telegramPosts)
      .where(
        and(
          eq(telegramPosts.chatId, key.chatId),
          eq(telegramPosts.mediaGroupId, key.mediaGroupId),
        ),
      )
      .limit(1)
    if (byGroup) return byGroup
  }

  if (key.messageId != null) {
    const [byAnchor] = await db
      .select()
      .from(telegramPosts)
      .where(
        and(eq(telegramPosts.chatId, key.chatId), eq(telegramPosts.messageId, key.messageId)),
      )
      .limit(1)
    if (byAnchor) return byAnchor
  }

  return null
}

/** Той самий текст — той самий пост, коли пересилач сховав джерело. */
export async function findPostByTextHash(textHash: string): Promise<TelegramPost | null> {
  const [row] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.textHash, textHash))
    .orderBy(desc(telegramPosts.createdAt))
    .limit(1)

  return row ?? null
}

/**
 * Записати пост. `null` — такий уже є: або переслали вдруге, або два інстанси
 * зчепились за один альбом. Обидва випадки нормальні, і обидва означають
 * «нічого не створюємо, доклеюємось до наявного».
 */
export async function insertPost(values: NewTelegramPost): Promise<TelegramPost | null> {
  const [row] = await db.insert(telegramPosts).values(values).onConflictDoNothing().returning()
  return row ?? null
}

/** Ключі фото цього поста. Дублі не додаються — ключ рахується з file_unique_id. */
export async function appendPostPhotos(
  postId: string,
  keys: string[],
  complete: boolean,
): Promise<void> {
  if (keys.length === 0 && !complete) return

  await db
    .update(telegramPosts)
    .set({
      photosLocal: sql`(
        select array_agg(distinct key)
        from unnest(${telegramPosts.photosLocal} || ${keys}::text[]) as key
      )`,
      archivedAt: complete ? new Date() : null,
    })
    .where(eq(telegramPosts.id, postId))
}

/** Попередній пост про це саме авто — з ним порівнюємо ціну. */
export async function previousPost(
  listingId: string,
  exceptPostId: string,
): Promise<TelegramPost | null> {
  const [row] = await db
    .select()
    .from(telegramPosts)
    .where(and(eq(telegramPosts.listingId, listingId), sql`${telegramPosts.id} <> ${exceptPostId}`))
    .orderBy(desc(telegramPosts.postedAt), desc(telegramPosts.createdAt))
    .limit(1)

  return row ?? null
}

/** Уся стрічка постів про авто — від найдавнішого, як її показує картка. */
export async function postsFor(listingId: string): Promise<TelegramPost[]> {
  return db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.listingId, listingId))
    .orderBy(asc(telegramPosts.postedAt), asc(telegramPosts.createdAt))
}

/** Пости, у яких фото ще не всі в сховищі. Черга для крону. */
export async function postsAwaitingPhotos(limit = 5): Promise<TelegramPost[]> {
  return db
    .select()
    .from(telegramPosts)
    .where(isNull(telegramPosts.archivedAt))
    .orderBy(asc(telegramPosts.createdAt))
    .limit(limit)
}

/**
 * Яка картка стоїть за цим посиланням на пост. Це і є відповідь на питання
 * «t.me-посилання і вебхук дають різні форми source_id»: пост уже прив'язаний
 * до авто, і воно може бути звичайною autoria-карткою.
 */
export async function listingForTelegramRef(ref: ListingRef): Promise<string | null> {
  const parsed = parseTelegramId(ref.id)
  if (!parsed || parsed.chat.startsWith('@')) return null

  const messageId = Number(parsed.messageId)

  const [row] = await db
    .select({ listingId: telegramPosts.listingId })
    .from(telegramPosts)
    .where(
      and(
        eq(telegramPosts.chatId, parsed.chat),
        or(
          eq(telegramPosts.messageId, messageId),
          sql`${messageId} = any(${telegramPosts.originMessageIds})`,
        ),
      ),
    )
    .limit(1)

  return row?.listingId ?? null
}

/** Найраніший пост про авто — з нього рахуються «днів у продажу» telegram-картки. */
export async function earliestPostedAt(listingId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: sql<Date | null>`min(${telegramPosts.postedAt})` })
    .from(telegramPosts)
    .where(eq(telegramPosts.listingId, listingId))

  return row?.at ? new Date(row.at) : null
}

/** Остання ціна з поста на картку. Історія лишається в telegram_posts. */
export async function setPriceFromPost(listingId: string, priceUsd: number): Promise<void> {
  await db.update(listings).set({ priceFromPost: priceUsd }).where(eq(listings.id, listingId))
}
