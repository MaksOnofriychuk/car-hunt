import Image from 'next/image'

import { Description } from './Description'

import type { TelegramPost } from '@/db/schema'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { formatNumber, formatPrice } from '@/lib/format'
import type { Currency } from '@/lib/settings'
import { storage } from '@/lib/storage'

/**
 * Блок «З Telegram» — стрічка постів про це авто.
 *
 * Сенс блоку в тому, чого немає в оголошенні: реальна ціна і те, як вона падала
 * між передруками. «Місяць тому ви просили 9500» — головний аргумент у розмові,
 * і він має бути на екрані, а не в памʼяті.
 *
 * Блок зникає сам, коли постів немає.
 */
export function TelegramPosts({
  posts,
  currency,
}: {
  posts: TelegramPost[]
  currency: Currency
}) {
  if (posts.length === 0) return null

  const files = storage()
  // Найсвіжіший зверху: саме він описує теперішній стан.
  const ordered = [...posts].reverse()

  return (
    <section className="surface p-3">
      <h2 className="t-micro text-faint">
        З Telegram · {posts.length} {posts.length === 1 ? 'пост' : 'постів'}
      </h2>

      <ol className="mt-2 space-y-3">
        {ordered.map((post, index) => {
          // Різниця з попереднім у часі постом, а не з попереднім у списку.
          const earlier = ordered[index + 1]
          const delta =
            earlier?.priceUsd && post.priceUsd ? post.priceUsd - earlier.priceUsd : null

          return (
            <li key={post.id} className="sunken p-2.5">
              <div className="flex items-baseline gap-2">
                <span className="t-num text-[12px] text-faint">
                  {post.postedAt ? formatDate(post.postedAt) : '—'}
                </span>
                {post.originTitle ? (
                  <span className="t-micro truncate text-faint">{post.originTitle}</span>
                ) : null}

                <span className="t-num ml-auto shrink-0 text-[15px]">
                  {formatPrice(post.priceUsd, post.priceUah, currency)}
                </span>

                {delta ? (
                  <span
                    className={cn(
                      't-num shrink-0 text-[12px]',
                      delta < 0 ? 'text-ok' : 'text-warn',
                    )}
                  >
                    {delta < 0 ? '−' : '+'}
                    {formatNumber(Math.abs(delta))}
                  </span>
                ) : null}
              </div>

              {post.photosLocal.length > 0 ? (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {post.photosLocal.slice(0, 4).map((key) => (
                    <Image
                      key={key}
                      src={files.url(key)}
                      alt=""
                      width={160}
                      height={120}
                      className="aspect-[4/3] w-full rounded-chip border border-edge object-cover"
                    />
                  ))}
                </div>
              ) : null}

              {post.text ? (
                <div className="mt-2">
                  <Description text={post.text} />
                </div>
              ) : null}

              {post.links.length > 1 ? (
                <p className="t-micro mt-2 text-faint">
                  У пості ще {post.links.length - 1} посилання
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
