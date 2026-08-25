'use client'

import { useActionState } from 'react'

import { unlockField } from '@/app/(app)/listing/actions'
import { FIELD_LABELS } from '@/lib/events'
import { IDLE } from '@/lib/forms'

/**
 * Поля, які виправили руками. Парсер їх більше не перезаписує — але якщо
 * виправлення виявилось зайвим, позначку знімають тапом, і наступний прогін
 * поверне туди значення з оголошення.
 */
export function ManualFields({ listingId, fields }: { listingId: string; fields: string[] }) {
  const [state, formAction, pending] = useActionState(unlockField, IDLE)

  if (fields.length === 0) return null

  return (
    <form action={formAction} className="surface p-3">
      <input type="hidden" name="listingId" value={listingId} />

      <h2 className="t-micro text-faint">Виправлено руками</h2>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <button
            key={field}
            type="submit"
            name="field"
            value={field}
            disabled={pending}
            title="Повернути значення з оголошення"
            className="chip"
          >
            {FIELD_LABELS[field] ?? field} ✕
          </button>
        ))}
      </div>

      <p className="t-body mt-2 text-faint">
        {state.error ?? 'Парсер їх не чіпає. Тап — знову довіряти оголошенню.'}
      </p>
    </form>
  )
}
