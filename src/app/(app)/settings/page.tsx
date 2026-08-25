import { cookies } from 'next/headers'

import { DataSettings } from '@/components/DataSettings'
import { LookSettings } from '@/components/LookSettings'
import { NotifySettings } from '@/components/NotifySettings'
import { WorkSettings } from '@/components/WorkSettings'
import { getSettings } from '@/db/settings'
import { requireSession } from '@/lib/auth'
import { LOOK_COOKIE, parseLook } from '@/lib/look'
import { storage } from '@/lib/storage'

export const metadata = { title: 'Налаштування' }

/**
 * Налаштування. Окрема сторінка, а не спливне вікно: на телефоні модалка з
 * чотирма розділами — це прокрутка всередині прокрутки.
 *
 * Розділено за тим, де воно живе: вигляд — у cookie на цьому пристрої, робота
 * і сповіщення — у базі на користувача.
 */
export default async function SettingsPage() {
  const { author, name } = await requireSession()

  const [jar, settings, usage] = await Promise.all([
    cookies(),
    getSettings(author),
    storage().usage(),
  ])

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      <div className="flex items-baseline gap-2">
        <h1 className="t-title">Налаштування</h1>
        <span className="t-micro text-faint">{name}</span>
      </div>

      <LookSettings look={parseLook(jar.get(LOOK_COOKIE)?.value)} />
      <WorkSettings settings={settings} />
      <NotifySettings settings={settings} />
      <DataSettings usage={usage} />
    </div>
  )
}
