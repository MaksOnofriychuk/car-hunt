import { politeFetch } from '../http'
import { ListingGoneError, SourceBlockedError } from '../types'

/**
 * Сторінка оголошення як текст.
 *
 * `transport: 'tls12'` — вимушено: OLX за CloudFront, і той відхиляє відбиток
 * стандартного клієнта Node (403 навіть із браузерними заголовками). Наш
 * User-Agent при цьому лишається чесним, див. `sources/tls12.ts`.
 */
export async function fetchListingPage(url: string): Promise<string> {
  const response = await politeFetch(url, { source: 'olx', kind: 'page', transport: 'tls12' })

  if (response.status === 404 || response.status === 410) {
    throw new ListingGoneError('olx', url)
  }
  // 403 від CloudFront — це «не пустили», а не «оголошення зламане»:
  // картку в failed зводити не можна, вона має лишитись у черзі.
  if (response.status === 403 || response.status === 429) {
    throw new SourceBlockedError('olx', response.status)
  }
  if (!response.ok) {
    throw new Error(`OLX віддав ${response.status} на ${url}`)
  }

  return response.text()
}
