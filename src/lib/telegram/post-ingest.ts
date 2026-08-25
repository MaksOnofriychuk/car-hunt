import { and, eq } from 'drizzle-orm'

import { isFullVin, parsePostText, textHashOf, type ParsedPost } from './post-parse'
import { savePostPhotos, type PhotoRef } from './post-photos'
import { notifyNewListing, notifyPostPrice } from './notify'

import { db } from '@/db'
import { events, listings, type Author, type Listing } from '@/db/schema'
import { fillEmptyColumns } from '@/db/listings'
import { addSellerPhone, setSellerTelegramUsername } from '@/db/sellers'
import {
  appendPostPhotos,
  earliestPostedAt,
  findPost,
  findPostByTextHash,
  insertPost,
  listingForTelegramRef,
  previousPost,
  setPriceFromPost,
} from '@/db/telegram'
import { ingestUrl, parseListing } from '@/lib/ingest'
import { bothPrices } from '@/lib/rates'
import { extractListingRef } from '@/lib/sources'
import { telegramRef } from '@/lib/sources/telegram'

/**
 * Пост із групи → картка авто. Головне правило розділу SPEC — **злиття, а не
 * дубль**: є в пості посилання на auto.ria або olx, значить картка створюється
 * за ним звичайним інгестом, а дані поста лягають зверху як доповнення.
 *
 * Пост ніколи не затирає непорожнє поле парсера (виняток — VIN, бо RIA кладе
 * туди маску). Розбіжність не привід щось переписувати: вона лишається в пості
 * і видно її на картці, а людина розбереться швидше за евристику.
 */

/** Зібраний із апдейтів пост — те, що вебхук передає сюди. */
export type BuiltPost = {
  /** Числовий id групи ПОХОДЖЕННЯ; наш чат — лише коли пересилач сховав джерело. */
  chatId: string
  /** Якір: найменший message_id альбому. Ніколи не змінюється після створення. */
  messageId: number
  originMessageIds: number[]
  originTitle: string | null
  mediaGroupId: string | null
  /** Telegram не віддав forward_origin — доводиться спиратись на текст. */
  originHidden: boolean
  postedAt: Date | null
  text: string
  photos: PhotoRef[]
  raw: unknown
  forwardedBy: Author
}

export type PostResult =
  | { kind: 'saved'; listingId: string; created: boolean; title: string | null; priceUsd: number | null }
  | { kind: 'duplicate'; listingId: string; title: string | null }
  | { kind: 'unknown' }

export async function processPost(post: BuiltPost): Promise<PostResult> {
  const parsed = parsePostText(post.text)
  const textHash = post.originHidden ? textHashOf(post.text) : null

  // Уже бачили цей пост? Тоді нічого не створюємо — лише доклеюємо фото.
  const existingPost = await findPost({
    chatId: post.chatId,
    mediaGroupId: post.mediaGroupId,
    messageId: post.messageId,
  })

  if (existingPost) {
    await attachPhotos(existingPost.id, post)
    const listing = await listingById(existingPost.listingId)
    return { kind: 'duplicate', listingId: existingPost.listingId, title: listing?.title ?? null }
  }

  const target = await resolveListing(post, parsed, textHash)
  if (!target) return { kind: 'unknown' }

  const money = await postPrices(parsed)

  const row = await insertPost({
    listingId: target.listingId,
    chatId: post.chatId,
    messageId: post.messageId,
    originMessageIds: post.originMessageIds,
    originTitle: post.originTitle,
    mediaGroupId: post.mediaGroupId,
    textHash,
    forwardedBy: post.forwardedBy,
    postedAt: post.postedAt,
    text: post.text,
    parsed,
    raw: post.raw,
    priceUsd: money.priceUsd,
    priceUah: money.priceUah,
    priceCurrency: parsed.price?.currency ?? null,
    links: parsed.links,
  })

  // Конфлікт означає, що паралельний обробник встиг першим — доклеюємось до нього.
  if (!row) {
    const twin = await findPost({
      chatId: post.chatId,
      mediaGroupId: post.mediaGroupId,
      messageId: post.messageId,
    })
    if (twin) await attachPhotos(twin.id, post)
    return { kind: 'duplicate', listingId: target.listingId, title: target.listing.title }
  }

  await applyToListing(target.listing, parsed, post, money)

  // Ціна з поста і подія про її зміну — тільки між двома постами.
  if (money.priceUsd !== null) {
    await setPriceFromPost(target.listingId, money.priceUsd)

    const before = await previousPost(target.listingId, row.id)
    const sameCurrency = before?.priceCurrency && before.priceCurrency === row.priceCurrency
    const movedNative =
      row.priceCurrency === 'UAH'
        ? before?.priceUah !== row.priceUah
        : before?.priceUsd !== row.priceUsd

    if (before && sameCurrency && movedNative && before.priceUsd !== null) {
      await db.insert(events).values({
        listingId: target.listingId,
        author: post.forwardedBy,
        type: 'price_change',
        payload: {
          old_price: before.priceUsd,
          new_price: money.priceUsd,
          source: 'post',
          post_id: row.id,
        },
      })

      await notifyPostPrice(target.listing, post.forwardedBy, {
        oldPrice: before.priceUsd,
        newPrice: money.priceUsd,
      })
    }
  }

  // Подія в стрічку — без тексту поста: інакше цитата дилера видавала б себе
  // за наш коментар у черзі (там показується останній запис із текстом).
  await db.insert(events).values({
    listingId: target.listingId,
    author: post.forwardedBy,
    type: 'telegram_post',
    payload: { post_id: row.id, source: 'post' },
  })

  await saveSeller(target.listingId, parsed)
  await attachPhotos(row.id, post)

  // Нове авто — звичне сповіщення іншому; передрук наявного лишається тихим.
  if (target.created) await notifyNewListing(target.listingId, post.forwardedBy)

  const fresh = await listingById(target.listingId)
  return {
    kind: 'saved',
    listingId: target.listingId,
    created: target.created,
    title: fresh?.title ?? parsed.title,
    priceUsd: fresh?.priceUsd ?? money.priceUsd,
  }
}

/* -------------------------------- деталі ---------------------------------- */

type Target = { listingId: string; listing: Listing; created: boolean }

/**
 * До якого авто чіпляється пост. Порядок і є правилом «злиття, а не дубль»:
 * спершу посилання на майданчик, далі — сам пост як джерело, і лише потім
 * відбиток тексту, коли пересилач сховав походження.
 */
async function resolveListing(
  post: BuiltPost,
  parsed: ParsedPost,
  textHash: string | null,
): Promise<Target | null> {
  const carLink = parsed.carLinks.find((link) => {
    const ref = extractListingRef(link)
    return ref?.source === 'autoria' || ref?.source === 'olx'
  })

  if (carLink) {
    const result = await ingestUrl(carLink, post.forwardedBy)
    // Свіжу картку доводимо парсером ДО того, як писати дані поста: інакше
    // пост заповнить колонки, які за секунду перезапише майданчик.
    if (!result.duplicate) await parseListing(result.id)

    const listing = await listingById(result.id)
    return listing ? { listingId: result.id, listing, created: !result.duplicate } : null
  }

  if (!post.originHidden) {
    const ref = telegramRef(post.chatId, post.messageId)

    const byPost = await listingForTelegramRef(ref)
    if (byPost) {
      const listing = await listingById(byPost)
      if (listing) return { listingId: byPost, listing, created: false }
    }

    const [existing] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.source, 'telegram'), eq(listings.sourceId, ref.id)))
      .limit(1)

    if (existing) return { listingId: existing.id, listing: existing, created: false }

    return createTelegramListing(post, parsed)
  }

  // Джерело сховане: той самий текст чіпляється до наявного авто.
  if (textHash) {
    const twin = await findPostByTextHash(textHash)
    if (twin) {
      const listing = await listingById(twin.listingId)
      if (listing) return { listingId: twin.listingId, listing, created: false }
    }
  }

  // Ні посилання, ні джерела, ні тексту — створювати нічого. Краще попросити
  // переслати з показом джерела, ніж завести картку, яку ніколи не впізнати.
  if (!textHash) return null

  return createTelegramListing(post, parsed)
}

/** Картка з самого поста. `active`, а не `pending`: тягнути більше нема звідки. */
async function createTelegramListing(post: BuiltPost, parsed: ParsedPost): Promise<Target | null> {
  const [created] = await db
    .insert(listings)
    .values({
      source: 'telegram',
      sourceId: `${post.chatId}:${post.messageId}`,
      url: postUrl(post),
      status: 'active',
      title: parsed.title,
      brand: parsed.brand,
      model: parsed.model,
      year: parsed.year,
      mileageKm: parsed.mileageKm,
      city: parsed.city,
      driveType: parsed.driveType,
      fuelType: parsed.fuelType,
      engineVolume: parsed.engineVolume,
      vin: isFullVin(parsed.vin) ? parsed.vin : null,
      descriptionText: post.text,
      publishedAt: post.postedAt,
      createdBy: post.forwardedBy,
    })
    .onConflictDoNothing()
    .returning()

  if (created) return { listingId: created.id, listing: created, created: true }

  // Хтось встиг створити її паралельно — беремо наявну.
  const [existing] = await db
    .select()
    .from(listings)
    .where(
      and(eq(listings.source, 'telegram'), eq(listings.sourceId, `${post.chatId}:${post.messageId}`)),
    )
    .limit(1)

  return existing ? { listingId: existing.id, listing: existing, created: false } : null
}

/** Посилання на оригінал поста: t.me/c/{internal}/{msg} для супергруп і каналів. */
function postUrl(post: BuiltPost): string {
  const internal = post.chatId.replace(/^-100/, '').replace(/^-/, '')
  return `https://t.me/c/${internal}/${post.messageId}`
}

/** Дані поста в колонки — лише в порожні, одним запитом (див. fillEmptyColumns). */
async function applyToListing(
  listing: Listing,
  parsed: ParsedPost,
  post: BuiltPost,
  money: { priceUsd: number | null; priceUah: number | null },
): Promise<void> {
  const fromPost = listing.source === 'telegram'
  const earliest = fromPost ? await earliestPostedAt(listing.id) : null

  await fillEmptyColumns(
    listing,
    {
      title: parsed.title,
      brand: parsed.brand,
      model: parsed.model,
      year: parsed.year,
      mileageKm: parsed.mileageKm,
      city: parsed.city,
      driveType: parsed.driveType,
      fuelType: parsed.fuelType,
      engineVolume: parsed.engineVolume,
      vin: parsed.vin,
      // Опис пишемо тільки telegram-картці: у злитої він прийде з оголошення,
      // а непорожній description_text заблокував би архіватор.
      descriptionText: fromPost ? post.text : null,
      publishedAt: earliest ?? (fromPost ? post.postedAt : null),
      // У telegram-картки ціни оголошення не існує — тому ціна з поста стає і
      // ціною картки. Інакше вона висіла б у черзі без ціни, не потрапляла в
      // фільтри й сортування. Історія цін постів усе одно лишається в
      // telegram_posts, а в price_history вони не пишуться ніколи.
      priceUsd: fromPost ? money.priceUsd : null,
      priceUah: fromPost ? money.priceUah : null,
    },
    { vinIsFull: isFullVin(parsed.vin) },
  )
}

/**
 * Продавець. Телефон іде тим самим шляхом, що й уведений руками, — **без
 * автозлиття**: за одним номером сидить і перекуп, і його брат, тому чужий
 * номер лише піднімає звичне попередження `sameAs` на картці.
 */
async function saveSeller(listingId: string, parsed: ParsedPost): Promise<void> {
  for (const phone of parsed.phones) {
    const result = await addSellerPhone(listingId, phone)
    if (!result.ok) console.warn('[telegram] телефон не записався:', result.error)
  }

  if (!parsed.username) return

  const listing = await listingById(listingId)
  // Юзернейм — довідкове поле продавця; без продавця його нікуди класти.
  if (listing?.sellerId) await setSellerTelegramUsername(listing.sellerId, parsed.username)
}

async function attachPhotos(postId: string, post: BuiltPost): Promise<void> {
  const saved = await savePostPhotos(post.chatId, post.photos)
  await appendPostPhotos(postId, saved.keys, saved.complete)
}

/** Ціна поста в обох валютах — тим самим курсом, що й ціни оголошень. */
async function postPrices(parsed: ParsedPost): Promise<{ priceUsd: number | null; priceUah: number | null }> {
  if (!parsed.price) return { priceUsd: null, priceUah: null }

  return bothPrices({
    priceUsd: parsed.price.currency === 'USD' ? parsed.price.amount : null,
    priceUah: parsed.price.currency === 'UAH' ? parsed.price.amount : null,
    priceCurrency: parsed.price.currency,
  })
}

async function listingById(id: string): Promise<Listing | null> {
  const [row] = await db.select().from(listings).where(eq(listings.id, id)).limit(1)
  return row ?? null
}
