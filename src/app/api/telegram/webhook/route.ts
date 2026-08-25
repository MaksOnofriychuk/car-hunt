import { timingSafeEqual } from 'node:crypto'

import { after, NextResponse } from 'next/server'

import { handleMessage } from '@/lib/telegram/handle'
import { authorForChat, updateSchema } from '@/lib/telegram/update'

export const runtime = 'nodejs'

/**
 * Бюджет: пауза на збирання альбому (3 с) плюс завантаження фото (до 25 с).
 * Типові 10 с не вистачило б, і остання половина альбому лишалась би без фото.
 */
export const maxDuration = 60

/**
 * Вхідні від Telegram — SPEC, «Telegram-бот» і «Пости з Telegram-груп».
 *
 * Роут навмисно тонкий: перевірити, що це справді Telegram, покласти апдейт у
 * чергу і **одразу відповісти 200**. Якщо відповідь затримається, Telegram
 * повторить апдейт — і той самий пост приїде вдруге.
 *
 * Виняток один: не змогли зберегти апдейт — тоді 500. Ретрай Telegram у цьому
 * випадку якраз потрібен, а `update_id` первинним ключем робить його безкоштовним.
 */
export async function POST(request: Request) {
  if (!authentic(request)) {
    return NextResponse.json({ error: 'Не для тебе' }, { status: 401 })
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  // Формат, якого ми не розуміємо, — тиха 200: інакше Telegram ретраїтиме його
  // довіку, а ми все одно нічого з ним не зробимо.
  if (!parsed.success || !parsed.data.message) return ok()

  const message = parsed.data.message
  const author = authorForChat(message.chat.id)
  // Усе, що прийшло не від нас двох, теж отримує тиху 200 і не обробляється.
  if (!author) return ok()

  after(async () => {
    try {
      await handleMessage(parsed.data, message, author)
    } catch (error) {
      console.error('[telegram] апдейт не обробився:', error)
    }
  })

  return ok()
}

function ok(): NextResponse {
  return NextResponse.json({ ok: true })
}

/**
 * Секретний заголовок. Порівняння стале в часі, і довжину звіряємо окремо —
 * `timingSafeEqual` на різних довжинах кидає виняток.
 *
 * Змінної немає взагалі → 401 на все: замок без ключа має бути зачиненим.
 */
function authentic(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return false

  const given = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  const a = Buffer.from(expected)
  const b = Buffer.from(given)

  return a.length === b.length && timingSafeEqual(a, b)
}
