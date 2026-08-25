'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'

import { changeStage, recordCall, recordComment, recordEdit } from '@/db/events'
import {
  createManualListing,
  listingExists,
  setArchived,
  setFieldManual,
  setNextContactAt,
  setTargetPrice,
  updateListingFields,
  EDITABLE_FIELDS,
  type EditableFields,
} from '@/db/listings'
import { listings, SELLER_TYPES, STAGES, type SellerType } from '@/db/schema'
import { addSellerPhone, saveManualSeller } from '@/db/sellers'
import { getSettings } from '@/db/settings'
import { manualRef } from '@/lib/sources'
import { notifyCall, notifyComment, notifyNewListing, notifyStage } from '@/lib/telegram/notify'
import { storage } from '@/lib/storage'
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

  const settings = await getSettings(author)

  await recordCall({
    listingId,
    author,
    outcome,
    text: text ?? null,
    offeredPrice: offeredPrice ?? null,
    followupDays: settings.callFollowupDays,
  })
  refresh(listingId)

  // Telegram — після відповіді: людина вже бачить запис у стрічці, а сповіщення
  // хай собі йде у фоні. Мережа Telegram не має тримати форму.
  after(() =>
    notifyCall(listingId, author, {
      outcome,
      text: text ?? null,
      offeredPrice: offeredPrice ?? null,
    }),
  )

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
  after(() => notifyComment(listingId, author, text))

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
  after(() => notifyStage(listingId, author, stage))

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

/**
 * Видалити назавжди. Це єдина дія в застосунку, яка справді стирає дані:
 * зникає картка, весь її архів, історія цін і всі події по ній (каскад по
 * зовнішніх ключах). Локальні копії фото прибираємо теж — інакше вони лежали б
 * у сховищі без жодного посилання.
 *
 * Проти принципу «архів назавжди» зі SPEC, тому кнопка живе під «···» і питає
 * підтвердження: випадково натиснути її не можна.
 */
export async function removeListing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()

  const listingId = listingIdSchema.safeParse(field(formData, 'listingId'))
  if (!listingId.success) return { error: NOT_FOUND, ok: false }
  if (field(formData, 'confirm') !== 'yes') return { error: 'Не підтверджено', ok: false }

  const [row] = await db
    .select({ local: listings.photosLocal, manual: listings.photosManual })
    .from(listings)
    .where(eq(listings.id, listingId.data))
    .limit(1)
  if (!row) return { error: NOT_FOUND, ok: false }

  const files = storage()
  await Promise.all(
    [...row.local, ...row.manual].map((key) => files.remove(key).catch(() => undefined)),
  )

  await db.delete(listings).where(eq(listings.id, listingId.data))

  revalidatePath('/')
  revalidatePath('/sellers')

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

/* -------------------------------------------------------------------------- */
/*  Ручне заповнення                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Форма ручного додавання і редагування. Обовʼязкові лише марка і модель:
 * решту дописують потім, коли з'явиться. Усе, що людина тут вводить, парсер
 * більше не перезаписує — див. `manual_fields`.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const formSchema = z.object({
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  mileageKm: z.coerce.number().int().min(0).max(3_000_000).optional(),
  priceUsd: z.coerce.number().int().positive().max(10_000_000).optional(),
  city: z.string().max(60).optional(),
  publishedAt: z.string().regex(ISO_DAY).optional(),
  url: z.url().max(2000).optional(),
  descriptionText: z.string().max(20_000).optional(),
  sellerName: z.string().max(120).optional(),
  sellerPhone: z.string().max(40).optional(),
  sellerType: z.enum(SELLER_TYPES).optional(),
})

/** Помилки — людською мовою і по одній: форма показує рядок, а не список. */
const FIELD_ERRORS: Record<string, string> = {
  brand: 'Марка і модель обовʼязкові',
  model: 'Марка і модель обовʼязкові',
  year: 'Рік — чотири цифри',
  mileageKm: 'Пробіг — тільки число',
  priceUsd: 'Ціна — тільки число',
  publishedAt: 'Дата у форматі РРРР-ММ-ДД',
  url: 'Посилання схоже на неправильне',
  sellerType: 'Невідомий тип продавця',
}

type ParsedForm = {
  values: EditableFields
  seller: { name: string | null; phone: string | null; type: SellerType | null }
  photos: string[]
}

function readForm(formData: FormData): { ok: true; data: ParsedForm } | { ok: false; error: string } {
  const parsed = formSchema.safeParse({
    brand: field(formData, 'brand'),
    model: field(formData, 'model'),
    year: field(formData, 'year'),
    mileageKm: field(formData, 'mileageKm')?.replace(/\s/g, ''),
    priceUsd: field(formData, 'priceUsd')?.replace(/[^\d]/g, '') || undefined,
    city: field(formData, 'city'),
    publishedAt: field(formData, 'publishedAt'),
    url: field(formData, 'url'),
    descriptionText: field(formData, 'descriptionText'),
    sellerName: field(formData, 'sellerName'),
    sellerPhone: field(formData, 'sellerPhone'),
    sellerType: field(formData, 'sellerType'),
  })

  if (!parsed.success) {
    const where = String(parsed.error.issues[0]?.path[0] ?? '')
    return { ok: false, error: FIELD_ERRORS[where] ?? 'Перевір заповнені поля' }
  }

  const input = parsed.data
  return {
    ok: true,
    data: {
      values: {
        brand: input.brand,
        model: input.model,
        year: input.year ?? null,
        mileageKm: input.mileageKm ?? null,
        priceUsd: input.priceUsd ?? null,
        city: input.city ?? null,
        // Полудень за Києвом: інакше дата зʼїжджає на добу назад.
        publishedAt: input.publishedAt ? new Date(`${input.publishedAt}T12:00:00+03:00`) : null,
        url: input.url ?? null,
        descriptionText: input.descriptionText ?? null,
      },
      seller: {
        name: input.sellerName ?? null,
        phone: input.sellerPhone ?? null,
        type: input.sellerType ?? null,
      },
      photos: readPhotoKeys(formData),
    },
  }
}

/** Ключі вже завантажених фото приходять прихованим полем як JSON. */
function readPhotoKeys(formData: FormData): string[] {
  const raw = formData.get('photos')
  if (typeof raw !== 'string' || !raw.trim()) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((key): key is string => typeof key === 'string').slice(0, 40)
  } catch {
    return []
  }
}

export async function createListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const form = readForm(formData)
  if (!form.ok) return { error: form.error, ok: false }

  const id = await createManualListing({
    ref: manualRef(),
    author,
    values: form.data.values,
    photos: form.data.photos,
  })

  const [created] = await db.select().from(listings).where(eq(listings.id, id)).limit(1)
  if (created) await saveManualSeller(created, form.data.seller)

  // Заведене руками — теж нове авто: іншому воно так само цікаве. Реєструємо
  // до `redirect()`, бо той кидає виняток і рядки після нього не виконаються.
  after(() => notifyNewListing(id, author))

  revalidatePath('/')
  redirect(`/listing/${id}`)
}

export async function saveListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const listingId = listingIdSchema.safeParse(field(formData, 'listingId'))
  if (!listingId.success) return { error: NOT_FOUND, ok: false }

  const form = readForm(formData)
  if (!form.ok) return { error: form.error, ok: false }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId.data))
    .limit(1)
  if (!listing) return { error: NOT_FOUND, ok: false }

  const changed = await updateListingFields(listingId.data, form.data.values, form.data.photos)
  await saveManualSeller(listing, form.data.seller)

  const photosChanged = form.data.photos.join() !== listing.photosManual.join()
  await recordEdit(listingId.data, author, [...changed, ...(photosChanged ? ['photos'] : [])])

  refresh(listingId.data)
  redirect(`/listing/${listingId.data}`)
}

/**
 * «Знову довіряти парсеру»: знімає позначку з одного поля, і наступний прогін
 * повертає туди значення з оголошення.
 */
export async function unlockField(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()

  const listingId = listingIdSchema.safeParse(field(formData, 'listingId'))
  const name = field(formData, 'field')
  const known = EDITABLE_FIELDS.find((item) => item === name)

  if (!listingId.success || !known) return { error: NOT_FOUND, ok: false }
  if (!(await listingExists(listingId.data))) return { error: NOT_FOUND, ok: false }

  await setFieldManual(listingId.data, known, false)
  refresh(listingId.data)

  return { error: null, ok: true }
}
