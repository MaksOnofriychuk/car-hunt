'use client'

import { useSyncExternalStore } from 'react'

/**
 * Спільний лічильник «щось зараз відбувається».
 *
 * Потрібен тому, що App Router не має подій навігації: `loading.tsx` показує
 * скелетон лише при переході на інший маршрут, а `router.refresh()`, серверні
 * дії й довгий прогін оновлення черги ззовні не видно взагалі — сторінка просто
 * стоїть, і незрозуміло, чи вона щось робить.
 *
 * Лічильник, а не прапорець: паралельних задач буває кілька (опитування карток
 * і перемальовування таблиці), і та, що завершилась першою, не має гасити смугу
 * під тією, що ще працює.
 */

let running = 0
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function beginTask(): void {
  running += 1
  emit()
}

export function endTask(): void {
  running = Math.max(0, running - 1)
  emit()
}

/** Обгортка на будь-яку обіцянку: смуга гасне і після помилки теж. */
export async function withProgress<T>(work: () => Promise<T>): Promise<T> {
  beginTask()
  try {
    return await work()
  } finally {
    endTask()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useBusy(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => running > 0,
    // На сервері смуги немає: там нічого не «вантажиться».
    () => false,
  )
}
