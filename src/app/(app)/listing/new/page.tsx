import Link from 'next/link'

import { ListingForm, type ListingFormValues } from '@/components/ListingForm'
import { requireSession } from '@/lib/auth'

export const metadata = { title: 'Нове авто — Car Hunt' }

const EMPTY: ListingFormValues = {
  brand: '',
  model: '',
  year: '',
  mileageKm: '',
  priceUsd: '',
  city: '',
  publishedAt: '',
  url: '',
  descriptionText: '',
  sellerName: '',
  sellerPhone: '',
  sellerType: '',
}

/** Авто, яке ніде не висить: побачили в дворі, розповів знайомий, продають у групі. */
export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>
}) {
  await requireSession()
  const { url } = await searchParams

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      <Link
        href="/"
        className="inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        ← Черга
      </Link>

      <h1 className="text-[19px] font-semibold leading-tight">Нове авто</h1>

      <ListingForm values={{ ...EMPTY, url: url ?? '' }} photos={[]} />
    </div>
  )
}
