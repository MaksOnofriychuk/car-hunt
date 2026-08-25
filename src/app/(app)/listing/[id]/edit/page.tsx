import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ListingForm, type ListingFormValues } from '@/components/ListingForm'
import { getListingDetail } from '@/db/queries'
import { requireSession } from '@/lib/auth'
import { kyivIsoDay } from '@/lib/dates'
import { fileUrl } from '@/lib/photos'

export const metadata = { title: 'Редагування' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Та сама форма, що й для нового авто. Сюди веде і «Заповнити вручну» з картки,
 * яку парсер не подужав, і «Редагувати» зі звичайної: якщо майданчик показав
 * дурню, це має бути можливо виправити.
 */
export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  await requireSession()
  const detail = await getListingDetail(id)
  if (!detail) notFound()

  const { listing, seller } = detail

  const values: ListingFormValues = {
    brand: listing.brand ?? '',
    model: listing.model ?? '',
    year: listing.year?.toString() ?? '',
    mileageKm: listing.mileageKm?.toString() ?? '',
    priceUsd: listing.priceUsd?.toString() ?? '',
    city: listing.city ?? '',
    publishedAt: kyivIsoDay(listing.publishedAt),
    url: listing.url,
    descriptionText: listing.descriptionText ?? '',
    sellerName: seller?.name ?? '',
    sellerPhone: seller?.phones[0] ?? '',
    sellerType: seller?.type && seller.type !== 'unknown' ? seller.type : '',
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      <Link
        href={`/listing/${listing.id}`}
        className="inline-block t-micro text-faint"
      >
        ← Картка
      </Link>

      <h1 className="t-title">
        {listing.status === 'failed' ? 'Заповнити вручну' : 'Редагувати'}
      </h1>

      {listing.manualFields.length > 0 ? (
        <p className="t-body text-faint">
          Виправлене руками парсер більше не чіпає — зняти позначку можна на картці.
        </p>
      ) : null}

      <ListingForm
        listingId={listing.id}
        values={values}
        photos={listing.photosManual.map((key) => ({ key, url: fileUrl(key) }))}
      />
    </div>
  )
}
