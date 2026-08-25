import { and, arrayOverlaps, eq, isNull, ne } from 'drizzle-orm'

import { db } from '@/db'
import {
  listings,
  sellers,
  type Listing,
  type Seller,
  type SellerType,
  type SourceName,
} from '@/db/schema'
import { normalizePhone, normalizePhones } from '@/lib/phone'
import { sellerHint } from '@/lib/seller-hint'
import type { ListingSnapshot } from '@/lib/sources/types'

/**
 * Склейка продавців. Порядок ключів — з SPEC, розділ «Продавці»:
 *
 *   1. **`(source, source_user_id)`** — основний ключ. Для AUTO.RIA це `userId`
 *      зі сторінки: він стабільний між оголошеннями і видно його без телефону.
 *   2. **телефон** — додатковий. Спрацьовує, коли id немає (заповнили руками,
 *      інше джерело) або коли продавець завів новий кабінет зі старим номером.
 *
 * Нічого введеного руками не перезаписуємо: імʼя і тип лише заповнюємо, якщо
 * вони порожні, телефони — доповнюємо, notes не чіпаємо взагалі.
 */

type SellerIdentity = {
  source: SourceName
  sourceUserId: string | null
  name: string | null
  type: SellerType
  phones: string[]
}

function identityFrom(listing: Listing, snapshot: ListingSnapshot): SellerIdentity {
  return {
    source: listing.source,
    sourceUserId: snapshot.sellerSourceId?.trim() || null,
    name: snapshot.sellerName?.trim() || null,
    type: snapshot.sellerType ?? 'unknown',
    phones: normalizePhones(snapshot.sellerPhones),
  }
}

async function findBySourceUser(source: SourceName, sourceUserId: string): Promise<Seller | null> {
  const [row] = await db
    .select()
    .from(sellers)
    .where(and(eq(sellers.source, source), eq(sellers.sourceUserId, sourceUserId)))
    .limit(1)
  return row ?? null
}

async function findByPhone(phones: string[]): Promise<Seller | null> {
  if (phones.length === 0) return null
  const [row] = await db.select().from(sellers).where(arrayOverlaps(sellers.phones, phones)).limit(1)
  return row ?? null
}

/** Доповнити знайденого продавця тим, чого в нього ще немає. */
async function fillGaps(seller: Seller, identity: SellerIdentity): Promise<void> {
  const patch: Partial<typeof sellers.$inferInsert> = {}

  if (!seller.name && identity.name) patch.name = identity.name
  if (seller.type === 'unknown' && identity.type !== 'unknown') patch.type = identity.type

  // Знайшли по телефону, а id джерела в рядку ще не було — дописуємо його,
  // і далі цей продавець склеюється вже за основним ключем.
  if (!seller.sourceUserId && identity.sourceUserId) {
    patch.source = identity.source
    patch.sourceUserId = identity.sourceUserId
  }

  const missing = identity.phones.filter((phone) => !seller.phones.includes(phone))
  if (missing.length > 0) patch.phones = [...seller.phones, ...missing]

  if (Object.keys(patch).length > 0) {
    await db.update(sellers).set(patch).where(eq(sellers.id, seller.id))
  }
}

/**
 * Знайти або створити продавця для оголошення. `null` — склеювати нема по чому:
 * ні id джерела, ні телефону (так буде для manual-карток, поки їх не заповнять).
 */
export async function linkSeller(
  listing: Listing,
  snapshot: ListingSnapshot,
): Promise<string | null> {
  const identity = identityFrom(listing, snapshot)
  if (!identity.sourceUserId && identity.phones.length === 0) return null

  const existing =
    (identity.sourceUserId
      ? await findBySourceUser(identity.source, identity.sourceUserId)
      : null) ?? (await findByPhone(identity.phones))

  if (existing) {
    await fillGaps(existing, identity)
    return existing.id
  }

  const [created] = await db
    .insert(sellers)
    .values({
      source: identity.sourceUserId ? identity.source : null,
      sourceUserId: identity.sourceUserId,
      name: identity.name,
      type: identity.type,
      phones: identity.phones,
    })
    // Два оголошення того самого продавця можуть парситись паралельно.
    .onConflictDoNothing({ target: [sellers.source, sellers.sourceUserId] })
    .returning({ id: sellers.id })

  if (created) return created.id

  // Гонка: рядок встиг створити паралельний парсинг — беремо його.
  const raced = identity.sourceUserId
    ? await findBySourceUser(identity.source, identity.sourceUserId)
    : null
  return raced?.id ?? null
}

/* -------------------------------------------------------------------------- */
/*  Номер, введений руками                                                     */
/* -------------------------------------------------------------------------- */

/** Продавець, у якого вже є цей номер. Показуємо як попередження, не зливаємо. */
export type SharedSeller = { id: string; name: string | null }

export type AddPhoneResult =
  | { ok: false; error: string }
  | { ok: true; phone: string; already: boolean; sameAs: SharedSeller[] }

/** Інші продавці з таким же номером. Порожньо — номер унікальний. */
export async function sellersWithPhone(phone: string, exceptId: string): Promise<Seller[]> {
  return db
    .select()
    .from(sellers)
    .where(and(arrayOverlaps(sellers.phones, [phone]), ne(sellers.id, exceptId)))
}

/** Продавець оголошення; якщо його ще немає — знайти або створити за номером. */
async function sellerForListing(listing: Listing, phone: string): Promise<Seller | null> {
  if (listing.sellerId) {
    const [row] = await db.select().from(sellers).where(eq(sellers.id, listing.sellerId)).limit(1)
    if (row) return row
  }

  // Продавця ще немає: збираємо його з того, що знає парсер, плюс введений номер.
  // Далі спрацьовує звичайна склейка — спершу по id джерела, потім по телефону.
  const hint = sellerHint(listing.snapshotRaw)
  const sellerId = await linkSeller(listing, {
    raw: null,
    sellerName: hint.name,
    sellerSourceId: hint.userId,
    sellerType: hint.type ?? 'unknown',
    sellerPhones: [phone],
  })
  if (!sellerId) return null

  await db.update(listings).set({ sellerId }).where(eq(listings.id, listing.id))

  const [created] = await db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1)
  return created ?? null
}

/**
 * Дописати продавцю номер, введений руками. Номер нормалізується до
 * `+380XXXXXXXXX`; якщо він уже є в когось іншого — **не зливаємо** продавців,
 * а повертаємо їх у `sameAs`, щоб інтерфейс попередив: може бути та сама людина.
 */
export async function addSellerPhone(listingId: string, rawPhone: string): Promise<AddPhoneResult> {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { ok: false, error: 'Не схоже на український номер' }

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1)
  if (!listing) return { ok: false, error: 'Оголошення не знайдено' }

  const seller = await sellerForListing(listing, phone)
  if (!seller) return { ok: false, error: 'Не вдалось створити продавця' }

  const already = seller.phones.includes(phone)
  if (!already) {
    await db
      .update(sellers)
      .set({ phones: [...seller.phones, phone] })
      .where(eq(sellers.id, seller.id))
  }

  const others = await sellersWithPhone(phone, seller.id)
  return {
    ok: true,
    phone,
    already,
    sameAs: others.map((row) => ({ id: row.id, name: row.name })),
  }
}

/**
 * Продавець із форми ручного заповнення. Відрізняється від `linkSeller` тим, що
 * тут людина друкує сама: імʼя і тип перекривають те, що колись вгадав парсер,
 * бо вона щойно з цим продавцем говорила.
 *
 * Повертає попередження `sameAs` — інші продавці з тим самим номером. Не зливаємо
 * їх і тут: за одним номером сидить і перекуп, і його брат.
 */
export async function saveManualSeller(
  listing: Listing,
  input: { name: string | null; phone: string | null; type: SellerType | null },
): Promise<{ sellerId: string | null; sameAs: SharedSeller[] }> {
  const phone = input.phone ? normalizePhone(input.phone) : null
  if (!input.name && !phone && !input.type) return { sellerId: null, sameAs: [] }

  const seller = await findOrCreate(listing, phone)
  if (!seller) return { sellerId: null, sameAs: [] }

  const phones = phone && !seller.phones.includes(phone) ? [...seller.phones, phone] : seller.phones

  await db
    .update(sellers)
    .set({
      name: input.name ?? seller.name,
      type: input.type ?? seller.type,
      phones,
    })
    .where(eq(sellers.id, seller.id))

  if (listing.sellerId !== seller.id) {
    await db.update(listings).set({ sellerId: seller.id }).where(eq(listings.id, listing.id))
  }

  const sameAs = phone ? await sellersWithPhone(phone, seller.id) : []
  return { sellerId: seller.id, sameAs: sameAs.map((row) => ({ id: row.id, name: row.name })) }
}

/** Продавець картки, продавець із таким номером, або новий. */
async function findOrCreate(listing: Listing, phone: string | null): Promise<Seller | null> {
  if (listing.sellerId) {
    const [existing] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.id, listing.sellerId))
      .limit(1)
    if (existing) return existing
  }

  if (phone) {
    const byPhone = await findByPhone([phone])
    if (byPhone) return byPhone
  }

  const [created] = await db
    .insert(sellers)
    .values({ name: null, phones: phone ? [phone] : [], type: 'unknown' })
    .returning()

  return created ?? null
}

/** Наші нотатки про продавця. Парсер їх не чіпає — це поле тільки людини. */
/**
 * Юзернейм із поста — другий контакт продавця поруч із телефоном. Записується,
 * лише коли порожньо: це довідкове поле, а не ключ склейки (його міняють), і
 * введене руками воно не перезаписує.
 */
export async function setSellerTelegramUsername(
  sellerId: string,
  username: string,
): Promise<void> {
  await db
    .update(sellers)
    .set({ telegramUsername: username })
    .where(and(eq(sellers.id, sellerId), isNull(sellers.telegramUsername)))
}

export async function setSellerNotes(id: string, notes: string | null): Promise<void> {
  await db.update(sellers).set({ notes }).where(eq(sellers.id, id))
}
