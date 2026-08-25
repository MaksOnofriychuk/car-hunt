'use client'

import { useActionState, useEffect, useState } from 'react'

import {
  saveNextContact,
  saveTargetPrice,
  toggleArchived,
} from '@/app/(app)/listing/actions'
import { cn } from '@/lib/cn'
import { formatUsd } from '@/lib/format'
import { IDLE } from '@/lib/forms'

/**
 * Два поля, які редагуються в один тап (SPEC, «Інтерфейс»), і перемикач черги.
 * Усе, що людина міняє на картці руками, окрім телефону продавця.
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
      <div className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[16px] font-semibold tabular-nums underline decoration-line underline-offset-4"
        >
          {formatUsd(value)}
        </button>
        {state.error ? <span className="text-[12px] font-semibold">{state.error}</span> : null}
      </div>
    )
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="listingId" value={listingId} />
      <input
        name="price"
        type="text"
        inputMode="numeric"
        autoFocus
        defaultValue={value ?? ''}
        placeholder="$"
        className="h-9 w-[110px] rounded-card border border-line bg-card px-2.5 text-right font-mono text-[15px] tabular-nums placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-9 shrink-0 rounded-card border border-ink px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
      >
        Ок
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-9 shrink-0 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        Скасувати
      </button>
    </form>
  )
}

/** Кнопки «коли дзвонити» зі SPEC. Кожна — один тап і одразу запис. */
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
            className="h-9 rounded-card border border-line text-[11px] font-semibold disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        {state.error ? <span className="text-[12px] font-semibold">{state.error}</span> : null}
        {hasDate ? (
          <button
            type="submit"
            name="when"
            value="none"
            disabled={pending}
            className="ml-auto text-[11px] font-semibold uppercase tracking-[0.08em] text-muted disabled:opacity-50"
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
export function ArchiveToggle({
  listingId,
  archived,
}: {
  listingId: string
  archived: boolean
}) {
  const [state, formAction, pending] = useActionState(toggleArchived, IDLE)

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="archived" value={archived ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'h-9 rounded-card border px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50',
          archived ? 'border-ink' : 'border-line text-muted',
        )}
      >
        {archived ? 'Повернути в чергу' : 'Прибрати з черги'}
      </button>
      {state.error ? <span className="text-[12px] font-semibold">{state.error}</span> : null}
    </form>
  )
}
