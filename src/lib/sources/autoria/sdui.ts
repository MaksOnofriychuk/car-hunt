/**
 * Сторінка AUTO.RIA — це SDUI: у `window.__PINIA__` лежить дерево шаблонів,
 * з якого Vue малює розмітку. Дерево стабільніше за HTML — у вузлів є `id`
 * («badgesVin», «descColorColor»), і саме по них тут усе й дістається.
 *
 * Головне: вузол оголошення видно окремо від блоків «інші пропозиції
 * продавця» і «схожі авто». Через це фото з чужих машин більше не долітають.
 */

export type JsonRecord = Record<string, unknown>

const MAX_DEPTH = 60

/** Обхід дерева: перший вузол, який підійшов під предикат. */
export function findNode(
  state: unknown,
  match: (node: JsonRecord) => boolean,
): JsonRecord | null {
  const seen = new Set<unknown>()

  const walk = (node: unknown, depth: number): JsonRecord | null => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node)) return null
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

/** Усі вузли, які підійшли під предикат, у порядку обходу. */
export function findAll(
  state: unknown,
  match: (node: JsonRecord) => boolean,
): JsonRecord[] {
  const hits: JsonRecord[] = []
  const seen = new Set<unknown>()

  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }

    const record = node as JsonRecord
    if (match(record)) hits.push(record)
    for (const value of Object.values(record)) walk(value, depth + 1)
  }

  walk(state, 0)
  return hits
}

/** Усі вузли з id за шаблоном: «mvsOptions0», «mvsOptions1», … */
export function allById(state: unknown, id: RegExp): JsonRecord[] {
  return findAll(state, (node) => typeof node.id === 'string' && id.test(node.id))
}

export function byId(state: unknown, id: string | RegExp): JsonRecord | null {
  const test =
    typeof id === 'string' ? (value: string) => value === id : (value: string) => id.test(value)
  return findNode(state, (node) => typeof node.id === 'string' && test(node.id))
}

/** Дочірні вузли: у шаблонів це `templates`, у списків — `elements`. */
export function children(node: JsonRecord): JsonRecord[] {
  const out: JsonRecord[] = []
  for (const key of ['templates', 'elements'] as const) {
    const value = node[key]
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item === 'object') out.push(item as JsonRecord)
    }
  }
  return out
}

/** Усі вузли піддерева згори вниз, у порядку показу. */
export function nodesIn(node: unknown, depth = 0, out: JsonRecord[] = []): JsonRecord[] {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return out
  if (Array.isArray(node)) {
    for (const item of node) nodesIn(item, depth + 1, out)
    return out
  }
  const record = node as JsonRecord
  out.push(record)
  for (const child of children(record)) nodesIn(child, depth + 1, out)
  return out
}

/** Тексти всередині одного шматка дерева, згори вниз. */
export function textsIn(node: unknown, depth = 0, out: string[] = []): string[] {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return out
  if (Array.isArray(node)) {
    for (const item of node) textsIn(item, depth + 1, out)
    return out
  }
  const record = node as JsonRecord
  if (record.type === 'Text' && typeof record.content === 'string') out.push(record.content)
  for (const value of Object.values(record)) textsIn(value, depth + 1, out)
  return out
}

/** Один злитий текст вузла: «5.0 з 5 рейтинг • 4 відгуки». */
export function textOf(node: unknown): string | null {
  return clean(textsIn(node).join(' ').replace(/\s+/g, ' '))
}

/** Текст вузла з таким id. Найчастіший виклик у розборі характеристик. */
export function textById(state: unknown, id: string | RegExp): string | null {
  return textOf(byId(state, id))
}

/** Усі тексти всього стану — коли шукаємо фразу, а не конкретний вузол. */
export function allTexts(state: unknown): string[] {
  const texts: string[] = []
  const seen = new Set<unknown>()

  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }

    const record = node as JsonRecord
    if (record.type === 'Text' && typeof record.content === 'string') texts.push(record.content)
    for (const value of Object.values(record)) walk(value, depth + 1)
  }

  walk(state, 0)
  return texts
}

/**
 * `actionData.data` приходить масивом пар `[["userId","17339823"], …]`,
 * а `actionData.params` — тим самим набором, але вже обʼєктом. Зливаємо обидва.
 */
export function actionValues(node: JsonRecord | null): Record<string, string> {
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

export function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Перше число в тексті: «Переглядів авто 1 378» → 1378. */
export function firstNumber(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.replace(/ /g, ' ').match(/\d[\d\s]*(?:[.,]\d+)?/)
  if (!match) return null
  const parsed = Number.parseFloat(match[0].replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/** Розділювач «  •  » між значеннями в одному рядку. */
export function splitBullets(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/\s*[•·]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}
