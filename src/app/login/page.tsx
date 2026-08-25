import { cookies, headers } from 'next/headers'

import { PlateStrip } from '@/components/PlateStrip'
import { loginBlockFor } from '@/db/login-attempts'
import { clientIp } from '@/lib/request-ip'
import { LAST_AUTHOR_COOKIE } from '@/lib/session'
import { isAuthor, userNames } from '@/lib/users'

import { LoginForm } from './LoginForm'

export const metadata = { title: 'Вхід' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const [block, jar] = await Promise.all([
    loginBlockFor(clientIp(await headers())),
    cookies(),
  ])

  // Хто заходив із цього пристрою минулого разу — форма підставить його сама.
  const remembered = jar.get(LAST_AUTHOR_COOKIE)?.value
  const lastAuthor = isAuthor(remembered) ? remembered : null

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <PlateStrip label="CAR HUNT" size="lg" />
        <p className="t-body mt-3 text-muted">Трекер пошуку авто. Нас тут двоє.</p>
      </div>

      {block.blocked ? (
        <p className="t-body surface rib border-l-danger p-3">
          Забагато спроб входу. Спробуй за{' '}
          <span className="t-num">{Math.ceil(block.retryAfterSeconds / 60)}</span> хв.
        </p>
      ) : (
        <LoginForm names={userNames()} next={next} lastAuthor={lastAuthor} />
      )}
    </main>
  )
}
