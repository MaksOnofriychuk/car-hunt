import { isAuthor, type Author } from './users'

/**
 * Підпис і перевірка сесії. Web Crypto, а не node:crypto, бо цей модуль
 * підключає middleware, а він живе в Edge-рантаймі.
 *
 * Сам токен сервер нікуди не кладе: сесія живе на пристрої в `localStorage`, а
 * в запит потрапляє дзеркальною cookie з тим самим імʼям
 * (`src/lib/device-store.ts`). Тут лишається рівно те, що вміє тільки сервер, —
 * підписати автора і перевірити підпис.
 *
 * Через це токен читабельний для JS сторінки. Плата свідома: cookie на iPhone
 * зникала швидше, ніж `localStorage`, і людину викидало на вхід. Ціна підробки
 * не змінилась — без `SESSION_SECRET` підпис не зібрати, а секрет лишився на
 * сервері.
 */

export const SESSION_COOKIE = 'car_hunt_session'
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

/**
 * Хто востаннє заходив із цього пристрою. Живе окремо від сесії й переживає
 * «вийти»: на екрані входу лишається вибраним той самий, і після виходу
 * достатньо ввести пароль.
 *
 * Нічого не підписує — це підказка формі, а не облікові дані: підмінити її
 * означає лише обрати іншого зі списку, що й так доступний кнопкою. Сесію все
 * одно видає лише правильний пароль.
 */
export const LAST_AUTHOR_COOKIE = 'car_hunt_author'

const encoder = new TextEncoder()
let cachedKey: Promise<CryptoKey> | null = null

function hmacKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    const secret = process.env.SESSION_SECRET
    if (!secret) {
      throw new Error('SESSION_SECRET не заданий. Згенеруй: openssl rand -hex 32')
    }
    cachedKey = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
  }
  return cachedKey
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function sign(payload: string): Promise<Uint8Array<ArrayBuffer>> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(payload))
  return new Uint8Array(signature)
}

export async function createSessionToken(author: Author): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ a: author, t: Date.now() })))
  return `${payload}.${toBase64Url(await sign(payload))}`
}

/** Повертає автора або null. Ніколи не кидає — інакше middleware поклав би весь сайт. */
export async function readSessionToken(token: string | undefined): Promise<Author | null> {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      fromBase64Url(signature),
      encoder.encode(payload),
    )
    if (!valid) return null

    const data: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))
    if (typeof data !== 'object' || data === null) return null

    const { a, t } = data as { a?: unknown; t?: unknown }
    if (!isAuthor(a)) return null
    if (typeof t !== 'number' || Date.now() - t > SESSION_MAX_AGE_SECONDS * 1000) return null

    return a
  } catch {
    return null
  }
}

/** Побайтове порівняння за сталий час: жодних ранніх виходів. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Порівняння пароля за сталий час. Два рубежі:
 * 1) звіряємо не самі рядки, а їхні HMAC — довжина і збіг префікса пароля
 *    не впливають ні на що, бо дайджести завжди по 32 байти;
 * 2) самі дайджести звіряємо побайтово без раннього виходу.
 * Ніякого `===` на секретах.
 */
export async function passwordMatches(
  candidate: string,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected) return false
  const [a, b] = await Promise.all([sign(candidate), sign(expected)])
  return timingSafeEqual(a, b)
}
