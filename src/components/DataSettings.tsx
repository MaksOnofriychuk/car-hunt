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
export function DataSettings({
  usage,
  storage,
}: {
  usage: { files: number; bytes: number } | null
  /** `none` — сховища немає: на Vercel без ключів R2 копії фото не робляться. */
  storage: 'r2' | 'local' | 'none'
}) {
  const [state, formAction, pending] = useActionState(cleanupArchivedPhotos, IDLE)
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="surface p-3">
      <h2 className="t-micro text-faint">Дані</h2>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <a
          href="/api/export?format=json"
          className="chip chip-sm"
        >
          JSON
        </a>
        <a
          href="/api/export?format=json&full=1"
          className="chip chip-sm"
        >
          JSON з архівом сторінок
        </a>
        <a
          href="/api/export?format=csv"
          className="chip chip-sm"
        >
          CSV
        </a>
        <a
          href="/export/print"
          className="chip chip-sm"
        >
          PDF / друк
        </a>
      </div>

      <p className="t-body mt-3">
        Фото у сховищі:{' '}
        {storage === 'none' ? (
          <span className="text-warn">
            сховище не налаштоване — копії не робляться, картки показують фото з майданчика
          </span>
        ) : usage ? (
          <span className="t-num">
            {formatNumber(usage.files)} файлів · {megabytes(usage.bytes)}
          </span>
        ) : (
          <span className="text-faint">невідомо (сховище в хмарі)</span>
        )}
      </p>

      <form action={formAction} className="mt-2">
        <input type="hidden" name="confirm" value="yes" />

        {confirming ? (
          <div className="sunken rib border-l-warn px-3 py-2">
            <p className="t-body">
              Прибрати копії фото в авто, які прибрані з черги і вже «куплено» або «відпало»?
              Сторінка оголошення, опис, характеристики і вся стрічка подій лишаються.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="btn tap border-warn px-3 text-warn"
              >
                {pending ? 'Прибираю…' : 'Так, прибрати'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="btn btn-quiet tap px-2 text-faint"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="chip chip-sm"
          >
            Почистити фото завершених
          </button>
        )}
      </form>

      {state.error ? <p className="t-body mt-2 text-danger">{state.error}</p> : null}
      {state.ok ? <p className="t-body mt-2 text-faint">Прибрано</p> : null}
    </section>
  )
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}
