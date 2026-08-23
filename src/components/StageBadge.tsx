import { cn } from '@/lib/cn'
import { STAGE_LABELS, type Stage } from '@/lib/stages'

/** Колір майже не задіяний — лише «купили» синім і «відпало» приглушеним. */
const STYLES: Record<Stage, string> = {
  new: 'bg-concrete text-ink',
  contacted: 'bg-concrete text-ink',
  offer_made: 'bg-concrete text-ink',
  negotiating: 'bg-concrete text-ink',
  viewing_scheduled: 'bg-concrete text-ink',
  won: 'bg-plate text-white',
  lost: 'bg-concrete text-muted',
}

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-card px-1.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.08em]',
        STYLES[stage],
        className,
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  )
}
