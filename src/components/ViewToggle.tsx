'use client'

import { useRouter } from 'next/navigation'

import { cn } from '@/lib/cn'
import { writeViewPrefs, type ViewMode, type ViewPrefs } from '@/lib/view-prefs'

/**
 * Список ⇄ таблиця. На вузькому екрані перемикача немає взагалі: таблиця на
 * 390 px — це не таблиця, а горизонтальний скрол, тому телефон лишається зі
 * списком незалежно від того, що обрано на компʼютері.
 */
export function ViewToggle({ prefs }: { prefs: ViewPrefs }) {
  const router = useRouter()

  const set = (mode: ViewMode) => {
    if (mode === prefs.mode) return
    writeViewPrefs({ ...prefs, mode })
    // Cookie читає сервер, тому режим міняється тільки після перемальовування.
    router.refresh()
  }

  return (
    <div className="hidden lg:flex lg:items-center lg:gap-1">
      {(['list', 'table'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => set(mode)}
          aria-pressed={prefs.mode === mode}
          className={cn('chip tap', prefs.mode === mode && 'chip-on')}
        >
          {mode === 'list' ? 'Список' : 'Таблиця'}
        </button>
      ))}
    </div>
  )
}
