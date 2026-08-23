import { and, desc, eq, inArray } from 'drizzle-orm'

import { db } from './index'
import { DEFAULT_STAGE, events, type Stage } from './schema'

import { isStage } from '@/lib/stages'

/**
 * Етапи для пачки авто одним запитом (DISTINCT ON — остання `stage_change` на кожне авто).
 * Для списків завжди бери це, а не currentStage() по кожному авто окремо.
 */
export async function getStages(listingIds: string[]): Promise<Map<string, Stage>> {
  const result = new Map<string, Stage>()
  if (listingIds.length === 0) return result

  const rows = await db
    .selectDistinctOn([events.listingId], {
      listingId: events.listingId,
      payload: events.payload,
    })
    .from(events)
    .where(and(eq(events.type, 'stage_change'), inArray(events.listingId, listingIds)))
    .orderBy(events.listingId, desc(events.createdAt))

  for (const id of listingIds) result.set(id, DEFAULT_STAGE)
  for (const row of rows) {
    if (isStage(row.payload?.stage)) result.set(row.listingId, row.payload.stage)
  }

  return result
}

/** Етап одного авто. */
export async function getStage(listingId: string): Promise<Stage> {
  const [row] = await db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.listingId, listingId), eq(events.type, 'stage_change')))
    .orderBy(desc(events.createdAt))
    .limit(1)

  return isStage(row?.payload?.stage) ? row.payload.stage : DEFAULT_STAGE
}
