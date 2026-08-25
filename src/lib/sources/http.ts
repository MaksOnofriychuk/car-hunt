import { and, count, eq, gte } from 'drizzle-orm'

import { db } from '@/db'
import { sourceRequests, type RequestKind, type SourceName } from '@/db/schema'

/**
 * Ввічливі вихідні запити до джерел: чесний User-Agent, ≥2 с між запитами
 * і квота AUTO.RIA API — SPEC, «Парсер AUTO.RIA».
 */

const MIN_DELAY_MS = 2000

/** Ліміти стосуються developers.ria.com. Публічна сторінка і CDN з фото — ні. */
const API_PER_HOUR = 30
const API_PER_MONTH = 1000
const HOUR_MS = 60 * 60 * 1000
const MONTH_MS = 30 * 24 * HOUR_MS

const FETCH_TIMEOUT_MS = 20_000

/**
 * Хто ми і як з нами звʼязатись. CONTACT_EMAIL опційний: без нього UA лишається
 * чесним, але без пошти. Свою адресу підставляй сам — я її туди не вписую.
 */
export function userAgent(): string {
  const contact = process.env.CONTACT_EMAIL?.trim()
  const base = 'CarHunt/0.1 (private car-search tracker for two people)'
  return contact ? `${base} (+mailto:${contact})` : base
}

/** Квота вичерпана. Означає «в чергу», а не помилку: листинг лишається pending. */
export class QuotaExceededError extends Error {
  constructor(
    readonly scope: 'hour' | 'month',
    readonly used: number,
    readonly limit: number,
  ) {
    super(`Квота AUTO.RIA API вичерпана: ${used}/${limit} за ${scope === 'hour' ? 'годину' : 'місяць'}`)
    this.name = 'QuotaExceededError'
  }
}

async function usedSince(source: SourceName, kind: RequestKind, ms: number): Promise<number> {
  const [row] = await db
    .select({ used: count() })
    .from(sourceRequests)
    .where(
      and(
        eq(sourceRequests.source, source),
        eq(sourceRequests.kind, kind),
        gte(sourceRequests.createdAt, new Date(Date.now() - ms)),
      ),
    )
  return row?.used ?? 0
}

/** Скільки запитів до API лишилось. Cron дивиться сюди, щоб не братись за зайве. */
export async function apiQuotaLeft(source: SourceName = 'autoria') {
  const [hour, month] = await Promise.all([
    usedSince(source, 'api', HOUR_MS),
    usedSince(source, 'api', MONTH_MS),
  ])
  return {
    hour: Math.max(0, API_PER_HOUR - hour),
    month: Math.max(0, API_PER_MONTH - month),
  }
}

async function assertQuota(source: SourceName): Promise<void> {
  const hour = await usedSince(source, 'api', HOUR_MS)
  if (hour >= API_PER_HOUR) throw new QuotaExceededError('hour', hour, API_PER_HOUR)

  const month = await usedSince(source, 'api', MONTH_MS)
  if (month >= API_PER_MONTH) throw new QuotaExceededError('month', month, API_PER_MONTH)
}

// Черга в памʼяті процесу: тримає паузу між запитами. На Vercel у кожного
// інстанса вона своя, тому це ввічливість, а не жорсткий глобальний ліміт.
let chain: Promise<void> = Promise.resolve()
let lastRequestAt = 0

function waitForSlot(): Promise<void> {
  chain = chain.then(async () => {
    const since = Date.now() - lastRequestAt
    if (since < MIN_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - since))
    }
    lastRequestAt = Date.now()
  })
  return chain
}

export async function politeFetch(
  url: string,
  options: { source: SourceName; kind: RequestKind; accept?: string },
): Promise<Response> {
  if (options.kind === 'api') await assertQuota(options.source)

  await waitForSlot()

  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent(),
      Accept: options.accept ?? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'uk,en;q=0.8',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
    redirect: 'follow',
  })

  // Пишемо факт запиту навіть при помилці: квоту він усе одно зʼїв.
  await db.insert(sourceRequests).values({ source: options.source, kind: options.kind })

  return response
}
