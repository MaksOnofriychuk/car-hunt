'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'

import { CallForm, CommentForm } from './EventForms'

import { setStage } from '@/app/(app)/listing/actions'
import { cn } from '@/lib/cn'
import { IDLE } from '@/lib/forms'
import { STAGES, STAGE_LABELS, type Stage } from '@/lib/stages'

/**
 * Панель дій картки авто — липка до низу екрана (аркуш 07): записати дзвінок
 * можна з будь-якого місця сторінки, не гортаючи до кінця.
 *
 * Дві головні дії видно завжди, решта — під «···»: етап міняють рідше, ніж
 * пишуть коментар, і місця на 390px на третю кнопку немає.
 */

type Panel = 'call' | 'comment' | 'stage'

export function ListingActions({
  listingId,
  stage,
  phones = [],
}: {
  listingId: string
  stage: Stage
  /** Номери продавця — «Дзвінок» спершу набирає, а вже потім записує. */
  phones?: string[]
}) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const close = useCallback(() => setPanel(null), [])
  const toggle = (next: Panel) => setPanel((open) => (open === next ? null : next))

  return (
    <div className="sticky bottom-3 z-20">
      {panel ? (
        <div className="panel-in surface mb-2 p-3">
          {panel === 'call' ? (
            <CallForm listingId={listingId} onDone={close} phones={phones} />
          ) : null}
          {panel === 'comment' ? <CommentForm listingId={listingId} onDone={close} /> : null}
          {panel === 'stage' ? (
            <StagePicker listingId={listingId} current={stage} onDone={close} />
          ) : null}
        </div>
      ) : null}

      <div className="surface flex gap-2 p-2">
        <button
          type="button"
          onClick={() => toggle('call')}
          aria-expanded={panel === 'call'}
          className="btn btn-accent tap flex-1"
        >
          Дзвінок
        </button>
        <button
          type="button"
          onClick={() => toggle('comment')}
          aria-expanded={panel === 'comment'}
          className={cn('btn btn-quiet tap flex-1', panel === 'comment' && 'border-ink')}
        >
          Коментар
        </button>
        <button
          type="button"
          onClick={() => toggle('stage')}
          aria-expanded={panel === 'stage'}
          aria-label="Змінити етап"
          className={cn('btn btn-quiet tap w-12 shrink-0', panel === 'stage' && 'border-ink')}
        >
          ···
        </button>
      </div>
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
      <p className="t-micro text-faint">Етап</p>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {STAGES.map((value) => (
          <button
            key={value}
            type="submit"
            name="stage"
            value={value}
            disabled={pending || value === current}
            className={cn('chip tap', value === current && 'chip-on disabled:opacity-100')}
          >
            {STAGE_LABELS[value]}
          </button>
        ))}
      </div>

      {state.error ? (
        <p className="t-body mt-1.5 text-danger">{state.error}</p>
      ) : (
        <p className="t-body mt-1.5 text-faint">
          «Купили» і «Відпало» прибирають авто з черги. Картка лишається.
        </p>
      )}
    </form>
  )
}
