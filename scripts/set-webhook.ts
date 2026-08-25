import './load-env'

import { deleteWebhook, getWebhookInfo, setWebhook } from '../src/lib/telegram/api'

/**
 * Реєстрація вебхука в Telegram.
 *
 *   npm run tg:webhook                     показати поточний стан
 *   npm run tg:webhook -- --set            поставити на APP_URL
 *   npm run tg:webhook -- --set --url https://xxx.trycloudflare.com
 *   npm run tg:webhook -- --set --drop     ще й викинути накопичену чергу
 *   npm run tg:webhook -- --delete         зняти
 *
 * Telegram вимагає **https** і публічну адресу: з localhost вебхук не працює
 * взагалі, потрібен тунель (`cloudflared tunnel --url http://localhost:3000`).
 */

const args = process.argv.slice(2)
const wantsSet = args.includes('--set')
const wantsDelete = args.includes('--delete')
const dropPending = args.includes('--drop')
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : null

async function show(): Promise<void> {
  const info = await getWebhookInfo()

  console.log(`Адреса:        ${info.url || '— не встановлено'}`)
  console.log(`У черзі:       ${info.pending_update_count}`)
  console.log(`Типи апдейтів: ${info.allowed_updates?.join(', ') ?? 'усі'}`)

  if (info.last_error_message) {
    const when = info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : '?'
    console.log(`Остання помилка (${when}): ${info.last_error_message}`)
  }
}

async function main(): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN не заданий.')
    process.exit(1)
  }

  if (wantsDelete) {
    await deleteWebhook(dropPending)
    console.log('Вебхук знято.')
    await show()
    return
  }

  if (wantsSet) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) {
      console.error(
        'TELEGRAM_WEBHOOK_SECRET порожній. Без нього роут відповідає 401 на все —\n' +
          'згенеруй: openssl rand -hex 32',
      )
      process.exit(1)
    }

    const base = (urlArg ?? process.env.APP_URL ?? '').replace(/\/$/, '')
    if (!base.startsWith('https://')) {
      console.error(
        `Потрібна публічна https-адреса, а не «${base || 'порожньо'}».\n` +
          'Для локальної перевірки підніми тунель:\n' +
          '  cloudflared tunnel --url http://localhost:3000\n' +
          'і передай його адресу: npm run tg:webhook -- --set --url https://…',
      )
      process.exit(1)
    }

    await setWebhook(`${base}/api/telegram/webhook`, secret, { dropPending })
    console.log(`Вебхук поставлено на ${base}/api/telegram/webhook`)
  }

  await show()
}

main().catch((error: unknown) => {
  console.error('Не вийшло:', error)
  process.exit(1)
})
