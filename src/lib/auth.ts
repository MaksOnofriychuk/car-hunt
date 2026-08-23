import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SESSION_COOKIE, readSessionToken } from './session'
import { userNames, type Author } from './users'

/** Хто зараз працює, або null. Серверні компоненти й роут-хендлери. */
export async function getAuthor(): Promise<Author | null> {
  const store = await cookies()
  return readSessionToken(store.get(SESSION_COOKIE)?.value)
}

/** Те саме, але без сесії відправляє на /login. Основний вхід у захищені сторінки. */
export async function requireAuthor(): Promise<Author> {
  const author = await getAuthor()
  if (!author) redirect('/login')
  return author
}

/** Автор + його імʼя з .env — те, що показуємо в шапці і в стрічці подій. */
export async function requireSession(): Promise<{ author: Author; name: string }> {
  const author = await requireAuthor()
  return { author, name: userNames()[author] }
}
