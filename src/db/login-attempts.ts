import { and, count, eq, gte, max } from 'drizzle-orm'

import { db } from './index'
import { loginAttempts, type Author } from './schema'

/** Не більше 5 невдалих спроб з однієї IP за 15 хвилин. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_MAX_FAILURES = 5

export type LoginBlock = {
  blocked: boolean
  failures: number
  /** Скільки секунд чекати до наступної спроби. Для заголовка Retry-After. */
  retryAfterSeconds: number
}

/**
 * Стан обмеження для IP. Рахуємо лише **невдалі** спроби: успішний вхід не є
 * атакою, і лічити його означало б замикати двері перед своїми ж.
 */
export async function loginBlockFor(ip: string): Promise<LoginBlock> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS)

  const [row] = await db
    .select({ failures: count(), lastAt: max(loginAttempts.createdAt) })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ip),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, since),
      ),
    )

  const failures = row?.failures ?? 0
  const blocked = failures >= LOGIN_MAX_FAILURES
  const lastAt = row?.lastAt ? new Date(row.lastAt).getTime() : Date.now()
  const retryAfterSeconds = blocked
    ? Math.max(1, Math.ceil((lastAt + LOGIN_WINDOW_MS - Date.now()) / 1000))
    : 0

  return { blocked, failures, retryAfterSeconds }
}

/** Кожна спроба входу лишає слід: час, IP, user-agent, успіх. */
export async function recordLoginAttempt(attempt: {
  ip: string
  userAgent: string | null
  author: Author | null
  success: boolean
}): Promise<void> {
  await db.insert(loginAttempts).values({
    ip: attempt.ip,
    userAgent: attempt.userAgent?.slice(0, 500) ?? null,
    author: attempt.author,
    success: attempt.success,
  })
}
