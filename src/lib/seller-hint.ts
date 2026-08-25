import type { SellerType } from '@/db/schema'

/**
 * Те, що парсер дізнався про продавця і поклав у `snapshot_raw.seller`.
 * Повного номера там немає — AUTO.RIA віддає лише маску `(066) XXX XX XX`,
 * тому номер вводимо руками, а маска підказує, який саме шукати.
 */
export type SellerHint = {
  name: string | null
  type: SellerType | null
  userId: string | null
  phoneMasked: string | null
  phoneId: string | null
}

const EMPTY: SellerHint = {
  name: null,
  type: null,
  userId: null,
  phoneMasked: null,
  phoneId: null,
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function sellerHint(snapshotRaw: unknown): SellerHint {
  if (!snapshotRaw || typeof snapshotRaw !== 'object') return EMPTY
  const seller = (snapshotRaw as Record<string, unknown>).seller
  if (!seller || typeof seller !== 'object') return EMPTY

  const record = seller as Record<string, unknown>
  const type = str(record.type)

  return {
    name: str(record.name),
    type: (type as SellerType | null) ?? null,
    userId: str(record.userId),
    phoneMasked: str(record.phoneMasked),
    phoneId: str(record.phoneId),
  }
}
