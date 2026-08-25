import { eq } from 'drizzle-orm'

import { db } from './index'
import { userSettings, type Author } from './schema'

import {
  CURRENCIES,
  DEFAULT_SETTINGS,
  DEFAULT_SORTS,
  type Currency,
  type DefaultSort,
  type Settings,
} from '@/lib/settings'

/** Налаштування користувача. Рядка ще немає — віддаємо типові, не створюючи його. */
export async function getSettings(author: Author): Promise<Settings> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.author, author))
    .limit(1)

  if (!row) return DEFAULT_SETTINGS

  return {
    callFollowupDays: row.callFollowupDays,
    longStandingDays: row.longStandingDays,
    currency: CURRENCIES.includes(row.currency as Currency)
      ? (row.currency as Currency)
      : DEFAULT_SETTINGS.currency,
    defaultSort: DEFAULT_SORTS.includes(row.defaultSort as DefaultSort)
      ? (row.defaultSort as DefaultSort)
      : DEFAULT_SETTINGS.defaultSort,
    notifyNew: row.notifyNew,
    notifyComment: row.notifyComment,
    notifyPrice: row.notifyPrice,
    notifyStage: row.notifyStage,
    digestAt: row.digestAt,
    quietFrom: row.quietFrom,
    quietTo: row.quietTo,
  }
}

/** Зберегти частину налаштувань; рядок створюється при першому збереженні. */
export async function saveSettings(author: Author, patch: Partial<Settings>): Promise<void> {
  await db
    .insert(userSettings)
    .values({ author, ...DEFAULT_SETTINGS, ...patch })
    .onConflictDoUpdate({ target: userSettings.author, set: patch })
}
