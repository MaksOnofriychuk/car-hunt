/**
 * Фото на сторінці лежать десятком варіантів одного знімка:
 * `photosnew/auto/photo/{slug}__{id}{size}.{ext}`, де size — s | bx | fx | hd | fhd.
 * Для архіву беремо найбільший наявний, по одному на знімок.
 *
 * Це не дрібниця: у ld+json оголошення віддає лише частину фото (на перевіреній
 * сторінці 6 із 27), тому повний список збирається саме звідси.
 */

const PHOTO_URL = /https:\/\/cdn\d*\.riastatic\.com\/photosnew\/auto\/photo\/[^"'\\\s)]+/g
const PARTS = /\/photo\/([a-z0-9_]+)__(\d+)([a-z]*)\.(\w+)$/

/** Від найбільшого до найменшого. */
const SIZE_RANK = ['fhd', 'hd', 'fx', 'bx', 's', '']

export function extractPhotos(html: string): string[] {
  const best = new Map<string, { url: string; rank: number; order: number }>()
  let order = 0

  for (const url of html.match(PHOTO_URL) ?? []) {
    const parts = url.match(PARTS)
    if (!parts) continue

    const [, , id, size, ext] = parts
    // webp дає ту саму картинку меншим файлом; jpg лишаємо як запасний
    const rank = SIZE_RANK.indexOf(size) * 2 + (ext === 'webp' ? 0 : 1)
    if (rank < 0) continue

    const current = best.get(id)
    if (!current || rank < current.rank) {
      best.set(id, { url, rank, order: current?.order ?? order++ })
    }
  }

  return [...best.values()].sort((a, b) => a.order - b.order).map((photo) => photo.url)
}
