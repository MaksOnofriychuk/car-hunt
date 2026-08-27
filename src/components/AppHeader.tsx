'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { PlateStrip } from './PlateStrip'
import { ThemeToggle } from './ThemeToggle'

import { cn } from '@/lib/cn'
import { forgetDevice } from '@/lib/device-store'
import type { Look } from '@/lib/look'

/**
 * Шапка. На 390 px тут одночасно знак, три розділи, перемикач теми і вихід —
 * це впритул, тому навігація має власну прокрутку, а вихід згорнутий до
 * значка. Так нічого не вилазить за екран, і все лишається під палець.
 */

const NAV = [
  { href: '/', label: 'Черга' },
  { href: '/sellers', label: 'Продавці' },
  { href: '/settings', label: 'Налаштування' },
]

/**
 * Вийти — робота клієнта, а не серверної дії: сесія лежить у `localStorage`, і
 * прибрати її звідти може лише той, у кого це сховище є.
 */
function logout(): void {
  forgetDevice('car_hunt_session')
  window.location.replace('/login')
}

export function AppHeader({ name, look }: { name: string; look: Look }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-10 border-b border-edge bg-base/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-2 px-3">
        <Link href="/" aria-label="Car Hunt" className="shrink-0">
          <PlateStrip label="Car Hunt" size="sm" compactBelow />
        </Link>

        <nav className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center justify-end gap-3">
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className={cn(
                      't-micro whitespace-nowrap transition-colors duration-(--t-instant)',
                      active ? 'text-ink' : 'text-faint hover:text-muted',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <ThemeToggle look={look} />

        <div className="shrink-0">
          <button
            type="button"
            onClick={logout}
            title={`Вийти — ${name}`}
            aria-label={`Вийти — ${name}`}
            className="surface flex h-9 w-9 items-center justify-center rounded-control text-muted transition-colors duration-(--t-instant) hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M12 6.5V5a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 4 5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 12 15v-1.5M9 10h7m0 0-2.2-2.2M16 10l-2.2 2.2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
