import { createHash } from 'node:crypto'

import { fileUrl, getFile } from './api'

import { contentTypeFor, storage } from '@/lib/storage'

/**
 * Фото постів. Качаються через Bot API у найбільшому розмірі, який дає
 * Telegram: оголошення знімуть, канал зникне — копії лишаться.
 *
 * Ключ рахується з `file_unique_id`, а не з посилання: посилання `getFile`
 * одноразове й живе близько години, тому хеш від нього був би різним щоразу.
 * `file_unique_id` заразом не дає качати те саме фото вдруге, коли пост
 * передрукували в іншій групі.
 *
 * Ключі живуть **поза** простором `listings/`: прибирання фото завершених авто
 * (`removeArchivedPhotos`) ходить по `listings.photos_local` і знищило б архів
 * поста, який для telegram-картки і є єдиним архівом.
 */

export type PhotoRef = { fileId: string; fileUniqueId: string }

/** Бюджет часу, як в архіві оголошень: що не встигли — добере крон. */
const DEFAULT_BUDGET_MS = 20_000
const DOWNLOAD_TIMEOUT_MS = 15_000

export function postPhotoKey(chatId: string, photo: PhotoRef, filePath?: string): string {
  const chat = chatId.replace(/[^A-Za-z0-9_-]/g, '_')
  const unique = createHash('sha256').update(photo.fileUniqueId).digest('hex').slice(0, 12)
  const ext = filePath?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? 'jpg'

  return `telegram/${chat}/${unique}.${ext}`
}

export type SavedPhotos = { keys: string[]; complete: boolean }

export async function savePostPhotos(
  chatId: string,
  photos: PhotoRef[],
  budgetMs = DEFAULT_BUDGET_MS,
): Promise<SavedPhotos> {
  if (photos.length === 0) return { keys: [], complete: true }

  const files = storage()
  const deadline = Date.now() + budgetMs
  const keys: string[] = []

  for (const photo of photos) {
    if (Date.now() > deadline) break

    try {
      // Спершу дешева перевірка: те саме фото вже могло приїхати з іншим постом.
      const guess = postPhotoKey(chatId, photo)
      if (await files.exists(guess)) {
        keys.push(guess)
        continue
      }

      const file = await getFile(photo.fileId)
      if (!file.file_path) continue

      const key = postPhotoKey(chatId, photo, file.file_path)
      if (await files.exists(key)) {
        keys.push(key)
        continue
      }

      const response = await fetch(fileUrl(file.file_path), {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        cache: 'no-store',
      })
      if (!response.ok) continue

      const body = Buffer.from(await response.arrayBuffer())
      await files.put(key, body, response.headers.get('content-type') ?? contentTypeFor(key))
      keys.push(key)
    } catch (error) {
      // Файл понад 20 МБ Bot API не віддає взагалі — це не привід валити пост.
      console.warn('[telegram] фото не збереглось:', (error as Error).message)
    }
  }

  return { keys, complete: keys.length >= photos.length }
}
