'use client'

import { useActionState } from 'react'

import { Toggle } from './Toggle'

import { saveNotifySettings } from '@/app/(app)/actions'
import { IDLE } from '@/lib/forms'
import type { Settings } from '@/lib/settings'

/**
 * Сповіщення в Telegram. Правило «пишемо іншому, не автору дії» лишається
 * незмінним — тут лише про те, які саме події турбують і о котрій годині.
 */

const SWITCHES: { name: keyof Settings; label: string; hint: string }[] = [
  { name: 'notifyNew', label: 'Нове авто', hint: 'хтось із нас додав картку' },
  { name: 'notifyComment', label: 'Коментарі і дзвінки', hint: 'записали розмову з продавцем' },
  { name: 'notifyPrice', label: 'Зміни ціни', hint: 'продавець змінив ціну в оголошенні' },
  { name: 'notifyStage', label: 'Зміни етапу', hint: 'авто рушило по воронці' },
]

export function NotifySettings({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(saveNotifySettings, IDLE)

  return (
    <form action={formAction} className="surface p-3">
      <h2 className="t-micro text-faint">Сповіщення</h2>
      <p className="t-body mt-1 text-faint">
        Бот ще не написаний — налаштування зберігаються і почнуть діяти, щойно зʼявиться розсилка.
      </p>

      <ul className="mt-2 divide-y divide-edge">
        {SWITCHES.map((item) => (
          <li key={item.name} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="t-body block font-semibold">{item.label}</span>
              <span className="t-body block text-faint">{item.hint}</span>
            </span>
            <Toggle
              name={item.name}
              defaultChecked={Boolean(settings[item.name])}
              label={item.label}
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Time name="digestAt" label="Зведення" value={settings.digestAt} />
        <Time name="quietFrom" label="Тиша з" value={settings.quietFrom} />
        <Time name="quietTo" label="Тиша до" value={settings.quietTo} />
      </div>

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

function Time({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="block">
      <span className="t-micro block truncate text-faint">{label}</span>
      <input type="time" name={name} defaultValue={value} className="field mt-1 text-center" />
    </label>
  )
}
