import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/db'
import { listings } from '@/db/schema'
import { getAuthor } from '@/lib/auth'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Клієнт поллить це раз на 1.5 с, поки status === 'pending' (SPEC, «Інгест»). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const author = await getAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Некоректний id' }, { status: 400 })

  const [listing] = await db
    .select({
      id: listings.id,
      status: listings.status,
      title: listings.title,
      priceUsd: listings.priceUsd,
      year: listings.year,
      mileageKm: listings.mileageKm,
      city: listings.city,
      photos: listings.photos,
      publishedAt: listings.publishedAt,
      parsedAt: listings.parsedAt,
      archivedAt: listings.archivedAt,
    })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1)

  if (!listing) return NextResponse.json({ error: 'Не знайдено' }, { status: 404 })

  return NextResponse.json(listing, { headers: { 'Cache-Control': 'no-store' } })
}
