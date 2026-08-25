import { politeFetch } from '../http'
import { ListingGoneError } from '../types'
import type { ListingSnapshot } from '../types'

/**
 * Офіційне API. Витрачає квоту 30/год і 1000/міс, тому politeFetch рахує саме
 * ці запити. Ключа в проєкті поки немає — режим вмикається PARSER_SOURCE=api.
 */

const ENDPOINT = 'https://developers.ria.com/auto/info'

type ApiResponse = Record<string, unknown>

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''))
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function pick(source: ApiResponse, path: string[]): unknown {
  let current: unknown = source
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as ApiResponse)[key]
  }
  return current
}

export async function fetchFromApi(autoRiaId: string): Promise<Partial<ListingSnapshot>> {
  const apiKey = process.env.RIA_API_KEY
  if (!apiKey) throw new Error('RIA_API_KEY не заданий, а PARSER_SOURCE=api')

  const url = `${ENDPOINT}?api_key=${encodeURIComponent(apiKey)}&auto_id=${encodeURIComponent(autoRiaId)}`
  const response = await politeFetch(url, { source: 'autoria', kind: 'api', accept: 'application/json' })

  if (response.status === 404) throw new ListingGoneError('autoria', url)
  if (!response.ok) throw new Error(`developers.ria.com віддав ${response.status}`)

  const data = (await response.json()) as ApiResponse

  return {
    title: str(pick(data, ['title'])),
    brand: str(pick(data, ['markName'])) ?? str(pick(data, ['brand', 'name'])),
    model: str(pick(data, ['modelName'])) ?? str(pick(data, ['model', 'name'])),
    year: num(pick(data, ['autoData', 'year'])) ?? num(pick(data, ['year'])),
    mileageKm: num(pick(data, ['autoData', 'race'])),
    priceUsd: num(pick(data, ['USD'])) ?? num(pick(data, ['price'])),
    city: str(pick(data, ['stateData', 'name'])) ?? str(pick(data, ['cityName'])),
    descriptionText: str(pick(data, ['autoData', 'description'])),
    raw: data,
  }
}
