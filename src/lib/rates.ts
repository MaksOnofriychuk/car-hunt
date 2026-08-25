import { desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { exchangeRates } from '@/db/schema'
import { todayInKyiv } from '@/lib/dates'

/**
 * Курс долара. Потрібен для OLX: там ціни здебільшого в гривні, а `price_usd` —
 * головне поле картки, історії цін і цілі торгу.
 *
 * Курс кешується **в базі**, по одному рядку на день: на Vercel процес не живе
 * між запитами, тому памʼять кешем бути не може — вийшов би запит до НБУ на
 * кожен парсинг. Заразом лишається історія, за яким курсом рахували.
 *
 * Джерело — офіційний курс НБУ. Він на кілька відсотків нижчий за готівковий,
 * але це єдине безкоштовне джерело без ключів і реєстрацій. Щоб змінити
 * джерело, досить переписати `fetchRate`.
 */

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json'
const TIMEOUT_MS = 8000

/** Курс на сьогодні. `null` — не дістали нізвідки, конвертувати нічим. */
export async function usdUahRate(): Promise<number | null> {
  const today = todayInKyiv()

  const [cached] = await db
    .select()
    .from(exchangeRates)
    .where(eq(exchangeRates.date, today))
    .limit(1)
  if (cached) return cached.usdUah

  const fresh = await fetchRate()
  if (fresh) {
    await db
      .insert(exchangeRates)
      .values({ date: today, usdUah: fresh, source: 'nbu' })
      .onConflictDoNothing()
    return fresh
  }

  // НБУ не відповів — беремо найсвіжіший відомий курс. Вчорашній краще, ніж
  // порожня ціна: різниця в межах відсотка, а картка лишається придатною.
  const [last] = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.date))
    .limit(1)
  if (last) return last.usdUah

  return envRate()
}

/** Запасний курс на випадок першого запуску без інтернету до НБУ. */
function envRate(): number | null {
  const raw = process.env.USD_UAH_RATE?.replace(',', '.').trim()
  const parsed = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

async function fetchRate(): Promise<number | null> {
  try {
    const response = await fetch(NBU_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!response.ok) return null

    const data: unknown = await response.json()
    const first = Array.isArray(data) ? data[0] : null
    const rate = first && typeof first === 'object' ? (first as { rate?: unknown }).rate : null

    return typeof rate === 'number' && rate > 0 ? rate : null
  } catch {
    // Курс — не привід валити парсинг: повернемо null, розберуться вище.
    return null
  }
}

/** Гривні в долари за сьогоднішнім курсом. Округлення до цілих, як усі ціни. */
export async function uahToUsd(uah: number | null | undefined): Promise<number | null> {
  if (!uah) return null
  const rate = await usdUahRate()
  return rate ? Math.round(uah / rate) : null
}

/** Долари в гривні — для оголошень, виставлених у доларах. */
export async function usdToUah(usd: number | null | undefined): Promise<number | null> {
  if (!usd) return null
  const rate = await usdUahRate()
  return rate ? Math.round(usd * rate) : null
}

/**
 * Друга валюта за курсом. Майданчики дають щось одне: RIA — і долар, і гривню,
 * OLX — здебільшого лише гривню, а `price_usd` у нас головне поле картки.
 */
export async function bothPrices(snapshot: {
  priceUsd?: number | null
  priceUah?: number | null
  priceCurrency?: 'UAH' | 'USD'
}): Promise<{ priceUsd: number | null; priceUah: number | null }> {
  const priceUsd = snapshot.priceUsd ?? null
  const priceUah = snapshot.priceUah ?? null

  if (snapshot.priceCurrency === 'UAH' && priceUsd === null) {
    return { priceUsd: await uahToUsd(priceUah), priceUah }
  }
  if (snapshot.priceCurrency === 'USD' && priceUah === null) {
    return { priceUsd, priceUah: await usdToUah(priceUsd) }
  }
  return { priceUsd, priceUah }
}
