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
          't-body whitespace-pre-line',
          long && !open && 'line-clamp-6',
        )}
      >
        {text}
      </p>

      {long ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="t-micro tap mt-2 text-accent-lit"
        >
          {open ? 'Згорнути' : 'Читати повністю'}
        </button>
      ) : null}
    </div>
  )
}
