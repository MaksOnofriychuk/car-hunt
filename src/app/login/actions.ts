'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { loginBlockFor, recordLoginAttempt } from '@/db/login-attempts'
import { clientIp } from '@/lib/request-ip'
import {
  SESSION_COOKIE,
  createSessionToken,
  passwordMatches,
  sessionCookieOptions,
} from '@/lib/session'
import { AUTHOR_VALUES, isAuthor } from '@/lib/users'

/**
 * Одне повідомлення на всі причини відмови. Ні «нема такого користувача»,
 * ні «пароль закороткий» — нічого, з чого можна щось вивести про облікові дані.
 */
const WRONG = 'Невірний пароль'

const loginSchema = z.object({
  password: z.string().min(1),
  author: z.enum(AUTHOR_VALUES),
  next: z.string().optional(),
})

export type LoginState = {
  error: string | null
  /** Досягнуто ліміту: форму треба заблокувати, щоб наступний POST не впав у 429. */
  blocked?: boolean
  retryAfterSeconds?: number
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const requestHeaders = await headers()
  const ip = clientIp(requestHeaders)
  const userAgent = requestHeaders.get('user-agent')

  // Другий рубіж: middleware вже віддав би 429, але дублюємо на випадок,
  // якщо дія колись викличеться в обхід нього.
  const before = await loginBlockFor(ip)
  if (before.blocked) {
    return { error: WRONG, blocked: true, retryAfterSeconds: before.retryAfterSeconds }
  }

  const raw = {
    password: formData.get('password'),
    author: formData.get('author'),
    next: formData.get('next') ?? undefined,
  }
  const parsed = loginSchema.safeParse(raw)
  const author = isAuthor(raw.author) ? raw.author : null

  const ok =
    parsed.success && (await passwordMatches(parsed.data.password, process.env.APP_PASSWORD))

  await recordLoginAttempt({ ip, userAgent, author, success: ok })

  if (!ok) {
    const after = await loginBlockFor(ip)
    return {
      error: WRONG,
      blocked: after.blocked,
      retryAfterSeconds: after.retryAfterSeconds,
    }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, await createSessionToken(parsed.data!.author), sessionCookieOptions)

  // Тільки внутрішні шляхи, щоб ?next= не став відкритим редиректом.
  const target = parsed.data!.next
  redirect(target && target.startsWith('/') && !target.startsWith('//') ? target : '/')
}

export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login')
}
