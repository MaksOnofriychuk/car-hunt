import { extractOlxId, olxUrl, OLX_HOST } from './url'
import { findUrl, type ListingSnapshot, type ListingSource } from '../types'

export { extractOlxId, olxUrl } from './url'

/**
 * Модуль лишається чистим: розпізнавання посилання не тягне ні БД, ні cheerio.
 * Усе важке підключається динамічно всередині fetch() — так само, як в autoria.
 */

export const olxSource: ListingSource = {
  name: 'olx',
  refreshable: true,

  canHandle(input) {
    return findUrl(input, OLX_HOST) !== null
  },

  extractRef(input) {
    const id = extractOlxId(input)
    return id ? { source: 'olx', id } : null
  },

  async fetch(url, ref): Promise<ListingSnapshot> {
    const [{ fetchListingPage }, { parseListingOlx }] = await Promise.all([
      import('./page'),
      import('./parse'),
    ])

    const pageUrl = url || olxUrl(ref.id)
    const html = await fetchListingPage(pageUrl)

    return parseListingOlx(html, { url: pageUrl, expectId: ref.id })
  },
}
