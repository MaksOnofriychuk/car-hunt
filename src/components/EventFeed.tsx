import { StageBadge } from './StageBadge'

import type { Author, Event } from '@/db/schema'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/dates'
import { callOutcome, EVENT_LABELS, fieldsLabel } from '@/lib/events'
import { formatUsd } from '@/lib/format'
import { isStage } from '@/lib/stages'

/**
 * Стрічка подій: підпис зверху, сам запис — бульбашкою. Append-only, нічого не
 * редагуємо. Свої записи мають акцентне ребро — у стрічці на двох людей це
 * єдине, що треба розрізняти з відстані.
 *
 * Хвіст ховається під `<details>`, а не під стан: розгортання списку не варте
 * клієнтського компонента, а без JS воно все одно працює.
 */

type Props = {
  events: Event[]
  viewer: Author
  names: Record<Author, string>
}

/** Скільки записів видно одразу. Решта — під «показати ще». */
const HEAD = 5

export function EventFeed({ events, viewer, names }: Props) {
  if (events.length === 0) {
    return <p className="t-body mt-2 text-faint">Подій ще немає.</p>
  }

  const head = events.slice(0, HEAD)
  const tail = events.slice(HEAD)

  return (
    <div className="mt-2">
      <ol className="space-y-2.5">
        {head.map((event) => (
          <FeedItem key={event.id} event={event} viewer={viewer} names={names} />
        ))}
      </ol>

      {tail.length > 0 ? (
        <details className="group mt-2.5">
          <summary className="t-micro tap flex cursor-pointer items-center text-accent-lit marker:content-['']">
            Показати ще {tail.length} ↓
          </summary>
          <ol className="mt-2.5 space-y-2.5">
            {tail.map((event) => (
              <FeedItem key={event.id} event={event} viewer={viewer} names={names} />
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  )
}

function FeedItem({ event, viewer, names }: { event: Event; viewer: Author; names: Props['names'] }) {
  const mine = event.author === viewer

  return (
    <li>
      <p className="flex items-baseline gap-1.5">
        <span className="t-micro text-accent-lit">{EVENT_LABELS[event.type]}</span>
        <span className="t-micro text-faint">· {mine ? 'Я' : names[event.author]}</span>
        <span className="t-num ml-auto shrink-0 text-[11px] text-faint">
          {formatDateTime(event.createdAt)}
        </span>
      </p>

      <div className={cn('sunken mt-1 px-2.5 py-2', mine && 'rib border-l-accent')}>
        <EventBody event={event} />
      </div>
    </li>
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
    return isStage(stage) ? <StageBadge stage={stage} /> : <span className="t-body">—</span>
  }

  if (event.type === 'price_change') {
    const down = oldPrice && newPrice ? newPrice < oldPrice : false
    return (
      <p className="t-num text-[15px]">
        <span className="text-faint line-through decoration-1">{formatUsd(oldPrice)}</span>{' '}
        <span className={cn('font-semibold', down ? 'text-ok' : 'text-warn')}>
          {formatUsd(newPrice)}
        </span>
      </p>
    )
  }

  if (event.type === 'edit') {
    return <p className="t-body">{fieldsLabel(fields) ?? '—'}</p>
  }

  const outcomeLabel = callOutcome(outcome)

  return (
    <>
      {text ? <p className="t-body whitespace-pre-line">{text}</p> : null}
      {outcomeLabel || offered ? (
        <p className={cn('t-body text-faint', text && 'mt-1')}>
          {outcomeLabel}
          {outcomeLabel && offered ? ' · ' : null}
          {offered ? (
            <>
              запропонував <span className="t-num text-ink">{formatUsd(offered)}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </>
  )
}
