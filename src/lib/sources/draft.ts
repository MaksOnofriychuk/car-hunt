import type { ListingSnapshot } from './types'

/**
 * Чернетка снапшота і правило шарів, спільне для всіх джерел: наступний шар
 * лише **доповнює** порожні поля і ніколи не затирає знайдене раніше.
 */

export type Draft = Omit<ListingSnapshot, 'raw' | 'html'>

export function fillGaps(target: Draft, extra: Draft): Draft {
  const merged: Draft = { ...target }
  for (const [key, value] of Object.entries(extra) as [keyof Draft, unknown][]) {
    const current = merged[key]
    const missing =
      current === undefined || current === null || (Array.isArray(current) && current.length === 0)
    if (missing && value !== undefined && value !== null) {
      Object.assign(merged, { [key]: value })
    }
  }
  return merged
}
