import { NextResponse } from 'next/server'

import { getAuthor } from '@/lib/auth'
import { contentTypeFor, storage } from '@/lib/storage'
import { verifyFileSignature } from '@/lib/storage/signed'

export const runtime = 'nodejs'

/**
 * Роздача файлів локального сховища. Тека /storage лежить поза public/, тому
 * файли проходять через цей роут — а отже під тією ж автентифікацією, що й усе
 * інше. У публічний список middleware не додається навмисно.
 *
 * Другий вхід — підписане посилання (`?exp=&sig=`) на **один конкретний ключ**,
 * дійсне годину: за фото в повідомленнях Telegram ходить своїм сервером, без
 * наших cookie. Підпис перевіряється тут; middleware лише пропускає запит із
 * цими параметрами далі, щоб не робити ту саму криптографію двічі.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  const path = key.map(decodeURIComponent).join('/')

  const query = new URL(request.url).searchParams
  const signed = verifyFileSignature(path, query.get('exp'), query.get('sig'))

  if (!signed) {
    const author = await getAuthor()
    if (!author) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

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
