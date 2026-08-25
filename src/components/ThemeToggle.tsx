'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { THEME_LABELS, writeLook, type Look, type Theme } from '@/lib/look'

/**
 * Перемикач теми. Тем дві — темна і світла, тому це саме перемикач, а не меню:
 * один тап великим пальцем міняє її туди й назад.
 *
 * Вибір лягає в cookie, яку сервер читає при наступному рендері, тому тема
 * міняється разом із розміткою, без спалаху старими кольорами.
 */
export function ThemeToggle({ look }: { look: Look }) {
  const router = useRouter()
  const [theme, setTheme] = useState<Theme>(look.theme)

  const next = () => {
    const value: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(value)
    writeLook({ ...look, theme: value })
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={next}
      title={`Тема: ${THEME_LABELS[theme]}`}
      aria-label={`Тема: ${THEME_LABELS[theme]}. Перемкнути на ${
        theme === 'dark' ? THEME_LABELS.light : THEME_LABELS.dark
      }`}
      className="surface flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-(--t-instant) hover:text-ink"
    >
      <Icon theme={theme} />
    </button>
  )
}

function Icon({ theme }: { theme: Theme }) {
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.4" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <line
            key={angle}
            x1="10"
            y1="1.8"
            x2="10"
            y2="4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            transform={`rotate(${angle} 10 10)`}
          />
        ))}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M16 12.4A7 7 0 0 1 7.6 4a7 7 0 1 0 8.4 8.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
