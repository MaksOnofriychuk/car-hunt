'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { loginBlockFor, recordLoginAttempt } from '@/db/login-attempts'
import { clientIp } from '@/lib/request-ip'
import { createSessionToken, passwordMatches } from '@/lib/session'
import { AUTHOR_VALUES, isAuthor, type Author } from '@/lib/users'

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
  /**
   * Підписаний токен сесії. Сервер його **не зберігає**: сесія живе на
   * пристрої в `localStorage`, і покласти її туди може лише клієнт. Форма
   * забирає токен звідси і сама вирішує, куди йти далі.
   */
  token?: string
  author?: Author
  next?: string
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

  // Тільки внутрішні шляхи, щоб ?next= не став відкритим редиректом.
  const target = parsed.data!.next
  const safe = target && target.startsWith('/') && !target.startsWith('//') ? target : '/'

  return {
    error: null,
    token: await createSessionToken(parsed.data!.author),
    author: parsed.data!.author,
    next: safe,
  }
}
