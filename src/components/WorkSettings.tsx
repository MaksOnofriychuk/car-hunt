'use client'

import { useActionState } from 'react'

import { saveWorkSettings } from '@/app/(app)/actions'
import { cn } from '@/lib/cn'
import { IDLE } from '@/lib/forms'
import {
  CURRENCIES,
  CURRENCY_LABELS,
  DEFAULT_SORTS,
  FOLLOWUP_DAYS,
  FOLLOWUP_LABELS,
  SORT_LABELS,
  type Settings,
} from '@/lib/settings'

/** Робочі налаштування — у базі на користувача: це про людину, а не про екран. */
export function WorkSettings({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(saveWorkSettings, IDLE)

  return (
    <form action={formAction} className="rounded-card border border-line bg-card p-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Робота</h2>

      <fieldset className="mt-3">
        <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Коли дзвонити після дзвінка
        </legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FOLLOWUP_DAYS.map((days) => (
            <Radio
              key={days}
              name="callFollowupDays"
              value={String(days)}
              checked={settings.callFollowupDays === days}
            >
              {FOLLOWUP_LABELS[days]}
            </Radio>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          «Довго висить» після, днів
        </span>
        <input
          name="longStandingDays"
          inputMode="numeric"
          defaultValue={settings.longStandingDays}
          className="mt-1 h-9 w-24 rounded-card border border-line bg-card px-2.5 font-mono text-[14px] tabular-nums"
        />
        <span className="mt-1 block text-[11px] text-muted">
          Від цього числа залежить підсвічування на смузі номерного знака і пресет «Довго висять».
        </span>
      </label>

      <fieldset className="mt-3">
        <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Валюта
        </legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {CURRENCIES.map((currency) => (
            <Radio
              key={currency}
              name="currency"
              value={currency}
              checked={settings.currency === currency}
            >
              {CURRENCY_LABELS[currency]}
            </Radio>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Сортування черги
        </legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DEFAULT_SORTS.map((sort) => (
            <Radio
              key={sort}
              name="defaultSort"
              value={sort}
              checked={settings.defaultSort === sort}
            >
              {SORT_LABELS[sort]}
            </Radio>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-card border border-ink px-3 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
        >
          {pending ? 'Зберігаю…' : 'Зберегти'}
        </button>
        {state.error ? <span className="text-[12px] font-semibold">{state.error}</span> : null}
        {state.ok ? <span className="text-[12px] text-muted">Записано</span> : null}
      </div>
    </form>
  )
}

function Radio({
  name,
  value,
  checked,
  children,
}: {
  name: string
  value: string
  checked: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        'h-9 cursor-pointer rounded-card border px-2.5 text-[12px] leading-9',
        'border-line text-muted has-checked:border-ink has-checked:bg-concrete has-checked:font-semibold has-checked:text-ink',
      )}
    >
      <input type="radio" name={name} value={value} defaultChecked={checked} className="sr-only" />
      {children}
    </label>
  )
}
