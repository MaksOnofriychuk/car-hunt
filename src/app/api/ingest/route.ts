import { after, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthor } from '@/lib/auth'
import { ingestUrl, parseListing } from '@/lib/ingest'
import { findListingLink } from '@/lib/sources/links'
import { notifyNewListing } from '@/lib/telegram/notify'

export const runtime = 'nodejs'

/**
 * Парсинг і архівація йдуть у `after()` уже після відповіді, але живуть у тій
 * самій функції: сторінка оголошення, курс, потім десятки фото. Типових 10 с
 * не вистачило б, і картка лишалась би з половиною архіву.
 */
export const maxDuration = 60

const bodySchema = z
  .object({
    url: z.string().trim().min(1).optional(),
    urls: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((value) => value.url || value.urls?.length, {
    message: 'Потрібен url або urls',
  })

/**
 * Що саме вважати окремим входом. Текст поста, вкинутий у «вставити багато»,
 * розбивається по рядках — і «2015», «245 тис км» та VIN стали б окремими
 * картками manual/failed (SPEC, «Сміття в тексті»).
 *
 * Правило: є хоч одне посилання — беремо тільки рядки з посиланнями; немає
 * жодного — це **один** вхід, а не N.
 */
function inputsFrom(raw: string[]): string[] {
  const withLinks = raw.filter((line) => findListingLink(line) !== null)
  if (withLinks.length > 0) return withLinks

  const text = raw.join('\n').trim()
  return text ? [text] : []
}

export async function POST(request: Request) {
  const author = await getAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const urls = inputsFrom(parsed.data.urls?.length ? parsed.data.urls : [parsed.data.url!])

  const results = []
  for (const url of urls) {
    const result = await ingestUrl(url, author)
    results.push({ ...result, url })

    // Відповідь не чекає на парсинг: картка вже є, далі вона наповнюється у фоні.
    // Сповіщення йде після парсингу — інакше в ньому не було б ні назви, ні ціни.
    if (!result.duplicate && result.recognized) {
      after(async () => {
        await parseListing(result.id)
        await notifyNewListing(result.id, author)
      })
    }
  }

  return NextResponse.json({ results }, { status: 200 })
}
