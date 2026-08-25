'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { deletePreset, savePreset } from '@/app/(app)/actions'
import { cn } from '@/lib/cn'
import { IDLE } from '@/lib/forms'
import { BUILT_IN_PRESETS, isPresetActive, type Preset } from '@/lib/presets'

/**
 * Набори фільтрів. Пресет — це просто збережений рядок запиту, тому клік по
 * ньому нічим не відрізняється від переходу за посиланням.
 */
export function PresetBar({ presets, search }: { presets: Preset[]; search: string }) {
  const [saving, setSaving] = useState(false)
  const [saveState, saveAction, savePending] = useActionState(savePreset, IDLE)
  const [, deleteAction] = useActionState(deletePreset, IDLE)

  const all = [...BUILT_IN_PRESETS, ...presets]

  return (
    <section className="rounded-card border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {all.map((preset) => {
          const active = isPresetActive(preset, search)
          return (
            <span key={preset.key} className="inline-flex items-center">
              <Link
                href={preset.query ? `/?${preset.query}` : '/'}
                className={cn(
                  'h-8 rounded-card border px-2 text-[12px] leading-8',
                  active ? 'border-ink bg-concrete font-semibold' : 'border-line',
                )}
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
                    className="px-1 text-[12px] text-muted"
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
            className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-plate"
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
            className="h-9 min-w-0 flex-1 rounded-card border border-line bg-white px-2.5 text-[14px] placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={savePending}
            className="h-9 rounded-card border border-ink px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            {savePending ? 'Пишу…' : 'Ок'}
          </button>
          <button
            type="button"
            onClick={() => setSaving(false)}
            className="h-9 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Скасувати
          </button>
        </form>
      ) : null}

      {saveState.error ? (
        <p className="mt-1.5 text-[12px] font-semibold">{saveState.error}</p>
      ) : null}
    </section>
  )
}
