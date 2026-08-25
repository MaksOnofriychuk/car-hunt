'use client'

import { useActionState, useEffect, useState } from 'react'

import { DateField } from './DateField'

import { saveNextContact, saveTargetPrice, toggleArchived } from '@/app/(app)/listing/actions'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { IDLE } from '@/lib/forms'

/**
 * Поля, які людина міняє на картці руками: цільова ціна, дата наступного
 * контакту і перемикач черги. Усе редагується в один тап, без модалок.
 */

/** Цільова ціна: тап по числу відкриває поле, Enter або «ок» зберігає. */
export function TargetPrice({ listingId, value }: { listingId: string; value: number | null }) {
  const [state, formAction, pending] = useActionState(saveTargetPrice, IDLE)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (state.ok) setOpen(false)
  }, [state.ok])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Змінити цільову ціну"
        className="t-num text-[17px] text-ink transition-colors duration-(--t-instant) hover:text-accent-lit"
      >
        {value === null ? '—' : formatNumber(value)}
      </button>
    )
  }

  return (
    <form action={formAction} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="listingId" value={listingId} />
      <input
        name="price"
        type="text"
        inputMode="numeric"
        autoFocus
        defaultValue={value ?? ''}
        placeholder="$"
        aria-label="Цільова ціна"
        className="field field-num w-[104px]"
      />
      <button type="submit" disabled={pending} className="btn tap shrink-0 px-2.5">
        Ок
      </button>
      {state.error ? <span className="t-body text-danger">{state.error}</span> : null}
    </form>
  )
}

/**
 * Коли дзвонити. Чотири кнопки-пресети — це 90% випадків, і кожна з них одразу
 * запис; поруч календар для решти.
 */
const PRESETS: { days: string; label: string }[] = [
  { days: '0', label: 'сьогодні' },
  { days: '3', label: '+3 дні' },
  { days: '7', label: '+7 днів' },
  { days: '14', label: '+14 днів' },
]

export function ContactDate({
  listingId,
  hasDate,
}: {
  listingId: string
  /** Дата вже стоїть — тоді є що прибирати. */
  hasDate: boolean
}) {
  const [state, formAction, pending] = useActionState(saveNextContact, IDLE)

  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />

      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="submit"
            name="when"
            value={preset.days}
            disabled={pending}
            className="chip tap"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        {/* Календар — для дат, яких немає серед пресетів: «подзвонити 3 вересня». */}
        <DateField name="when" ariaLabel="Інша дата" className="min-w-0 flex-1" />
        <button type="submit" disabled={pending} className="btn tap shrink-0 px-2.5">
          Ок
        </button>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        {state.error ? <span className="t-body text-danger">{state.error}</span> : null}
        {hasDate ? (
          <button
            type="submit"
            name="when"
            value="none"
            disabled={pending}
            className="t-micro ml-auto text-faint transition-colors duration-(--t-instant) hover:text-ink disabled:opacity-50"
          >
            Прибрати дату
          </button>
        ) : null}
      </div>
    </form>
  )
}

/**
 * Прибрати з черги або повернути. Це не видалення: картка, архів і стрічка
 * лишаються, авто просто не показується на головному екрані.
 */
export function ArchiveToggle({ listingId, archived }: { listingId: string; archived: boolean }) {
  const [state, formAction, pending] = useActionState(toggleArchived, IDLE)

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="archived" value={archived ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={pending}
        className={cn('chip tap', archived && 'chip-on')}
      >
        {archived ? 'Повернути в чергу' : 'Прибрати з черги'}
      </button>
      {state.error ? <span className="t-body text-danger">{state.error}</span> : null}
    </form>
  )
}
