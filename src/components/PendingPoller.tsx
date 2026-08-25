'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Поки картки дорозбираються, черга має оновитись сама.
 *
 * Раніше це був `router.refresh()` раз на півтори секунди — тобто повний
 * серверний рендер сторінки з усіма запитами, незалежно від того, чи щось
 * змінилось. Тепер опитуємо тільки самі картки (легкий роут на кілька полів) і
 * перемальовуємо сторінку, коли якась із них справді розібралась.
 */

const INTERVAL_MS = 2000

export function PendingPoller({ ids }: { ids: string[] }) {
  const router = useRouter()
  const key = ids.join(',')

  useEffect(() => {
    const pending = key ? key.split(',') : []
    if (pending.length === 0) return

    let stopped = false

    const check = async () => {
      for (const id of pending) {
        try {
          const response = await fetch(`/api/listings/${id}`, { cache: 'no-store' })
          if (!response.ok) continue

          const data: { status?: string } = await response.json()
          if (data.status && data.status !== 'pending' && !stopped) {
            router.refresh()
            return
          }
        } catch {
          // Мережа блимнула — спробуємо наступного разу.
        }
      }
    }

    const timer = setInterval(() => void check(), INTERVAL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [key, router])

  return null
}
