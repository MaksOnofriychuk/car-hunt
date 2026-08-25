'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

/**
 * Ціна одометром (аркуш 03). Коли число міняється, змінені розряди
 * перекручуються: старий іде вгору, новий заходить знизу, зі стагером 40 мс.
 * На 900 мс число підсвічується кольором напрямку — зелений, якщо ціна впала,
 * теплий, якщо виросла, — і повертається до основного кольору.
 *
 * Перший показ нічого не анімує: сторінка не мусить смикатись просто тому, що
 * її відкрили. Рух зʼявляється тільки на справжній зміні — коли черга
 * перемалювалась після нової ціни в оголошенні.
 *
 * `prefers-reduced-motion` вимикає рух у CSS, і тоді це просто число.
 */

/** Затримка між розрядами. Аркуш 03: стагер 40 мс. */
const STAGGER = 40
/** Скільки тримати колір напрямку, перш ніж вирівнятись до основного. */
const HIGHLIGHT_MS = 900

export function Odometer({
  value,
  className,
}: {
  /** Готовий рядок: «8 900», «$9 800» — форматування лишається зовні. */
  value: string
  className?: string
}) {
  const [shown, setShown] = useState(value)
  const previous = useRef(value)
  const [direction, setDirection] = useState<'down' | 'up' | null>(null)

  useEffect(() => {
    if (value === previous.current) return

    const before = digitsOf(previous.current)
    const after = digitsOf(value)
    setDirection(after < before ? 'down' : 'up')
    setShown(value)
    previous.current = value

    const timer = setTimeout(() => setDirection(null), HIGHLIGHT_MS * 2)
    return () => clearTimeout(timer)
  }, [value])

  const changed = shown !== value ? value : shown

  return (
    <span
      className={cn(
        direction === 'down' && 'odometer-down',
        direction === 'up' && 'odometer-up',
        className,
      )}
    >
      {[...changed].map((char, index) => (
        <span
          // Ключ із позиції і символу: коли символ на позиції змінився, React
          // створює новий вузол — і той сам заходить анімацією.
          key={`${index}-${char}`}
          className={cn('digit', direction && char !== ' ' && 'digit-in')}
          style={direction ? { animationDelay: `${index * STAGGER}ms` } : undefined}
        >
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  )
}

/** Лише цифри — щоб порівняти «$9 800» і «$9 200» як числа. */
function digitsOf(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}
