import type { SourceName } from '@/db/schema'

/**
 * Підписи джерел. Повні — для фільтрів і сторінки авто, короткі — для рядка
 * упізнавання на картці: там «AUTO.RIA» зʼїдає місце, яке потрібне місту.
 */
export const SOURCE_LABELS: Record<SourceName, string> = {
  autoria: 'AUTO.RIA',
  olx: 'OLX',
  telegram: 'Telegram',
  manual: 'Руками',
}

export const SOURCE_SHORT: Record<SourceName, string> = {
  autoria: 'RIA',
  olx: 'OLX',
  telegram: 'TG',
  manual: 'руками',
}
