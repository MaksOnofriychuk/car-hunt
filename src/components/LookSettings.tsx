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
  THEME_HINT,
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
    <section className="surface p-3">
      <h2 className="t-micro text-faint">Вигляд</h2>
      <p className="t-body mt-1 text-faint">
        Зберігається на цьому пристрої: у кожного свій екран і свої очі.
      </p>

      <div className="mt-3">
        <span className="t-micro text-faint">Тема</span>
        {/* Сегментний перемикач, як у макеті: три стани в одній рамці. */}
        <div className="sunken mt-1 flex gap-1 rounded-control p-1">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => apply({ theme })}
              aria-pressed={draft.theme === theme}
              className={cn(
                'flex h-10 flex-1 items-center justify-center rounded-chip px-2 text-[14px] transition-colors duration-(--t-base)',
                draft.theme === theme
                  ? 'bg-accent font-semibold text-white'
                  : 'text-muted hover:text-ink',
              )}
            >
              {THEME_LABELS[theme]}
            </button>
          ))}
        </div>
        <p className="t-body mt-1 text-faint">{THEME_HINT}</p>
      </div>

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
      <span className="t-micro text-faint">
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
      className={cn('chip chip-sm', active && 'chip-on')}
    >
      {children}
    </button>
  )
}
