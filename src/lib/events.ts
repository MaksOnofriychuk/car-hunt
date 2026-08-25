import type { EventType } from '@/db/schema'

export const EVENT_LABELS: Record<EventType, string> = {
  call: 'Дзвінок',
  comment: 'Коментар',
  stage_change: 'Зміна етапу',
  viewing: 'Огляд',
  price_change: 'Зміна ціни',
  edit: 'Правка руками',
}

/** Людські назви полів картки — для події «правка руками». */
export const FIELD_LABELS: Record<string, string> = {
  brand: 'марка',
  model: 'модель',
  year: 'рік',
  mileageKm: 'пробіг',
  priceUsd: 'ціна',
  city: 'місто',
  publishedAt: 'дата публікації',
  url: 'посилання',
  descriptionText: 'опис',
  photos: 'фото',
}

/** «марку, рік і ціну» — підпис події про правку. */
export function fieldsLabel(fields: string[] | undefined): string | null {
  if (!fields?.length) return null
  return fields.map((field) => FIELD_LABELS[field] ?? field).join(', ')
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
