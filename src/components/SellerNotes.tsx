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
    <form action={formAction} className="surface p-3">
      <input type="hidden" name="id" value={sellerId} />

      <label
        htmlFor="seller-notes"
        className="t-micro text-faint"
      >
        Нотатки
      </label>

      <textarea
        id="seller-notes"
        name="notes"
        rows={3}
        defaultValue={notes}
        placeholder="Торгується, але тримає слово. Дзвонити після 18:00."
        className="field mt-1"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn tap px-3"
        >
          {pending ? 'Пишу…' : 'Зберегти'}
        </button>
        {state.error ? <span className="t-body text-danger">{state.error}</span> : null}
        {state.ok ? <span className="t-body text-faint">Записано</span> : null}
      </div>
    </form>
  )
}
