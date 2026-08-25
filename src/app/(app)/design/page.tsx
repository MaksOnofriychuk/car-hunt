import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { ListingCard } from '@/components/ListingCard'
import { getListings, type ListingRow } from '@/db/list'
import { getSettings } from '@/db/settings'
import { requireSession } from '@/lib/auth'
import { todayInKyiv } from '@/lib/dates'
import { DEFAULT_QUERY } from '@/lib/list-query'
import { LOOK_COOKIE, parseLook } from '@/lib/look'
import { userNames } from '@/lib/users'

export const metadata = { title: 'Стенд' }

/**
 * Стенд візуальної системи. Живе тільки в розробці: показує всі стани картки і
 * типографіку на **реальних** рядках із бази — на макетних даних не видно ні
 * довгих назв, ні шестизначних пробігів.
 *
 * Дані тільки читаються: стани підмінюються копією рядка в памʼяті, у базу
 * нічого не пишеться.
 */
export default async function DesignPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const { author } = await requireSession()
  const [settings, jar] = await Promise.all([getSettings(author), cookies()])
  const look = parseLook(jar.get(LOOK_COOKIE)?.value)
  const today = todayInKyiv()
  const names = userNames()

  const { rows } = await getListings({ ...DEFAULT_QUERY, per: 'all' })
  if (rows.length === 0) return <p className="t-body">У базі порожньо — стенд нема на чому малювати.</p>

  const display = { currency: settings.currency, longStandingDays: settings.longStandingDays }
  const props = { today, viewer: author, names, search: '', display, density: look.density }

  // Беремо найдовшу назву — саме на ній верстка ламається першою.
  const longest = [...rows].sort(
    (a, b) => (b.listing.title?.length ?? 0) - (a.listing.title?.length ?? 0),
  )[0]
  const parsed = rows.find((row) => row.listing.status === 'active') ?? longest

  const yesterday = shift(today, -3)
  const tomorrow = shift(today, 1)

  const cases: { label: string; row: ListingRow; variant?: 'full' | 'compact' }[] = [
    { label: 'Звичайна · етап «торгуємось»', row: patch(parsed, { nextContactAt: tomorrow }, 'negotiating') },
    { label: 'Прострочена', row: patch(parsed, { nextContactAt: yesterday }) },
    { label: 'Куплено', row: patch(longest, { nextContactAt: null }, 'won') },
    { label: 'Знято з продажу', row: patch(parsed, { status: 'removed' }) },
    { label: 'Не актуально — згорнута в рядок', row: patch(parsed, {}, 'lost') },
    { label: 'Pending — поля наливаються', row: patch(parsed, { status: 'pending' }) },
    { label: 'Failed — не розпізналось', row: patch(parsed, { status: 'failed' }) },
    { label: 'Компактний рядок', row: patch(parsed, { nextContactAt: tomorrow }), variant: 'compact' },
  ]

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      <h1 className="t-title">Стенд · стани картки</h1>

      {cases.map((item) => (
        <section key={item.label} className="space-y-1.5">
          <h2 className="t-micro text-faint">{item.label}</h2>
          <ListingCard {...props} row={item.row} variant={item.variant} />
        </section>
      ))}

      <section className="space-y-1.5">
        <h2 className="t-micro text-faint">Типографіка</h2>
        <div className="surface space-y-3 p-3">
          <p className="t-display">$9 800</p>
          <p className="t-title">Volkswagen Passat B7 2.0 TDI</p>
          <p className="t-body">Готовий на 9 200, але тягне час — хоче до вихідних.</p>
          <p className="t-micro text-faint">днів в оголошенні · наступний контакт · ціль</p>
        </div>
      </section>
    </div>
  )
}

/** Копія рядка з підміненими полями — щоб побачити стан, якого зараз немає в базі. */
function patch(
  row: ListingRow,
  fields: Partial<ListingRow['listing']>,
  stage?: ListingRow['stage'],
): ListingRow {
  return { ...row, stage: stage ?? row.stage, listing: { ...row.listing, ...fields } }
}

function shift(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
