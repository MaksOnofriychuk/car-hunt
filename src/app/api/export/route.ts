import { NextResponse } from 'next/server'

import { db } from '@/db'
import { events, listings, priceHistory, sellers } from '@/db/schema'
import { getAuthor } from '@/lib/auth'
import { todayInKyiv } from '@/lib/dates'

/**
 * Експорт усього. Два формати: JSON — щоб можна було відновитись або
 * перенести, CSV — щоб відкрити в таблиці й порахувати щось своє.
 *
 * `?full=1` додає в JSON збережені сторінки оголошень (`html_raw`). Без нього
 * файл у рази менший, з ним — це повна резервна копія разом з архівом.
 */

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<NextResponse> {
  const author = await getAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })

  const url = new URL(request.url)
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json'
  const full = url.searchParams.get('full') === '1'
  const day = todayInKyiv()

  const [cars, people, feed, prices] = await Promise.all([
    db.select().from(listings),
    db.select().from(sellers),
    db.select().from(events),
    db.select().from(priceHistory),
  ])

  if (format === 'csv') {
    const byId = new Map(people.map((person) => [person.id, person]))
    return csvResponse(cars, byId, day)
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    // Без `full` викидаємо збережені сторінки: вони важать більше за все інше
    // разом узяте, а для перегляду даних не потрібні.
    listings: full ? cars : cars.map((car) => ({ ...car, htmlRaw: null })),
    sellers: people,
    events: feed,
    priceHistory: prices,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="car-hunt-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

const COLUMNS = [
  'Назва',
  'Рік',
  'Пробіг',
  'Ціна $',
  'Ціна грн',
  'Ціль $',
  'Різниця $',
  'Місто',
  'Статус',
  'Джерело',
  'Продавець',
  'Телефон',
  'Опубліковано',
  'Коли дзвонити',
  'Посилання',
]

function csvResponse(
  cars: (typeof listings.$inferSelect)[],
  people: Map<string, typeof sellers.$inferSelect>,
  day: string,
): NextResponse {
  const rows = cars.map((car) => {
    const seller = car.sellerId ? people.get(car.sellerId) : undefined
    const diff = car.priceUsd !== null && car.targetPriceUsd !== null
      ? car.priceUsd - car.targetPriceUsd
      : null

    return [
      car.title,
      car.year,
      car.mileageKm,
      car.priceUsd,
      car.priceUah,
      car.targetPriceUsd,
      diff,
      car.city,
      car.status,
      car.source,
      seller?.name ?? null,
      seller?.phones.join(' ') ?? null,
      car.publishedAt ? car.publishedAt.toISOString().slice(0, 10) : null,
      car.nextContactAt,
      car.url,
    ]
  })

  // Крапка з комою і BOM — щоб Excel відкрив без танців із кодуванням.
  const body =
    '﻿' + [COLUMNS, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="car-hunt-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
