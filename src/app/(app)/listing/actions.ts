'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { changeStage, recordCall, recordComment } from '@/db/events'
import { listingExists, setArchived, setNextContactAt, setTargetPrice } from '@/db/listings'
import { STAGES } from '@/db/schema'
import { addSellerPhone } from '@/db/sellers'
import { requireAuthor } from '@/lib/auth'
import { kyivDatePlus } from '@/lib/dates'
import { CALL_OUTCOME_ORDER } from '@/lib/events'
import type { FormState } from '@/lib/forms'

/**
 * Дії з картки авто. Усе, що людина натискає, — і на головному екрані, і на
 * самій картці, тому кожна дія оновлює обидва шляхи.
 */

const NOT_FOUND = 'Авто не знайдено'

function refresh(listingId: string): void {
  revalidatePath('/')
  revalidatePath(`/listing/${listingId}`)
}

/** Порожнє поле форми — це «нічого не ввели», а не порожній рядок. */
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const listingIdSchema = z.uuid()

/* -------------------------------------------------------------------------- */
/*  Події                                                                      */
/* -------------------------------------------------------------------------- */

const callSchema = z.object({
  listingId: z.uuid(),
  outcome: z.enum(CALL_OUTCOME_ORDER),
  text: z.string().max(2000).optional(),
  offeredPrice: z.coerce.number().int().positive().max(10_000_000).optional(),
})

export async function logCall(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const parsed = callSchema.safeParse({
    listingId: field(formData, 'listingId'),
    outcome: field(formData, 'outcome'),
    text: field(formData, 'text'),
    offeredPrice: field(formData, 'offeredPrice'),
  })
  if (!parsed.success) {
    const where = parsed.error.issues[0]?.path[0]
    return {
      error: where === 'offeredPrice' ? 'Ціна — тільки число' : 'Обери результат дзвінка',
      ok: false,
    }
  }

  const { listingId, outcome, text, offeredPrice } = parsed.data
  if (!(await listingExists(listingId))) return { error: NOT_FOUND, ok: false }

  await recordCall({
    listingId,
    author,
    outcome,
    text: text ?? null,
    offeredPrice: offeredPrice ?? null,
  })
  refresh(listingId)

  return { error: null, ok: true }
}

const commentSchema = z.object({
  listingId: z.uuid(),
  text: z.string().min(1).max(2000),
})

export async function logComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const parsed = commentSchema.safeParse({
    listingId: field(formData, 'listingId'),
    text: field(formData, 'text'),
  })
  if (!parsed.success) return { error: 'Порожній коментар', ok: false }

  const { listingId, text } = parsed.data
  if (!(await listingExists(listingId))) return { error: NOT_FOUND, ok: false }

  await recordComment(listingId, author, text)
  refresh(listingId)

  return { error: null, ok: true }
}

const stageSchema = z.object({
  listingId: z.uuid(),
  stage: z.enum(STAGES),
})

export async function setStage(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const parsed = stageSchema.safeParse({
    listingId: field(formData, 'listingId'),
    stage: field(formData, 'stage'),
  })
  if (!parsed.success) return { error: 'Невідомий етап', ok: false }

  const { listingId, stage } = parsed.data
  if (!(await listingExists(listingId))) return { error: NOT_FOUND, ok: false }

  await changeStage(listingId, author, stage)
  refresh(listingId)

  return { error: null, ok: true }
}

/* -------------------------------------------------------------------------- */
/*  Два поля, які редагуються в один тап (SPEC, «Інтерфейс»)                    */
/* -------------------------------------------------------------------------- */

const targetPriceSchema = z.object({
  listingId: z.uuid(),
  /** Порожнє поле — прибрати ціль. */
  price: z.coerce.number().int().positive().max(10_000_000).optional(),
})

export async function saveTargetPrice(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()

  const parsed = targetPriceSchema.safeParse({
    listingId: field(formData, 'listingId'),
    price: field(formData, 'price')?.replace(/[^\d]/g, '') || undefined,
  })
  if (!parsed.success) return { error: 'Ціна — тільки число', ok: false }

  const { listingId, price } = parsed.data
  if (!(await listingExists(listingId))) return { error: NOT_FOUND, ok: false }

  await setTargetPrice(listingId, price ?? null)
  refresh(listingId)

  return { error: null, ok: true }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Кнопки «сьогодні / +3 / +7 / +14»: у формі лежить кількість днів.
 * `none` прибирає дату, повна дата теж приймається — знадобиться для календаря.
 */
function contactDateFor(when: string): string | null | undefined {
  if (when === 'none') return null
  if (/^\d{1,3}$/.test(when)) return kyivDatePlus(Number(when))
  if (ISO_DATE.test(when)) return when
  return undefined
}

export async function saveNextContact(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()

  const listingId = listingIdSchema.safeParse(field(formData, 'listingId'))
  const when = field(formData, 'when')
  const date = when ? contactDateFor(when) : undefined

  if (!listingId.success || date === undefined) return { error: 'Не зрозумів дату', ok: false }
  if (!(await listingExists(listingId.data))) return { error: NOT_FOUND, ok: false }

  await setNextContactAt(listingId.data, date)
  refresh(listingId.data)

  return { error: null, ok: true }
}

/** Прибрати з черги / повернути. Картка і всі її дані лишаються назавжди. */
export async function toggleArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()

  const listingId = listingIdSchema.safeParse(field(formData, 'listingId'))
  if (!listingId.success) return { error: NOT_FOUND, ok: false }
  if (!(await listingExists(listingId.data))) return { error: NOT_FOUND, ok: false }

  await setArchived(listingId.data, field(formData, 'archived') === 'true')
  refresh(listingId.data)

  return { error: null, ok: true }
}

/* -------------------------------------------------------------------------- */
/*  Телефон продавця                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Номер продавця вводимо руками: AUTO.RIA показує лише маску `(066) XXX XX XX`,
 * повний номер відкривається тільки по кліку в них на сайті.
 */

export type PhoneFormState = {
  error: string | null
  /** Збережений номер у нормалізованому вигляді — підпис «записано». */
  saved: string | null
  /** Продавці, у яких цей номер уже є. Не зливаємо, лише попереджаємо. */
  sameAs: { id: string; name: string | null }[]
}

const phoneSchema = z.object({
  listingId: z.uuid(),
  phone: z.string().min(1),
})

export async function saveSellerPhone(
  _prev: PhoneFormState,
  formData: FormData,
): Promise<PhoneFormState> {
  await requireAuthor()

  const parsed = phoneSchema.safeParse({
    listingId: formData.get('listingId'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) return { error: 'Введи номер', saved: null, sameAs: [] }

  const result = await addSellerPhone(parsed.data.listingId, parsed.data.phone)
  if (!result.ok) return { error: result.error, saved: null, sameAs: [] }

  revalidatePath(`/listing/${parsed.data.listingId}`)
  revalidatePath('/sellers')

  return { error: null, saved: result.phone, sameAs: result.sameAs }
}
