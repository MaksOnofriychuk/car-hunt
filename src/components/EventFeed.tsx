import { StageBadge } from './StageBadge'

import type { Author, Event } from '@/db/schema'
import { formatDateTime } from '@/lib/dates'
import { callOutcome, EVENT_LABELS, fieldsLabel } from '@/lib/events'
import { formatUsd } from '@/lib/format'
import { isStage } from '@/lib/stages'

type Props = {
  events: Event[]
  viewer: Author
  names: Record<Author, string>
}

/** Стрічка подій із автором і часом. Append-only: нічого не редагуємо. */
export function EventFeed({ events, viewer, names }: Props) {
  if (events.length === 0) {
    return <p className="mt-2 text-[13px] text-muted">Подій ще немає.</p>
  }

  return (
    <ol className="mt-1">
      {events.map((event) => (
        <li key={event.id} className="border-t border-line py-2.5 first:border-t-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {EVENT_LABELS[event.type]}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted">
              {formatDateTime(event.createdAt)}
            </span>
          </div>

          <EventBody event={event} />

          <p className="mt-0.5 text-[11px] text-muted">
            {event.author === viewer ? 'Я' : names[event.author]}
          </p>
        </li>
      ))}
    </ol>
  )
}

function EventBody({ event }: { event: Event }) {
  const {
    text,
    outcome,
    offered_price: offered,
    old_price: oldPrice,
    new_price: newPrice,
    stage,
    fields,
  } = event.payload ?? {}

  if (event.type === 'stage_change') {
    return (
      <p className="mt-1">{isStage(stage) ? <StageBadge stage={stage} /> : <span>—</span>}</p>
    )
  }

  if (event.type === 'price_change') {
    return (
      <p className="mt-1 font-mono text-[14px] tabular-nums">
        <span className="text-muted line-through decoration-1">{formatUsd(oldPrice)}</span>{' '}
        <span className="font-semibold">{formatUsd(newPrice)}</span>
      </p>
    )
  }

  if (event.type === 'edit') {
    return <p className="mt-1 text-[14px] leading-snug">{fieldsLabel(fields) ?? '—'}</p>
  }

  const outcomeLabel = callOutcome(outcome)

  return (
    <div className="mt-1">
      {text ? <p className="text-[14px] leading-snug">{text}</p> : null}
      {outcomeLabel || offered ? (
        <p className="mt-0.5 text-[12px] text-muted">
          {outcomeLabel}
          {outcomeLabel && offered ? ' · ' : null}
          {offered ? (
            <>
              запропонував <span className="font-mono tabular-nums">{formatUsd(offered)}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
