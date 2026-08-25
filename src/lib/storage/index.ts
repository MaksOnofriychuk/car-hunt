import { localStorage } from './local'
import { unavailableStorage } from './none'
import { createR2Storage, r2ConfigFromEnv } from './r2'
import type { FileStorage } from './types'

export * from './types'
export { StorageUnavailableError } from './none'

let cached: FileStorage | null = null

/**
 * STORAGE_DRIVER=auto|r2|local. `auto` бере R2, якщо задані ключі, інакше
 * локальну теку — тобто переїзд на R2 це одна змінна оточення, без правок коду
 * і без міграції даних: у базі лежать ключі, а не URL.
 *
 * Окремий випадок — Vercel без R2. Там файлова система тимчасова й лише для
 * читання, тому локальна тека не підходить: замість неї береться «сховища
 * немає». Застосунок працює далі, просто без копій фото — картки показують
 * оригінальні адреси з майданчика, а в налаштуваннях видно, що архіву немає.
 */
export function storage(): FileStorage {
  if (cached) return cached

  const driver = process.env.STORAGE_DRIVER ?? 'auto'
  const config = r2ConfigFromEnv()

  if (driver === 'r2') {
    if (!config) throw new Error('STORAGE_DRIVER=r2, але змінні R2_* не задані')
    cached = createR2Storage(config)
  } else if (driver === 'local') {
    // Явний вибір поважаємо навіть на Vercel: там теж є /tmp, і людина може
    // знати, що робить.
    cached = localStorage
  } else if (config) {
    cached = createR2Storage(config)
  } else if (process.env.VERCEL) {
    console.warn('[storage] R2 не налаштований — фото не зберігаються (див. docs/deploy.md)')
    cached = unavailableStorage
  } else {
    cached = localStorage
  }

  return cached
}
