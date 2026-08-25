'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { findListingLink } from '@/lib/sources/links'

/**
 * Поле «вставити посилання» — завжди видиме зверху черги (SPEC, «Інтерфейс»).
 * Глобальний paste ловить посилання на auto.ria з буфера і кладе його в поле.
 * Сам інгест підключається на наступному кроці «Порядку робіт».
 */
export function PasteBar() {
  const router = useRouter()
  const [bulk, setBulk] = useState(false)
  const [value, setValue] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    const urls = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (urls.length === 0) return

    setBusy(true)
    setNote(null)
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      const data = (await response.json()) as {
        results?: { duplicate: boolean; recognized: boolean }[]
        error?: string
      }

      if (!response.ok) {
        setNote(data.error ?? 'Не вдалось додати')
        return
      }

      const results = data.results ?? []
      const duplicates = results.filter((item) => item.duplicate).length
      const unknown = results.filter((item) => !item.recognized).length

      setValue('')
      setNote(
        [
          duplicates > 0 ? `вже було: ${duplicates}` : null,
          unknown > 0 ? `невідомий сайт: ${unknown} — заповни вручну` : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
      )
      router.refresh()
    } catch {
      setNote('Мережа не відповіла')
    } finally {
      setBusy(false)
    }
  }

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
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submit()
              }
            }}
            className="h-10 min-w-0 flex-1 rounded-card border border-line bg-white px-2.5 font-mono text-[13px] placeholder:text-muted"
          />
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || value.trim().length === 0}
          className="h-10 shrink-0 self-start rounded-card border border-ink bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
        >
          {busy ? 'Читаю…' : `Додати${bulk && count > 0 ? ` ${count}` : ''}`}
        </button>
      </div>

      {note ? <p className="mt-2 text-[12px] text-muted">{note}</p> : null}

      {/* Авто без оголошення: побачили в дворі, розповіли, продають у групі. */}
      <div className="mt-2 border-t border-line pt-2">
        <Link
          href="/listing/new"
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-plate"
        >
          Додати вручну
        </Link>
      </div>
    </section>
  )
}
