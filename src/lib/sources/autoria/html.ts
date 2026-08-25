import { politeFetch } from '../http'
import { ListingGoneError } from '../types'

/** Сторінка оголошення як текст. 404/410 означає, що оголошення зняли. */
export async function fetchListingPage(url: string): Promise<string> {
  const response = await politeFetch(url, { source: 'autoria', kind: 'page' })

  if (response.status === 404 || response.status === 410) {
    throw new ListingGoneError('autoria', url)
  }
  if (!response.ok) {
    throw new Error(`AUTO.RIA віддав ${response.status} на ${url}`)
  }

  return response.text()
}
