'use client'

import { useActionState } from 'react'

import { saveSellerNotes } from '@/app/(app)/actions'
import { IDLE } from '@/lib/forms'

/**
 * Нотатки про продавця. Колонка існувала з першого дня, а форми до неї не було —
 * тобто записати «торгується, але тримає слово» було ніде.
 */
export function SellerNotes({ sellerId, notes }: { sellerId: string; notes: string }) {
  const [state, formAction, pending] = useActionState(saveSellerNotes, IDLE)

  return (
    <form action={formAction} className="rounded-card border border-line bg-white p-3">
      <input type="hidden" name="id" value={sellerId} />

      <label
        htmlFor="seller-notes"
        className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
      >
        Нотатки
      </label>

      <textarea
        id="seller-notes"
        name="notes"
        rows={3}
        defaultValue={notes}
        placeholder="Торгується, але тримає слово. Дзвонити після 18:00."
        className="mt-1 w-full rounded-card border border-line bg-white px-2.5 py-2 text-[14px] leading-snug placeholder:text-muted"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-card border border-ink px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
        >
          {pending ? 'Пишу…' : 'Зберегти'}
        </button>
        {state.error ? <span className="text-[12px] font-semibold">{state.error}</span> : null}
        {state.ok ? <span className="text-[12px] text-muted">Записано</span> : null}
      </div>
    </form>
  )
}
