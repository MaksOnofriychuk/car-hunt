# Car Hunt

Трекер пошуку авто на AUTO.RIA для двох людей (я + батько). Кидаєш посилання → у базі
картка з даними; далі історія дзвінків/коментарів, черга «кому дзвонити сьогодні»,
сповіщення в Telegram. Мобільний-first. Користувачів рівно двоє — без ролей і онбордингу.

**`SPEC.md` — джерело правди.** Суперечність із промтом — питай, не вигадуй.

## Стек

Next.js 15 (App Router) · TS strict · Tailwind v4 · ESLint 9 · npm · Drizzle + PostgreSQL
(Neon) · Zod на всі вхідні дані. Деплой Vercel, cron — GitHub Actions / Vercel Cron.
**Не додавати:** окремий бекенд (Nest), Redux, tRPC, GraphQL, Docker, мікросервіси.
Тести — лише vitest на `extractAutoRiaId`, решту не покривати.

## Команди

```bash
npm run dev      # http://localhost:3000
npm run build    # разом з npm run lint має бути чисто, без попереджень
npm run db:generate | db:migrate | db:studio | db:seed   # схема → БД → тестові авто
```
Змінні — в `.env.local` (не комітиться); перелік тримаємо в `.env.example`.

## Структура

```
src/app/            # сторінки: / (черга), /listing/[id], /sellers, /login
src/app/api/        # ingest, listings/[id], events, cron/*, telegram/webhook
src/components/     # UI
src/db/             # schema.ts, index.ts, stage.ts (етап пачкою, DISTINCT ON)
src/lib/            # stages.ts; autoria/ — url.ts + парсери; telegram/ — бот
drizzle/            # міграції   scripts/ — seed, set-webhook   docs/ — інструкції
```

## Ключові принципи

- `events` — **append-only**. Нічого не редагуємо і не видаляємо.
- Етап авто **не зберігається полем** — рахується з останньої події `stage_change`:
  `src/lib/stages.ts` (чиста `currentStage`), `src/db/stage.ts` (`getStages` для списків).
- Посилання не губиться ніколи: збій парсера → `status: 'failed'`, картка лишається.
- Архів назавжди і незалежно від RIA: `snapshot_raw` + `html_raw` (gzip→base64) +
  `description_text` + копії фото в `photos_local`. Пишеться раз, не перезаписується.
  `archived_at IS NULL` = архів неповний, cron добирає. Файли — `FileStorage`: R2 або `/storage`.
- Ліміт AUTO.RIA API: 30 запитів/год, 1000/міс, ≥2 с між запитами — черга, не 429.
- Telegram-сповіщення йде **іншому** користувачу, не автору дії.

## Дизайн («Візуальний напрямок» у SPEC)

Орієнтир — український номерний знак і приладова панель. Фон `#EEEFEC`, текст
`#16181A`, акцент `#0057B8`, сигнальний `#FFD200` (тільки «прострочено»).
Картки білі, радіус 4px, без тіней, рамка `#D8DAD5`. Шрифти: Archivo (інтерфейс),
IBM Plex Mono (всі числа). Анімацій майже нема.
**Заборонено:** кремовий фон, теракотовий акцент, великі serif-заголовки.

## Робочий процес

Йдемо по пунктах розділу «Порядок робіт» у SPEC. Після кожного — робочий стан, який
можна запустити, і підсумок «що зроблено / що перевірити руками». Секрети не комітити.
