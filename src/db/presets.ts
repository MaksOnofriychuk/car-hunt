import { desc, eq } from 'drizzle-orm'

import { db } from './index'
import { filterPresets, type Author, type FilterPreset } from './schema'

/** Набори фільтрів, збережені руками. Вбудовані три живуть у `lib/presets.ts`. */

export async function listPresets(): Promise<FilterPreset[]> {
  return db.select().from(filterPresets).orderBy(desc(filterPresets.createdAt))
}

export async function createPreset(author: Author, name: string, query: string): Promise<void> {
  await db.insert(filterPresets).values({ author, name, query })
}

export async function removePreset(id: string): Promise<void> {
  await db.delete(filterPresets).where(eq(filterPresets.id, id))
}
