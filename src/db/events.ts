import { eq } from 'drizzle-orm'

import { db } from './index'
import { events, listings } from './schema'
import type { Author, Event, EventPayload, EventType } from './schema'
import { getStage } from './stage'

import { kyivDatePlus } from '@/lib/dates'
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
  /** Через скільки днів передзвонити (з налаштувань). 0 — дату не чіпати. */
  followupDays?: number
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

  // Дзвінок без наступної дати — це авто, яке тихо випало з черги. Тому після
  // запису одразу ставимо, коли передзвонити; скільки саме — з налаштувань.
  if (input.followupDays && input.followupDays > 0) {
    await db
      .update(listings)
      .set({ nextContactAt: kyivDatePlus(input.followupDays) })
      .where(eq(listings.id, input.listingId))
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

/**
 * Правка руками. Пишеться лише коли щось справді змінилось: у стрічці має бути
 * видно, хто і що виправив, а не «відкрив форму і закрив».
 */
export async function recordEdit(
  listingId: string,
  author: Author,
  fields: string[],
): Promise<Event | null> {
  if (fields.length === 0) return null
  return addEvent(listingId, author, 'edit', { fields })
}
