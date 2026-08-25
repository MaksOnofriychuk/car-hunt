import { SELLER_TYPES, SOURCE_NAMES, type SellerType, type SourceName } from '@/db/schema'
import { STAGES, type Stage } from '@/lib/stages'

/**
 * Стан списку авто живе в URL — і фільтри, і сортування, і сторінка.
 *
 * Так посилання можна кинути іншому, і він побачить рівно те саме: «глянь, оці
 * три дешевші за ціль». Модуль чистий — ні бази, ні серверних API, бо його
 * читає і сервер при рендері, і клієнт у панелі фільтрів.
 */

export type Range = { min: number | null; max: number | null }

/** За чим сортуємо. `contact` — типове, воно ж «прострочені вгорі». */
export const SORT_FIELDS = [
  'contact',
  'title',
  'price',
  'target',
  'diff',
  'days',
  'mileage',
  'year',
  'city',
  'stage',
  'seller',
  'source',
  'comment',
  'added',
] as const

export type SortField = (typeof SORT_FIELDS)[number]

/** Підписи полів сортування — однакові в панелі фільтрів і в заголовках таблиці. */
export const SORT_LABELS: Record<SortField, string> = {
  contact: 'Контакт',
  title: 'Назва',
  price: 'Ціна',
  target: 'Ціль',
  diff: 'Різниця',
  days: 'Днів',
  mileage: 'Пробіг',
  year: 'Рік',
  city: 'Місто',
  stage: 'Етап',
  seller: 'Продавець',
  source: 'Джерело',
  comment: 'Коментар',
  added: 'Додано',
}

/** Ті шість, за якими сортують із телефона. Решта живе в заголовках таблиці. */
export const QUICK_SORTS: SortField[] = ['price', 'days', 'mileage', 'year', 'added', 'contact']
export type SortDir = 'asc' | 'desc'
export type Sort = { field: SortField; dir: SortDir }

/** Коли дзвонити: прострочені, сьогодні, найближчий тиждень. */
export const DUE_VALUES = ['overdue', 'today', 'week'] as const
export type Due = (typeof DUE_VALUES)[number]

export type ListQuery = {
  price: Range
  year: Range
  km: Range
  /** Скільки днів висить оголошення. Довго — привід торгуватись. */
  days: Range
  city: string | null
  source: SourceName[]
  stage: Stage[]
  sellerType: SellerType[]
  /** Чи задана цільова ціна. */
  target: 'yes' | 'no' | null
  /** Ціна вже не вища за нашу ціль. */
  cheaper: boolean
  due: Due | null
  /** Показувати й архівні. Типово черга їх ховає. */
  archived: boolean
  /** null — типове сортування, і саме воно вмикає секції черги. */
  sort: Sort | null
  page: number
  /** 'all' показує все одним списком, зі стелею `MAX_PER_PAGE`. */
  per: number | 'all'
}

export const PER_PAGE = 50

/** Скільки авто на сторінці можна обрати. Все інше в URL зводиться до типового. */
export const PER_OPTIONS = [20, 50, 100] as const

/** Стеля для «показати всі»: випадковий клік не має класти сторінку. */
export const MAX_PER_PAGE = 500

export const EMPTY_RANGE: Range = { min: null, max: null }

export const DEFAULT_QUERY: ListQuery = {
  price: EMPTY_RANGE,
  year: EMPTY_RANGE,
  km: EMPTY_RANGE,
  days: EMPTY_RANGE,
  city: null,
  source: [],
  stage: [],
  sellerType: [],
  target: null,
  cheaper: false,
  due: null,
  archived: false,
  sort: null,
  page: 1,
  per: PER_PAGE,
}

/* --------------------------------- розбір ---------------------------------- */

type Params = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: Params, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)
  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function num(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function range(params: Params, key: string): Range {
  const min = num(read(params, `${key}_min`))
  const max = num(read(params, `${key}_max`))
  // Переплутані місцями межі — не помилка, просто міняємо їх назад.
  if (min !== null && max !== null && min > max) return { min: max, max: min }
  return { min, max }
}

/** Список через кому, з якого лишаємо тільки відомі значення. */
function csv<T extends string>(params: Params, key: string, allowed: readonly T[]): T[] {
  const raw = read(params, key)
  if (!raw) return []
  const values = raw.split(',').map((item) => item.trim())
  return allowed.filter((item) => values.includes(item))
}

function parseSort(value: string | null): Sort | null {
  if (!value) return null
  const [field, dir] = value.split(':')
  if (!SORT_FIELDS.includes(field as SortField)) return null
  return { field: field as SortField, dir: dir === 'desc' ? 'desc' : 'asc' }
}

export function parseListQuery(params: Params): ListQuery {
  const per = read(params, 'per')
  const page = num(read(params, 'page'))
  const due = read(params, 'due')
  const target = read(params, 'target')
  const city = read(params, 'city')?.trim()

  return {
    price: range(params, 'price'),
    year: range(params, 'year'),
    km: range(params, 'km'),
    days: range(params, 'days'),
    city: city ? city : null,
    source: csv(params, 'source', SOURCE_NAMES),
    stage: csv(params, 'stage', STAGES),
    sellerType: csv(params, 'seller', SELLER_TYPES),
    target: target === 'yes' || target === 'no' ? target : null,
    cheaper: read(params, 'cheaper') === '1',
    due: DUE_VALUES.includes(due as Due) ? (due as Due) : null,
    archived: read(params, 'archived') === '1',
    sort: parseSort(read(params, 'sort')),
    page: page && page > 0 ? page : 1,
    per:
      per === 'all'
        ? 'all'
        : (PER_OPTIONS as readonly number[]).includes(Number(per))
          ? Number(per)
          : PER_PAGE,
  }
}

/* -------------------------------- збирання --------------------------------- */

/**
 * Назад у рядок. Типові значення не пишемо: URL має лишатись читабельним, а
 * порожня черга — просто `/`.
 */
export function serializeListQuery(query: ListQuery): string {
  const params = new URLSearchParams()

  const putRange = (key: string, value: Range) => {
    if (value.min !== null) params.set(`${key}_min`, String(value.min))
    if (value.max !== null) params.set(`${key}_max`, String(value.max))
  }

  putRange('price', query.price)
  putRange('year', query.year)
  putRange('km', query.km)
  putRange('days', query.days)

  if (query.city) params.set('city', query.city)
  if (query.source.length) params.set('source', query.source.join(','))
  if (query.stage.length) params.set('stage', query.stage.join(','))
  if (query.sellerType.length) params.set('seller', query.sellerType.join(','))
  if (query.target) params.set('target', query.target)
  if (query.cheaper) params.set('cheaper', '1')
  if (query.due) params.set('due', query.due)
  if (query.archived) params.set('archived', '1')
  if (query.sort) params.set('sort', `${query.sort.field}:${query.sort.dir}`)
  if (query.page > 1) params.set('page', String(query.page))
  if (query.per === 'all') params.set('per', 'all')
  else if (query.per !== PER_PAGE) params.set('per', String(query.per))

  return params.toString()
}

/** Посилання на список із цим запитом. Порожній запит — просто «/». */
export function listHref(query: ListQuery, base = '/'): string {
  const search = serializeListQuery(query)
  return search ? `${base}?${search}` : base
}

/* -------------------------------- допоміжне -------------------------------- */

/** Чи є хоч один фільтр. Від цього залежить, чи розгортати панель. */
export function hasFilters(query: ListQuery): boolean {
  return (
    query.price.min !== null ||
    query.price.max !== null ||
    query.year.min !== null ||
    query.year.max !== null ||
    query.km.min !== null ||
    query.km.max !== null ||
    query.days.min !== null ||
    query.days.max !== null ||
    query.city !== null ||
    query.source.length > 0 ||
    query.stage.length > 0 ||
    query.sellerType.length > 0 ||
    query.target !== null ||
    query.cheaper ||
    query.due !== null ||
    query.archived
  )
}

/** Типове сортування — те, при якому черга лишається трьома секціями. */
export function isDefaultSort(query: ListQuery): boolean {
  return query.sort === null
}

/**
 * Клік по заголовку колонки: перший раз — за зростанням, другий — за спаданням,
 * третій повертає типове сортування.
 */
export function toggleSort(query: ListQuery, field: SortField): ListQuery {
  const current = query.sort
  const next: Sort | null =
    current?.field !== field
      ? { field, dir: 'asc' }
      : current.dir === 'asc'
        ? { field, dir: 'desc' }
        : null

  return { ...query, sort: next, page: 1 }
}

/** Будь-яка зміна фільтрів повертає на першу сторінку. */
export function withFilters(query: ListQuery, patch: Partial<ListQuery>): ListQuery {
  return { ...query, ...patch, page: 1 }
}
