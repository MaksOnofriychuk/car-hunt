'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createPreset, removePreset } from '@/db/presets'
import { setSellerNotes } from '@/db/sellers'
import { requireAuthor } from '@/lib/auth'
import type { FormState } from '@/lib/forms'

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
