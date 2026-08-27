/**
 * Користувачів рівно двоє. Значення навмисно продубльовані зі схеми:
 * middleware виконується в Edge, тягнути туди drizzle не можна.
 */
export const AUTHOR_VALUES = ['me', 'dad'] as const
export type Author = (typeof AUTHOR_VALUES)[number]

export function isAuthor(value: unknown): value is Author {
  return typeof value === 'string' && (AUTHOR_VALUES as readonly string[]).includes(value)
}

/** Імена беремо з .env — у коді їх немає. */
export function userNames(): Record<Author, string> {
  return {
    me: process.env.USER_ME_NAME || 'Я',
    dad: process.env.USER_DAD_NAME || 'Батько',
  }
}
