'use client'

import { useActionState, useEffect } from 'react'

import { logCall, logComment } from '@/app/(app)/listing/actions'
import { cn } from '@/lib/cn'
import { CALL_OUTCOMES, CALL_OUTCOME_ORDER } from '@/lib/events'
import { IDLE } from '@/lib/forms'

/**
 * Форми швидкого запису. Одні й ті самі і на картці авто, і в черзі на
 * головному екрані — записувати дзвінок, не відкриваючи авто, це половина сенсу
 * черги.
 */

type Props = {
  listingId: string
  /** Батько закриває панель, коли подія записалась. */
  onDone: () => void
  /** У черзі місця менше: без поля «запропонував». */
  compact?: boolean
}

/**
 * Дзвінок. Результат — це і є кнопка «записати»: тиснеш «не взяв слухавку» і
 * подія вже в стрічці. Текст і запропонована ціна — необовʼязкові.
 */
export function CallForm({ listingId, onDone, compact = false }: Props) {
  const [state, formAction, pending] = useActionState(logCall, IDLE)

  useEffect(() => {
    if (state.ok) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />

      <div className={cn('flex gap-2', compact && 'flex-col')}>
        <textarea
          name="text"
          rows={compact ? 2 : 3}
          autoFocus
          placeholder="Що сказали"
          className="min-w-0 flex-1 rounded-card border border-line bg-white px-2.5 py-2 text-[14px] leading-snug placeholder:text-muted"
        />
        {compact ? null : (
          <label className="flex w-[104px] shrink-0 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Запропонував
            </span>
            <input
              name="offeredPrice"
              type="text"
              inputMode="numeric"
              placeholder="$"
              className="h-10 w-full rounded-card border border-line bg-white px-2.5 font-mono text-[14px] tabular-nums placeholder:text-muted"
            />
          </label>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {CALL_OUTCOME_ORDER.map((outcome) => (
          <button
            key={outcome}
            type="submit"
            name="outcome"
            value={outcome}
            disabled={pending}
            className="h-9 rounded-card border border-ink px-2.5 text-[12px] font-semibold disabled:opacity-50"
          >
            {CALL_OUTCOMES[outcome]}
          </button>
        ))}
      </div>

      <FormNote
        error={state.error}
        hint={pending ? 'Пишу…' : 'Результат дзвінка записує подію одразу.'}
      />
    </form>
  )
}

/** Коментар: текст і одна кнопка. */
export function CommentForm({ listingId, onDone, compact = false }: Props) {
  const [state, formAction, pending] = useActionState(logComment, IDLE)

  useEffect(() => {
    if (state.ok) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />

      <textarea
        name="text"
        rows={compact ? 2 : 3}
        autoFocus
        placeholder="Коментар"
        className="w-full rounded-card border border-line bg-white px-2.5 py-2 text-[14px] leading-snug placeholder:text-muted"
      />

      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-card border border-ink px-3 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
        >
          {pending ? 'Пишу…' : 'Записати'}
        </button>
      </div>

      <FormNote error={state.error} />
    </form>
  )
}

function FormNote({ error, hint }: { error: string | null; hint?: string }) {
  if (error) return <p className="mt-1.5 text-[12px] font-semibold">{error}</p>
  return hint ? <p className="mt-1.5 text-[12px] text-muted">{hint}</p> : null
}
