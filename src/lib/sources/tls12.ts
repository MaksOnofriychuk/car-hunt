import { Agent, request, type RequestOptions } from 'node:https'

/**
 * Запит із TLS 1.2 замість стандартного для Node 1.3.
 *
 * Навіщо: OLX стоїть за CloudFront, і той ріже **відбиток клієнта**, а не нас
 * самих. Вбудований `fetch()` Node отримує 403 із будь-якими заголовками —
 * навіть з повністю браузерними. Той самий запит з тим самим нашим чесним
 * User-Agent, але з `maxVersion: 'TLSv1.2'`, проходить. Тобто ми нікого не
 * вдаємо: підписуємось як завжди, лише тиснемо руку старішою версією TLS.
 *
 * `Accept-Encoding` навмисно не надсилаємо: тоді відповідь приходить нестисненою
 * і не треба тягнути сюди zlib. Сторінка OLX — близько 1.6 МБ, це прийнятно.
 */

const MAX_REDIRECTS = 5

/**
 * Свій агент без keep-alive: інакше зʼєднання може повернутись із пулу, де
 * лежить сокет на TLS 1.3, і запит знову впреться в 403. При паузі ≥2 с між
 * запитами зайве рукостискання нічого не коштує.
 */
const agent = new Agent({ keepAlive: false, maxVersion: 'TLSv1.2' })

/** Статуси, яким за стандартом не можна мати тіла. */
const BODYLESS = new Set([204, 205, 304])

export async function tls12Fetch(
  url: string,
  options: { headers: Record<string, string>; timeoutMs: number },
): Promise<Response> {
  let current = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await once(current, options)

    const location = response.headers.get('location')
    if (location && response.status >= 300 && response.status < 400) {
      current = new URL(location, current).toString()
      continue
    }

    return response
  }

  throw new Error(`Забагато редіректів: ${url}`)
}

/** Один запит без редіректів. Тіло збираємо повністю — сторінки невеликі. */
function once(
  url: string,
  options: { headers: Record<string, string>; timeoutMs: number },
): Promise<Response> {
  const requestOptions: RequestOptions = {
    agent,
    maxVersion: 'TLSv1.2',
    headers: options.headers,
  }

  return new Promise((resolve, reject) => {
    const req = request(url, requestOptions, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const status = res.statusCode ?? 500
        // `new Response(body)` кидає TypeError, якщо статусу тіло не належить.
        const body = BODYLESS.has(status) ? null : new Uint8Array(Buffer.concat(chunks))
        resolve(
          new Response(body, {
            status,
            statusText: res.statusMessage,
            headers: toHeaders(res.headers),
          }),
        )
      })
      res.on('error', reject)
    })

    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error(`Час вийшов (${options.timeoutMs} мс): ${url}`))
    })
    req.on('error', reject)
    req.end()
  })
}

function toHeaders(raw: NodeJS.Dict<string | string[]>): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else if (typeof value === 'string') {
      headers.set(name, value)
    }
  }
  return headers
}
