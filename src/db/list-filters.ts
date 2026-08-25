import { and, eq, ilike, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'

import { listings, sellers } from './schema'

import { kyivDatePlus, todayInKyiv } from '@/lib/dates'
import type { ListQuery, Range, SortField } from '@/lib/list-query'
import { STAGES } from '@/lib/stages'

/**
 * `ListQuery` → умови SQL. Один білдер на весь застосунок: те саме крутить
 * черга і сторінка продавця, тому фільтр «дешевші за ціль» скрізь означає
 * одне й те саме.
 *
 * Етап, останній коментар і падіння ціни живуть не колонками, а в подіях, тому
 * сюди приходять готові підзапити (`joins`) — див. `db/list.ts`.
 */

export type ListJoins = {
  /** Етап із останньої події `stage_change`; NULL означає `new`. */
  stage: SQL
  /** Час останнього коментаря — за ним сортують колонку «останній коментар». */
  commentAt: SQL
}

function fromRange(column: SQL | ReturnType<typeof sql>, value: Range): SQL[] {
  const parts: SQL[] = []
  if (value.min !== null) parts.push(sql`${column} >= ${value.min}`)
  if (value.max !== null) parts.push(sql`${column} <= ${value.max}`)
  return parts
}

export function listWhere(query: ListQuery, joins: ListJoins): SQL | undefined {
  const parts: (SQL | undefined)[] = []

  // Архівні ховаються, поки їх не попросили: черга — це те, чим займаються зараз.
  if (!query.archived) parts.push(eq(listings.archived, false))

  parts.push(...fromRange(sql`${listings.priceUsd}`, query.price))
  parts.push(...fromRange(sql`${listings.year}`, query.year))
  parts.push(...fromRange(sql`${listings.mileageKm}`, query.km))

  // «Днів в оголошенні» колонкою не існує — це відстань від дати публікації.
  if (query.days.min !== null) {
    parts.push(sql`${listings.publishedAt} <= now() - make_interval(days => ${query.days.min})`)
  }
  if (query.days.max !== null) {
    parts.push(sql`${listings.publishedAt} >= now() - make_interval(days => ${query.days.max})`)
  }

  // Ціна вже не вища за ціль — те, заради чого цільову ціну й ставлять.
  if (query.cheaper) {
    parts.push(sql`${listings.targetPriceUsd} is not null and ${listings.priceUsd} <= ${listings.targetPriceUsd}`)
  }

  // Місто вводять руками, тому шукаємо входженням і без регістру: «київ» має
  // знаходити «Київ», а «Біла» — «Біла Церква».
  if (query.city) parts.push(ilike(listings.city, `%${query.city}%`))

  if (query.source.length) parts.push(inArray(listings.source, query.source))
  if (query.sellerType.length) parts.push(inArray(sellers.type, query.sellerType))

  if (query.stage.length) {
    parts.push(sql`coalesce(${joins.stage}, 'new') in ${query.stage}`)
  }

  if (query.target === 'yes') parts.push(isNotNull(listings.targetPriceUsd))
  if (query.target === 'no') parts.push(isNull(listings.targetPriceUsd))

  const due = dueCondition(query.due)
  if (due) parts.push(due)

  const conditions = parts.filter((part): part is SQL => part !== undefined)
  return conditions.length > 0 ? and(...conditions) : undefined
}

/** «Прострочені / сьогодні / цього тижня» — по даті наступного контакту. */
function dueCondition(due: ListQuery['due']): SQL | undefined {
  if (!due) return undefined
  const today = todayInKyiv()

  if (due === 'overdue') return sql`${listings.nextContactAt} < ${today}`
  if (due === 'today') return sql`${listings.nextContactAt} = ${today}`
  // Тиждень включає прострочене: це список того, що треба зробити до кінця тижня.
  return and(
    isNotNull(listings.nextContactAt),
    sql`${listings.nextContactAt} <= ${kyivDatePlus(7)}`,
  )
}

/**
 * Порядок. Типове сортування — за датою контакту з `nulls last`, і воно ж саме
 * собою піднімає прострочені вгору.
 */
export function listOrderBy(query: ListQuery, joins: ListJoins): SQL[] {
  if (!query.sort) {
    return [sql`${listings.nextContactAt} asc nulls last`, sql`${listings.createdAt} desc`]
  }

  const { field, dir } = query.sort
  const column = sortColumn(field, joins)
  // «Днів в оголошенні» рахується з дати публікації навпаки: менше днів — це
  // свіжіша публікація. Тому напрямок для цієї колонки перевертаємо.
  const flip = field === 'days'
  const ascending = flip ? dir === 'desc' : dir === 'asc'
  const direction = sql.raw(ascending ? 'asc' : 'desc')

  return [sql`${column} ${direction} nulls last`, sql`${listings.createdAt} desc`]
}

function sortColumn(field: SortField, joins: ListJoins): SQL {
  switch (field) {
    case 'price':
      return sql`${listings.priceUsd}`
    case 'target':
      return sql`${listings.targetPriceUsd}`
    // «Різниця» — наскільки ціна вища за нашу ціль. Немає цілі — немає різниці.
    case 'diff':
      return sql`${listings.priceUsd} - ${listings.targetPriceUsd}`
    // «Днів в оголошенні» — це дата публікації навпаки: що раніше опубліковане,
    // то більше днів воно висить.
    case 'days':
      return sql`${listings.publishedAt}`
    case 'mileage':
      return sql`${listings.mileageKm}`
    case 'year':
      return sql`${listings.year}`
    case 'city':
      return sql`${listings.city}`
    case 'seller':
      return sql`${sellers.name}`
    case 'source':
      return sql`${listings.source}`
    case 'comment':
      return sql`${joins.commentAt}`
    case 'added':
      return sql`${listings.createdAt}`
    // Етап сортуємо по воронці, а не за абеткою: «Купили» має бути в кінці,
    // а не між «Дзвонили» і «Торгуємось».
    case 'stage':
      return stageOrder(joins.stage)
    default:
      return sql`${listings.nextContactAt}`
  }
}

function stageOrder(stage: SQL): SQL {
  const cases = STAGES.map((name, index) => sql`when ${name} then ${index}`)
  return sql`case coalesce(${stage}, 'new') ${sql.join(cases, sql` `)} else 99 end`
}

/** Скільки пропустити і скільки взяти. `all` має стелю — див. `MAX_PER_PAGE`. */
export function listRange(query: ListQuery, maxPerPage: number): { limit: number; offset: number } {
  if (query.per === 'all') return { limit: maxPerPage, offset: 0 }
  return { limit: query.per, offset: (query.page - 1) * query.per }
}
