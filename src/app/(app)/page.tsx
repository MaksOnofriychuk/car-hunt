import { ListingCard } from '@/components/ListingCard'
import { PasteBar } from '@/components/PasteBar'
import { getQueue, type QueueCard } from '@/db/queries'
import { requireSession } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { todayInKyiv } from '@/lib/dates'
import { userNames } from '@/lib/users'

export const metadata = { title: 'Черга — Car Hunt' }

export default async function QueuePage() {
  const { author } = await requireSession()
  const queue = await getQueue()
  const today = todayInKyiv()
  const names = userNames()

  const total = queue.overdue.length + queue.today.length + queue.later.length

  const sections = [
    { key: 'overdue', title: 'Прострочено', cards: queue.overdue, signal: true },
    { key: 'today', title: 'Сьогодні', cards: queue.today, signal: false },
    { key: 'later', title: 'Далі', cards: queue.later, signal: false },
  ] as const

  return (
    <div className="space-y-5">
      <PasteBar />

      {total === 0 ? (
        <p className="rounded-card border border-line bg-white p-4 text-[14px] text-muted">
          Черга порожня. Встав посилання на оголошення зверху — картка зʼявиться тут.
        </p>
      ) : null}

      {sections.map((section) =>
        section.cards.length === 0 ? null : (
          <section key={section.key} className="space-y-2">
            <SectionTitle title={section.title} count={section.cards.length} signal={section.signal} />
            {section.cards.map((card: QueueCard) => (
              <ListingCard
                key={card.listing.id}
                card={card}
                today={today}
                viewer={author}
                names={names}
              />
            ))}
          </section>
        ),
      )}
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
    <h2 className="flex items-center gap-2 px-0.5">
      {signal ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 bg-signal" /> : null}
      <span
        className={cn(
          'text-[11px] font-semibold uppercase tracking-[0.12em]',
          signal ? 'text-ink' : 'text-muted',
        )}
      >
        {title}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-muted">{count}</span>
    </h2>
  )
}
