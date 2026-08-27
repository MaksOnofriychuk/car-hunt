'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { refreshQueue, type RefreshState } from '@/app/(app)/actions'
import { cars } from '@/lib/format'
import { withProgress } from '@/lib/progress'

/**
 * «Оновити чергу» — той самий прогін, що й погодинний крон, тільки на вимогу:
 * сходити на майданчики, перечитати ціни, дозібрати архів.
 *
 * Кнопка не мовчить ні секунди. Поки прогін іде — напис «Оновлюю…», сама кнопка
 * замкнена, а вгорі екрана світиться спільна смуга. Коли завершився — коротко
 * каже, що саме змінилось, і за кілька секунд прибирає підпис: постійний рядок
 * «оновлено 0» під заголовком не потрібен нікому.
 */

/** Скільки тримати підсумок на екрані. */
const RESULT_MS = 6000

function summary(done: NonNullable<RefreshState['done']>): string {
  const touched = done.refreshed + done.parsed
  if (touched === 0) return 'Усе свіже'

  const parts = [`${touched} ${cars(touched)}`]
  if (done.archived > 0) parts.push(`архів +${done.archived}`)
  return `Оновлено ${parts.join(' · ')}`
}

export function RefreshQueue() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!result) return
    const timer = setTimeout(() => setResult(null), RESULT_MS)
    return () => clearTimeout(timer)
  }, [result])

  const run = async () => {
    if (pending) return

    setPending(true)
    setResult(null)
    setFailed(false)

    try {
      const state = await withProgress(() => refreshQueue())

      if (state.error) {
        setFailed(true)
        setResult(state.error)
        return
      }

      setResult(state.done ? summary(state.done) : 'Готово')
      // `revalidatePath` у дії скинув кеш, але намалювати нове має клієнт.
      router.refresh()
    } catch {
      setFailed(true)
      setResult('Не вийшло оновити. Спробуй ще раз.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={pending}
        aria-busy={pending}
        className="chip chip-sm tap shrink-0"
        title="Перечитати ціни на майданчиках"
      >
        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`}
          fill="none"
          aria-hidden
        >
          <path
            d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {pending ? 'Оновлюю…' : 'Оновити чергу'}
      </button>

      {result ? (
        <span className={`t-micro truncate ${failed ? 'text-danger' : 'text-faint'}`}>
          {result}
        </span>
      ) : null}
    </div>
  )
}
