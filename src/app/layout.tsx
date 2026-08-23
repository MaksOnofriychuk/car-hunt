import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'

import './globals.css'

/**
 * SPEC просить Archivo для інтерфейсу, але в Archivo немає кирилиці
 * (Google Fonts віддає лише latin, latin-ext, vietnamese), а весь інтерфейс
 * український. Беремо IBM Plex Sans — сестру Plex Mono, який SPEC і так
 * призначив для чисел. Заміна на один рядок, якщо знайдемо кращий варіант.
 */
const sans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-ui',
  display: 'swap',
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
}

export const viewport: Viewport = {
  themeColor: '#EEEFEC',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
