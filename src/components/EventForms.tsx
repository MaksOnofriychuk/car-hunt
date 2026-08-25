'use client'

import { useActionState, useEffect } from 'react'

import { logCall, logComment } from '@/app/(app)/listing/actions'
import { cn } from '@/lib/cn'
import { CALL_OUTCOMES, CALL_OUTCOME_ORDER } from '@/lib/events'
import { formatPhone } from '@/lib/phone'
import { IDLE } from '@/lib/forms'

/**
 * Форми швидкого запису — аркуш 04, «запис дзвінка інлайн, без модалки». Одні
 * й ті самі і на картці авто, і в черзі: записувати дзвінок, не відкриваючи
 * авто, це половина сенсу черги.
 *
 * Результат дзвінка — це і є кнопка «записати»: тиснеш «не взяв слухавку», і
 * подія вже в стрічці.
 */

type Props = {
  listingId: string
  /** Батько закриває панель, коли подія записалась. */
  onDone: () => void
  /** У черзі місця менше: без поля «запропонував». */
  compact?: boolean
  /** Номери продавця: «Дзвінок» має спершу дзвонити, а вже потім записувати. */
  phones?: string[]
}

export function CallForm({ listingId, onDone, compact = false, phones = [] }: Props) {
  const [state, formAction, pending] = useActionState(logCall, IDLE)

  useEffect(() => {
    if (state.ok) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />

      {/* Спершу дзвінок, потім запис: тиснеш «Дзвінок» — телефон уже набирає,
          а поле для нотатки чекає, поки поговориш. */}
      {phones.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {phones.map((phone) => (
            <a key={phone} href={`tel:${phone}`} className="btn btn-accent tap flex-1">
              Набрати {formatPhone(phone)}
            </a>
          ))}
        </div>
      ) : (
        <p className="t-body mb-2 text-faint">
          Номера ще немає — його вводять на картці авто, у блоці продавця.
        </p>
      )}

      <div className={cn('flex gap-2', compact && 'flex-col')}>
        <label className="min-w-0 flex-1">
          <span className="t-micro text-faint">Що сказали</span>
          <textarea
            name="text"
            rows={compact ? 2 : 3}
            autoFocus
            placeholder="Готовий на 9 200, тягне час…"
            className="field mt-1"
          />
        </label>

        {compact ? null : (
          <label className="w-[112px] shrink-0">
            <span className="t-micro text-faint">Віддає, $</span>
            <input
              name="offeredPrice"
              type="text"
              inputMode="numeric"
              placeholder="9 200"
              className="field field-num mt-1"
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
            className="chip tap"
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
        className="field"
      />

      <div className="mt-2 flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-accent tap px-4">
          {pending ? 'Пишу…' : 'Записати'}
        </button>
      </div>

      <FormNote error={state.error} />
    </form>
  )
}

function FormNote({ error, hint }: { error: string | null; hint?: string }) {
  if (error) return <p className="t-body mt-1.5 text-danger">{error}</p>
  return hint ? <p className="t-body mt-1.5 text-faint">{hint}</p> : null
}
