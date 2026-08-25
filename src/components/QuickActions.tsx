'use client'

import { useCallback, useState } from 'react'

import { CardMenu } from './CardMenu'
import { CallForm, CommentForm } from './EventForms'
import { ContactDate } from './ListingFields'

import { cn } from '@/lib/cn'

/**
 * Дії просто з черги: дзвінок і коментар пишуться, не відкриваючи авто. Заради
 * цього черга й існує — пройтись списком і відзвітувати.
 *
 * Запис розкривається **інлайн**, без модалки: модалка на телефоні перекриває
 * саме те авто, про яке пишеш.
 */

type Panel = 'call' | 'second'

export function QuickActions({
  listingId,
  overdue = false,
  archived = false,
  title,
  phones = [],
}: {
  listingId: string
  /** Прострочене — головна дія стає червоною і зветься «Дзвінок зараз». */
  overdue?: boolean
  archived?: boolean
  /** Назва авто — для підтвердження видалення під «···». */
  title: string
  /** Номери продавця — щоб дзвонити просто з черги. */
  phones?: string[]
}) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const close = useCallback(() => setPanel(null), [])
  const toggle = (next: Panel) => setPanel((open) => (open === next ? null : next))

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toggle('call')}
          aria-expanded={panel === 'call'}
          className={cn('btn tap flex-1', overdue ? 'btn-danger' : 'btn-accent')}
        >
          {overdue ? 'Дзвінок зараз' : 'Дзвінок'}
        </button>
        {/* Друга кнопка залежить від стану: у простроченого мова не про
            коментар, а про те, коли передзвонити (аркуш 04). */}
        <button
          type="button"
          onClick={() => toggle('second')}
          aria-expanded={panel === 'second'}
          className={cn('btn tap btn-quiet flex-1', panel === 'second' && 'border-edge')}
        >
          {overdue ? 'Перенести' : 'Коментар'}
        </button>

        <CardMenu listingId={listingId} archived={archived} title={title} />
      </div>

      {panel ? (
        <div className="panel-in sunken mt-2 p-2.5">
          {panel === 'call' ? (
            <CallForm listingId={listingId} onDone={close} compact phones={phones} />
          ) : overdue ? (
            <ContactDate listingId={listingId} hasDate />
          ) : (
            <CommentForm listingId={listingId} onDone={close} compact />
          )}
        </div>
      ) : null}
    </div>
  )
}
