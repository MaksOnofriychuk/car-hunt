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
    <form action={formAction} className="rounded-card border border-line bg-white p-3">
      <input type="hidden" name="listingId" value={listingId} />

      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Виправлено руками
      </h2>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <button
            key={field}
            type="submit"
            name="field"
            value={field}
            disabled={pending}
            title="Повернути значення з оголошення"
            className="rounded-card border border-ink px-1.5 py-0.5 text-[11px] disabled:opacity-50"
          >
            {FIELD_LABELS[field] ?? field} ✕
          </button>
        ))}
      </div>

      <p className="mt-1.5 text-[12px] text-muted">
        {state.error ?? 'Парсер їх не чіпає. Тап — знову довіряти оголошенню.'}
      </p>
    </form>
  )
}
