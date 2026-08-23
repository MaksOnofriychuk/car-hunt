import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE, readSessionToken } from '@/lib/session'

/**
 * Захищає все, крім /login, вебхука Telegram, /api/cron/* і статики — SPEC,
 * розділ «Автентифікація». Cron окремо перевіряє свій Bearer CRON_SECRET,
 * а вебхук — заголовок X-Telegram-Bot-Api-Secret-Token.
 */
const PUBLIC_PREFIXES = ['/api/telegram/webhook', '/api/cron']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const author = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === '/login') {
    return author ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next()
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next()
  }

  if (!author) {
    const login = new URL('/login', request.url)
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)',
  ],
}
