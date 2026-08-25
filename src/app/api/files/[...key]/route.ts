import { NextResponse } from 'next/server'

import { getAuthor } from '@/lib/auth'
import { contentTypeFor, storage } from '@/lib/storage'

export const runtime = 'nodejs'

/**
 * Роздача файлів локального сховища. Тека /storage лежить поза public/, тому
 * файли проходять через цей роут — а отже під тією ж автентифікацією, що й усе
 * інше. У публічний список middleware не додається навмисно.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const author = await getAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })

  const { key } = await params
  const path = key.map(decodeURIComponent).join('/')

  let body: Buffer | null
  try {
    body = await storage().get(path)
  } catch {
    return NextResponse.json({ error: 'Некоректний ключ' }, { status: 400 })
  }

  if (!body) return NextResponse.json({ error: 'Не знайдено' }, { status: 404 })

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentTypeFor(path),
      // Копія незмінна: ключ містить хеш вмісту.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
