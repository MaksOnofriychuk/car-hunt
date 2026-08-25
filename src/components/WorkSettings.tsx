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
    <form action={formAction} className="surface p-3">
      <h2 className="t-micro text-faint">Робота</h2>

      <fieldset className="mt-3">
        <legend className="t-micro text-faint">
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
        <span className="t-micro text-faint">
          «Довго висить» після, днів
        </span>
        <input
          name="longStandingDays"
          inputMode="numeric"
          defaultValue={settings.longStandingDays}
          className="field field-num mt-1 w-24"
        />
        <span className="t-body mt-1 block text-faint">
          Від цього числа залежить підсвічування на смузі номерного знака і пресет «Довго висять».
        </span>
      </label>

      <fieldset className="mt-3">
        <legend className="t-micro text-faint">
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
        <legend className="t-micro text-faint">
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
          className="btn tap px-3"
        >
          {pending ? 'Зберігаю…' : 'Зберегти'}
        </button>
        {state.error ? <span className="t-body text-danger">{state.error}</span> : null}
        {state.ok ? <span className="t-body text-faint">Записано</span> : null}
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
        'chip chip-sm cursor-pointer',
        'has-checked:border-accent has-checked:bg-accent/12 has-checked:text-accent-lit',
      )}
    >
      <input type="radio" name={name} value={value} defaultChecked={checked} className="sr-only" />
      {children}
    </label>
  )
}
