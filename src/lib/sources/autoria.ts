import {
  SourceNotReadyError,
  findUrl,
  type ListingRef,
  type ListingSnapshot,
  type ListingSource,
} from './types'

const HOST = 'auto\\.ria\\.com'

/**
 * Числовий id оголошення AUTO.RIA. Приймає і голе посилання, і переслане
 * повідомлення, у якому посилання десь усередині, і хвости з UTM.
 */
export function extractAutoRiaId(input: string): string | null {
  const url = findUrl(input, HOST)
  if (!url) return null

  // ?auto_id=38123456 — трапляється в мобільних і партнерських посиланнях
  const param = url.searchParams.get('auto_id') ?? url.searchParams.get('autoId')
  if (param && /^\d{4,12}$/.test(param)) return param

  // /uk/auto_volkswagen_passat_38123456.html
  const path = url.pathname.match(/_(\d{4,12})\.html$/)
  if (path) return path[1]

  // /uk/newauto/.../38123456.html і просто /38123456
  const tail = url.pathname.match(/\/(\d{4,12})(?:\.html)?\/?$/)
  return tail ? tail[1] : null
}

export const autoRiaSource: ListingSource = {
  name: 'autoria',
  refreshable: true,

  canHandle(input) {
    return findUrl(input, HOST) !== null
  },

  extractRef(input) {
    const id = extractAutoRiaId(input)
    return id ? { source: 'autoria', id } : null
  },

  async fetch(): Promise<ListingSnapshot> {
    // Реалізація — крок «Інгест і парсер»: дві стратегії, api|html за PARSER_SOURCE.
    throw new SourceNotReadyError('autoria')
  },
}

export type { ListingRef }
