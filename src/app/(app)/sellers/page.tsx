import Link from 'next/link'

import { getSellerRows, type SellersSort } from '@/db/sellers-view'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { daysOnSale, formatDate } from '@/lib/dates'
import { cars, formatNumber, formatUsd } from '@/lib/format'
import { looksLikeDealer, SELLER_TYPE_LABELS } from '@/lib/sellers'

export const metadata = { title: 'Продавці' }

/** Скільки авто показувати в картці, перш ніж відправити на сторінку продавця. */
const CARS_SHOWN = 3

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
  const dealers = rows.filter((row) => looksLikeDealer(row)).length

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <div className="flex items-baseline gap-2">
        <h1 className="t-title">Продавці</h1>
        <span className="t-num text-[14px] text-faint">{rows.length}</span>

        {dealers > 0 ? (
          <span className="t-micro rounded-chip border border-warn px-1.5 py-1 text-warn">
            перекупи · {dealers}
          </span>
        ) : null}

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
        <p className="t-body surface p-4 text-muted">
          Продавців ще немає. Вони зʼявляться самі, коли розпарситься перше оголошення.
        </p>
      ) : null}

      {rows.map((row) => {
        const dealer = looksLikeDealer(row)
        return (
          <section
            key={row.seller.id}
            className="surface rib border-l-edge p-3 transition-colors duration-(--t-instant) hover:border-l-accent"
          >
            <Link href={`/sellers/${row.seller.id}`} className="block">
            <div className="flex items-center gap-2.5">
              {/* Плитка з ініціалом замість аватарки: фото продавця в нас немає
                  і не буде, а рядок без якоря читається гірше. */}
              <span className="t-num sunken flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-[15px] text-muted">
                {(row.seller.name?.trim()[0] ?? '—').toUpperCase()}
              </span>

              <h2 className="t-title min-w-0 flex-1 truncate text-[16px]">
                {row.seller.name ?? 'Без імені'}
              </h2>

              {dealer ? (
                <span className="t-micro shrink-0 rounded-chip border border-warn px-1.5 py-1 text-warn">
                  перекуп
                </span>
              ) : null}
              <span className="t-num shrink-0 text-[13px] text-faint">
                {row.active}/{row.total} {cars(row.total)}
              </span>
            </div>

            <p className="t-body mt-1.5 text-faint">
              {SELLER_TYPE_LABELS[row.seller.type]}
              {row.avgPrice ? ` · середня ${formatUsd(row.avgPrice)}` : null}
              {row.drops > 0 ? ` · знижував ${formatNumber(row.drops)}×` : null}
              {row.lastContact ? ` · говорили ${formatDate(row.lastContact)}` : ' · ще не говорили'}
            </p>

            {row.seller.phones.length > 0 ? (
                <p className="t-num mt-1 text-[12px] text-muted">
                  {row.seller.phones.join(' · ')}
                </p>
              ) : null}
            </Link>

            {row.seller.phones.length > 0 ? (
              <a
                href={`tel:${row.seller.phones[0]}`}
                className="btn tap mt-2 w-full"
                aria-label={`Подзвонити ${row.seller.name ?? 'продавцю'}`}
              >
                Подзвонити
              </a>
            ) : null}

            {/* Що саме людина продає — прямо в картці (аркуш 07): по трьох
                однакових «гаражних» оголошеннях перекуп видно без переходу. */}
            {row.cars.length > 0 ? (
              <ul className="mt-2 divide-y divide-edge border-t border-edge">
                {row.cars.slice(0, CARS_SHOWN).map((car) => (
                  <li key={car.id}>
                    <Link href={`/listing/${car.id}`} className="flex items-baseline gap-2 py-1.5">
                      <span
                        className={cn(
                          't-body min-w-0 flex-1 truncate',
                          car.removed && 'text-faint line-through decoration-1',
                        )}
                      >
                        {car.title ?? 'Без назви'}
                      </span>
                      <span
                        className={cn(
                          't-num shrink-0 text-[13px]',
                          car.removed && 'text-faint line-through decoration-1',
                        )}
                      >
                        {formatUsd(car.priceUsd)}
                      </span>
                      <span className="t-num w-9 shrink-0 text-right text-[12px] text-faint">
                        {car.removed ? 'знято' : `${daysOnSale(car.publishedAt) ?? '—'}д`}
                      </span>
                    </Link>
                  </li>
                ))}

                {row.cars.length > CARS_SHOWN ? (
                  <li className="pt-1.5">
                    <Link href={`/sellers/${row.seller.id}`} className="t-micro text-accent-lit">
                      Ще {row.cars.length - CARS_SHOWN} →
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </section>
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
    <Link
      href={href}
      className={cn('t-micro tap', active ? 'text-accent-lit' : 'text-faint hover:text-ink')}
    >
      {children}
    </Link>
  )
}
