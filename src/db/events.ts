import { eq } from 'drizzle-orm'

import { db } from './index'
import { events, listings } from './schema'
import type { Author, Event, EventPayload, EventType } from './schema'
import { getStage } from './stage'

import { isTerminalStage, type Stage } from '@/lib/stages'

/**
 * Запис у стрічку подій. Таблиця append-only (SPEC, «Модель даних»): тут є
 * лише insert, жодного update чи delete — виправлення дописується новою подією.
 */
async function addEvent(
  listingId: string,
  author: Author,
  type: EventType,
  payload: EventPayload = {},
): Promise<Event> {
  const [event] = await db.insert(events).values({ listingId, author, type, payload }).returning()
  return event
}

export type CallInput = {
  listingId: string
  author: Author
  /** Ключ із CALL_OUTCOMES: reached | no_answer | busy | callback | declined. */
  outcome: string
  text: string | null
  offeredPrice: number | null
}

/**
 * Дзвінок. Якщо слухавку взяли, а етап ще `new` — дописуємо `stage_change`
 * на `contacted`: після розмови «нове» вже неправда, а тиснути другу кнопку
 * щоразу ніхто не буде. Далі етап міняється тільки руками.
 */
export async function recordCall(input: CallInput): Promise<Event> {
  const payload: EventPayload = { outcome: input.outcome }
  if (input.text) payload.text = input.text
  if (input.offeredPrice !== null) payload.offered_price = input.offeredPrice

  const event = await addEvent(input.listingId, input.author, 'call', payload)

  if (input.outcome === 'reached' && (await getStage(input.listingId)) === 'new') {
    await changeStage(input.listingId, input.author, 'contacted')
  }

  return event
}

export async function recordComment(
  listingId: string,
  author: Author,
  text: string,
): Promise<Event> {
  return addEvent(listingId, author, 'comment', { text })
}

/**
 * Зміна етапу. Полем у `listings` етап не зберігається — він живе лише
 * всередині події (SPEC). `won` і `lost` означають, що робота по авто
 * закінчена: прибираємо картку з черги і знімаємо дату дзвінка, інакше вона
 * вічно висітиме в «прострочено».
 */
export async function changeStage(
  listingId: string,
  author: Author,
  stage: Stage,
): Promise<Event> {
  const event = await addEvent(listingId, author, 'stage_change', { stage })

  if (isTerminalStage(stage)) {
    await db
      .update(listings)
      .set({ archived: true, nextContactAt: null })
      .where(eq(listings.id, listingId))
  }

  return event
}
