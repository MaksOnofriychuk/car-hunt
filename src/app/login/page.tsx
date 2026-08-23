import { PlateStrip } from '@/components/PlateStrip'
import { userNames } from '@/lib/users'

import { LoginForm } from './LoginForm'

export const metadata = { title: 'Вхід — Car Hunt' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <PlateStrip label="CAR HUNT" size="lg" />
        <p className="mt-3 text-[13px] text-muted">Трекер пошуку авто. Нас тут двоє.</p>
      </div>

      <LoginForm names={userNames()} next={next} />
    </main>
  )
}
