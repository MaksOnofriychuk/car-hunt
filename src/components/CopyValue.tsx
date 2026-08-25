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
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[13px] tracking-[0.02em]">{value}</span>
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
        className="rounded-card border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        {copied ? 'ок' : 'копі'}
      </button>
    </span>
  )
}
