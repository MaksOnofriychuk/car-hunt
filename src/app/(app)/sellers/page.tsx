import { getSellers } from '@/db/queries'
import { requireSession } from '@/lib/auth'
import { cars, formatNumber } from '@/lib/format'

export const metadata = { title: 'Продавці — Car Hunt' }

const SELLER_TYPES: Record<string, string> = {
  owner: 'Власник',
  dealer: 'Перекуп',
  showroom: 'Автосалон',
  unknown: 'Невідомо',
}

export default async function SellersPage() {
  await requireSession()
  const rows = await getSellers()

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-white p-4 text-[14px] text-muted">
        Продавців ще немає. Вони зʼявляться самі, коли розпарситься перше оголошення.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <h1 className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        Продавці <span className="font-mono tabular-nums">{rows.length}</span>
      </h1>

      {rows.map(({ seller, listingCount }) => (
        <article key={seller.id} className="rounded-card border border-line bg-white p-3">
          <div className="flex items-baseline gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-tight">
              {seller.name ?? 'Без імені'}
            </h2>
            <span className="shrink-0 text-[12px] text-muted">
              <span className="font-mono tabular-nums">{formatNumber(listingCount)}</span>{' '}
              {cars(listingCount)}
            </span>
          </div>

          <p className="mt-0.5 text-[12px] text-muted">{SELLER_TYPES[seller.type] ?? seller.type}</p>

          {seller.phones.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {seller.phones.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone}`}
                  className="inline-flex h-9 items-center rounded-card border border-ink px-2.5 font-mono text-[13px] tabular-nums"
                >
                  {phone}
                </a>
              ))}
            </div>
          ) : null}

          {seller.notes ? <p className="mt-2 text-[13px] leading-snug">{seller.notes}</p> : null}
        </article>
      ))}
    </div>
  )
}
