import { NextResponse, type NextRequest } from 'next/server'

import { clientIp } from '@/lib/request-ip'
import { SESSION_COOKIE, readSessionToken } from '@/lib/session'

/**
 * Node-рантайм, а не Edge: rate limit на /login читає лічильник з БД,
 * і зробити це треба ДО того, як справа дійде до перевірки пароля.
 */
export const runtime = 'nodejs'

/**
 * Відкриті шляхи. Список навмисно короткий і точний — жодних масок за
 * розширенням файлу, бо маска на кшталт `.*\.txt$` відкрила б будь-який
 * майбутній маршрут, назва якого закінчується на .txt.
 */
const PUBLIC_PATHS = new Set(['/login', '/robots.txt', '/favicon.ico'])

/** Мають власну автентифікацію: cron — Bearer CRON_SECRET, вебхук — секретний заголовок. */
const PUBLIC_PREFIXES = ['/api/telegram/webhook', '/api/cron']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/** Сайт не має потрапляти в пошук узагалі. Заголовок вішаємо на кожну відповідь. */
function secured(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
  return response
}

function tooManyAttempts(retryAfterSeconds: number): NextResponse {
  const minutes = Math.ceil(retryAfterSeconds / 60)
  const body = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<title>Забагато спроб</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#EEEFEC;color:#16181A;font:16px/1.5 ui-sans-serif,system-ui,sans-serif">
<main style="max-width:22rem;padding:1.5rem;background:#fff;border:1px solid #D8DAD5;border-radius:4px">
<h1 style="margin:0 0 .5rem;font-size:1rem">Забагато спроб входу</h1>
<p style="margin:0;color:#6B7075">Спробуй за ${minutes} хв.</p>
</main></body>`

  return secured(
    new NextResponse(body, {
      status: 429,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': String(retryAfterSeconds),
        'Cache-Control': 'no-store',
      },
    }),
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Обмеження спрацьовує до будь-якої роботи з паролем — і для форми, і для скрипта.
  if (pathname === '/login' && request.method === 'POST') {
    const { loginBlockFor } = await import('@/db/login-attempts')
    const block = await loginBlockFor(clientIp(request.headers))
    if (block.blocked) return tooManyAttempts(block.retryAfterSeconds)
  }

  const author = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === '/login') {
    return author
      ? secured(NextResponse.redirect(new URL('/', request.url)))
      : secured(NextResponse.next())
  }

  if (isPublic(pathname)) return secured(NextResponse.next())

  // Підписане посилання на файл: пропускаємо далі, підпис перевіряє сам роут
  // (`/api/files/[...key]`). Тут перевіряти нічим — секрет і ключ живуть у
  // Node-рантаймі роута, а middleware не має знати про сховище нічого.
  // Без валідного підпису роут віддасть 401, тому дірки це не робить.
  if (pathname.startsWith('/api/files/') && request.nextUrl.searchParams.has('sig')) {
    return secured(NextResponse.next())
  }

  if (!author) {
    const login = new URL('/login', request.url)
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return secured(NextResponse.redirect(login))
  }

  return secured(NextResponse.next())
}

export const config = {
  // Усе, крім простору /_next — це складені ассети, оптимізатор картинок і HMR.
  // Створити там власний маршрут код застосунку не може, тож дірки це не робить,
  // а X-Robots-Tag туди все одно доїжджає з headers() у next.config.ts.
  // Решта — /api/*, /robots.txt, /favicon.ico — проходить через список вище.
  matcher: ['/((?!_next/).*)'],
}
