import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
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

export const EVENT_TYPES = [
  'call',
  'comment',
  'stage_change',
  'viewing',
  'price_change',
  'edit',
  /** Прилетів переслений пост із Telegram-групи про це авто. */
  'telegram_post',
] as const
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
  /** Які саме поля виправили руками — для події `edit`. */
  fields?: string[]
  /** Який саме пост — для `telegram_post` і для змін ціни, що прийшли з поста. */
  post_id?: string
  /**
   * Звідки прийшла зміна ціни. `listing` — з оголошення (типово, старі події
   * поля не мають), `post` — між двома постами. Розділені навмисно: 9500 у
   * пості проти 9799 в оголошенні — це знижка, а не падіння ціни, і черга
   * показала б фальшиве «↓».
   */
  source?: 'listing' | 'post'
}

/* -------------------------------------------------------------------------- */
/*  Таблиці                                                                    */
/* -------------------------------------------------------------------------- */

export const sellers = pgTable(
  'sellers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Де в продавця кабінет. NULL — продавця завели руками, джерела в нього немає. */
    source: text('source').$type<SourceName>(),
    /**
     * Ідентифікатор продавця всередині джерела (для autoria — `userId` зі сторінки).
     * **Основний ключ склейки**: він стабільний між оголошеннями і видно його
     * без телефону. Телефон — додатковий ключ, на випадок коли id немає.
     */
    sourceUserId: text('source_user_id'),
    name: text('name'),
    /** Нормалізовані до +380XXXXXXXXX. Додатковий ключ склейки. */
    phones: text('phones').array().notNull().default([]),
    /**
     * Контакт із поста (@nickname). Довідкове поле, **не ключ склейки**:
     * юзернейм міняють, а в злитій autoria-картці продавець уже має свій
     * `source_user_id` із майданчика.
     */
    telegramUsername: text('telegram_username'),
    type: text('type').$type<SellerType>().notNull().default('unknown'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // NULL-и в унікальному індексі Postgres не конфліктують між собою, тому
    // продавців без джерела (заведених руками) може бути скільки завгодно.
    uniqueIndex('sellers_source_user_id_idx').on(t.source, t.sourceUserId),
    index('sellers_phones_idx').using('gin', t.phones),
  ],
)

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

    /** Характеристики з оголошення. Раніше жили тільки всередині snapshot_raw. */
    vin: text('vin'),
    fuelType: text('fuel_type'),
    transmission: text('transmission'),
    color: text('color'),
    /** Літри: 2.36. numeric, бо 2.36 у float — це 2.359999999. */
    engineVolume: numeric('engine_volume', { precision: 4, scale: 2, mode: 'number' }),
    driveType: text('drive_type'),
    bodyType: text('body_type'),
    /** Держномер зі сторінки: «AI 8180 PP». */
    plateNumber: text('plate_number'),
    /** Ціна в гривні на момент парсингу. Історію ведемо тільки в доларах. */
    priceUah: integer('price_uah'),
    /**
     * Реальна ціна з останнього поста в Telegram — та, за яку продавець
     * насправді готовий віддати. Історія цін по постах живе в `telegram_posts`;
     * тут лежить остання, щоб картка показувала обидві ціни поруч.
     */
    priceFromPost: integer('price_from_post'),
    /** Коли оголошення зʼявилось на AUTO.RIA — з цього рахуємо «днів у продажу». */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** Оригінальні URL з RIA — тільки для довідки, вони помруть разом з оголошенням. */
    photos: text('photos').array().notNull().default([]),
    /** Ключі наших копій фото у сховищі: listings/{auto_ria_id}/{n}-{hash8}.{ext}. */
    photosLocal: text('photos_local').array().notNull().default([]),

    /**
     * Колонки, які людина виправила руками. Парсер їх більше не чіпає: cron має
     * оновлювати ціну, але не повертати марку, яку він колись витягнув невірно.
     * Позначка на рівні поля, а не картки — інакше довелось би вибирати між
     * «оновлюй усе» і «не оновлюй нічого».
     */
    manualFields: text('manual_fields').array().notNull().default([]),
    /**
     * Фото, додані руками. Окремо від `photos_local` навмисно: перерозбір
     * перебудовує той масив із `photos` і видаляє зі сховища все зайве —
     * ручні знімки він знищив би при першому ж прогоні.
     */
    photosManual: text('photos_manual').array().notNull().default([]),

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
    // Головний запит черги: не архівні, за датою контакту.
    index('listings_archived_next_contact_at_idx').on(t.archived, t.nextContactAt),
    // Фільтри списку. На сотні рядків Postgres їх ще ігноруватиме, але саме ці
    // три діапазони крутять руками найчастіше.
    index('listings_price_usd_idx').on(t.priceUsd),
    index('listings_year_idx').on(t.year),
    index('listings_published_at_idx').on(t.publishedAt),
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

/** Що саме ми смикали: api — developers.ria.com, page — сторінка, photo — файл з CDN. */
export const REQUEST_KINDS = ['api', 'page', 'photo'] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]

/**
 * Журнал вихідних запитів до джерел. Потрібен як лічильник квоти AUTO.RIA
 * (30/год і 1000/міс) — у памʼяті його тримати не можна, бо на Vercel процес
 * не живе між запитами.
 */
export const sourceRequests = pgTable(
  'source_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').$type<SourceName>().notNull(),
    kind: text('kind').$type<RequestKind>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('source_requests_source_kind_created_at_idx').on(t.source, t.kind, t.createdAt)],
)

/**
 * Робочі налаштування і сповіщення — по рядку на користувача. Вигляд
 * (тема, шрифт, розмір, щільність) сюди не потрапляє: він у cookie, бо в
 * кожного свій пристрій і свої очі.
 */
export const userSettings = pgTable('user_settings', {
  author: text('author').$type<Author>().primaryKey(),
  /** Через скільки днів дзвонити після записаного дзвінка; 0 — не ставити дату. */
  callFollowupDays: integer('call_followup_days').notNull().default(3),
  /** Після скількох днів в оголошенні підсвічувати «довго висить». */
  longStandingDays: integer('long_standing_days').notNull().default(60),
  /** usd | uah | both */
  currency: text('currency').notNull().default('usd'),
  defaultSort: text('default_sort').notNull().default('contact'),
  notifyNew: boolean('notify_new').notNull().default(true),
  notifyComment: boolean('notify_comment').notNull().default(true),
  notifyPrice: boolean('notify_price').notNull().default(true),
  notifyStage: boolean('notify_stage').notNull().default(true),
  /** HH:MM за Києвом. */
  digestAt: text('digest_at').notNull().default('08:00'),
  quietFrom: text('quiet_from').notNull().default('22:00'),
  quietTo: text('quiet_to').notNull().default('08:00'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/**
 * Збережені набори фільтрів. Три готові («Мої гарячі», «Довго висять»,
 * «Дешевші за ціль») живуть константами в коді — це просто URL; сюди лягають
 * лише ті, які завели руками.
 */
export const filterPresets = pgTable(
  'filter_presets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    author: text('author').$type<Author>().notNull(),
    name: text('name').notNull(),
    /** Серіалізований запит списку: `price_max=10000&sort=days:desc`. */
    query: text('query').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('filter_presets_created_at_idx').on(t.createdAt)],
)

/**
 * Курс долара на день. Лежить у базі, а не в памʼяті процесу: на Vercel процес
 * не живе між запитами, і кеш у памʼяті означав би запит до НБУ мало не на
 * кожен парсинг. Заразом лишається історія — за яким курсом рахувалась ціна.
 */
export const exchangeRates = pgTable('exchange_rates', {
  /** День курсу за Києвом. */
  date: date('date', { mode: 'string' }).primaryKey(),
  /** Скільки гривень за долар. */
  usdUah: numeric('usd_uah', { precision: 8, scale: 4, mode: 'number' }).notNull(),
  /** Звідки взяли: nbu | env. */
  source: text('source').notNull().default('nbu'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})

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
/*  Telegram                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Переслані пости з груп. Append-only: одне авто — багато постів, і саме на цій
 * історії тримається головний аргумент у розмові («місяць тому ви просили 9500»).
 *
 * Живуть окремо від картки навмисно: парсер згодом перезапише колонки, а пост
 * лишиться як є — разом із телефоном і реальною ціною, яких на сторінці
 * оголошення немає взагалі.
 */
export const telegramPosts = pgTable(
  'telegram_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    /** Числовий id групи ПОХОДЖЕННЯ, не нашого чату з ботом. */
    chatId: text('chat_id').notNull(),
    /** Якір альбому — найменший message_id групи. */
    messageId: integer('message_id').notNull(),
    /** Усі повідомлення альбому: Telegram шле його кількома апдейтами. */
    originMessageIds: integer('origin_message_ids').array().notNull().default([]),
    /** Назва групи — її видно в стрічці постів на картці. */
    originTitle: text('origin_title'),
    mediaGroupId: text('media_group_id'),
    /** Коли пересилач сховав джерело — ловить той самий пост за текстом. */
    textHash: text('text_hash'),
    forwardedBy: text('forwarded_by').$type<Author>().notNull(),
    /** Дата ОРИГІНАЛЬНОГО поста, не пересилання. */
    postedAt: timestamp('posted_at', { withTimezone: true }),
    text: text('text'),
    /** Що ми з нього дістали евристиками — разом із ненадійним. */
    parsed: jsonb('parsed'),
    /** Сирий апдейт: для telegram це замість html_raw. */
    raw: jsonb('raw'),
    priceUsd: integer('price_usd'),
    priceUah: integer('price_uah'),
    /** У чому продавець назвав ціну. */
    priceCurrency: text('price_currency'),
    /** Усі посилання з поста; картку створює лише перше на відоме джерело. */
    links: text('links').array().notNull().default([]),
    /** Ключі наших копій; рахуються з file_unique_id, а не з посилання. */
    photosLocal: text('photos_local').array().notNull().default([]),
    /** Усі фото цього поста в сховищі. Для telegram це і є повнота архіву. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Той самий пост, переслений двічі, — це один рядок.
    uniqueIndex('telegram_posts_chat_message_idx').on(t.chatId, t.messageId),
    index('telegram_posts_listing_id_posted_at_idx').on(t.listingId, t.postedAt),
    // Жорсткий бекстоп проти двох обробників одного альбому: другий спіткнеться
    // об унікальність і піде доклеювати фото до наявного поста.
    uniqueIndex('telegram_posts_media_group_idx')
      .on(t.chatId, t.mediaGroupId)
      .where(sql`media_group_id is not null`),
    index('telegram_posts_text_hash_idx').on(t.textHash),
  ],
)

/**
 * Стейджинг апдейтів. Альбом приїжджає кількома окремими апдейтами з одним
 * `media_group_id`, а підпис лежить, як правило, у першому — обробити кожен
 * окремо означало б створити картку без фото і чотири сироти поруч.
 *
 * На Vercel процес не живе між запитами, тому буфер саме в базі.
 * `update_id` первинним ключем — це ще й дедуп: Telegram ретраїть апдейт,
 * якщо не отримав 200 вчасно.
 */
export const telegramInbox = pgTable(
  'telegram_inbox',
  {
    updateId: bigint('update_id', { mode: 'number' }).primaryKey(),
    chatId: text('chat_id').notNull(),
    messageId: integer('message_id').notNull(),
    mediaGroupId: text('media_group_id'),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    /** Атомарний claim: обробник групи рівно один, скільки б апдейтів не прийшло. */
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    index('telegram_inbox_media_group_idx').on(t.mediaGroupId, t.receivedAt),
    // Черга «застряглих»: інстанс міг померти між claim і обробкою.
    index('telegram_inbox_unprocessed_idx')
      .on(t.claimedAt)
      .where(sql`processed_at is null`),
  ],
)

/**
 * Наші вихідні повідомлення про конкретне авто. Потрібне рівно для одного:
 * відповідь реплаєм на сповіщення має ставати коментарем до того самого авто.
 */
export const tgMessages = pgTable(
  'tg_messages',
  {
    chatId: text('chat_id').notNull(),
    messageId: integer('message_id').notNull(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.messageId] })],
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
  telegramPosts: many(telegramPosts),
}))

export const telegramPostsRelations = relations(telegramPosts, ({ one }) => ({
  listing: one(listings, { fields: [telegramPosts.listingId], references: [listings.id] }),
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
export type ExchangeRate = typeof exchangeRates.$inferSelect
export type FilterPreset = typeof filterPresets.$inferSelect
export type UserSettings = typeof userSettings.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type PricePoint = typeof priceHistory.$inferSelect
export type NewPricePoint = typeof priceHistory.$inferInsert
export type SourceRequest = typeof sourceRequests.$inferSelect
export type LoginAttempt = typeof loginAttempts.$inferSelect
export type NewLoginAttempt = typeof loginAttempts.$inferInsert
export type TelegramPost = typeof telegramPosts.$inferSelect
export type NewTelegramPost = typeof telegramPosts.$inferInsert
export type TelegramInboxRow = typeof telegramInbox.$inferSelect
