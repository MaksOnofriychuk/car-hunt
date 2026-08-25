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

/** Порядок кнопок у формі дзвінка — від найчастішого результату. */
export const CALL_OUTCOME_ORDER = [
  'reached',
  'no_answer',
  'busy',
  'callback',
  'declined',
] as const

export type CallOutcome = (typeof CALL_OUTCOME_ORDER)[number]

export function callOutcome(outcome: string | undefined): string | null {
  if (!outcome) return null
  return CALL_OUTCOMES[outcome] ?? outcome
}
