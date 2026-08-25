'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { removeArchivedPhotos } from '@/db/maintenance'
import { createPreset, removePreset } from '@/db/presets'
import { setSellerNotes } from '@/db/sellers'
import { saveSettings } from '@/db/settings'
import { requireAuthor } from '@/lib/auth'
import type { FormState } from '@/lib/forms'
import { CURRENCIES, DEFAULT_SORTS, isTime } from '@/lib/settings'

/**
 * Набори фільтрів. Сам набір — це рядок запиту, тому «зберегти» означає лише
 * дати імʼя тому, що вже стоїть в адресі.
 */

const saveSchema = z.object({
  name: z.string().min(1).max(40),
  query: z.string().min(1).max(1000),
})

export async function savePreset(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const parsed = saveSchema.safeParse({
    name: formData.get('name')?.toString().trim(),
    query: formData.get('query')?.toString().trim(),
  })
  if (!parsed.success) return { error: 'Дай наборові назву', ok: false }

  await createPreset(author, parsed.data.name, parsed.data.query)
  revalidatePath('/')

  return { error: null, ok: true }
}

export async function deletePreset(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()

  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return { error: 'Набір не знайдено', ok: false }

  await removePreset(id.data)
  revalidatePath('/')

  return { error: null, ok: true }
}

/**
 * Нотатки про продавця. Досі їх ніде не було записати — колонка існувала, а
 * форми до неї не було.
 */
export async function saveSellerNotes(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()

  const parsed = z
    .object({ id: z.uuid(), notes: z.string().max(4000) })
    .safeParse({ id: formData.get('id'), notes: formData.get('notes')?.toString() ?? '' })

  if (!parsed.success) return { error: 'Продавця не знайдено', ok: false }

  await setSellerNotes(parsed.data.id, parsed.data.notes.trim() || null)
  revalidatePath(`/sellers/${parsed.data.id}`)
  revalidatePath('/sellers')

  return { error: null, ok: true }
}

/* -------------------------------------------------------------------------- */
/*  Налаштування                                                               */
/* -------------------------------------------------------------------------- */

const workSchema = z.object({
  callFollowupDays: z.coerce.number().int().min(0).max(90),
  longStandingDays: z.coerce.number().int().min(7).max(365),
  currency: z.enum(CURRENCIES),
  defaultSort: z.enum(DEFAULT_SORTS),
})

export async function saveWorkSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const parsed = workSchema.safeParse({
    callFollowupDays: formData.get('callFollowupDays'),
    longStandingDays: formData.get('longStandingDays'),
    currency: formData.get('currency'),
    defaultSort: formData.get('defaultSort'),
  })
  if (!parsed.success) return { error: 'Перевір числа в налаштуваннях', ok: false }

  await saveSettings(author, parsed.data)
  // Від цих значень залежить і черга, і картка авто.
  revalidatePath('/', 'layout')

  return { error: null, ok: true }
}

const notifySchema = z.object({
  notifyNew: z.boolean(),
  notifyComment: z.boolean(),
  notifyPrice: z.boolean(),
  notifyStage: z.boolean(),
  digestAt: z.string().refine(isTime, 'час'),
  quietFrom: z.string().refine(isTime, 'час'),
  quietTo: z.string().refine(isTime, 'час'),
})

export async function saveNotifySettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const author = await requireAuthor()

  const parsed = notifySchema.safeParse({
    notifyNew: formData.get('notifyNew') === 'on',
    notifyComment: formData.get('notifyComment') === 'on',
    notifyPrice: formData.get('notifyPrice') === 'on',
    notifyStage: formData.get('notifyStage') === 'on',
    digestAt: formData.get('digestAt')?.toString() ?? '',
    quietFrom: formData.get('quietFrom')?.toString() ?? '',
    quietTo: formData.get('quietTo')?.toString() ?? '',
  })
  if (!parsed.success) return { error: 'Час має бути у форматі 08:00', ok: false }

  await saveSettings(author, parsed.data)
  revalidatePath('/settings')

  return { error: null, ok: true }
}

/**
 * Прибрати копії фото в авто, з якими вже все вирішено: архівні і на етапі
 * «купили» або «відпало».
 *
 * SPEC каже «архів назавжди», і це правило не скасовується: сторінка,
 * характеристики, опис і сама історія лишаються недоторканими. Прибираються
 * тільки важкі копії знімків — і лише там, де рішення вже прийнято.
 */
export async function cleanupArchivedPhotos(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuthor()
  if (formData.get('confirm') !== 'yes') return { error: 'Не підтверджено', ok: false }

  const removed = await removeArchivedPhotos()
  revalidatePath('/settings')

  if (removed === 0) return { error: 'Нічого прибирати: таких авто немає', ok: false }
  return { error: null, ok: true }
}
