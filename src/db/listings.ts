import { eq, sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import { db } from './index'
import { listings, type Author, type Listing, type SourceName } from './schema'

/**
 * Дрібні правки картки з екрана. Події сюди не пишуться — вони в `db/events.ts`.
 * Тут тільки поля, які людина міняє руками в один тап.
 */

export async function listingExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1)

  return row !== undefined
}

/** Наша цільова ціна. null — прибрали. */
export async function setTargetPrice(id: string, priceUsd: number | null): Promise<void> {
  await db.update(listings).set({ targetPriceUsd: priceUsd }).where(eq(listings.id, id))
}

/** Дата наступного дзвінка (YYYY-MM-DD) — ключове поле робочої черги. */
export async function setNextContactAt(id: string, date: string | null): Promise<void> {
  await db.update(listings).set({ nextContactAt: date }).where(eq(listings.id, id))
}

/**
 * Прибрати з робочої черги або повернути. Даних не чіпає: архівна картка
 * лишається повністю читабельною, просто не потрапляє на головний екран.
 */
export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.update(listings).set({ archived }).where(eq(listings.id, id))
}

/* -------------------------------------------------------------------------- */
/*  Ручне заповнення                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Поля картки, які людина заповнює або виправляє руками. Рівно цей набір знає
 * форма, і рівно ці ключі можуть опинитись у `manual_fields` — тому список один
 * на весь застосунок.
 */
export type EditableFields = {
  brand: string | null
  model: string | null
  year: number | null
  mileageKm: number | null
  priceUsd: number | null
  city: string | null
  publishedAt: Date | null
  url: string | null
  descriptionText: string | null
}

export const EDITABLE_FIELDS = [
  'brand',
  'model',
  'year',
  'mileageKm',
  'priceUsd',
  'city',
  'publishedAt',
  'url',
  'descriptionText',
] as const satisfies readonly (keyof EditableFields)[]

export type EditableField = (typeof EDITABLE_FIELDS)[number]

/** Назва картки, якщо її ніхто не задав: «Volkswagen Passat». */
function titleFrom(values: EditableFields): string | null {
  const parts = [values.brand, values.model].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

/** Заповнені поля — саме вони стають «виправленими руками». */
function filledFields(values: Partial<EditableFields>): EditableField[] {
  return EDITABLE_FIELDS.filter((key) => {
    const value = values[key]
    return value !== undefined && value !== null && value !== ''
  })
}

/**
 * Картка, заведена руками. Джерело `manual`, статус одразу `active`: тягнути
 * дані нема звідки, тому й `pending` тут не має сенсу.
 */
export async function createManualListing(input: {
  ref: { source: SourceName; id: string }
  author: Author
  values: EditableFields
  photos: string[]
}): Promise<string> {
  const [created] = await db
    .insert(listings)
    .values({
      source: input.ref.source,
      sourceId: input.ref.id,
      status: 'active',
      ...input.values,
      title: titleFrom(input.values),
      url: input.values.url ?? '',
      photosManual: input.photos,
      // Усе, що людина ввела, парсер потім не має права затерти.
      manualFields: filledFields(input.values),
      createdBy: input.author,
      parsedAt: null,
    })
    .returning({ id: listings.id })

  return created.id
}

/**
 * Правка наявної картки. Повертає перелік полів, які справді змінились, — з
 * нього робиться подія в стрічці. Кожне змінене поле дописується в
 * `manual_fields`, і відтоді парсер його не чіпає.
 */
export async function updateListingFields(
  id: string,
  values: EditableFields,
  photos: string[],
): Promise<EditableField[]> {
  const [current] = await db.select().from(listings).where(eq(listings.id, id)).limit(1)
  if (!current) return []

  const changed = EDITABLE_FIELDS.filter((key) => !same(current[key], values[key]))
  const manualFields = [...new Set([...current.manualFields, ...changed])]

  await db
    .update(listings)
    .set({
      ...values,
      url: values.url ?? current.url,
      title: current.title ?? titleFrom(values),
      photosManual: photos,
      manualFields,
      // Заповнили руками картку, яку парсер не подужав, — вона більше не зламана.
      status: current.status === 'failed' ? 'active' : current.status,
    })
    .where(eq(listings.id, id))

  return changed
}

/** Дати або зняти позначку «виправлено руками» з одного поля. */
export async function setFieldManual(
  id: string,
  field: EditableField,
  manual: boolean,
): Promise<void> {
  const [current] = await db
    .select({ manualFields: listings.manualFields })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1)
  if (!current) return

  const next = manual
    ? [...new Set([...current.manualFields, field])]
    : current.manualFields.filter((item) => item !== field)

  await db.update(listings).set({ manualFields: next }).where(eq(listings.id, id))
}

/**
 * Чи те саме значення. Дати звіряємо по часу, а порожній рядок і `null`
 * вважаємо однаковим: у формі порожнє поле — це `''`, у базі — `null`, і без
 * цього кожне збереження позначало б порожні поля як «виправлені руками».
 */
function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof Date || b instanceof Date) return false
  return blank(a) === blank(b)
}

function blank(value: unknown): unknown {
  return value === '' || value === undefined ? null : value
}

/**
 * Прибрати з оновлення поля, які людина виправила руками. Через це проходить
 * усе, що пише парсер, — і фоновий `parseListing`, і перерозбір: cron має
 * оновлювати ціну, але не повертати марку, яку колись витягнув невірно.
 */

/**
 * Дані з поста в Telegram: заповнюють **тільки порожні** колонки і ніколи не
 * затирають те, що знайшов парсер (SPEC, «Злиття, а не дубль»).
 *
 * Одним запитом із `coalesce`, а не «прочитав — змінив — записав»: між читанням
 * і записом легко встигає парсер зі своїм UPDATE, і тоді пост затер би свіжі
 * дані власною чернеткою. Транзакція тут не допомогла б — обидві сторони
 * ходять у мережу, а тримати транзакцію через HTTP-запит не можна.
 *
 * Виняток один — VIN. AUTO.RIA кладе в ту саму колонку **маску**
 * (`1HGCR2650EA7XXXXX`), і правило «не затирати непорожнє» законсервувало б її,
 * а повний VIN із поста пропав би. Тому повний перемагає масковий.
 */
export type PostColumns = Partial<{
  title: string | null
  brand: string | null
  model: string | null
  year: number | null
  mileageKm: number | null
  city: string | null
  driveType: string | null
  fuelType: string | null
  engineVolume: number | null
  descriptionText: string | null
  publishedAt: Date | null
  vin: string | null
  priceUsd: number | null
  priceUah: number | null
}>

/**
 * Значення для сирого SQL-фрагмента. Дату доводиться віддавати рядком із
 * приведенням: усередині `sql` немає колонки, за якою драйвер зрозумів би тип,
 * і об'єкт Date він просто не вміє відправити.
 */
function bind(value: unknown): SQL {
  if (value instanceof Date) return sql`${value.toISOString()}::timestamptz`
  return sql`${value}`
}

export async function fillEmptyColumns(
  listing: Pick<Listing, 'id' | 'manualFields' | 'source'>,
  values: PostColumns,
  options: { vinIsFull?: boolean } = {},
): Promise<void> {
  // Виправлене руками перемагає і парсер, і пост.
  const allowed = dropManual(listing, values) as Record<string, unknown>
  const set: Record<string, SQL> = {}

  for (const [key, value] of Object.entries(allowed)) {
    if (value === null || value === undefined) continue
    if (key === 'vin') continue

    const column = listings[key as keyof typeof listings] as PgColumn
    set[key] = sql`coalesce(${column}, ${bind(value)})`
  }

  const vin = allowed.vin
  if (typeof vin === 'string' && options.vinIsFull) {
    // Порожньо або маска (менше 17 знаків чи хвіст із X) — пост перемагає.
    set.vin = sql`case
      when ${listings.vin} is null
        or length(${listings.vin}) <> 17
        or ${listings.vin} ~ 'X{3,}'
      then ${vin}
      else ${listings.vin}
    end`
  } else if (typeof vin === 'string') {
    set.vin = sql`coalesce(${listings.vin}, ${vin})`
  }

  // `published_at` для telegram-картки — найраніший пост, а не останній.
  if (values.publishedAt) {
    const at = bind(values.publishedAt)
    set.publishedAt = sql`least(coalesce(${listings.publishedAt}, ${at}), ${at})`
  }

  if (Object.keys(set).length === 0) return

  await db.update(listings).set(set).where(eq(listings.id, listing.id))
}

export function dropManual<T extends Record<string, unknown>>(
  listing: Pick<Listing, 'manualFields'>,
  values: T,
): T {
  if (listing.manualFields.length === 0) return values

  const next = { ...values }
  for (const field of listing.manualFields) delete next[field]
  return next
}
