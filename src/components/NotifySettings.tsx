'use client'

import { useActionState } from 'react'

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
    <form action={formAction} className="rounded-card border border-line bg-card p-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Сповіщення
      </h2>
      <p className="mt-1 text-[12px] text-muted">
        Бот ще не написаний — налаштування зберігаються і почнуть діяти, щойно зʼявиться розсилка.
      </p>

      <ul className="mt-2 divide-y divide-line">
        {SWITCHES.map((item) => (
          <li key={item.name} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px]">{item.label}</span>
              <span className="block text-[11px] text-muted">{item.hint}</span>
            </span>
            <input
              type="checkbox"
              name={item.name}
              defaultChecked={Boolean(settings[item.name])}
              className="h-5 w-5 shrink-0 accent-plate"
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Time name="digestAt" label="Ранкове зведення" value={settings.digestAt} />
        <Time name="quietFrom" label="Тиша з" value={settings.quietFrom} />
        <Time name="quietTo" label="Тиша до" value={settings.quietTo} />
      </div>

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

function Time({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <input
        type="time"
        name={name}
        defaultValue={value}
        className="mt-1 h-9 w-full rounded-card border border-line bg-card px-2 font-mono text-[13px] tabular-nums"
      />
    </label>
  )
}
