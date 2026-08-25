import { after, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthor } from '@/lib/auth'
import { ingestUrl, parseListing } from '@/lib/ingest'

export const runtime = 'nodejs'

const bodySchema = z
  .object({
    url: z.string().trim().min(1).optional(),
    urls: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((value) => value.url || value.urls?.length, {
    message: 'Потрібен url або urls',
  })

export async function POST(request: Request) {
  const author = await getAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const urls = parsed.data.urls?.length ? parsed.data.urls : [parsed.data.url!]

  const results = []
  for (const url of urls) {
    const result = await ingestUrl(url, author)
    results.push({ ...result, url })

    // Відповідь не чекає на парсинг: картка вже є, далі вона наповнюється у фоні.
    if (!result.duplicate && result.recognized) {
      after(() => parseListing(result.id))
    }
  }

  return NextResponse.json({ results }, { status: 200 })
}
