import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { chromium, type BrowserContext } from 'playwright-core'

/**
 * Знімки екранів застосунку — щоб бачити зроблене, а не вгадувати.
 *
 * Керує вже встановленим Chrome (`channel: 'chrome'`), тому нічого не качає.
 * Вхід робиться **руками один раз**: пароль вводиш ти, я його не бачу і не
 * ввожу. Сесія зберігається в `.auth/state.json` (не комітиться) і живе рік.
 *
 *   npm run shot -- --login          один раз: відкриється браузер, увійди
 *   npm run shot -- / /sellers       знімки сторінок, 390px
 *   npm run shot -- / --wide         те саме на 1280px
 *   npm run shot -- / --theme light  зі світлою темою
 */

const BASE = 'http://localhost:3000'
const STATE = resolve('.auth/state.json')
const OUT = resolve('design/shots')

const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const paths = args.filter((arg) => !arg.startsWith('--'))

const wide = flags.has('--wide')
const themeFlag = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : null

async function login(): Promise<void> {
  await mkdir(resolve('.auth'), { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome', headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)

  console.log('Відкрив /login у браузері. Увійди руками — я почекаю.')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 300_000 })

  await context.storageState({ path: STATE })
  console.log(`Сесія збережена: ${STATE}. Далі знімки робляться без тебе.`)
  await browser.close()
}

async function shoot(context: BrowserContext, path: string): Promise<void> {
  const page = await context.newPage()
  // Не `networkidle`: у черзі живе поллер незакінчених карток, і мережа
  // ніколи не затихає — знімок просто не дочекався б.
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)

  const name = (path === '/' ? 'queue' : path.replace(/^\//, '').replace(/[/?=&]/g, '-'))
    .concat(wide ? '-wide' : '')
    .concat(themeFlag ? `-${themeFlag}` : '')

  const file = `${OUT}/${name}.png`
  await page.screenshot({ path: file, fullPage: true })
  console.log(`  ${path} → ${file}`)
  await page.close()
}

async function main(): Promise<void> {
  if (flags.has('--login')) return login()

  if (!existsSync(STATE)) {
    console.error('Немає збереженої сесії. Спершу: npm run shot -- --login')
    process.exitCode = 1
    return
  }

  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext({
    storageState: STATE,
    viewport: wide ? { width: 1280, height: 900 } : { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: themeFlag === 'light' ? 'light' : 'dark',
  })

  // Тема застосунку живе в cookie — ставимо її тим самим ключем, що й інтерфейс.
  if (themeFlag) {
    await context.addCookies([
      {
        name: 'car_hunt_look',
        value: encodeURIComponent(JSON.stringify({ theme: themeFlag })),
        url: BASE,
      },
    ])
  }

  for (const path of paths.length > 0 ? paths : ['/']) {
    await shoot(context, path)
  }

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
