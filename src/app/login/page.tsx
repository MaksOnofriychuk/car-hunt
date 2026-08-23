import { headers } from 'next/headers'

import { PlateStrip } from '@/components/PlateStrip'
import { loginBlockFor } from '@/db/login-attempts'
import { clientIp } from '@/lib/request-ip'
import { userNames } from '@/lib/users'

import { LoginForm } from './LoginForm'

export const metadata = { title: 'Вхід — Car Hunt' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const block = await loginBlockFor(clientIp(await headers()))

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <PlateStrip label="CAR HUNT" size="lg" />
        <p className="mt-3 text-[13px] text-muted">Трекер пошуку авто. Нас тут двоє.</p>
      </div>

      {block.blocked ? (
        <p className="border-l-[3px] border-signal bg-white p-3 text-[14px]">
          Забагато спроб входу. Спробуй за{' '}
          <span className="font-mono tabular-nums">{Math.ceil(block.retryAfterSeconds / 60)}</span> хв.
        </p>
      ) : (
        <LoginForm names={userNames()} next={next} />
      )}
    </main>
  )
}
