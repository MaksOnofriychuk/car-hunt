/**
 * Як показувати чергу: списком чи таблицею, і які колонки в таблиці.
 *
 * Живе в cookie, а не в localStorage: сервер читає її при рендері й одразу
 * малює потрібне — інакше на кожному відкритті блимав би список, а вже потім
 * зʼявлялась таблиця. І це правильно на пристрій, а не на користувача: на
 * телефоні список, на компʼютері таблиця.
 */

export const COLUMN_IDS = [
  'photo',
  'title',
  'price',
  'target',
  'diff',
  'days',
  'mileage',
  'city',
  'stage',
  'contact',
  'seller',
  'source',
  'comment',
] as const

export type ColumnId = (typeof COLUMN_IDS)[number]

export const COLUMN_LABELS: Record<ColumnId, string> = {
  photo: 'Фото',
  title: 'Авто',
  price: 'Ціна',
  target: 'Ціль',
  diff: 'Різниця',
  days: 'Днів',
  mileage: 'Пробіг',
  city: 'Місто',
  stage: 'Етап',
  contact: 'Дзвонити',
  seller: 'Продавець',
  source: 'Джерело',
  comment: 'Коментар',
}

export type ViewMode = 'list' | 'table'

export type ViewPrefs = {
  mode: ViewMode
  /** Порядок колонок; те, чого тут немає, дописується в кінець. */
  order: ColumnId[]
  hidden: ColumnId[]
}

export const VIEW_COOKIE = 'car_hunt_view'

/** Рік: налаштування вигляду не з тих речей, які варто питати щомісяця. */
export const VIEW_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

export const DEFAULT_PREFS: ViewPrefs = {
  mode: 'list',
  order: [...COLUMN_IDS],
  hidden: [],
}

function isColumn(value: unknown): value is ColumnId {
  return typeof value === 'string' && COLUMN_IDS.includes(value as ColumnId)
}

export function parseViewPrefs(raw: string | undefined): ViewPrefs {
  if (!raw) return DEFAULT_PREFS

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS

    const record = parsed as { mode?: unknown; order?: unknown; hidden?: unknown }
    const order = Array.isArray(record.order) ? record.order.filter(isColumn) : []
    const hidden = Array.isArray(record.hidden) ? record.hidden.filter(isColumn) : []

    return {
      mode: record.mode === 'table' ? 'table' : 'list',
      // Колонка, якої не було в збереженому порядку (додали пізніше), стає в кінець.
      order: [...order, ...COLUMN_IDS.filter((id) => !order.includes(id))],
      hidden,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function serializeViewPrefs(prefs: ViewPrefs): string {
  return encodeURIComponent(JSON.stringify(prefs))
}

/** Записати з клієнта. Сервер прочитає її вже на наступному рендері. */
export function writeViewPrefs(prefs: ViewPrefs): void {
  document.cookie = `${VIEW_COOKIE}=${serializeViewPrefs(prefs)}; path=/; max-age=${VIEW_COOKIE_MAX_AGE}; samesite=lax`
}

/** Видимі колонки в потрібному порядку. */
export function visibleColumns(prefs: ViewPrefs): ColumnId[] {
  return prefs.order.filter((id) => !prefs.hidden.includes(id))
}
