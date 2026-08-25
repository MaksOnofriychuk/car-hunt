import { actionValues, byId, clean, textsIn } from './sdui'

import type { SellerType } from '@/db/schema'

/**
 * Продавець на сторінці AUTO.RIA.
 *
 * Самого номера в HTML немає — сторінка показує лише маску `(066) XXX XX XX`,
 * а повний номер довантажується окремим запитом по кліку. Тому тут зберігаємо
 * все, чим продавця можна впізнати без номера: `userId` (стабільний між
 * оголошеннями) і маску з кодом оператора.
 */
export type AutoRiaSeller = {
  name: string | null
  /** id користувача на RIA. По ньому склеюються оголошення одного продавця. */
  userId: string | null
  /** id телефону всередині RIA; сам номер по ньому не дістати без окремого запиту. */
  phoneId: string | null
  /** «(066) XXX XX XX» — видно тільки код оператора. */
  phoneMasked: string | null
  /** Порожній рядок = приватна особа; заповнений = автосалон. */
  companyId: string | null
  /** Підпис RIA над іменем: «Продавець» / «Професійний продавець». */
  segment: string | null
  type: SellerType
}

export const EMPTY_SELLER: AutoRiaSeller = {
  name: null,
  userId: null,
  phoneId: null,
  phoneMasked: null,
  companyId: null,
  segment: null,
  type: 'unknown',
}

/**
 * Тип продавця. `companyId` заповнений — це автосалон; порожній, але RIA підписала
 * «Професійний продавець» — перекупник без компанії; звичайне «Продавець» — власник.
 */
function sellerType(companyId: string | null, segment: string | null): SellerType {
  if (companyId) return 'showroom'
  if (segment && /професійн/i.test(segment)) return 'dealer'
  if (segment && /продавець/i.test(segment)) return 'owner'
  return 'unknown'
}

export function extractSeller(state: unknown): AutoRiaSeller {
  if (!state) return { ...EMPTY_SELLER }

  // Кнопка «показати телефон» — єдине місце, де лежать одразу userId, phoneId,
  // companyId і повне імʼя. У блоці над нею імʼя буває скорочене.
  const phoneButton = byId(state, /^sellerInfoPhone\d+$/)
  const values = actionValues(phoneButton)

  const segment = clean(textsIn(byId(state, 'sellerInfoSegment'))[0])
  const shortName = clean(textsIn(byId(state, 'sellerInfoUserName'))[0])
  const phoneMasked = clean(textsIn(phoneButton).find((text) => /\d/.test(text)))

  const name = clean(values.userName) ?? shortName
  const companyId = clean(values.companyId)

  return {
    name,
    userId: clean(values.userId) ?? clean(values.ownerId),
    phoneId: clean(values.phoneId),
    phoneMasked,
    companyId,
    segment,
    type: sellerType(companyId, segment),
  }
}
