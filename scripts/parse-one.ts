import './load-env'

import { eq, or } from 'drizzle-orm'

import { client, db } from '../src/db'
import { listings } from '../src/db/schema'
import { parseListing } from '../src/lib/ingest'

/**
 * Прогнати парсер по одному оголошенню — тим самим шляхом, яким ходить cron:
 * зі справжнім запитом на майданчик, записом у `price_history`, подією
 * `price_change` і сповіщенням у Telegram.
 *
 *   npm run parse -- 40252938                              за source_id
 *   npm run parse -- 89ec3313-c169-4f71-b30e-6b1cfc1a3f84  за id картки
 *
 * Потрібно рівно для двох речей: подивитись, що дістає парсер після правок, і
 * перевірити сповіщення про зміну ціни, не чекаючи, поки продавець її змінить.
 */

const key = process.argv[2]

if (!key) {
  console.error('Вкажи id картки або source_id: npm run parse -- 40252938')
  process.exit(1)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function main(): Promise<void> {
  const [listing] = await db
    .select()
    .from(listings)
    .where(UUID.test(key) ? eq(listings.id, key) : or(eq(listings.sourceId, key)))
    .limit(1)

  if (!listing) {
    console.error(`Не знайшов оголошення за «${key}»`)
    process.exit(1)
  }

  const before = listing.priceUsd
  console.log(`Парсю ${listing.title ?? listing.sourceId} (${listing.source}) — було $${before}`)

  await parseListing(listing.id)

  const [after] = await db
    .select({ price: listings.priceUsd, status: listings.status })
    .from(listings)
    .where(eq(listings.id, listing.id))
    .limit(1)

  console.log(`Стало $${after?.price} · статус ${after?.status}`)
  if (before !== null && after?.price != null && before !== after.price) {
    console.log('Ціна змінилась — подія записана, сповіщення пішло обом.')
  }

  await client.end()
}

main().catch(async (error: unknown) => {
  console.error('Парсер упав:', error)
  await client.end()
  process.exit(1)
})
