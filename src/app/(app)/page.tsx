import { ListFilters } from '@/components/ListFilters'
import { ListingCard } from '@/components/ListingCard'
import { ListPager } from '@/components/ListPager'
import { PasteBar } from '@/components/PasteBar'
import { PendingPoller } from '@/components/PendingPoller'
import { PresetBar } from '@/components/PresetBar'
import { SortBar } from '@/components/SortBar'
import { bucketByContact, getListings, listCities, type ListingRow } from '@/db/list'
import { listPresets } from '@/db/presets'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { todayInKyiv } from '@/lib/dates'
import { isDefaultSort, parseListQuery, serializeListQuery } from '@/lib/list-query'
import type { Preset } from '@/lib/presets'
import { userNames } from '@/lib/users'

export const metadata = { title: 'Черга — Car Hunt' }

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
  const query = parseListQuery(params)

  const [page, presets, cities] = await Promise.all([
    getListings(query),
    listPresets(),
    listCities(),
  ])

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

  const sections = isDefaultSort(query)
    ? (() => {
        const buckets = bucketByContact(page.rows)
        return [
          { key: 'overdue', title: 'Прострочено', rows: buckets.overdue, signal: true },
          { key: 'today', title: 'Сьогодні', rows: buckets.today, signal: false },
          { key: 'later', title: 'Далі', rows: buckets.later, signal: false },
        ]
      })()
    : [{ key: 'all', title: '', rows: page.rows, signal: false }]

  return (
    <div className="space-y-5">
      <PasteBar />
      <PendingPoller ids={pending} />
      <PresetBar presets={saved} search={search} />
      <ListFilters query={query} cities={cities} total={page.total} />
      <SortBar query={query} />

      {page.total === 0 ? (
        <p className="rounded-card border border-line bg-white p-4 text-[14px] text-muted">
          {search
            ? 'Під ці фільтри не підходить жодне авто. Спробуй прибрати частину.'
            : 'Черга порожня. Встав посилання на оголошення зверху — картка зʼявиться тут.'}
        </p>
      ) : null}

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
              />
            ))}
          </section>
        ),
      )}

      <ListPager query={query} total={page.total} />
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
