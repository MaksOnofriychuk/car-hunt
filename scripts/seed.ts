import './load-env'

import { inArray } from 'drizzle-orm'

import { client, db } from '../src/db'
import { getStages } from '../src/db/stage'
import { events, listings, priceHistory, sellers } from '../src/db/schema'
import { STAGE_LABELS } from '../src/lib/stages'

/**
 * Три тестові авто, щоб дивитись інтерфейс без парсера.
 * id фіксовані → сідер можна ганяти скільки завгодно, він щоразу перестворює саме ці рядки
 * і не чіпає справжні дані.
 */

const SELLER_IGOR = '11111111-1111-4111-8111-111111111111'
const SELLER_DEALER = '11111111-1111-4111-8111-222222222222'

const LISTING_PASSAT = '22222222-2222-4222-8222-111111111111'
const LISTING_OCTAVIA = '22222222-2222-4222-8222-222222222222'
const LISTING_MEGANE = '22222222-2222-4222-8222-333333333333'

const SEED_SELLER_IDS = [SELLER_IGOR, SELLER_DEALER]
const SEED_LISTING_IDS = [LISTING_PASSAT, LISTING_OCTAVIA, LISTING_MEGANE]

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

/** Час N днів тому. */
const daysAgo = (n: number) => new Date(NOW - n * DAY)
/** Трохи раніше, ніж N днів тому — щоб події одного дня мали чіткий порядок. */
const justBefore = (n: number) => new Date(NOW - n * DAY - 10 * 60_000)
/** Дата (без часу) через N днів, у локальній зоні — для next_contact_at. */
const inDays = (n: number) => {
  const d = new Date(NOW + n * DAY)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const photo = (seed: string, n: number) =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${seed}${i}/800/600`)

async function main() {
  console.log('Чищу попередні сідерські дані…')
  // events і price_history підуть каскадом разом з listings
  await db.delete(listings).where(inArray(listings.id, SEED_LISTING_IDS))
  await db.delete(sellers).where(inArray(sellers.id, SEED_SELLER_IDS))

  await db.insert(sellers).values([
    {
      id: SELLER_IGOR,
      name: 'Ігор',
      phones: ['+380671234567'],
      type: 'owner',
      notes: 'Перший власник, обслуговував у Львові. Каже, торг мінімальний.',
      createdAt: daysAgo(6),
    },
    {
      id: SELLER_DEALER,
      name: 'Автосалон «Дніпро-Авто»',
      phones: ['+380503334455', '+380973334455'],
      type: 'showroom',
      notes: 'Майданчик. Ціна з наваром, авто пригнане з Польщі.',
      createdAt: daysAgo(4),
    },
  ])

  await db.insert(listings).values([
    {
      id: LISTING_PASSAT,
      source: 'autoria',
      sourceId: '38123456',
      url: 'https://auto.ria.com/uk/auto_volkswagen_passat_38123456.html',
      status: 'active',
      sellerId: SELLER_IGOR,
      snapshotRaw: { source: 'seed' },
      title: 'Volkswagen Passat B7 2.0 TDI',
      brand: 'Volkswagen',
      model: 'Passat',
      year: 2012,
      mileageKm: 218_000,
      priceUsd: 9800,
      city: 'Львів',
      publishedAt: daysAgo(45),
      photos: photo('passat', 3),
      targetPriceUsd: 9000,
      nextContactAt: inDays(0), // сьогодні
      parsedAt: daysAgo(0),
      parserVersion: 1,
      createdBy: 'me',
      createdAt: daysAgo(6),
    },
    {
      id: LISTING_OCTAVIA,
      source: 'autoria',
      sourceId: '38891234',
      url: 'https://auto.ria.com/uk/auto_skoda_octavia_38891234.html',
      status: 'active',
      sellerId: SELLER_DEALER,
      snapshotRaw: { source: 'seed' },
      title: 'Skoda Octavia A7 1.6 TDI',
      brand: 'Skoda',
      model: 'Octavia',
      year: 2015,
      mileageKm: 265_000,
      priceUsd: 11_500,
      city: 'Київ',
      publishedAt: daysAgo(12),
      photos: photo('octavia', 2),
      targetPriceUsd: 10_500,
      nextContactAt: inDays(-2), // прострочено
      parsedAt: daysAgo(0),
      parserVersion: 1,
      createdBy: 'dad',
      createdAt: daysAgo(4),
    },
    {
      id: LISTING_MEGANE,
      source: 'autoria',
      sourceId: '37556677',
      url: 'https://auto.ria.com/uk/auto_renault_megane_37556677.html',
      status: 'active',
      sellerId: null, // продавця ще не заводили — так буває одразу після інгесту
      snapshotRaw: { source: 'seed' },
      title: 'Renault Megane III 1.5 dCi',
      brand: 'Renault',
      model: 'Megane',
      year: 2013,
      mileageKm: 198_000,
      priceUsd: 7300,
      city: 'Вінниця',
      publishedAt: daysAgo(3),
      photos: photo('megane', 4),
      targetPriceUsd: null,
      nextContactAt: inDays(3),
      parsedAt: daysAgo(0),
      parserVersion: 1,
      createdBy: 'me',
      createdAt: daysAgo(1),
    },
  ])

  await db.insert(events).values([
    // Passat: дійшли до пропозиції
    {
      listingId: LISTING_PASSAT,
      author: 'me',
      type: 'stage_change',
      payload: { stage: 'new' },
      createdAt: daysAgo(6),
    },
    {
      listingId: LISTING_PASSAT,
      author: 'me',
      type: 'call',
      payload: { text: 'Взяв слухавку, авто в наявності', outcome: 'reached' },
      createdAt: justBefore(5),
    },
    {
      listingId: LISTING_PASSAT,
      author: 'me',
      type: 'stage_change',
      payload: { stage: 'contacted' },
      createdAt: daysAgo(5),
    },
    {
      listingId: LISTING_PASSAT,
      author: 'dad',
      type: 'comment',
      payload: { text: 'Пробіг як на 2012 рік завеликий, але салон цілий. Треба дивитись ланцюг.' },
      createdAt: daysAgo(3),
    },
    {
      listingId: LISTING_PASSAT,
      author: 'me',
      type: 'call',
      payload: { text: 'Запропонував 9000, думає', outcome: 'reached', offered_price: 9000 },
      createdAt: justBefore(1),
    },
    {
      listingId: LISTING_PASSAT,
      author: 'me',
      type: 'stage_change',
      payload: { stage: 'offer_made' },
      createdAt: daysAgo(1),
    },

    // Octavia: тільки закинули і подивились, ціна впала
    {
      listingId: LISTING_OCTAVIA,
      author: 'dad',
      type: 'stage_change',
      payload: { stage: 'new' },
      createdAt: justBefore(4),
    },
    {
      listingId: LISTING_OCTAVIA,
      author: 'dad',
      type: 'comment',
      payload: { text: 'Салон, значить будуть впирати на «кредит і гарантію». Дзвонити після обіду.' },
      createdAt: daysAgo(4),
    },
    {
      listingId: LISTING_OCTAVIA,
      author: 'me',
      type: 'price_change',
      payload: { old_price: 12_200, new_price: 11_500 },
      createdAt: daysAgo(2),
    },

    // Megane: свіже, не додзвонились
    {
      listingId: LISTING_MEGANE,
      author: 'me',
      type: 'stage_change',
      payload: { stage: 'new' },
      createdAt: justBefore(1),
    },
    {
      listingId: LISTING_MEGANE,
      author: 'me',
      type: 'call',
      payload: { text: 'Не бере слухавку', outcome: 'no_answer' },
      createdAt: daysAgo(1),
    },
  ])

  await db.insert(priceHistory).values([
    { listingId: LISTING_PASSAT, priceUsd: 9800, seenAt: daysAgo(6) },
    { listingId: LISTING_OCTAVIA, priceUsd: 12_200, seenAt: daysAgo(4) },
    { listingId: LISTING_OCTAVIA, priceUsd: 11_500, seenAt: daysAgo(2) },
    { listingId: LISTING_MEGANE, priceUsd: 7300, seenAt: daysAgo(1) },
  ])

  const stages = await getStages(SEED_LISTING_IDS)
  console.log('\nГотово. 2 продавці, 3 авто, 11 подій, 4 точки цін.')
  for (const row of await db.select().from(listings).where(inArray(listings.id, SEED_LISTING_IDS))) {
    const stage = stages.get(row.id)!
    console.log(`  ${row.title} — $${row.priceUsd} — ${STAGE_LABELS[stage]} — дзвонити ${row.nextContactAt}`)
  }
}

main()
  .catch((error) => {
    console.error('Сідер упав:', error)
    process.exitCode = 1
  })
  .finally(() => client.end())
