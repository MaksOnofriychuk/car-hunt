'use client'

import { useActionState, useState } from 'react'

import { cleanupArchivedPhotos } from '@/app/(app)/actions'
import { IDLE } from '@/lib/forms'
import { formatNumber } from '@/lib/format'

/**
 * Дані: забрати все з собою і прибрати місце.
 *
 * PDF робить браузер зі сторінки друку — бібліотека, яка малює PDF на сервері,
 * важила б більше за весь застосунок і верстала б гірше.
 */
export function DataSettings({ usage }: { usage: { files: number; bytes: number } | null }) {
  const [state, formAction, pending] = useActionState(cleanupArchivedPhotos, IDLE)
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="rounded-card border border-line bg-card p-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Дані</h2>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <a
          href="/api/export?format=json"
          className="h-9 rounded-card border border-ink px-2.5 text-[12px] leading-9"
        >
          JSON
        </a>
        <a
          href="/api/export?format=json&full=1"
          className="h-9 rounded-card border border-line px-2.5 text-[12px] leading-9 text-muted"
        >
          JSON з архівом сторінок
        </a>
        <a
          href="/api/export?format=csv"
          className="h-9 rounded-card border border-ink px-2.5 text-[12px] leading-9"
        >
          CSV
        </a>
        <a
          href="/export/print"
          className="h-9 rounded-card border border-ink px-2.5 text-[12px] leading-9"
        >
          PDF / друк
        </a>
      </div>

      <p className="mt-3 text-[13px]">
        Фото у сховищі:{' '}
        {usage ? (
          <span className="font-mono tabular-nums">
            {formatNumber(usage.files)} файлів · {megabytes(usage.bytes)}
          </span>
        ) : (
          <span className="text-muted">невідомо (сховище в хмарі)</span>
        )}
      </p>

      <form action={formAction} className="mt-2">
        <input type="hidden" name="confirm" value="yes" />

        {confirming ? (
          <div className="border-l-[3px] border-signal py-2 pl-3">
            <p className="text-[13px]">
              Прибрати копії фото в авто, які прибрані з черги і вже «куплено» або «відпало»?
              Сторінка оголошення, опис, характеристики і вся стрічка подій лишаються.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-card border border-ink px-3 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
              >
                {pending ? 'Прибираю…' : 'Так, прибрати'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-9 rounded-card border border-line px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Почистити фото завершених
          </button>
        )}
      </form>

      {state.error ? <p className="mt-2 text-[12px] font-semibold">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-[12px] text-muted">Прибрано</p> : null}
    </section>
  )
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}
