import { findUrl } from '../types'

export const AUTORIA_HOST = 'auto\\.ria\\.com'

/**
 * Числовий id оголошення AUTO.RIA. Приймає і голе посилання, і переслане
 * повідомлення, у якому посилання десь усередині, і хвости з UTM.
 */
export function extractAutoRiaId(input: string): string | null {
  const url = findUrl(input, AUTORIA_HOST)
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

/** Канонічна адреса сторінки оголошення за одним лише id. */
export function autoRiaUrl(id: string): string {
  return `https://auto.ria.com/uk/auto_${id}.html`
}
