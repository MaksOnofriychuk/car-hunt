import { localStorage } from './local'
import { createR2Storage, r2ConfigFromEnv } from './r2'
import type { FileStorage } from './types'

export * from './types'

let cached: FileStorage | null = null

/**
 * STORAGE_DRIVER=auto|r2|local. `auto` бере R2, якщо задані ключі, інакше
 * локальну теку — тобто переїзд на R2 це одна змінна оточення, без правок коду
 * і без міграції даних: у базі лежать ключі, а не URL.
 */
export function storage(): FileStorage {
  if (cached) return cached

  const driver = process.env.STORAGE_DRIVER ?? 'auto'
  const config = r2ConfigFromEnv()

  if (driver === 'r2') {
    if (!config) throw new Error('STORAGE_DRIVER=r2, але змінні R2_* не задані')
    cached = createR2Storage(config)
  } else if (driver === 'local') {
    cached = localStorage
  } else {
    cached = config ? createR2Storage(config) : localStorage
  }

  return cached
}
