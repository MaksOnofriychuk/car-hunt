/**
 * Мінімальний клієнт Bot API. Токен читаємо всередині функції, а не на рівні
 * модуля, і ніколи не кладемо в текст помилки — URL із токеном не має витекти в лог.
 */

const ENDPOINT = 'https://api.telegram.org'
const TIMEOUT_MS = 10_000

export type TelegramChat = {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  username?: string
  title?: string
}

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly description: string,
    readonly status: number,
  ) {
    super(`Telegram ${method}: ${description}`)
    this.name = 'TelegramApiError'
  }
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не заданий. Візьми токен у @BotFather.')
  return token
}

export async function callTelegram<T>(
  method: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  )

  const response = await fetch(`${ENDPOINT}/bot${botToken()}/${method}?${query}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })

  const body = (await response.json()) as { ok: boolean; result?: T; description?: string }
  if (!body.ok) {
    throw new TelegramApiError(method, body.description ?? 'невідома помилка', response.status)
  }
  return body.result as T
}

/**
 * Для публічного каналу працює по @username і без членства бота в каналі —
 * саме на цьому тримається канонізація посилань t.me/<username>/<id>.
 */
export function getChat(chatId: string | number): Promise<TelegramChat> {
  return callTelegram<TelegramChat>('getChat', { chat_id: chatId })
}
