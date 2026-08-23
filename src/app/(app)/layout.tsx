import { AppHeader } from '@/components/AppHeader'
import { requireSession } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireSession()

  return (
    <div className="min-h-dvh">
      <AppHeader name={name} />
      <main className="mx-auto w-full max-w-[560px] px-3 pb-20 pt-3">{children}</main>
    </div>
  )
}
