# Car Hunt

Трекер пошуку авто для двох людей (я + батько). Кидаєш посилання → картка з даними;
історія дзвінків/коментарів, черга «кому дзвонити сьогодні», сповіщення в Telegram.
Джерела: AUTO.RIA, далі OLX і Telegram. Мобільний-first, користувачів двоє.

**`SPEC.md` — джерело правди.** Суперечність із промтом — питай, не вигадуй.

## Стек
Next.js 15 (App Router) · TS strict · Tailwind v4 · ESLint 9 · npm · Drizzle + PostgreSQL
(Neon) · Zod на вхідні дані · cheerio · TanStack Table (headless, лише черга). Деплой Vercel, cron — GitHub Actions / Vercel Cron.
**Не додавати:** окремий бекенд (Nest), Redux, tRPC, GraphQL, Docker, мікросервіси.
Тести — лише vitest на `extractListingRef`, решту не покривати.

## Команди
```bash
npm run dev      # localhost:3000; build під час dev затирає .next — не роби так
npm run build    # разом з npm run lint і npm test має бути чисто
npm run db:generate | db:migrate | db:studio | db:seed   # схема → БД → тестові авто
npm run reparse  # перерозбір збережених html_raw новим парсером (--dry, --archive)
```
Змінні — в `.env.local` (не комітиться), перелік у `.env.example`.
Деплой і його передумови — `docs/deploy.md`; вхідні/вихідні Telegram — `docs/telegram.md`.

## Структура
```
src/app/            # / (черга), /listing/[id], /sellers, /login + api/
src/components/     # UI      src/db/ — schema, queries, stage (DISTINCT ON)
src/lib/sources/    # реєстр джерел + парсер autoria (3 шари), http з квотою
src/lib/            # storage/ (R2 або /storage), ingest, archive, auth, stages, format
drizzle/            # міграції   scripts/ — seed
```

## Ключові принципи

- `events` — **append-only**. Нічого не редагуємо і не видаляємо.
- Етап авто **не зберігається полем** — рахується з останньої події `stage_change`:
  `src/lib/stages.ts` (чиста `currentStage`), `src/db/stage.ts` (`getStages` для списків).
- Посилання не губиться ніколи: збій парсера або невідомий домен → картка з
  `status: 'failed'` (невідомий домен ще й `source: 'manual'`). Ключ авто — пара
  `(source, source_id)`; нове джерело = файл + рядок у `src/lib/sources/index.ts`.
- Архів назавжди: `snapshot_raw` + `html_raw` (gzip→base64) + `description_text` +
  фото в `photos_local`. Пишеться раз; `archived_at IS NULL` = неповний, cron добирає.
- Фото — **лише з вузла галереї** `PhotoSliderTemplate` у `window.__PINIA__`:
  регулярка по сторінці тягла чужі авто з блоків «схожі» та «інші пропозиції
  продавця». Характеристики — теж зі стану, по id вузлів
  (`src/lib/sources/autoria/specs.ts`); усе, під що немає колонки, живе
  в `snapshot_raw.specs`.
- OLX: дані зі `window.__PRERENDERED_STATE__` (`state.ad.ad`), характеристики —
  список `params` (пробіг там **у тисячах**). Ходимо через `transport: 'tls12'`:
  CloudFront ріже TLS-відбиток Node, а не наш User-Agent. Ціна в гривні —
  `price_usd` рахується за курсом НБУ з таблиці `exchange_rates`, а подія
  `price_change` порівнює ціну **у валюті оголошення**.
- Налаштування діляться за місцем життя: вигляд (тема, розмір, шрифт, щільність)
  — cookie `car_hunt_look` на пристрої; робота і сповіщення — таблиця
  `user_settings` на користувача. Темна тема — власна палітра в `globals.css`,
  а не інверсія; поверхні карток — `bg-card`, ніде не `bg-white`.
- Режим черги (список/таблиця) і набір колонок — у cookie `car_hunt_view`:
  сервер читає її при рендері, тому таблиця малюється одразу. Таблиця — тільки
  з `lg`; нижня межа верстки 390 px.
- Стан списку авто (фільтри, сортування, сторінка) живе **в URL**, не в памʼяті:
  `src/lib/list-query.ts` розбирає і збирає, `src/db/list.ts` — одна проєкція
  рядка для всіх списків, `src/db/list-filters.ts` — той самий білдер SQL.
- Руками виправлене парсер не затирає: `listings.manual_fields` — перелік колонок
  на рівні **поля**, через `dropManual()` проходить усе, що пише парсер. Фото,
  додані руками, живуть у `photos_manual` — `reparse` чистить лише `photos_local`.
- Ліміт AUTO.RIA API: 30/год, 1000/міс — лічильник у `source_requests`, лише для
  `kind: 'api'`. Вичерпався — листинг лишається `pending`, cron добере. ≥2 с між запитами.
- Продавці склеюються по `(source, source_user_id)`, телефон — додатковий ключ
  (`src/db/sellers.ts`): RIA ховає номер за кліком, а `userId` видно завжди.
- Telegram-сповіщення йде **іншому** користувачу, не автору дії.

## Дизайн («Візуальний напрямок» у SPEC)

Система «Світні краї» — аркуші в `design/`, повний опис у SPEC. Темна тема основна,
світла — пара до неї; **тем рівно дві**, системного «авто» немає. Токени в
`globals.css`: тло `#06070A`, поверхня градієнтом `#151922→#0B0D12`, акцент `#0F6BD8`
(як текст — `#5AA2FF`), ok `#35D07F`, danger `#FF5A5A`, warn `#FFC46B`. Шрифти:
Inter для інтерфейсу, IBM Plex Mono для всіх чисел.

Глибина — градієнт + світна волосінь + сяйво в куті, **ніколи `drop-shadow`**.
У компонентах немає хардкодних кольорів — тільки змінні й готові класи: `.surface`,
`.sunken`, `.rib`, `.btn*`, `.chip*`, `.field*`, `.t-display/.t-title/.t-body/.t-micro/.t-num`.
`.surface` створює контекст накладання, тому випадні панелі — порталом у `body`.
**Заборонено:** кремовий фон, теракотовий акцент, великі serif-заголовки, тіні.

Перевіряти зроблене знімками: `npm run shot -- /` (390px, `--wide`, `--theme light`),
стенд усіх станів картки — `/design` (лише в dev).

## Робочий процес

Йдемо по пунктах розділу «Порядок робіт» у SPEC. Після кожного — робочий стан, який
можна запустити, і підсумок «що зроблено / що перевірити руками». Секрети не комітити.
