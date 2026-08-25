# Car Hunt

Трекер пошуку авто для двох людей (я + батько). Кидаєш посилання → картка з даними;
історія дзвінків/коментарів, черга «кому дзвонити сьогодні», сповіщення в Telegram.
Джерела: AUTO.RIA, далі OLX і Telegram. Мобільний-first, користувачів двоє.

**`SPEC.md` — джерело правди.** Суперечність із промтом — питай, не вигадуй.

## Стек
Next.js 15 (App Router) · TS strict · Tailwind v4 · ESLint 9 · npm · Drizzle + PostgreSQL
(Neon) · Zod на вхідні дані · cheerio. Деплой Vercel, cron — GitHub Actions / Vercel Cron.
**Не додавати:** окремий бекенд (Nest), Redux, tRPC, GraphQL, Docker, мікросервіси.
Тести — лише vitest на `extractListingRef`, решту не покривати.

## Команди
```bash
npm run dev      # localhost:3000; build під час dev затирає .next — не роби так
npm run build    # разом з npm run lint і npm test має бути чисто
npm run db:generate | db:migrate | db:studio | db:seed   # схема → БД → тестові авто
```
Змінні — в `.env.local` (не комітиться), перелік у `.env.example`.

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
- Ліміт AUTO.RIA API: 30/год, 1000/міс — лічильник у `source_requests`, лише для
  `kind: 'api'`. Вичерпався — листинг лишається `pending`, cron добере. ≥2 с між запитами.
- Продавці склеюються по `(source, source_user_id)`, телефон — додатковий ключ
  (`src/db/sellers.ts`): RIA ховає номер за кліком, а `userId` видно завжди.
- Telegram-сповіщення йде **іншому** користувачу, не автору дії.

## Дизайн («Візуальний напрямок» у SPEC)

Орієнтир — український номерний знак і приладова панель. Фон `#EEEFEC`, текст `#16181A`,
акцент `#0057B8`, сигнальний `#FFD200` (тільки «прострочено»). Картки білі, радіус 4px,
без тіней, рамка `#D8DAD5`. Шрифти: IBM Plex Sans (в Archivo зі SPEC немає кирилиці) +
IBM Plex Mono (всі числа). Анімацій майже нема.
**Заборонено:** кремовий фон, теракотовий акцент, великі serif-заголовки.

## Робочий процес

Йдемо по пунктах розділу «Порядок робіт» у SPEC. Після кожного — робочий стан, який
можна запустити, і підсумок «що зроблено / що перевірити руками». Секрети не комітити.
