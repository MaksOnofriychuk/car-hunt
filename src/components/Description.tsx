'use client'

import { useState } from 'react'

import { cn } from '@/lib/cn'

/**
 * Опис від продавця. Переноси рядків збережені — продавці пишуть списком,
 * і суцільний абзац з цього читати неможливо. Довгий текст згортається.
 */

/** Довший за це — ховаємо під «Читати повністю». */
const LONG = 320

export function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > LONG

  return (
    <div>
      <p
        className={cn(
          'whitespace-pre-line text-[14px] leading-relaxed',
          long && !open && 'line-clamp-6',
        )}
      >
        {text}
      </p>

      {long ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-plate"
        >
          {open ? 'Згорнути' : 'Читати повністю'}
        </button>
      ) : null}
    </div>
  )
}
