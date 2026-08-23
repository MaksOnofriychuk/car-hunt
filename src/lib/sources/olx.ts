import {
  SourceNotReadyError,
  findUrl,
  type ListingSnapshot,
  type ListingSource,
} from './types'

const HOST = 'olx\\.ua'

/**
 * Id оголошення OLX. У посиланні він у хвості шляху: `...-IDwEfGh.html`.
 * Парсер самого оголошення ще не написаний — тут тільки розпізнавання.
 */
export function extractOlxId(input: string): string | null {
  const url = findUrl(input, HOST)
  if (!url) return null

  const param = url.searchParams.get('ad_id')
  if (param && /^[A-Za-z0-9]{4,20}$/.test(param)) return param

  const path = url.pathname.match(/-ID([A-Za-z0-9]{4,20})\.html$/i)
  return path ? path[1] : null
}

export const olxSource: ListingSource = {
  name: 'olx',
  refreshable: true,

  canHandle(input) {
    return findUrl(input, HOST) !== null
  },

  extractRef(input) {
    const id = extractOlxId(input)
    return id ? { source: 'olx', id } : null
  },

  async fetch(): Promise<ListingSnapshot> {
    throw new SourceNotReadyError('olx')
  },
}
