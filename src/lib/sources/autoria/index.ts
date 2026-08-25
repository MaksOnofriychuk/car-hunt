import { autoRiaUrl, extractAutoRiaId, AUTORIA_HOST } from './url'
import { findUrl, type ListingSnapshot, type ListingSource } from '../types'

export { extractAutoRiaId, autoRiaUrl } from './url'

/**
 * Модуль лишається чистим: розбір посилання не тягне ні БД, ні cheerio.
 * Усе важке підключається динамічно всередині fetch() — інакше реєстр джерел
 * втратив би придатність для клієнта і для юніт-тестів.
 */

/** SPEC: перемикач стосується тільки цього джерела. Дефолт — html. */
function parserMode(): 'api' | 'html' {
  return process.env.PARSER_SOURCE === 'api' ? 'api' : 'html'
}

export const autoRiaSource: ListingSource = {
  name: 'autoria',
  refreshable: true,

  canHandle(input) {
    return findUrl(input, AUTORIA_HOST) !== null
  },

  extractRef(input) {
    const id = extractAutoRiaId(input)
    return id ? { source: 'autoria', id } : null
  },

  async fetch(url, ref): Promise<ListingSnapshot> {
    const [{ fetchListingPage }, { parseListingHtml }] = await Promise.all([
      import('./html'),
      import('./parse'),
    ])

    const pageUrl = url || autoRiaUrl(ref.id)

    // Сторінку тягнемо завжди, навіть у режимі api: у відповіді API немає ні
    // HTML для архіву, ні повного опису, ні всіх фото. Квоту це не витрачає.
    const html = await fetchListingPage(pageUrl)
    const fromPage = parseListingHtml(html)

    if (parserMode() === 'html') return fromPage

    // У режимі api його поля головніші, сторінка лишається джерелом архіву.
    const { fetchFromApi } = await import('./api')
    const fromApi = await fetchFromApi(ref.id)

    return {
      ...fromPage,
      ...Object.fromEntries(Object.entries(fromApi).filter(([, value]) => value != null)),
      raw: { parser: 'api', api: fromApi.raw, page: fromPage.raw },
      html,
    } as ListingSnapshot
  },
}
