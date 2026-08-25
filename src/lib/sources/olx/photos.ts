import type { JsonRecord } from './state'

/**
 * Фото беремо тільки зі стану оголошення (`ad.photos`) — там рівно його знімки.
 * Блок «схожі оголошення» OLX довантажує вже в браузері, але покладатись на це
 * не варто: на AUTO.RIA саме регулярка по документу натягала чужі машини.
 *
 * Розмір лишаємо той, який дає OLX (`;s=1000x750` і подібні): CDN приймає
 * будь-який бокс, але більший розмір — це втричі більше місця на знімок без
 * помітної користі на телефоні.
 */

const FILE_TOKEN = /\/files\/([\w-]+)/

export function extractPhotos(ad: JsonRecord | null, ldJsonImages: unknown): string[] {
  const fromAd = urls(ad?.photos)
  return fromAd.length > 0 ? fromAd : urls(ldJsonImages)
}

/** Один знімок може повторитись у різних розмірах — лишаємо перший. */
function urls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const byToken = new Map<string, string>()
  for (const item of raw) {
    if (typeof item !== 'string' || !item.startsWith('http')) continue
    const token = item.match(FILE_TOKEN)?.[1] ?? item
    if (!byToken.has(token)) byToken.set(token, item)
  }
  return [...byToken.values()]
}
