import { AppHeader } from '@/components/AppHeader'
import { requireSession } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireSession()

  return (
    <div className="min-h-dvh">
      <AppHeader name={name} />
      {/* Ширину обирає сторінка: черга в режимі таблиці широка, решта — вузька
          колонка на 560, як було. */}
      <main className="mx-auto w-full max-w-[1280px] px-3 pb-20 pt-3">{children}</main>
    </div>
  )
}
