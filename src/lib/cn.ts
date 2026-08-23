/** Склеює класи. Замість clsx — щоб не тягнути залежність заради трьох рядків. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
