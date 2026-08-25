import { cn } from '@/lib/cn'
import { STAGE_LABELS, type Stage } from '@/lib/stages'

/**
 * Етап окремою чипою. Колір майже не задіяний: «купили» — зелений, «відпало» —
 * приглушений, решта живе рамкою. Кольором у системі говорять стани картки, а
 * не етапи (аркуш 01).
 */
const STYLES: Record<Stage, string> = {
  new: 'border-edge text-muted',
  contacted: 'border-edge text-muted',
  offer_made: 'border-edge text-muted',
  negotiating: 'border-edge text-accent-lit',
  viewing_scheduled: 'border-edge text-accent-lit',
  won: 'border-ok text-ok',
  lost: 'border-edge text-faint',
}

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span
      className={cn(
        't-micro inline-flex shrink-0 items-center rounded-chip border px-1.5 py-1',
        STYLES[stage],
        className,
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  )
}
