import type { EventType } from '@/db/schema'

export const EVENT_LABELS: Record<EventType, string> = {
  call: 'Дзвінок',
  comment: 'Коментар',
  stage_change: 'Зміна етапу',
  viewing: 'Огляд',
  price_change: 'Зміна ціни',
}

/** Значення payload.outcome для дзвінків. */
export const CALL_OUTCOMES: Record<string, string> = {
  reached: 'додзвонився',
  no_answer: 'не взяв слухавку',
  busy: 'зайнято',
  callback: 'просив передзвонити',
  declined: 'відмовив',
}

export function callOutcome(outcome: string | undefined): string | null {
  if (!outcome) return null
  return CALL_OUTCOMES[outcome] ?? outcome
}
