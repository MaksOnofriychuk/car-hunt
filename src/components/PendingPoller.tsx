'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Поки на сторінці є хоч одна картка в статусі pending, оновлюємо серверний
 * рендер раз на 1.5 с (SPEC, «Інгест посилання»). Коли pending не лишилось,
 * компонент просто не рендериться і поллінг зупиняється сам.
 */
export function PendingPoller({ pending }: { pending: number }) {
  const router = useRouter()

  useEffect(() => {
    if (pending === 0) return

    const timer = setInterval(() => router.refresh(), 1500)
    return () => clearInterval(timer)
  }, [pending, router])

  return null
}
