import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { assertSafeKey, type FileStorage } from './types'

/**
 * Тека /storage у корені проєкту. Лежить поза public/, тому роздається
 * роутом /api/files/[...key] — тобто під автентифікацією, як і все інше.
 */
const ROOT = resolve(process.cwd(), 'storage')

function pathFor(key: string): string {
  assertSafeKey(key)
  const full = join(ROOT, key)
  if (!full.startsWith(ROOT)) throw new Error(`Ключ виводить за межі сховища: ${key}`)
  return full
}

export const localStorage: FileStorage = {
  name: 'local',

  async put(key, body) {
    const path = pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
  },

  async get(key) {
    try {
      return await readFile(pathFor(key))
    } catch {
      return null
    }
  },

  async exists(key) {
    try {
      await stat(pathFor(key))
      return true
    } catch {
      return false
    }
  },

  async remove(key) {
    await rm(pathFor(key), { force: true })
  },

  url(key) {
    assertSafeKey(key)
    return `/api/files/${key.split('/').map(encodeURIComponent).join('/')}`
  },

  async usage() {
    return walk(ROOT)
  },
}

/** Обхід теки сховища. Файлів тут тисячі, не мільйони, тому просто рахуємо. */
async function walk(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0
  let bytes = 0

  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return { files, bytes }
  }

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      const inner = await walk(path)
      files += inner.files
      bytes += inner.bytes
    } else {
      const info = await stat(path)
      files += 1
      bytes += info.size
    }
  }

  return { files, bytes }
}
