import Link from 'next/link'

import { getSellerRows, type SellersSort } from '@/db/sellers-view'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { cars, formatNumber, formatUsd } from '@/lib/format'
import { looksLikeDealer, SELLER_TYPE_LABELS } from '@/lib/sellers'

export const metadata = { title: 'Продавці — Car Hunt' }

/**
 * Продавці з цифрами. Питання, на яке має відповідати цей екран, одне: що це за
 * людина і чи варто з нею говорити. Тому тут не просто імена, а скільки авто
 * зараз продає, за скільки, як часто знижує ціни і коли ми говорили востаннє.
 */
export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  await requireSession()
  const { sort } = await searchParams
  const order: SellersSort = sort === 'contact' ? 'contact' : 'cars'
  const rows = await getSellerRows(order)

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-[19px] font-semibold leading-tight">Продавці</h1>
        <span className="font-mono text-[14px] tabular-nums text-muted">{rows.length}</span>

        <div className="ml-auto flex items-center gap-3">
          <SortLink active={order === 'cars'} href="/sellers">
            за авто
          </SortLink>
          <SortLink active={order === 'contact'} href="/sellers?sort=contact">
            за контактом
          </SortLink>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-card p-4 text-[14px] text-muted">
          Продавців ще немає. Вони зʼявляться самі, коли розпарситься перше оголошення.
        </p>
      ) : null}

      {rows.map((row) => {
        const dealer = looksLikeDealer(row)
        return (
          <Link
            key={row.seller.id}
            href={`/sellers/${row.seller.id}`}
            className="block rounded-card border border-line bg-card p-3"
          >
            <div className="flex items-baseline gap-2">
              <h2 className="min-w-0 truncate text-[16px] font-semibold">
                {row.seller.name ?? 'Без імені'}
              </h2>
              {dealer ? (
                <span className="shrink-0 rounded-card border border-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                  схоже на перекупа
                </span>
              ) : null}
              <span className="ml-auto shrink-0 font-mono text-[13px] tabular-nums text-muted">
                {row.active}/{row.total} {cars(row.total)}
              </span>
            </div>

            <p className="mt-1 text-[12px] text-muted">
              {SELLER_TYPE_LABELS[row.seller.type]}
              {row.avgPrice ? ` · середня ${formatUsd(row.avgPrice)}` : null}
              {row.drops > 0 ? ` · знижував ${formatNumber(row.drops)}×` : null}
              {row.lastContact ? ` · говорили ${formatDate(row.lastContact)}` : ' · ще не говорили'}
            </p>

            {row.seller.phones.length > 0 ? (
              <p className="mt-1 font-mono text-[12px] tabular-nums text-muted">
                {row.seller.phones.join(' · ')}
              </p>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}

function SortLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={cn('text-[12px]', active ? 'font-semibold' : 'text-muted')}>
      {children}
    </Link>
  )
}
