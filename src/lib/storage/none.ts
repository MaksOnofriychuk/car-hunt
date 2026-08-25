import { assertSafeKey, type FileStorage } from './types'

/**
 * Сховища немає.
 *
 * Так буває рівно в одному випадку: застосунок їде на Vercel, а ключі R2 не
 * задані. Локальна тека там не годиться — файлова система тимчасова й
 * доступна лише на читання, тож перший же `writeFile` упав би з EROFS, і то
 * посеред архівації.
 *
 * Замість падіння — чесна відмова: копії фото не робимо, картки показують
 * оригінальні адреси з майданчика, решта застосунку працює як була. Архів
 * лишається неповним, і це видно в налаштуваннях.
 */
export class StorageUnavailableError extends Error {
  constructor() {
    super('Сховище файлів не налаштоване: додай ключі R2 або запусти не на Vercel')
    this.name = 'StorageUnavailableError'
  }
}

export const unavailableStorage: FileStorage = {
  name: 'none',

  async put() {
    throw new StorageUnavailableError()
  },

  async get() {
    return null
  },

  async exists() {
    return false
  },

  async remove() {
    // Видаляти нічого — нічого й не збереглось.
  },

  url(key) {
    assertSafeKey(key)
    // Адреса лишається такою ж, як у локального сховища: роут просто віддасть
    // 404, і галерея впаде на оригінальні URL майданчика.
    return `/api/files/${key.split('/').map(encodeURIComponent).join('/')}`
  },

  async usage() {
    return null
  },
}
