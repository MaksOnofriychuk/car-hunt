import { PrintButton } from '@/components/PrintButton'
import { getListings } from '@/db/list'
import { requireSession } from '@/lib/auth'
import { daysOnSale, formatDate, todayInKyiv } from '@/lib/dates'
import { contactLabel, formatKm, formatUsd } from '@/lib/format'
import { parseListQuery } from '@/lib/list-query'
import { STAGE_LABELS } from '@/lib/stages'

export const metadata = { title: 'Друк списку' }

/**
 * Список для друку і для PDF. Окремою сторінкою, а не кнопкою на черзі: тут
 * інша верстка — без кнопок, фільтрів і кольорових плашок, зате з полями під
 * нотатки на полях і підписом, коли й з якими фільтрами це роздруковано.
 *
 * PDF робить сам браузер («друк → зберегти як PDF»): бібліотека, яка малює PDF
 * на сервері, важить більше за весь застосунок і верстає гірше.
 */
export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireSession()
  const params = await searchParams
  const query = parseListQuery(params)
  const { rows, total } = await getListings({ ...query, per: 'all' })

  const today = todayInKyiv()

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4 print:max-w-none">
      <header className="flex items-baseline gap-3 print:mb-4">
        <h1 className="t-title">Список авто</h1>
        <span className="t-num text-[13px] text-faint">
          {total} шт · {formatDate(new Date())}
        </span>
        <div className="ml-auto print:hidden">
          <PrintButton />
        </div>
      </header>

      <table className="t-body w-full border-collapse">
        <thead>
          <tr className="border-b border-edge text-left">
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Авто</th>
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Ціна</th>
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Ціль</th>
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Пробіг</th>
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Місто</th>
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Днів</th>
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Етап</th>
            <th className="t-micro py-1.5 pr-2 text-left text-faint">Дзвонити</th>
            <th className="t-micro py-1.5 text-left text-faint">Нотатки</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ listing, stage }) => (
            <tr key={listing.id} className="border-b border-edge align-top">
              <td className="py-1.5 pr-2">
                {listing.title ?? 'Без назви'}
                {listing.year ? (
                  <span className="t-num ml-1 text-faint">{listing.year}</span>
                ) : null}
              </td>
              <td className="py-1.5 pr-2 t-num">{formatUsd(listing.priceUsd)}</td>
              <td className="py-1.5 pr-2 t-num">
                {formatUsd(listing.targetPriceUsd)}
              </td>
              <td className="py-1.5 pr-2 t-num">{formatKm(listing.mileageKm)}</td>
              <td className="py-1.5 pr-2">{listing.city ?? '—'}</td>
              <td className="py-1.5 pr-2 t-num">
                {daysOnSale(listing.publishedAt) ?? '—'}
              </td>
              <td className="py-1.5 pr-2">{STAGE_LABELS[stage]}</td>
              <td className="py-1.5 pr-2">{contactLabel(listing.nextContactAt, today).text}</td>
              {/* Порожня колонка навмисно: у роздруку є куди писати ручкою. */}
              <td className="w-[22%] border-l border-edge py-1.5" />
            </tr>
          ))}
        </tbody>
      </table>

      <p className="t-micro text-faint print:mt-4">
        Car Hunt · роздруковано {formatDate(new Date())}
      </p>
    </div>
  )
}
