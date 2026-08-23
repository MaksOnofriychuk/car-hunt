/**
 * IP клієнта із заголовків проксі.
 *
 * Заголовкам можна вірити ЛИШЕ за довіреним проксі: на Vercel він переписує
 * x-forwarded-for сам, тому підробити його ззовні не вийде. Якщо колись
 * піднімемо це деінде — треба буде звузити довіру до свого балансувальника.
 * Немає жодного заголовка (локальний dev) → 'unknown', і всі локальні спроби
 * лічаться як один клієнт. Для rate limit це безпечний бік помилки.
 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0].trim()

  const real = headers.get('x-real-ip')
  if (real) return real.trim()

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  return 'unknown'
}
