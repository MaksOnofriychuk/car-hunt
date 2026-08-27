import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Fira_Sans, IBM_Plex_Mono, IBM_Plex_Sans, Inter, Rubik } from 'next/font/google'
import { cookies } from 'next/headers'

import './globals.css'

import { TopProgress } from '@/components/TopProgress'

import { DEVICE_BOOTSTRAP } from '@/lib/device-store'
import { LOOK_COOKIE, parseLook } from '@/lib/look'

/**
 * Шрифти інтерфейсу. Усі — з кирилицею: без неї український текст сипався б на
 * системний шрифт, і сенс вибору зникав.
 *
 * Типовий — Inter: він на макетах системи «Світні краї». Читабельний варіант —
 * Fira Sans, бо ні Archivo зі SPEC, ні Atkinson Hyperlegible кирилиці не мають
 * (перевірено по переліку підмножин next/font), і український текст сипався б
 * на системний шрифт.
 *
 * Попередньо вантажимо тільки типовий: решта підтягнеться, коли її оберуть.
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

const plex = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
  preload: false,
})

const fira = Fira_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira',
  display: 'swap',
  preload: false,
})

const rubik = Rubik({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-rubik',
  display: 'swap',
  preload: false,
})

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-ui',
  display: 'swap',
})

export const metadata: Metadata = {
  // Шаблон дає кожній вкладці власну назву: «Черга — Car Hunt», «Продавці —
  // Car Hunt». Сторінки задають лише свою частину.
  title: { default: 'Car Hunt', template: '%s — Car Hunt' },
  description: 'Трекер пошуку авто: AUTO.RIA, OLX і Telegram в одній черзі',
  applicationName: 'Car Hunt',
  // Третій рубіж проти індексації, поруч із X-Robots-Tag і robots.txt.
  robots: { index: false, follow: false, nocache: true },
}

/** Колір браузерної смуги йде за обраною темою, а не за системною. */
export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies()
  const { theme } = parseLook(jar.get(LOOK_COOKIE)?.value)

  return {
    themeColor: theme === 'light' ? '#EDF0F4' : '#06070A',
    width: 'device-width',
    initialScale: 1,
  }
}

const FONT_VARIABLES = [inter, plex, fira, rubik, mono].map((font) => font.variable).join(' ')

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Вигляд читається з cookie ще на сервері: інакше сторінка встигла б блимнути
  // світлою темою і типовим шрифтом, перш ніж клієнт про них дізнається.
  const jar = await cookies()
  const look = parseLook(jar.get(LOOK_COOKIE)?.value)

  return (
    <html
      lang="uk"
      className={FONT_VARIABLES}
      data-theme={look.theme}
      data-size={look.size}
      data-font={look.font}
      data-density={look.density}
    >
      <head>
        {/* Відновлення cookie з localStorage — до першого малювання, інакше
            сервер уже намалював би вхід замість черги. `beforeInteractive`
            тут не підходить: він теж чекає на гідратацію. */}
        <script dangerouslySetInnerHTML={{ __html: DEVICE_BOOTSTRAP }} />
      </head>
      <body>
        {/* `useSearchParams` усередині вимагає межі Suspense — інакше збірка
            статичних сторінок (наприклад 404) на ній спіткнеться. */}
        <Suspense fallback={null}>
          <TopProgress />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
