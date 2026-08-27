'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { beginTask, endTask, useBusy } from '@/lib/progress'

/**
 * Смуга вгорі екрана: видно, що застосунок зайнятий, не заглядаючи у вкладку.
 *
 * Два джерела сигналу:
 *
 *   1. явні задачі — `beginTask()` з кнопок і серверних дій. Про них ми знаємо
 *      точно, коли почались і коли скінчились;
 *   2. перехід між сторінками. Подій навігації в App Router немає, тому
 *      «зайнято» вмикає перехоплений клік по внутрішньому посиланню, а гасить —
 *      нова адреса: змінився `pathname` чи запит, отже сторінка вже намальована.
 *
 * Клік ловиться одним слухачем на `document`, а не обгорткою над кожним
 * посиланням: інакше про смугу довелось би памʼятати в кожному новому місці, де
 * зʼявиться `<Link>`, і рано чи пізно про неї забули б.
 *
 * Смуга не займає місця в потоці — тому нічого не смикається, коли вона
 * зʼявляється і зникає.
 */

/** Скільки чекати на перехід, перш ніж вирішити, що його не буде. */
const NAVIGATION_TIMEOUT_MS = 10_000

/** Миттєвий перехід не має блимати смугою: це читається як збій, а не як робота. */
const SHOW_DELAY_MS = 140

let navigating = false
let navigationTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Навігація рахується окремо від решти задач: завершити її зсередини нічим, і
 * гасить її поява нової адреси. Прапорець тримає облік чесним — щоб не зняти
 * задачу, якої не заводили.
 */
export function beginNavigation(): void {
  if (navigating) return
  navigating = true
  beginTask()

  // Запобіжник: клік міг і не привести до переходу (посилання на ту саму
  // адресу, скасований перехід). Смуга не має світитись вічно.
  navigationTimer = setTimeout(endNavigation, NAVIGATION_TIMEOUT_MS)
}

function endNavigation(): void {
  if (!navigating) return
  navigating = false
  if (navigationTimer) clearTimeout(navigationTimer)
  navigationTimer = null
  endTask()
}

/** Чи цей клік справді веде на іншу сторінку всередині застосунку. */
function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false

  const anchor = (event.target as Element | null)?.closest?.('a')
  if (!anchor) return false
  if (anchor.target && anchor.target !== '_self') return false
  if (anchor.hasAttribute('download')) return false

  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#')) return false

  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin) return false

  // Та сама адреса — переходу не буде, малювати нічого.
  return url.href !== window.location.href
}

export function TopProgress() {
  const busy = useBusy()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) beginNavigation()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    if (!busy) {
      setVisible(false)
      return
    }

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [busy])

  // Нова адреса — перехід відбувся.
  useEffect(() => {
    endNavigation()
  }, [pathname, search])

  if (!visible) return null

  return <div className="progress-top" role="progressbar" aria-label="Завантаження" />
}
