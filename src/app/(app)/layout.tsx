import { cookies } from 'next/headers'

import { AppHeader } from '@/components/AppHeader'
import { requireSession } from '@/lib/auth'
import { LOOK_COOKIE, parseLook } from '@/lib/look'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ name }, jar] = await Promise.all([requireSession(), cookies()])
  const look = parseLook(jar.get(LOOK_COOKIE)?.value)

  return (
    <div className="app-shell">
      <AppHeader name={name} look={look} />
      {/* Ширину обирає сторінка: черга в режимі таблиці широка, решта — вузька
          колонка на 560, як було. */}
      <main className="mx-auto w-full max-w-[1280px] px-3 pb-20 pt-3">{children}</main>
    </div>
  )
}
