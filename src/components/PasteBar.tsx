'use client'

import { useEffect, useRef, useState } from 'react'

import { findListingLink } from '@/lib/sources/links'

/**
 * Поле «вставити посилання» — завжди видиме зверху черги (SPEC, «Інтерфейс»).
 * Глобальний paste ловить посилання на auto.ria з буфера і кладе його в поле.
 * Сам інгест підключається на наступному кроці «Порядку робіт».
 */
export function PasteBar() {
  const [bulk, setBulk] = useState(false)
  const [value, setValue] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      const text = event.clipboardData?.getData('text') ?? ''
      const link = findListingLink(text)
      if (!link) return

      event.preventDefault()
      setValue(link)
      inputRef.current?.focus()
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  const count = value.split('\n').filter((line) => findListingLink(line) !== null).length

  return (
    <section className="rounded-card border border-line bg-white p-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor="paste-url"
          className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
        >
          Вставити посилання
        </label>
        <button
          type="button"
          onClick={() => setBulk((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-[0.08em] text-plate"
        >
          {bulk ? 'одне' : 'вставити багато'}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        {bulk ? (
          <textarea
            id="paste-url"
            rows={4}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={'https://auto.ria.com/…\nhttps://www.olx.ua/…'}
            className="min-w-0 flex-1 rounded-card border border-line bg-white px-2.5 py-2 font-mono text-[13px] leading-relaxed placeholder:text-muted"
          />
        ) : (
          <input
            id="paste-url"
            ref={inputRef}
            type="url"
            inputMode="url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://auto.ria.com/…"
            className="h-10 min-w-0 flex-1 rounded-card border border-line bg-white px-2.5 font-mono text-[13px] placeholder:text-muted"
          />
        )}

        <button
          type="button"
          onClick={() => setNote('Інгест зʼявиться на кроці «Інгест і парсер».')}
          className="h-10 shrink-0 self-start rounded-card border border-ink bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
        >
          Додати{bulk && count > 0 ? ` ${count}` : ''}
        </button>
      </div>

      {note ? <p className="mt-2 text-[12px] text-muted">{note}</p> : null}
    </section>
  )
}
