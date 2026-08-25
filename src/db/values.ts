/**
 * Переліки значень домену — **без drizzle**.
 *
 * Винесені зі `schema.ts` навмисно: клієнтські компоненти (фільтри, вибір
 * етапу) імпортують ці масиви, а разом зі схемою в браузер приїжджав би ORM —
 * 38 КБ коду, який там нічого не робить. Та сама причина, з якої
 * `src/lib/users.ts` тримає власну копію переліку авторів для middleware.
 *
 * У базі це звичайний `text`, щоб не мучитись з ALTER TYPE.
 */

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


/** Що саме ми смикали: api — developers.ria.com, page — сторінка, photo — файл з CDN. */
export const REQUEST_KINDS = ['api', 'page', 'photo'] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]
