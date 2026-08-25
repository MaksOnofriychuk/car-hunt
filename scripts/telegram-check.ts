import './load-env'

import { desc, isNotNull } from 'drizzle-orm'

import { db } from '../src/db'
import { listings } from '../src/db/schema'
import { getSettings } from '../src/db/settings'
import { callTelegram, sendMessage, sendPhoto } from '../src/lib/telegram/api'
import { newListingMessage } from '../src/lib/telegram/messages'
import { isQuietNow } from '../src/lib/telegram/notify'
import { timeInKyiv } from '../src/lib/dates'
import { signedFileUrl } from '../src/lib/storage/signed'
import { userNames, type Author } from '../src/lib/users'

/**
 * Перевірка бота без чекання на подію: чи є токен, чи відповідає Bot API, чи
 * доходять повідомлення в обидва чати і чи бачить Telegram наші фото.
 *
 *   npm run tg:check                    лише перевірки, нічого не шле
 *   npm run tg:check -- --send          надішле тестове повідомлення обом
 *   npm run tg:check -- --send --to me  тільки собі, щоб не смикати другого
 *
 * Останнє реальне авто береться з бази — щоб побачити справжній вигляд картки
 * в месенджері, а не «Lorem ipsum».
 */

const send = process.argv.includes('--send')

/** Кому саме слати перевірку. Типово обом — але тренуватись краще на собі. */
const only = (() => {
  const index = process.argv.indexOf('--to')
  const value = index >= 0 ? process.argv[index + 1] : null
  return value === 'me' || value === 'dad' ? (value as Author) : null
})()

function line(ok: boolean, text: string): void {
  console.log(`${ok ? '✓' : '✗'} ${text}`)
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  line(Boolean(token), token ? 'TELEGRAM_BOT_TOKEN заданий' : 'TELEGRAM_BOT_TOKEN порожній')
  if (!token) process.exit(1)

  const appUrl = process.env.APP_URL
  line(Boolean(appUrl), appUrl ? `APP_URL = ${appUrl}` : 'APP_URL порожній — не буде ні посилань, ні фото')

  const me = await callTelegram<{ username: string; first_name: string }>('getMe')
  line(true, `Bot API відповідає: @${me.username} (${me.first_name})`)

  const chats: Record<Author, string | undefined> = {
    me: process.env.TELEGRAM_CHAT_ID_ME,
    dad: process.env.TELEGRAM_CHAT_ID_DAD,
  }
  const names = userNames()

  const [listing] = await db
    .select()
    .from(listings)
    .where(isNotNull(listings.title))
    .orderBy(desc(listings.createdAt))
    .limit(1)

  if (!listing) {
    line(false, 'У базі немає жодного розпарсеного авто — тестове повідомлення буде без прикладу')
  }

  const photoKey = listing?.photosLocal[0] ?? listing?.photosManual[0]
  const photoUrl = photoKey ? signedFileUrl(photoKey) : (listing?.photos[0] ?? null)
  line(Boolean(photoUrl), photoUrl ? `Фото для перевірки: ${photoUrl.slice(0, 72)}…` : 'Фото немає')

  for (const author of ['me', 'dad'] as const) {
    const chatId = chats[author]
    if (!chatId) {
      line(false, `${names[author]}: chat_id не заданий — сповіщення не підуть`)
      continue
    }

    const settings = await getSettings(author)
    const quiet = isQuietNow(settings)
    line(
      true,
      `${names[author]} (${chatId}): нові ${flag(settings.notifyNew)}, розмови ${flag(
        settings.notifyComment,
      )}, ціни ${flag(settings.notifyPrice)}, етапи ${flag(settings.notifyStage)}` +
        ` · зараз ${timeInKyiv()}, тихі години ${settings.quietFrom}–${settings.quietTo}` +
        ` → ${quiet ? 'без звуку' : 'зі звуком'}`,
    )

    if (!send || (only && only !== author)) continue

    const text = listing
      ? newListingMessage(listing, names[author === 'me' ? 'dad' : 'me'], settings.currency)
      : '🚗 <b>Перевірка звʼязку</b>\nЯкщо це видно — бот налаштований.'

    try {
      if (photoUrl) {
        await sendPhoto(chatId, photoUrl, text, { silent: quiet })
        line(true, `${names[author]}: надіслано з фото`)
      } else {
        await sendMessage(chatId, text, { silent: quiet })
        line(true, `${names[author]}: надіслано текстом`)
      }
    } catch (error) {
      line(false, `${names[author]}: не надіслалось — ${(error as Error).message}`)
      if (photoUrl) {
        await sendMessage(chatId, text, { silent: quiet })
        line(true, `${names[author]}: текст без фото пройшов — значить, недоступне саме фото`)
      }
    }
  }

  if (!send) console.log('\nНічого не надіслано. Додай --send, щоб перевірити доставку.')
  process.exit(0)
}

function flag(on: boolean): string {
  return on ? 'увімкнені' : 'вимкнені'
}

main().catch((error: unknown) => {
  console.error('Перевірка впала:', error)
  process.exit(1)
})
