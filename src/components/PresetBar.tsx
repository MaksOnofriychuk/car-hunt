'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { deletePreset, savePreset } from '@/app/(app)/actions'
import { cn } from '@/lib/cn'
import { IDLE } from '@/lib/forms'
import { isPresetActive, type Preset } from '@/lib/presets'

/**
 * Набори фільтрів. Пресет — це просто збережений рядок запиту, тому клік по
 * ньому нічим не відрізняється від переходу за посиланням.
 */
export function PresetBar({
  presets,
  builtIn,
  search,
}: {
  presets: Preset[]
  builtIn: Preset[]
  search: string
}) {
  const [saving, setSaving] = useState(false)
  const [saveState, saveAction, savePending] = useActionState(savePreset, IDLE)
  const [, deleteAction] = useActionState(deletePreset, IDLE)

  const all = [...builtIn, ...presets]

  return (
    <section className="surface p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {all.map((preset) => {
          const active = isPresetActive(preset, search)
          return (
            <span key={preset.key} className="inline-flex items-center">
              <Link
                href={preset.query ? `/?${preset.query}` : '/'}
                className={cn('chip tap', active && 'chip-on')}
              >
                {preset.name}
              </Link>
              {/* Вбудовані три прибрати не можна — вони частина застосунку. */}
              {preset.custom ? (
                <form action={deleteAction} className="ml-0.5">
                  <input type="hidden" name="id" value={preset.key} />
                  <button
                    type="submit"
                    aria-label={`Прибрати набір ${preset.name}`}
                    className="tap px-1 text-faint"
                  >
                    ✕
                  </button>
                </form>
              ) : null}
            </span>
          )
        })}

        {search && !saving ? (
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="chip chip-sm"
          >
            Зберегти набір
          </button>
        ) : null}
      </div>

      {saving ? (
        <form action={saveAction} className="mt-2 flex gap-1.5">
          <input type="hidden" name="query" value={search} />
          <input
            name="name"
            autoFocus
            maxLength={40}
            placeholder="Назва набору"
            className="field min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={savePending}
            className="btn tap px-3"
          >
            {savePending ? 'Пишу…' : 'Ок'}
          </button>
          <button
            type="button"
            onClick={() => setSaving(false)}
            className="btn btn-quiet tap px-2 text-faint"
          >
            Скасувати
          </button>
        </form>
      ) : null}

      {saveState.error ? (
        <p className="t-body mt-1.5 text-danger">{saveState.error}</p>
      ) : null}
    </section>
  )
}
