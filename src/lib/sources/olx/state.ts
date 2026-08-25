/**
 * Стан застосунку зі сторінки OLX.
 *
 * `window.__PRERENDERED_STATE__` — це JSON **у вигляді рядкового літерала**,
 * тобто розбирати треба двічі: спершу сам літерал, потім те, що всередині.
 * У ньому лежить усе оголошення (`ad.ad`) — назва, опис, ціна, характеристики,
 * фото, продавець і точна дата публікації.
 */

export type JsonRecord = Record<string, unknown>

const MARKER = 'window.__PRERENDERED_STATE__'

export function prerenderedState(html: string): JsonRecord | null {
  const marker = html.indexOf(MARKER)
  if (marker < 0) return null

  const start = html.indexOf('"', marker + MARKER.length)
  if (start < 0) return null

  const literal = readStringLiteral(html, start)
  if (!literal) return null

  try {
    const inner: unknown = JSON.parse(literal)
    if (typeof inner !== 'string') return null

    const state: unknown = JSON.parse(inner)
    return state && typeof state === 'object' ? (state as JsonRecord) : null
  } catch {
    // Зіпсований стан не має валити парсинг: далі спрацюють запасні шари.
    return null
  }
}

/** Сам об'єкт оголошення. Решта стану — довідник категорій на 900 КБ, не наше. */
export function adFromState(state: JsonRecord | null): JsonRecord | null {
  const ad = state?.ad
  if (!ad || typeof ad !== 'object') return null

  const inner = (ad as JsonRecord).ad
  return inner && typeof inner === 'object' ? (inner as JsonRecord) : null
}

/**
 * Рядковий літерал від відкривної лапки до парної закривної. Через екранування
 * (`\"`, `\\`) шукати кінець простим `indexOf` не можна.
 */
function readStringLiteral(html: string, start: number): string | null {
  for (let i = start + 1; i < html.length; i += 1) {
    const char = html[i]
    if (char === '\\') {
      i += 1
      continue
    }
    if (char === '"') return html.slice(start, i + 1)
  }
  return null
}
