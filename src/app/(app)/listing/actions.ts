'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { addSellerPhone } from '@/db/sellers'
import { requireAuthor } from '@/lib/auth'

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
