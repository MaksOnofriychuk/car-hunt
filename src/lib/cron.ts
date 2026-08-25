import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm'

import { db } from '@/db'
import { listings, loginAttempts, userSettings, type Listing } from '@/db/schema'
import { bucketByContact, getListings } from '@/db/list'
import { getSettings } from '@/db/settings'
import { deleteOldInbox } from '@/db/telegram'
import { archiveListing } from '@/lib/archive'
import { todayInKyiv, timeInKyiv } from '@/lib/dates'
import { parseListing } from '@/lib/ingest'
import { DEFAULT_QUERY } from '@/lib/list-query'
import { isRefreshable, SOURCES } from '@/lib/sources'
import { canonicalizeRef } from '@/lib/sources/canonicalize'
import { isProvisionalTelegramId } from '@/lib/sources/telegram'
import { sendMessage } from '@/lib/telegram/api'
import { todayMessage } from '@/lib/telegram/messages'
import { sweepStaleInbox } from '@/lib/telegram/inbox'
import { isQuietNow } from '@/lib/telegram/notify'
import { storage } from '@/lib/storage'
import { savePostPhotos, type PhotoRef } from '@/lib/telegram/post-photos'
import { appendPostPhotos, postsAwaitingPhotos } from '@/db/telegram'
import { AUTHOR_VALUES, type Author } from '@/lib/users'

/**
 * Фонові задачі — SPEC, «Фонові задачі (cron)».
 *
 * Два прогони. `refresh` раз на годину робить усе, що встигає в бюджет
 * запитів; `daily` щогодини перевіряє, чи не час комусь із нас надіслати
 * ранкове зведення.
 *
 * Чому зведення теж щогодини: 8:00 за Києвом узимку — це 06:00 UTC, а влітку
 * 05:00. Розкладом у UTC в це не влучити, а переносити перехід на літній час у
 * cron-рядок означало б правити його двічі на рік і забути. Тому крон питає
 * час, а рішення ухвалює застосунок — заразом це дає кожному свій `digest_at`.
 */

/**
 * Чи це справді наш крон. Vercel Cron сам додає цей заголовок, коли в проєкті
 * заданий `CRON_SECRET`; GitHub Actions передає його явно.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

/** Скільки мережевих запитів дозволено за один прогін (SPEC). */
const REQUEST_BUDGET = 25

/**
 * Скільки прогін узагалі має право тривати. На serverless функцію обривають по
 * `maxDuration` (у нас 60 с), і обрив посеред роботи нічого не ламає — кожен
 * крок фіксується окремо, — але краще зупинитись самим і дати наступному
 * прогону продовжити з того ж місця.
 */
const RUN_BUDGET_MS = 50_000

/** Джерела, які взагалі має сенс перезавантажувати. */
const REFRESHABLE = SOURCES.filter((source) => source.refreshable).map((source) => source.name)

export type RefreshReport = {
  parsed: number
  archived: number
  refreshed: number
  canonicalized: number
  telegramGroups: number
  telegramPhotos: number
  cleaned: { inbox: number; logins: number }
}

export async function runRefresh(): Promise<RefreshReport> {
  const report: RefreshReport = {
    parsed: 0,
    archived: 0,
    refreshed: 0,
    canonicalized: 0,
    telegramGroups: 0,
    telegramPhotos: 0,
    cleaned: { inbox: 0, logins: 0 },
  }

  let budget = REQUEST_BUDGET
  const deadline = Date.now() + RUN_BUDGET_MS
  const outOfTime = () => Date.now() > deadline

  // 1. Пріоритет перший: картки, які так і не розібрались.
  for (const listing of await pendingListings(budget)) {
    if (budget <= 0 || outOfTime()) break
    budget -= 1
    await parseListing(listing.id)
    report.parsed += 1
  }

  // 2. Неповний архів: HTML і фото, яких бракує. Telegram сюди не потрапляє —
  //    у нього немає html_raw, і він висів би в цій черзі довіку.
  for (const listing of await archiveBacklog(Math.min(budget, 5))) {
    if (budget <= 0 || outOfTime()) break
    budget -= 1
    const result = await archiveListing(listing)
    if (result.complete) report.archived += 1
  }

  // 3. Telegram: застряглі групи, недокачані фото, доканонізація, прибирання.
  report.telegramGroups = await sweepStaleInbox(5)
  report.telegramPhotos = await finishPostPhotos()
  report.canonicalized = await canonicalizeProvisional()
  report.cleaned.inbox = await deleteOldInbox(1)
  report.cleaned.logins = await cleanupLoginAttempts()

  // 4. Ціни. Найдавніше розібрані — першими; те, що не влізло, добере наступний
  //    прогін. Telegram і manual сюди не входять: оновлювати їх нізвідки.
  for (const listing of await staleListings(budget)) {
    if (budget <= 0 || outOfTime()) break
    budget -= 1
    await parseListing(listing.id)
    report.refreshed += 1
  }

  return report
}

/* -------------------------------- вибірки --------------------------------- */

async function pendingListings(limit: number): Promise<Listing[]> {
  if (limit <= 0) return []

  return db
    .select()
    .from(listings)
    .where(eq(listings.status, 'pending'))
    .orderBy(asc(listings.createdAt))
    .limit(limit)
}

async function archiveBacklog(limit: number): Promise<Listing[]> {
  if (limit <= 0) return []

  return db
    .select()
    .from(listings)
    .where(
      and(
        isNull(listings.archivedAt),
        eq(listings.status, 'active'),
        sql`${listings.source} in ${REFRESHABLE}`,
        sql`array_length(${listings.photos}, 1) > 0`,
      ),
    )
    .orderBy(asc(listings.parsedAt))
    .limit(limit)
}

/**
 * Кого перечитувати. Тільки живі оголошення живих джерел: telegram і manual
 * мають `refreshable: false`, і смикати їх нема куди.
 */
async function staleListings(limit: number): Promise<Listing[]> {
  if (limit <= 0) return []

  return db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.archived, false),
        eq(listings.status, 'active'),
        sql`${listings.source} in ${REFRESHABLE}`,
      ),
    )
    .orderBy(sql`${listings.parsedAt} asc nulls first`)
    .limit(limit)
}

/* -------------------------------- дрібне ---------------------------------- */

/** Доякати фото постів, яким не вистачило часу під час обробки. */
async function finishPostPhotos(): Promise<number> {
  // Без сховища ця черга ніколи не спорожніє — не смикаємо її щогодини.
  if (storage().name === 'none') return 0

  const posts = await postsAwaitingPhotos(5)
  let finished = 0

  for (const post of posts) {
    const raw = post.raw as { photo?: { file_id: string; file_unique_id: string }[] }[] | null
    const photos: PhotoRef[] = (Array.isArray(raw) ? raw : [])
      .map((message) => message.photo?.at(-1))
      .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
      .map((photo) => ({ fileId: photo.file_id, fileUniqueId: photo.file_unique_id }))

    if (photos.length === 0) {
      // Фото не було взагалі — архів такого поста повний за визначенням.
      await appendPostPhotos(post.id, [], true)
      continue
    }

    const saved = await savePostPhotos(post.chatId, photos)
    await appendPostPhotos(post.id, saved.keys, saved.complete)
    if (saved.complete) finished += 1
  }

  return finished
}

/**
 * Рядки з тимчасовим `source_id` виду `@username:55`. `getChat` міг не
 * відповісти при інгесті — пробуємо знову.
 *
 * Якщо канонічний двійник уже існує (той самий пост приїхав вебхуком), рядок
 * не чіпаємо: переписати `source_id` означало б порушити унікальність.
 */
async function canonicalizeProvisional(): Promise<number> {
  const rows = await db
    .select({ id: listings.id, sourceId: listings.sourceId })
    .from(listings)
    .where(and(eq(listings.source, 'telegram'), sql`${listings.sourceId} like '@%'`))
    .limit(10)

  let done = 0

  for (const row of rows) {
    if (!isProvisionalTelegramId(row.sourceId)) continue

    const { ref, canonical } = await canonicalizeRef({ source: 'telegram', id: row.sourceId })
    if (!canonical) continue

    const [twin] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.source, 'telegram'), eq(listings.sourceId, ref.id)))
      .limit(1)

    if (twin) continue

    await db.update(listings).set({ sourceId: ref.id }).where(eq(listings.id, row.id))
    done += 1
  }

  return done
}

/** Журнал спроб входу тримаємо 30 днів — далі він нічого не доводить. */
async function cleanupLoginAttempts(): Promise<number> {
  const rows = await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.createdAt, sql`now() - interval '30 days'`))
    .returning({ id: loginAttempts.id })

  return rows.length
}

/* --------------------------- ранкове зведення ----------------------------- */

export type DigestReport = { sent: Author[]; skipped: Author[] }

/**
 * Ранкове зведення. Викликається щогодини і сам вирішує, кому вже час:
 * порівнює **годину за Києвом** із `digest_at` кожного і позначає день, щоб не
 * надіслати двічі.
 *
 * Тихі години не скасовують зведення, а знімають із нього звук — як і в решті
 * сповіщень: загубити список на день гірше, ніж тихо його доставити.
 */
export async function runDaily(force = false): Promise<DigestReport> {
  const report: DigestReport = { sent: [], skipped: [] }

  const today = todayInKyiv()
  const now = timeInKyiv()

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

  for (const author of AUTHOR_VALUES) {
    const chatId = chatIdFor(author)
    const settings = await getSettings(author)

    const [state] = await db
      .select({ sentOn: userSettings.digestSentOn })
      .from(userSettings)
      .where(eq(userSettings.author, author))
      .limit(1)

    const due = force || (sameHour(now, settings.digestAt) && state?.sentOn !== today)
    if (!chatId || !due) {
      report.skipped.push(author)
      continue
    }

    try {
      await sendMessage(chatId, todayMessage(cars, settings.currency), {
        silent: isQuietNow(settings, now),
      })

      await db
        .insert(userSettings)
        .values({ author, digestSentOn: today })
        .onConflictDoUpdate({ target: userSettings.author, set: { digestSentOn: today } })

      report.sent.push(author)
    } catch (error) {
      console.warn(`[cron] зведення для ${author} не пішло:`, (error as Error).message)
      report.skipped.push(author)
    }
  }

  return report
}

/** Година збіглась — хвилини не звіряємо: крон ходить раз на годину. */
function sameHour(now: string, digestAt: string): boolean {
  return now.slice(0, 2) === digestAt.slice(0, 2)
}

function chatIdFor(author: Author): string | null {
  const value = author === 'me' ? process.env.TELEGRAM_CHAT_ID_ME : process.env.TELEGRAM_CHAT_ID_DAD
  return value?.trim() || null
}

export { isRefreshable }
