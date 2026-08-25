'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'

import { CallForm, CommentForm } from './EventForms'

import { setStage } from '@/app/(app)/listing/actions'
import { cn } from '@/lib/cn'
import { IDLE } from '@/lib/forms'
import { STAGES, STAGE_LABELS, type Stage } from '@/lib/stages'

/** Кнопки швидкого запису на картці авто (SPEC, «Інтерфейс»). */

type Panel = 'call' | 'comment' | 'stage'

const TABS: { key: Panel; label: string }[] = [
  { key: 'call', label: 'Дзвінок' },
  { key: 'comment', label: 'Коментар' },
  { key: 'stage', label: 'Змінити етап' },
]

export function ListingActions({ listingId, stage }: { listingId: string; stage: Stage }) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const close = useCallback(() => setPanel(null), [])

  return (
    <div>
      <div className="flex gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setPanel((open) => (open === tab.key ? null : tab.key))}
            aria-expanded={panel === tab.key}
            className={cn(
              'h-10 flex-1 rounded-card border border-ink text-[11px] font-semibold uppercase tracking-[0.08em]',
              panel === tab.key ? 'bg-ink text-white' : 'text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {panel ? (
        <div className="mt-2.5">
          {panel === 'call' ? <CallForm listingId={listingId} onDone={close} /> : null}
          {panel === 'comment' ? <CommentForm listingId={listingId} onDone={close} /> : null}
          {panel === 'stage' ? (
            <StagePicker listingId={listingId} current={stage} onDone={close} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Етап міняється в один тап: кожна кнопка — це і вибір, і сабміт. Поточний етап
 * підсвічений і заблокований, щоб не писати в стрічку однакові події поспіль.
 */
function StagePicker({
  listingId,
  current,
  onDone,
}: {
  listingId: string
  current: Stage
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(setStage, IDLE)

  useEffect(() => {
    if (state.ok) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />

      <div className="grid grid-cols-2 gap-1.5">
        {STAGES.map((value) => (
          <button
            key={value}
            type="submit"
            name="stage"
            value={value}
            disabled={pending || value === current}
            className={cn(
              'h-10 rounded-card border px-2 text-[12px] font-semibold',
              value === current
                ? 'border-ink bg-concrete disabled:opacity-100'
                : 'border-line disabled:opacity-50',
            )}
          >
            {STAGE_LABELS[value]}
          </button>
        ))}
      </div>

      {state.error ? (
        <p className="mt-1.5 text-[12px] font-semibold">{state.error}</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-muted">
          «Купили» і «Відпало» прибирають авто з черги. Картка лишається.
        </p>
      )}
    </form>
  )
}
