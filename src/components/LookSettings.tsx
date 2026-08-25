'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { cn } from '@/lib/cn'
import {
  DENSITIES,
  DENSITY_LABELS,
  FONTS,
  FONT_LABELS,
  SIZES,
  SIZE_LABELS,
  THEMES,
  THEME_LABELS,
  writeLook,
  type Look,
} from '@/lib/look'

/**
 * Вигляд. Зберігається в cookie на цьому пристрої — сервер читає її при
 * рендері, тому зміна видно одразу після оновлення, без мигання.
 */
export function LookSettings({ look }: { look: Look }) {
  const router = useRouter()
  const [draft, setDraft] = useState(look)

  const apply = (patch: Partial<Look>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    writeLook(next)
    router.refresh()
  }

  return (
    <section className="rounded-card border border-line bg-card p-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Вигляд</h2>
      <p className="mt-1 text-[12px] text-muted">
        Зберігається на цьому пристрої: у кожного свій екран і свої очі.
      </p>

      <Row label="Тема">
        {THEMES.map((theme) => (
          <Chip key={theme} active={draft.theme === theme} onClick={() => apply({ theme })}>
            {THEME_LABELS[theme]}
          </Chip>
        ))}
      </Row>

      <Row label="Розмір інтерфейсу">
        {SIZES.map((size) => (
          <Chip key={size} active={draft.size === size} onClick={() => apply({ size })}>
            {SIZE_LABELS[size]}
          </Chip>
        ))}
      </Row>

      <Row label="Шрифт">
        {FONTS.map((font) => (
          <Chip key={font} active={draft.font === font} onClick={() => apply({ font })}>
            {FONT_LABELS[font]}
          </Chip>
        ))}
      </Row>

      <Row label="Щільність списку">
        {DENSITIES.map((density) => (
          <Chip key={density} active={draft.density === density} onClick={() => apply({ density })}>
            {DENSITY_LABELS[density]}
          </Chip>
        ))}
      </Row>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 rounded-card border px-2.5 text-[12px]',
        active ? 'border-ink bg-concrete font-semibold' : 'border-line text-muted',
      )}
    >
      {children}
    </button>
  )
}
