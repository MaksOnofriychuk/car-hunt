import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import { getAuthor } from '@/lib/auth'
import { contentTypeFor, storage } from '@/lib/storage'

/**
 * Фото, додані руками. Окремий роут, а не серверна дія: у дій ліміт тіла 1 МБ,
 * а тут ще й видно поступ по кожному файлу. Стиснення робиться на клієнті
 * (`src/lib/image.ts`), сюди приїжджає вже webp на кількасот кілобайт.
 */

export const runtime = 'nodejs'

/** Стиснене фото рідко більше за мегабайт; 8 — це вже щось пішло не так. */
const MAX_BYTES = 8 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

export async function POST(request: Request): Promise<NextResponse> {
  const author = await getAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файла немає' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Фото завелике' }, { status: 400 })
  }

  const ext = EXTENSIONS[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Це не фото' }, { status: 400 })
  }

  const key = `listings/manual/${randomUUID()}.${ext}`
  const body = Buffer.from(await file.arrayBuffer())
  await storage().put(key, body, contentTypeFor(key))

  return NextResponse.json({ key, url: storage().url(key) })
}
