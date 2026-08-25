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

export type TelegramParams = Record<string, string | number | boolean | undefined>

/**
 * POST із JSON, а не GET із query: текст повідомлення буває довгим і з
 * розміткою, і в адресному рядку йому не місце. Токен лишається в шляху — інакше
 * Bot API його не приймає, — тому URL нікуди не логується.
 */
export async function callTelegram<T>(method: string, params: TelegramParams = {}): Promise<T> {
  const payload = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  )

  const response = await fetch(`${ENDPOINT}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })

  const body = (await response.json()) as { ok: boolean; result?: T; description?: string }
  if (!body.ok) {
    throw new TelegramApiError(method, body.description ?? 'невідома помилка', response.status)
  }
  return body.result as T
}

/** Чи є взагалі кому слати: без токена весь модуль мовчить, а не падає. */
export function hasBotToken(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

/**
 * Для публічного каналу працює по @username і без членства бота в каналі —
 * саме на цьому тримається канонізація посилань t.me/<username>/<id>.
 */
export function getChat(chatId: string | number): Promise<TelegramChat> {
  return callTelegram<TelegramChat>('getChat', { chat_id: chatId })
}

export type SentMessage = { message_id: number }

/**
 * Текстове повідомлення. `HTML` замість Markdown: у назвах авто трапляються
 * `_` і `*`, і екранувати їх довелося б у кожному рядку.
 */
export function sendMessage(
  chatId: string | number,
  text: string,
  options: { silent?: boolean; preview?: boolean } = {},
): Promise<SentMessage> {
  return callTelegram<SentMessage>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_notification: options.silent,
    // Прев'ю сторінки оголошення в стрічці зайве: посилання веде на нашу картку,
    // а не на майданчик, і картинку до неї Telegram однаково не покаже.
    link_preview_options: JSON.stringify({ is_disabled: !options.preview }),
  })
}

/** Фото з підписом. Підпис Bot API обрізає на 1024 символах — тримаємось коротко. */
export function sendPhoto(
  chatId: string | number,
  photoUrl: string,
  caption: string,
  options: { silent?: boolean } = {},
): Promise<SentMessage> {
  return callTelegram<SentMessage>('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
    disable_notification: options.silent,
  })
}
