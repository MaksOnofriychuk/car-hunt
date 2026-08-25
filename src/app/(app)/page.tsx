import { cookies } from 'next/headers'

import { ListFilters } from '@/components/ListFilters'
import { ListingCard } from '@/components/ListingCard'
import { ListingTable, type TableRow } from '@/components/ListingTable'
import { FloatingPager } from '@/components/FloatingPager'
import { ListPager } from '@/components/ListPager'
import { PasteBar } from '@/components/PasteBar'
import { PendingPoller } from '@/components/PendingPoller'
import { PerPageBar } from '@/components/PerPageBar'
import { PresetBar } from '@/components/PresetBar'
import { ViewToggle } from '@/components/ViewToggle'
import { bucketByContact, getListings, listCities, type ListingRow } from '@/db/list'
import { listPresets } from '@/db/presets'
import { getSettings } from '@/db/settings'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { todayInKyiv } from '@/lib/dates'
import { cars, formatNumber } from '@/lib/format'
import {
  DEFAULT_QUERY,
  isDefaultSort,
  parseListQuery,
  serializeListQuery,
} from '@/lib/list-query'
import { LOOK_COOKIE, parseLook } from '@/lib/look'
import { displayPhotos } from '@/lib/photos'
import { builtInPresets, type Preset } from '@/lib/presets'
import { userNames } from '@/lib/users'
import { parseViewPrefs, VIEW_COOKIE } from '@/lib/view-prefs'

export const metadata = { title: 'Черга' }

/** Куди дивиться кожне сортування за замовчуванням, щоб не питати про це двічі. */
const DEFAULT_DIRECTION = {
  contact: 'asc',
  added: 'desc',
  price: 'asc',
  days: 'desc',
} as const

/** Скільки прибраних з черги показувати внизу, перш ніж відправити у фільтр. */
const ARCHIVE_LIMIT = 12

/**
 * Робоча черга. Три секції — прострочено, сьогодні, далі — і архів згорнутими
 * рядками в самому низу: нічого не видаляється, але й уваги більше не просить.
 *
 * Секції живуть тільки при типовому сортуванні: у порядку за ціною вони
 * означали б неправду, тому список тоді стає плоским.
 */
export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { author } = await requireSession()
  const params = await searchParams
  const parsed = parseListQuery(params)

  const [settings, jar] = await Promise.all([getSettings(author), cookies()])

  const query =
    parsed.sort === null && settings.defaultSort !== 'contact'
      ? {
          ...parsed,
          sort: {
            field: settings.defaultSort,
            dir: DEFAULT_DIRECTION[settings.defaultSort],
          },
        }
      : parsed

  const [page, archive, presets, cities] = await Promise.all([
    getListings(query),
    // Архів тягнемо окремо і лише тоді, коли його не показують у списку.
    parsed.archived
      ? Promise.resolve(null)
      : getListings({ ...DEFAULT_QUERY, archived: true, per: 'all' }, { archivedOnly: true }),
    listPresets(),
    listCities(),
  ])

  const today = todayInKyiv()
  const names = userNames()
  const search = serializeListQuery(query)
  const prefs = parseViewPrefs(jar.get(VIEW_COOKIE)?.value)
  const look = parseLook(jar.get(LOOK_COOKIE)?.value)
  const asTable = prefs.mode === 'table'
  const display = { currency: settings.currency, longStandingDays: settings.longStandingDays }
  const pending = page.rows
    .filter((row) => row.listing.status === 'pending')
    .map((row) => row.listing.id)

  const saved: Preset[] = presets.map((preset) => ({
    key: preset.id,
    name: preset.name,
    query: preset.query,
    custom: true,
  }))

  // Секції мають сенс тоді, коли список справді стоїть у порядку дат контакту:
  // або типово, або тому, що цю колонку обрали руками.
  const sectioned =
    (isDefaultSort(parsed) && settings.defaultSort === 'contact') ||
    parsed.sort?.field === 'contact'
  const buckets = sectioned ? bucketByContact(page.rows) : null

  const tableRows: TableRow[] = page.rows.map((row) => ({
    row,
    photo: displayPhotos(row.listing, row.postPhoto ? [row.postPhoto] : [])[0] ?? null,
  }))

  const card = (row: ListingRow, variant: 'full' | 'compact' = 'full') => (
    <ListingCard
      key={row.listing.id}
      row={row}
      today={today}
      viewer={author}
      names={names}
      search={search}
      display={display}
      density={look.density}
      variant={variant}
    />
  )

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[560px] space-y-3">
        <header className="flex items-baseline gap-2 px-1">
          <h1 className="t-title">Черга</h1>
          <span className="t-num text-[13px] text-faint">
            {formatNumber(page.total)} {cars(page.total)}
          </span>
          <div className="ml-auto">
            <ViewToggle prefs={prefs} />
          </div>
        </header>

        <PasteBar />
        <PendingPoller ids={pending} />
        <PresetBar
          presets={saved}
          builtIn={builtInPresets(settings.longStandingDays)}
          search={search}
        />
        <ListFilters query={query} cities={cities} total={page.total} />
        <PerPageBar query={query} total={page.total} />
      </div>

      {page.total === 0 ? (
        <p className="surface mx-auto w-full max-w-[560px] t-body p-4 text-muted">
          {search
            ? 'Під ці фільтри не підходить жодне авто. Спробуй прибрати частину.'
            : 'Черга порожня. Встав посилання зверху — картка зʼявиться тут.'}
        </p>
      ) : null}

      {asTable && page.total > 0 ? (
        <div className="hidden lg:block">
          <ListingTable
            rows={tableRows}
            prefs={prefs}
            context={{
              query,
              today,
              search,
              viewer: author,
              names,
              currency: settings.currency,
              longStandingDays: settings.longStandingDays,
              density: look.density,
            }}
          />
        </div>
      ) : null}

      <div className={cn('mx-auto w-full max-w-[560px] space-y-5', asTable && 'lg:hidden')}>
        {buckets ? (
          <>
            <Section title="Прострочено" count={buckets.overdue.length} tone="danger">
              {buckets.overdue.map((row) => card(row))}
            </Section>
            <Section title="Сьогодні" count={buckets.today.length} tone="accent">
              {buckets.today.map((row) => card(row))}
            </Section>
            <Section title="Далі" count={buckets.later.length} tone="faint">
              {/* Тут авто ще не на часі — рядок замість картки з кнопками. */}
              {buckets.later.map((row) =>
                row.listing.status === 'pending' || row.listing.status === 'failed'
                  ? card(row)
                  : card(row, 'compact'),
              )}
            </Section>
          </>
        ) : (
          <div className="space-y-2">{page.rows.map((row) => card(row))}</div>
        )}

        <ListPager query={query} total={page.total} />
        <FloatingPager query={query} total={page.total} />

        {archive && archive.rows.length > 0 ? (
          <Section title="Архів" count={archive.total} tone="faint">
            {archive.rows.slice(0, ARCHIVE_LIMIT).map((row) => card(row, 'compact'))}
            {archive.total > ARCHIVE_LIMIT ? (
              <p className="t-body px-1 text-faint">
                Показано {ARCHIVE_LIMIT} із {archive.total}. Решта — у фільтрі «з архівними».
              </p>
            ) : null}
          </Section>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Заголовок секції: підпис, лічильник і лінійка на всю ширину. Колір лінійки і
 * є станом — червона видно раніше, ніж прочитається слово.
 */
function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string
  count: number
  tone: 'danger' | 'accent' | 'faint'
  children: React.ReactNode
}) {
  if (count === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <h2
          className={cn(
            't-micro',
            tone === 'danger' && 'text-danger',
            tone === 'accent' && 'text-accent-lit',
            tone === 'faint' && 'text-faint',
          )}
        >
          {title}
        </h2>
        <span
          className={cn(
            't-num rounded-chip border px-1.5 text-[11px]',
            tone === 'danger' && 'border-danger text-danger',
            tone === 'accent' && 'border-accent text-accent-lit',
            tone === 'faint' && 'border-edge text-faint',
          )}
        >
          {count}
        </span>
        <span
          className={cn(
            'h-px flex-1',
            tone === 'danger' && 'bg-danger/40',
            tone === 'accent' && 'bg-accent/40',
            tone === 'faint' && 'bg-edge',
          )}
        />
      </div>

      <div className="space-y-2">{children}</div>
    </section>
  )
}
