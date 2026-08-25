import { PrintButton } from '@/components/PrintButton'
import { getListings } from '@/db/list'
import { requireSession } from '@/lib/auth'
import { daysOnSale, formatDate, todayInKyiv } from '@/lib/dates'
import { contactLabel, formatKm, formatUsd } from '@/lib/format'
import { parseListQuery } from '@/lib/list-query'
import { STAGE_LABELS } from '@/lib/stages'

export const metadata = { title: 'Друк списку — Car Hunt' }

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
        <h1 className="text-[19px] font-semibold">Список авто</h1>
        <span className="font-mono text-[13px] tabular-nums text-muted">
          {total} шт · {formatDate(new Date())}
        </span>
        <div className="ml-auto print:hidden">
          <PrintButton />
        </div>
      </header>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-1 pr-2 font-semibold">Авто</th>
            <th className="py-1 pr-2 font-semibold">Ціна</th>
            <th className="py-1 pr-2 font-semibold">Ціль</th>
            <th className="py-1 pr-2 font-semibold">Пробіг</th>
            <th className="py-1 pr-2 font-semibold">Місто</th>
            <th className="py-1 pr-2 font-semibold">Днів</th>
            <th className="py-1 pr-2 font-semibold">Етап</th>
            <th className="py-1 pr-2 font-semibold">Дзвонити</th>
            <th className="py-1 font-semibold">Нотатки</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ listing, stage }) => (
            <tr key={listing.id} className="border-b border-line align-top">
              <td className="py-1.5 pr-2">
                {listing.title ?? 'Без назви'}
                {listing.year ? (
                  <span className="ml-1 font-mono text-muted">{listing.year}</span>
                ) : null}
              </td>
              <td className="py-1.5 pr-2 font-mono tabular-nums">{formatUsd(listing.priceUsd)}</td>
              <td className="py-1.5 pr-2 font-mono tabular-nums">
                {formatUsd(listing.targetPriceUsd)}
              </td>
              <td className="py-1.5 pr-2 font-mono tabular-nums">{formatKm(listing.mileageKm)}</td>
              <td className="py-1.5 pr-2">{listing.city ?? '—'}</td>
              <td className="py-1.5 pr-2 font-mono tabular-nums">
                {daysOnSale(listing.publishedAt) ?? '—'}
              </td>
              <td className="py-1.5 pr-2">{STAGE_LABELS[stage]}</td>
              <td className="py-1.5 pr-2">{contactLabel(listing.nextContactAt, today).text}</td>
              {/* Порожня колонка навмисно: у роздруку є куди писати ручкою. */}
              <td className="w-[22%] border-l border-line py-1.5" />
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[11px] text-muted print:mt-4">
        Car Hunt · роздруковано {formatDate(new Date())}
      </p>
    </div>
  )
}
