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

export type SendOptions = {
  silent?: boolean
  preview?: boolean
  /** Відповісти на конкретне повідомлення — щоб у чаті було видно, на що саме. */
  replyTo?: number
  /** Кнопка-посилання під повідомленням: «Відкрити картку». */
  button?: { text: string; url: string }
}

/** Кнопка під повідомленням. Bot API чекає JSON-рядок, як і link_preview_options. */
function replyMarkup(button: SendOptions['button']): string | undefined {
  if (!button) return undefined
  return JSON.stringify({ inline_keyboard: [[{ text: button.text, url: button.url }]] })
}

/**
 * Текстове повідомлення. `HTML` замість Markdown: у назвах авто трапляються
 * `_` і `*`, і екранувати їх довелося б у кожному рядку.
 */
export function sendMessage(
  chatId: string | number,
  text: string,
  options: SendOptions = {},
): Promise<SentMessage> {
  return callTelegram<SentMessage>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_notification: options.silent,
    reply_to_message_id: options.replyTo,
    reply_markup: replyMarkup(options.button),
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
  options: SendOptions = {},
): Promise<SentMessage> {
  return callTelegram<SentMessage>('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
    disable_notification: options.silent,
    reply_to_message_id: options.replyTo,
    reply_markup: replyMarkup(options.button),
  })
}

/* -------------------------------------------------------------------------- */
/*  Файли                                                                      */
/* -------------------------------------------------------------------------- */

export type TelegramFile = { file_id: string; file_unique_id: string; file_path?: string }

/**
 * Шлях до файлу в Telegram. Посилання, яке з нього збирається, живе близько
 * години і одноразове — качати треба одразу.
 *
 * Файли понад 20 МБ Bot API не віддає взагалі: кидає помилку, яку ловить
 * викликач і просто пропускає це фото.
 */
export function getFile(fileId: string): Promise<TelegramFile> {
  return callTelegram<TelegramFile>('getFile', { file_id: fileId })
}

/** Адреса для завантаження. Токен у шляху, тому вона нікуди не логується. */
export function fileUrl(filePath: string): string {
  return `${ENDPOINT}/file/bot${botToken()}/${filePath}`
}

/** Вебхук: реєстрація, стан і зняття. Використовує scripts/set-webhook.ts. */
export type WebhookInfo = {
  url: string
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
  max_connections?: number
  allowed_updates?: string[]
}

export function setWebhook(
  url: string,
  secretToken: string,
  options: { dropPending?: boolean } = {},
): Promise<boolean> {
  return callTelegram<boolean>('setWebhook', {
    url,
    secret_token: secretToken,
    // Пости з каналів поза межами цього кроку — приймаємо лише приватні
    // повідомлення від нас двох.
    allowed_updates: JSON.stringify(['message']),
    drop_pending_updates: options.dropPending,
  })
}

export function deleteWebhook(dropPending = false): Promise<boolean> {
  return callTelegram<boolean>('deleteWebhook', { drop_pending_updates: dropPending })
}

export function getWebhookInfo(): Promise<WebhookInfo> {
  return callTelegram<WebhookInfo>('getWebhookInfo')
}
