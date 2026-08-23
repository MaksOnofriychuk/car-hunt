'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { SESSION_COOKIE, createSessionToken, passwordMatches, sessionCookieOptions } from '@/lib/session'
import { AUTHOR_VALUES } from '@/lib/users'

const loginSchema = z.object({
  password: z.string().min(1, 'Введи пароль'),
  author: z.enum(AUTHOR_VALUES),
  next: z.string().optional(),
})

export type LoginState = { error: string | null }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    password: formData.get('password'),
    author: formData.get('author'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Оберіть, хто ви, і введіть пароль' }
  }

  if (!(await passwordMatches(parsed.data.password, process.env.APP_PASSWORD))) {
    return { error: 'Пароль не підходить' }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, await createSessionToken(parsed.data.author), sessionCookieOptions)

  // Тільки внутрішні шляхи, щоб ?next= не став відкритим редиректом.
  const target = parsed.data.next
  redirect(target && target.startsWith('/') && !target.startsWith('//') ? target : '/')
}

export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login')
}
