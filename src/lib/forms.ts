/**
 * Спільний стан форм із `useActionState`. Одна форма — одна дія: або помилка,
 * або `ok`, після якого клієнт закриває поле і показує оновлені дані.
 */
export type FormState = {
  error: string | null
  ok: boolean
}

export const IDLE: FormState = { error: null, ok: false }
