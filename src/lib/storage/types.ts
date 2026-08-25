/** Сховище файлів — SPEC, «Сховище файлів». Дві реалізації, один інтерфейс. */
export interface FileStorage {
  readonly name: 'r2' | 'local'
  put(key: string, body: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Buffer | null>
  exists(key: string): Promise<boolean>
  /** Адреса для показу. Ключі в базі лишаються ключами — URL збирається тут. */
  url(key: string): string
}

export function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase()
  const types: Record<string, string> = {
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    avif: 'image/avif',
  }
  return types[ext] ?? 'application/octet-stream'
}

/** Ключ не має вилазити за межі сховища. */
export function assertSafeKey(key: string): void {
  if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\')) {
    throw new Error(`Небезпечний ключ у сховищі: ${key}`)
  }
}
