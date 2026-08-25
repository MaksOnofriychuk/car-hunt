import { cookies } from 'next/headers'

import { ListFilters } from '@/components/ListFilters'
import { ListingCard } from '@/components/ListingCard'
import { ListingTable, type TableRow } from '@/components/ListingTable'
import { ListPager } from '@/components/ListPager'
import { PasteBar } from '@/components/PasteBar'
import { PendingPoller } from '@/components/PendingPoller'
import { PresetBar } from '@/components/PresetBar'
import { SortBar } from '@/components/SortBar'
import { ViewToggle } from '@/components/ViewToggle'
import { bucketByContact, getListings, listCities, type ListingRow } from '@/db/list'
import { listPresets } from '@/db/presets'
import { getSettings } from '@/db/settings'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { todayInKyiv } from '@/lib/dates'
import { isDefaultSort, parseListQuery, serializeListQuery } from '@/lib/list-query'
import { displayPhotos } from '@/lib/photos'
import { builtInPresets, type Preset } from '@/lib/presets'
import { userNames } from '@/lib/users'
import { LOOK_COOKIE, parseLook } from '@/lib/look'
import { parseViewPrefs, VIEW_COOKIE } from '@/lib/view-prefs'

export const metadata = { title: 'Черга — Car Hunt' }

/** Куди дивиться кожне сортування за замовчуванням, щоб не питати про це двічі. */
const DEFAULT_DIRECTION = {
  contact: 'asc',
  added: 'desc',
  price: 'asc',
  days: 'desc',
} as const

/**
 * Робоча черга. Фільтри, сортування і сторінка живуть в URL, тому відфільтрований
 * список можна кинути посиланням.
 *
 * Три секції «Прострочено / Сьогодні / Далі» лишаються тільки при типовому
 * сортуванні: щойно обрано інше, вони почали б брехати, і список стає плоским.
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

  // Сортування за замовчуванням із налаштувань діє, поки в URL нічого не обрано.
  const query = parsed.sort === null && settings.defaultSort !== 'contact'
    ? { ...parsed, sort: { field: settings.defaultSort, dir: DEFAULT_DIRECTION[settings.defaultSort] } }
    : parsed

  const [page, presets, cities] = await Promise.all([
    getListings(query),
    listPresets(),
    listCities(),
  ])

  const prefs = parseViewPrefs(jar.get(VIEW_COOKIE)?.value)
  const look = parseLook(jar.get(LOOK_COOKIE)?.value)
  const asTable = prefs.mode === 'table'
  const display = { currency: settings.currency, longStandingDays: settings.longStandingDays }

  const today = todayInKyiv()
  const names = userNames()
  const search = serializeListQuery(query)
  const pending = page.rows
    .filter((row) => row.listing.status === 'pending')
    .map((row) => row.listing.id)

  const saved: Preset[] = presets.map((preset) => ({
    key: preset.id,
    name: preset.name,
    query: preset.query,
    custom: true,
  }))

  // Секції має сенс показувати лише коли список стоїть у порядку дат контакту.
  const sections = isDefaultSort(parsed) && settings.defaultSort === 'contact'
    ? (() => {
        const buckets = bucketByContact(page.rows)
        return [
          { key: 'overdue', title: 'Прострочено', rows: buckets.overdue, signal: true },
          { key: 'today', title: 'Сьогодні', rows: buckets.today, signal: false },
          { key: 'later', title: 'Далі', rows: buckets.later, signal: false },
        ]
      })()
    : [{ key: 'all', title: '', rows: page.rows, signal: false }]

  // Фото для таблиці розбирає сервер: `displayPhotos` ходить у сховище, і
  // клієнтському компоненту цього робити нічим.
  const tableRows: TableRow[] = page.rows.map((row) => ({
    row,
    photo: displayPhotos(row.listing)[0] ?? null,
  }))

  return (
    <div className="space-y-5">
      <div className="mx-auto w-full max-w-[560px] space-y-5">
        <PasteBar />
        <PendingPoller ids={pending} />
        <PresetBar
          presets={saved}
          builtIn={builtInPresets(settings.longStandingDays)}
          search={search}
        />
        <ListFilters query={query} cities={cities} total={page.total} />

        <div className="flex items-center gap-2">
          {/* На вузькому екрані перемикача немає — там таблиці не буде ніколи. */}
          <ViewToggle prefs={prefs} />
          {asTable ? null : <SortBar query={query} />}
        </div>
      </div>

      {page.total === 0 ? (
        <p className="mx-auto w-full max-w-[560px] rounded-card border border-line bg-card p-4 text-[14px] text-muted">
          {search
            ? 'Під ці фільтри не підходить жодне авто. Спробуй прибрати частину.'
            : 'Черга порожня. Встав посилання на оголошення зверху — картка зʼявиться тут.'}
        </p>
      ) : null}

      {/* Таблиця займає всю ширину, список лишається вузькою колонкою. */}
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
        {sections.map((section) =>
          section.rows.length === 0 ? null : (
            <section key={section.key} className="space-y-2">
              {section.title ? (
                <SectionTitle
                  title={section.title}
                  count={section.rows.length}
                  signal={section.signal}
                />
              ) : null}

              {section.rows.map((row: ListingRow) => (
                <ListingCard
                  key={row.listing.id}
                  row={row}
                  today={today}
                  viewer={author}
                  names={names}
                  search={search}
                  display={display}
                  density={look.density}
                />
              ))}
            </section>
          ),
        )}
      </div>

      <div className="mx-auto w-full max-w-[560px]">
        <ListPager query={query} total={page.total} />
      </div>
    </div>
  )
}

function SectionTitle({
  title,
  count,
  signal,
}: {
  title: string
  count: number
  signal: boolean
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      {signal ? <span className="h-2.5 w-2.5 bg-signal" /> : null}
      <h2 className={cn('text-[11px] font-semibold uppercase tracking-[0.12em]')}>{title}</h2>
      <span className="font-mono text-[11px] tabular-nums text-muted">{count}</span>
    </div>
  )
}
