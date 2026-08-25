import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from './index'
import { events, listings } from './schema'

import { storage } from '@/lib/storage'
import { TERMINAL_STAGES } from '@/lib/stages'

/**
 * Прибирання місця. Єдина операція, яка щось видаляє з даних, — тому вона
 * навмисно вузька.
 *
 * «Архів назавжди» зі SPEC лишається чинним: сторінка оголошення (`html_raw`),
 * опис, характеристики й уся стрічка подій не чіпаються. Прибираються тільки
 * копії фото — і тільки в тих авто, з якими вже все вирішено: прибрані з черги
 * і на етапі «купили» або «відпало». Оригінальні URL лишаються в `photos`,
 * тобто поки оголошення живе, фото ще видно.
 */
export async function removeArchivedPhotos(): Promise<number> {
  // Етап живе всередині payload, тому порівнюємо саме поле, а не весь обʼєкт:
  // у ньому можуть зʼявитись інші ключі, і рівність обʼєктів зламалась би.
  const finished = await db
    .selectDistinct({ listingId: events.listingId })
    .from(events)
    .where(
      and(
        eq(events.type, 'stage_change'),
        sql`${events.payload} ->> 'stage' in ${TERMINAL_STAGES}`,
      ),
    )

  const ids = finished.map((row) => row.listingId)
  if (ids.length === 0) return 0

  const rows = await db
    .select({ id: listings.id, keys: listings.photosLocal })
    .from(listings)
    .where(and(eq(listings.archived, true), inArray(listings.id, ids)))

  const files = storage()
  let removed = 0

  for (const row of rows) {
    if (row.keys.length === 0) continue

    for (const key of row.keys) {
      await files.remove(key)
      removed += 1
    }
    // Архів знову неповний — і це чесно: фото ми прибрали свідомо.
    await db
      .update(listings)
      .set({ photosLocal: [], archivedAt: null })
      .where(eq(listings.id, row.id))
  }

  return removed
}
