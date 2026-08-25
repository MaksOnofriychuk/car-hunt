import type { Metadata, Viewport } from 'next'
import { Fira_Sans, IBM_Plex_Mono, IBM_Plex_Sans, Inter, Rubik } from 'next/font/google'
import { cookies } from 'next/headers'

import './globals.css'

import { LOOK_COOKIE, parseLook } from '@/lib/look'

/**
 * Шрифти інтерфейсу. Усі — з кирилицею: без неї український текст сипався б на
 * системний шрифт, і сенс вибору зникав.
 *
 * SPEC просить Archivo, а серед «підвищеної читабельності» проситься Atkinson
 * Hyperlegible — але в жодного з них кирилиці немає (перевірено по переліку
 * підмножин next/font). Тому читабельний варіант — Fira Sans: її малювали саме
 * заради розбірливості на екрані, і кирилиця в неї повна.
 *
 * Попередньо вантажимо тільки типовий: решта підтягнеться, коли її оберуть.
 */
const plex = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
})

const fira = Fira_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira',
  display: 'swap',
  preload: false,
})

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-inter',
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
  title: 'Car Hunt',
  description: 'Трекер пошуку авто на AUTO.RIA',
  // Третій рубіж проти індексації, поруч із X-Robots-Tag і robots.txt.
  robots: { index: false, follow: false, nocache: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEEFEC' },
    { media: '(prefers-color-scheme: dark)', color: '#15181C' },
  ],
  width: 'device-width',
  initialScale: 1,
}

const FONT_VARIABLES = [plex, fira, inter, rubik, mono].map((font) => font.variable).join(' ')

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Вигляд читається з cookie ще на сервері: інакше сторінка встигла б блимнути
  // світлою темою і типовим шрифтом, перш ніж клієнт про них дізнається.
  const jar = await cookies()
  const look = parseLook(jar.get(LOOK_COOKIE)?.value)

  return (
    <html
      lang="uk"
      className={FONT_VARIABLES}
      data-theme={look.theme === 'system' ? undefined : look.theme}
      data-size={look.size}
      data-font={look.font}
      data-density={look.density}
    >
      <body>{children}</body>
    </html>
  )
}
