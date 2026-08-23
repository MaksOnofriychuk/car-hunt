import { DEFAULT_STAGE, STAGES, type Event, type Stage } from '@/db/schema'

export { STAGES, DEFAULT_STAGE, type Stage }

export const STAGE_LABELS: Record<Stage, string> = {
  new: 'Нове',
  contacted: 'Дзвонили',
  offer_made: 'Зробили пропозицію',
  negotiating: 'Торгуємось',
  viewing_scheduled: 'Домовились про огляд',
  won: 'Купили',
  lost: 'Відпало',
}

/** Етапи, після яких робота по авто закінчена. */
export const TERMINAL_STAGES: readonly Stage[] = ['won', 'lost']

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value)
}

export function isTerminalStage(stage: Stage): boolean {
  return TERMINAL_STAGES.includes(stage)
}

/** Порядковий номер етапу у воронці — для сортування і прогресу. */
export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage)
}

type StageEvent = Pick<Event, 'type' | 'payload' | 'createdAt'>

/**
 * Поточний етап авто. Окремим полем НЕ зберігається (SPEC, «Модель даних»):
 * рахуємо з останньої події `stage_change`. Порядок подій на вході не важливий.
 * Немає жодної події зміни етапу → `new`.
 */
export function currentStage(events: readonly StageEvent[]): Stage {
  let stage: Stage = DEFAULT_STAGE
  let at = -Infinity

  for (const event of events) {
    if (event.type !== 'stage_change') continue
    if (!isStage(event.payload?.stage)) continue

    const ts = event.createdAt.getTime()
    if (ts >= at) {
      at = ts
      stage = event.payload.stage
    }
  }

  return stage
}
