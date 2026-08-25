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

type JsonRecord = Record<string, unknown>

/** Обхід SDUI-дерева: перший вузол, який підійшов під предикат. */
function findNode(state: unknown, match: (node: JsonRecord) => boolean): JsonRecord | null {
  const seen = new Set<unknown>()

  const walk = (node: unknown, depth: number): JsonRecord | null => {
    if (!node || typeof node !== 'object' || depth > 60 || seen.has(node)) return null
    seen.add(node)

    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walk(item, depth + 1)
        if (hit) return hit
      }
      return null
    }

    const record = node as JsonRecord
    if (match(record)) return record
    for (const value of Object.values(record)) {
      const hit = walk(value, depth + 1)
      if (hit) return hit
    }
    return null
  }

  return walk(state, 0)
}

function byId(state: unknown, id: string | RegExp): JsonRecord | null {
  const test = typeof id === 'string' ? (value: string) => value === id : (value: string) => id.test(value)
  return findNode(state, (node) => typeof node.id === 'string' && test(node.id))
}

/** Усі текстові вузли всередині одного шматка дерева, згори вниз. */
function textsIn(node: unknown, depth = 0, out: string[] = []): string[] {
  if (!node || typeof node !== 'object' || depth > 20) return out
  if (Array.isArray(node)) {
    for (const item of node) textsIn(item, depth + 1, out)
    return out
  }
  const record = node as JsonRecord
  if (record.type === 'Text' && typeof record.content === 'string') out.push(record.content)
  for (const value of Object.values(record)) textsIn(value, depth + 1, out)
  return out
}

/**
 * `actionData.data` приходить масивом пар `[["userId","17339823"], …]`,
 * а `actionData.params` — тим самим набором, але вже обʼєктом. Зливаємо обидва.
 */
function actionValues(node: JsonRecord | null): Record<string, string> {
  const values: Record<string, string> = {}
  const actionData = node?.actionData
  if (!actionData || typeof actionData !== 'object') return values

  const { data, params } = actionData as JsonRecord
  if (Array.isArray(data)) {
    for (const pair of data) {
      if (Array.isArray(pair) && typeof pair[0] === 'string' && pair[1] != null) {
        values[pair[0]] = String(pair[1])
      }
    }
  }
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    for (const [key, value] of Object.entries(params as JsonRecord)) {
      if (values[key] === undefined && (typeof value === 'string' || typeof value === 'number')) {
        values[key] = String(value)
      }
    }
  }
  return values
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
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
