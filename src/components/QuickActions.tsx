'use client'

import { useCallback, useState } from 'react'

import { CallForm, CommentForm } from './EventForms'

import { cn } from '@/lib/cn'

/**
 * Підвал картки в черзі: дзвінок і коментар пишуться прямо звідси, не
 * відкриваючи авто. Заради цього черга й існує — пройтись списком і відзвітувати.
 */

type Panel = 'call' | 'comment'

export function QuickActions({
  listingId,
  contactText,
  overdue,
}: {
  listingId: string
  contactText: string
  overdue: boolean
}) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const close = useCallback(() => setPanel(null), [])
  const toggle = (next: Panel) => setPanel((open) => (open === next ? null : next))

  return (
    <footer className="border-t border-line">
      <div className="flex items-center gap-2 px-3 py-2">
        <PanelButton label="Дзвінок" active={panel === 'call'} onClick={() => toggle('call')} />
        <PanelButton
          label="Коментар"
          active={panel === 'comment'}
          onClick={() => toggle('comment')}
        />
        <span
          className={cn(
            'ml-auto shrink-0 text-[12px]',
            overdue ? 'font-semibold text-ink' : 'text-muted',
          )}
        >
          {contactText}
        </span>
      </div>

      {panel ? (
        <div className="border-t border-line px-3 py-2.5">
          {panel === 'call' ? (
            <CallForm listingId={listingId} onDone={close} compact />
          ) : (
            <CommentForm listingId={listingId} onDone={close} compact />
          )}
        </div>
      ) : null}
    </footer>
  )
}

function PanelButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        'h-8 rounded-card border px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
        active ? 'border-ink bg-ink text-white' : 'border-line text-ink',
      )}
    >
      {label}
    </button>
  )
}
