import { eq } from 'drizzle-orm'

import { db } from './index'
import { listings } from './schema'

/**
 * Дрібні правки картки з екрана. Події сюди не пишуться — вони в `db/events.ts`.
 * Тут тільки поля, які людина міняє руками в один тап.
 */

export async function listingExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1)

  return row !== undefined
}

/** Наша цільова ціна. null — прибрали. */
export async function setTargetPrice(id: string, priceUsd: number | null): Promise<void> {
  await db.update(listings).set({ targetPriceUsd: priceUsd }).where(eq(listings.id, id))
}

/** Дата наступного дзвінка (YYYY-MM-DD) — ключове поле робочої черги. */
export async function setNextContactAt(id: string, date: string | null): Promise<void> {
  await db.update(listings).set({ nextContactAt: date }).where(eq(listings.id, id))
}

/**
 * Прибрати з робочої черги або повернути. Даних не чіпає: архівна картка
 * лишається повністю читабельною, просто не потрапляє на головний екран.
 */
export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.update(listings).set({ archived }).where(eq(listings.id, id))
}
