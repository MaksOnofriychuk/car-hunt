import { createHmac, timingSafeEqual } from 'node:crypto'

import { assertSafeKey } from './types'

/**
 * Підписані посилання на файли сховища.
 *
 * `/api/files/*` живе під тією ж автентифікацією, що й усе інше, — а Telegram
 * ходить за фото своїм сервером, без наших cookie. Відкривати теку цілком не
 * можна, тому кожне посилання підписується окремо і живе годину: воно веде на
 * один конкретний ключ, і тільки на нього.
 *
 * Ключ підпису — `SESSION_SECRET` із доменним префіксом `file:`. Окрема змінна
 * тут нічого б не додала: секрет той самий за цінністю, а префікс не дає
 * переплутати підпис файлу з токеном сесії.
 */

const PREFIX = 'file:'

/** Година: Telegram качає картинку одразу, запас — на повтори при збоях. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET не заданий — нічим підписувати посилання на файли')
  return value
}

function sign(key: string, expires: number): string {
  return createHmac('sha256', secret())
    .update(`${PREFIX}${key}:${expires}`)
    .digest('base64url')
}

/**
 * Абсолютна адреса файлу з підписом. Абсолютна навмисно: відносний шлях
 * Telegram нікуди не приведе.
 *
 * `null` — коли адреси застосунку немає (локальний запуск без `APP_URL`) або
 * ключ виглядає небезпечно: краще повідомлення без фото, ніж бите посилання.
 */
export function signedFileUrl(key: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): string | null {
  const base = process.env.APP_URL?.replace(/\/$/, '')
  if (!base) return null

  try {
    assertSafeKey(key)
  } catch {
    return null
  }

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const path = key.split('/').map(encodeURIComponent).join('/')
  const query = new URLSearchParams({ exp: String(expires), sig: sign(key, expires) })

  return `${base}/api/files/${path}?${query}`
}

/** Чи справжній підпис і чи не протух. Порівняння стале в часі. */
export function verifyFileSignature(key: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false

  const expires = Number(exp)
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false

  const expected = Buffer.from(sign(key, expires))
  const given = Buffer.from(sig)

  return expected.length === given.length && timingSafeEqual(expected, given)
}
