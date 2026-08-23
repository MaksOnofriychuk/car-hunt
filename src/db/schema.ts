import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/* -------------------------------------------------------------------------- */
/*  Довідники значень (у БД — звичайний text, щоб не мучитись з ALTER TYPE)    */
/* -------------------------------------------------------------------------- */

/** Хто працює з базою. Користувачів рівно двоє. */
export const AUTHORS = ['me', 'dad'] as const
export type Author = (typeof AUTHORS)[number]

export const SELLER_TYPES = ['owner', 'dealer', 'showroom', 'unknown'] as const
export type SellerType = (typeof SELLER_TYPES)[number]

/**
 * Звідки приїхало оголошення. Унікальність — по парі (source, source_id):
 * id з різних сайтів можуть збігтись, і це не той самий автомобіль.
 */
export const SOURCE_NAMES = ['autoria', 'olx', 'telegram', 'manual'] as const
export type SourceName = (typeof SOURCE_NAMES)[number]

/** pending — щойно закинули посилання; failed — парсер не впорався, дані вводимо руками. */
export const LISTING_STATUSES = ['pending', 'active', 'removed', 'failed'] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const EVENT_TYPES = ['call', 'comment', 'stage_change', 'viewing', 'price_change'] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** Етапи по авто. Зберігаються лише всередині події `stage_change` (payload.stage). */
export const STAGES = [
  'new',
  'contacted',
  'offer_made',
  'negotiating',
  'viewing_scheduled',
  'won',
  'lost',
] as const
export type Stage = (typeof STAGES)[number]

/** Етап, поки по авто ще не було жодної події `stage_change`. */
export const DEFAULT_STAGE: Stage = 'new'

/**
 * Спільний мішок полів для payload події — набір ключів зі SPEC.
 * Кожен тип події заповнює свої: call → text/outcome/offered_price,
 * comment → text, stage_change → stage, price_change → old_price/new_price.
 */
export type EventPayload = {
  text?: string
  outcome?: string
  offered_price?: number
  stage?: Stage
  old_price?: number
  new_price?: number
}

/* -------------------------------------------------------------------------- */
/*  Таблиці                                                                    */
/* -------------------------------------------------------------------------- */

export const sellers = pgTable('sellers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  /** Нормалізовані до +380XXXXXXXXX. По них склеюємо продавців між оголошеннями. */
  phones: text('phones').array().notNull().default([]),
  type: text('type').$type<SellerType>().notNull().default('unknown'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').$type<SourceName>().notNull(),
    /**
     * Ідентифікатор усередині джерела: числовий id для autoria, хвіст посилання
     * для olx, "{chat_id}:{message_id}" для telegram, згенерований uuid для manual.
     */
    sourceId: text('source_id').notNull(),
    url: text('url').notNull(),
    status: text('status').$type<ListingStatus>().notNull().default('pending'),
    sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'set null' }),
    /** Повна відповідь API/парсера як є — щоб не втратити нічого, коли оголошення знімуть. */
    snapshotRaw: jsonb('snapshot_raw'),
    /**
     * Повний HTML сторінки на момент першого парсингу: gzip, у базу як base64
     * (сирі gzip-байти в text не покласти). Пишеться один раз, не перезаписується.
     */
    htmlRaw: text('html_raw'),
    /** Повний текст опису продавця — окремим полем, щоб шукати і показувати без розбору HTML. */
    descriptionText: text('description_text'),

    title: text('title'),
    brand: text('brand'),
    model: text('model'),
    year: integer('year'),
    mileageKm: integer('mileage_km'),
    priceUsd: integer('price_usd'),
    city: text('city'),
    /** Коли оголошення зʼявилось на AUTO.RIA — з цього рахуємо «днів у продажу». */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** Оригінальні URL з RIA — тільки для довідки, вони помруть разом з оголошенням. */
    photos: text('photos').array().notNull().default([]),
    /** Ключі наших копій фото у сховищі: listings/{auto_ria_id}/{n}-{hash8}.{ext}. */
    photosLocal: text('photos_local').array().notNull().default([]),

    targetPriceUsd: integer('target_price_usd'),
    /** Ключове поле робочої черги на головному екрані. */
    nextContactAt: date('next_contact_at', { mode: 'string' }),
    /** Ми прибрали авто з робочої черги. Не плутати з archivedAt — це різні речі. */
    archived: boolean('archived').notNull().default(false),

    parsedAt: timestamp('parsed_at', { withTimezone: true }),
    parserVersion: integer('parser_version'),
    /** Коли зняли повну копію: html_raw + усі фото в сховищі. NULL = архів неповний. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    createdBy: text('created_by').$type<Author>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('listings_source_source_id_idx').on(t.source, t.sourceId),
    index('listings_next_contact_at_idx').on(t.nextContactAt),
    index('listings_status_idx').on(t.status),
    // cron/refresh бере найдавніше оновлені неархівні авто
    index('listings_parsed_at_idx').on(t.parsedAt),
    index('listings_seller_id_idx').on(t.sellerId),
    // черга недознятих архівів для cron — часткового індексу вистачає з головою
    index('listings_archive_backlog_idx')
      .on(t.parsedAt)
      .where(sql`${t.archivedAt} is null`),
  ],
)

/** Append-only. Нічого не редагуємо і не видаляємо — тільки додаємо. */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    author: text('author').$type<Author>().notNull(),
    type: text('type').$type<EventType>().notNull(),
    payload: jsonb('payload').$type<EventPayload>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // стрічка подій на картці + обчислення поточного етапу
    index('events_listing_id_created_at_idx').on(t.listingId, t.createdAt),
    index('events_listing_id_type_idx').on(t.listingId, t.type),
  ],
)

/**
 * Журнал спроб входу. Дві задачі: rate limit по IP і слід того, хто заходив.
 * Пишеться і успіх, і невдача — без успіхів журнал не показав би, чи хтось таки зайшов.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** IP з проксі Vercel. Поза Vercel заголовкам довіряти не можна — там буде 'unknown'. */
    ip: text('ip').notNull(),
    userAgent: text('user_agent'),
    /** Кого обрали у формі. null — форма прийшла без валідного вибору. */
    author: text('author').$type<Author>(),
    success: boolean('success').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // вікно rate limit: невдачі з однієї IP за останні 15 хвилин
    index('login_attempts_ip_created_at_idx').on(t.ip, t.createdAt),
  ],
)

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    priceUsd: integer('price_usd').notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('price_history_listing_id_seen_at_idx').on(t.listingId, t.seenAt)],
)

/* -------------------------------------------------------------------------- */
/*  Звʼязки (для db.query.* із `with`)                                         */
/* -------------------------------------------------------------------------- */

export const sellersRelations = relations(sellers, ({ many }) => ({
  listings: many(listings),
}))

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(sellers, { fields: [listings.sellerId], references: [sellers.id] }),
  events: many(events),
  priceHistory: many(priceHistory),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  listing: one(listings, { fields: [events.listingId], references: [listings.id] }),
}))

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  listing: one(listings, { fields: [priceHistory.listingId], references: [listings.id] }),
}))

/* -------------------------------------------------------------------------- */
/*  Типи рядків                                                                */
/* -------------------------------------------------------------------------- */

export type Seller = typeof sellers.$inferSelect
export type NewSeller = typeof sellers.$inferInsert
export type Listing = typeof listings.$inferSelect
export type NewListing = typeof listings.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type PricePoint = typeof priceHistory.$inferSelect
export type NewPricePoint = typeof priceHistory.$inferInsert
export type LoginAttempt = typeof loginAttempts.$inferSelect
export type NewLoginAttempt = typeof loginAttempts.$inferInsert
