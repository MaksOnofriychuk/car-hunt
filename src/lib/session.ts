import { isAuthor, type Author } from './users'

/**
 * Підписаний httpOnly cookie на рік. Web Crypto, а не node:crypto, бо цей
 * модуль підключає middleware, а він живе в Edge-рантаймі.
 */

export const SESSION_COOKIE = 'car_hunt_session'
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const

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

/**
 * Порівняння пароля за сталий час: хешуємо обидва рядки тим самим ключем
 * і звіряємо хеші, щоб довжина і збіг префікса нічого не підказували.
 */
export async function passwordMatches(candidate: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false
  const [a, b] = await Promise.all([sign(candidate), sign(expected)])
  return toBase64Url(a) === toBase64Url(b)
}
