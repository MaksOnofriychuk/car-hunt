'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import { cn } from '@/lib/cn'
import { findListingLink } from '@/lib/sources/links'

/**
 * Поле вставки. Головна дія застосунку: кинув посилання — зʼявилась картка.
 *
 * Глобальний `paste` ловить посилання, навіть коли фокус не тут: людина копіює
 * з браузера і одразу тисне Cmd+V, не цілячись у поле.
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
      const data: {
        results?: { duplicate: boolean; recognized: boolean }[]
        error?: string
      } = await response.json()

      if (!response.ok) {
        setNote(data.error ?? 'Не вдалось додати')
        return
      }

      const duplicates = data.results?.filter((item) => item.duplicate).length ?? 0
      const unknown = data.results?.filter((item) => !item.recognized).length ?? 0

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
    <section className="surface p-3">
      <div className="flex items-center gap-2">
        {bulk ? (
          <textarea
            id="paste-url"
            rows={4}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={'https://auto.ria.com/…\nhttps://www.olx.ua/…'}
            className="t-num sunken min-w-0 flex-1 px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-faint focus:border-accent focus:outline-none"
          />
        ) : (
          <label className="sunken tap flex min-w-0 flex-1 items-center gap-2 px-3 focus-within:border-accent">
            <span className="text-faint" aria-hidden>
              ↗
            </span>
            <input
              id="paste-url"
              ref={inputRef}
              type="url"
              inputMode="url"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Встав посилання — RIA / OLX / Telegram"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit()
                }
              }}
              className="t-body min-w-0 flex-1 bg-transparent placeholder:text-faint focus:outline-none"
            />
          </label>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || value.trim().length === 0}
          className={cn('btn tap btn-accent shrink-0 self-stretch', bulk && 'self-start')}
        >
          {busy ? 'Читаю…' : `Додати${bulk && count > 0 ? ` ${count}` : ''}`}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setBulk((value) => !value)}
          aria-pressed={bulk}
          className={cn('chip', bulk && 'chip-on')}
        >
          {bulk ? 'Одне посилання' : 'Вставити багато'}
        </button>

        {/* Авто без оголошення: побачили в дворі, розповіли, продають у групі. */}
        <Link href="/listing/new" className="chip">
          Додати вручну
        </Link>

        {note ? <span className="t-body ml-auto truncate text-faint">{note}</span> : null}
      </div>
    </section>
  )
}
