import { findUrl } from '../types'

export const OLX_HOST = 'olx\\.ua'

/**
 * Id оголошення OLX. У посиланні він у хвості шляху: `...-IDwEfGh.html`.
 * Той самий id є і в параметрі `ad_id` — у пересланих посиланнях трапляється
 * і так, і так.
 */
export function extractOlxId(input: string): string | null {
  const url = findUrl(input, OLX_HOST)
  if (!url) return null

  const param = url.searchParams.get('ad_id')
  if (param && /^[A-Za-z0-9]{4,20}$/.test(param)) return param

  const path = url.pathname.match(/-ID([A-Za-z0-9]{4,20})\.html$/i)
  return path ? path[1] : null
}

/**
 * Посилання з самого id: слаг у шляху OLX не перевіряє і редіректить на
 * канонічну адресу. Потрібне лише як запасний варіант, коли в картці
 * невідомо чому порожній url.
 */
export function olxUrl(id: string): string {
  return `https://www.olx.ua/d/uk/obyavlenie/-ID${id}.html`
}
