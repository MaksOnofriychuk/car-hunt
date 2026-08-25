'use client'

import { useEffect, useState } from 'react'

/**
 * Значення, яке частіше копіюють, ніж читають, — VIN. На телефоні виділяти
 * сімнадцять символів пальцем неможливо, тому поруч кнопка.
 */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <span className="flex items-center gap-1.5">
      <span className="t-num min-w-0 flex-1 truncate">{value}</span>
      <button
        type="button"
        aria-label={`Скопіювати ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
          } catch {
            // Буфер недоступний (http або відмова) — мовчки лишаємо як є.
          }
        }}
        className="t-micro shrink-0 rounded-chip border border-edge px-1.5 py-1 text-faint transition-colors duration-(--t-instant) hover:text-ink"
      >
        {copied ? 'ок' : 'копі'}
      </button>
    </span>
  )
}
