'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { PlateStrip } from './PlateStrip'

import { logout } from '@/app/login/actions'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/', label: 'Черга' },
  { href: '/sellers', label: 'Продавці' },
]

export function AppHeader({ name }: { name: string }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-concrete">
      <div className="mx-auto flex h-12 w-full max-w-[560px] items-center gap-3 px-3">
        <Link href="/" aria-label="Car Hunt">
          <PlateStrip label="Car Hunt" size="sm" />
        </Link>

        <nav className="ml-auto flex items-center gap-3">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-[0.08em]',
                  active ? 'text-ink underline underline-offset-4' : 'text-muted',
                )}
              >
                {item.label}
              </Link>
            )
          })}

          <form action={logout}>
            <button
              type="submit"
              title="Вийти"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
            >
              {name} ↪
            </button>
          </form>
        </nav>
      </div>
    </header>
  )
}
