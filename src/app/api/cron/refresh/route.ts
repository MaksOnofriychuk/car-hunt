import { NextResponse } from 'next/server'

import { cronAuthorized, runRefresh } from '@/lib/cron'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Погодинний прогін — SPEC, «Фонові задачі». Що саме робиться і в якому
 * порядку, описано в `src/lib/cron.ts`; роут лише перевіряє, що це справді наш
 * крон.
 *
 * GET і POST — один і той самий прогін: Vercel Cron ходить GET-ом і сам додає
 * `Authorization: Bearer ${CRON_SECRET}`, а GitHub Actions і перевірка руками
 * зручніші через POST.
 */
export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}

async function run(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  const report = await runRefresh()
  return NextResponse.json(report)
}
