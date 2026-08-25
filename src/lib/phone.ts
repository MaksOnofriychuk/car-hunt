/**
 * Нормалізація українських номерів до `+380XXXXXXXXX` — у такому вигляді вони
 * лежать у `sellers.phones` і тільки в такому їх можна порівнювати між собою.
 *
 * Телефон — **додатковий** ключ склейки продавців. Основний — `source_user_id`
 * (див. «Продавці» у SPEC): він видно на сторінці, а номер RIA ховає за кліком.
 */

/** `(067) 123-45-67`, `380671234567`, `0671234567` → `+380671234567`. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')

  const national =
    digits.length === 12 && digits.startsWith('380')
      ? digits.slice(2)
      : digits.length === 10 && digits.startsWith('0')
        ? digits
        : digits.length === 9
          ? `0${digits}`
          : null

  return national ? `+38${national}` : null
}

/** Нормалізує список, викидає сміття і дублі. Порядок зберігається. */
export function normalizePhones(raw: readonly string[] | undefined | null): string[] {
  const out: string[] = []
  for (const value of raw ?? []) {
    const phone = normalizePhone(value)
    if (phone && !out.includes(phone)) out.push(phone)
  }
  return out
}

/** Для показу: `+380671234567` → `+380 67 123 45 67`. У `tel:` іде як є. */
export function formatPhone(phone: string): string {
  const match = phone.match(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/)
  return match ? `+380 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : phone
}
