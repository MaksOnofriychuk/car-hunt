'use client'

import { useRef } from 'react'

import { cn } from '@/lib/cn'

/**
 * Поле дати з видимою іконкою календаря.
 *
 * Рідний значок `::-webkit-calendar-picker-indicator` у темній темі — майже
 * невидимий квадратик, і перефарбувати його як слід не можна. Тому він
 * прихований, а поруч стоїть наша кнопка, яка відкриває той самий системний
 * календар через `showPicker()`. Сам випадний календар малює браузер — його
 * вигляд ми не контролюємо, тільки тему (`color-scheme`).
 */
export function DateField({
  name,
  defaultValue,
  ariaLabel,
  className,
}: {
  name: string
  defaultValue?: string
  ariaLabel: string
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <span className={cn('relative block', className)}>
      <input
        ref={input}
        type="date"
        name={name}
        defaultValue={defaultValue}
        aria-label={ariaLabel}
        className="field field-num w-full pr-11 text-left [&::-webkit-calendar-picker-indicator]:hidden"
      />

      <button
        type="button"
        aria-label="Відкрити календар"
        onClick={() => {
          const node = input.current
          if (!node) return
          // showPicker кидається, якщо виклик не з жесту користувача — тут він
          // саме з кліку, але перестрахуватись дешевше, ніж ловити падіння.
          try {
            node.showPicker()
          } catch {
            node.focus()
          }
        }}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-chip text-muted transition-colors duration-(--t-instant) hover:text-ink"
      >
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden>
          <rect
            x="2.75"
            y="4.25"
            width="14.5"
            height="13"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M2.75 8.25h14.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M6.5 2.75v3M13.5 2.75v3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  )
}
