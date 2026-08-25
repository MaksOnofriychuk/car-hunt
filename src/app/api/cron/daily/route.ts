import { NextResponse } from 'next/server'

import { cronAuthorized, runDaily } from '@/lib/cron'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Ранкове зведення. Роут викликається **щогодини**, а кому саме вже час —
 * вирішує `runDaily`: 8:00 за Києвом узимку і влітку припадають на різні
 * години UTC, і розкладом у це не влучити.
 *
 * `?force=1` надсилає негайно, не питаючи про годину — для перевірки руками.
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

  const force = new URL(request.url).searchParams.get('force') === '1'
  const report = await runDaily(force)

  return NextResponse.json(report)
}
