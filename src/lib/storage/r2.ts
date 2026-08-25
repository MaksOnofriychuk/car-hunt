import { createHash, createHmac } from 'node:crypto'

import { assertSafeKey, contentTypeFor, type FileStorage } from './types'

/**
 * Cloudflare R2 через S3-сумісний API. Підписуємо запити SigV4 вручну, без
 * @aws-sdk/client-s3: SDK додав би десятки мегабайт до бандла функції заради
 * коду, який виконується лише коли задані ключі R2.
 *
 * УВАГА: неперевірено на живому бакеті — ключів R2 поки немає. Перший запуск
 * з реальними ключами треба звірити руками.
 */

const REGION = 'auto'
const SERVICE = 's3'

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl?: string
}

export function r2ConfigFromEnv(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl: process.env.R2_PUBLIC_URL }
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest()

function signingKey(secret: string, date: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), REGION), SERVICE), 'aws4_request')
}

function signedRequest(
  config: R2Config,
  method: 'PUT' | 'GET' | 'HEAD' | 'DELETE',
  key: string,
  body: Buffer | undefined,
  contentType?: string,
): { url: string; headers: Record<string, string> } {
  const host = `${config.accountId}.r2.cloudflarestorage.com`
  const path = `/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`

  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = now.slice(0, 8)
  const payloadHash = sha256(body ?? '')

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': now,
  }
  if (contentType) headers['content-type'] = contentType

  const signedHeaders = Object.keys(headers).sort()
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${headers[name]}\n`).join('')
  const signedHeaderList = signedHeaders.join(';')

  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    signedHeaderList,
    payloadHash,
  ].join('\n')

  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonicalRequest)].join('\n')
  const signature = hmac(signingKey(config.secretAccessKey, date), stringToSign).toString('hex')

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaderList}, Signature=${signature}`

  return { url: `https://${host}${path}`, headers }
}

export function createR2Storage(config: R2Config): FileStorage {
  return {
    name: 'r2',

    async put(key, body, contentType) {
      assertSafeKey(key)
      const { url, headers } = signedRequest(config, 'PUT', key, body, contentType)
      const response = await fetch(url, { method: 'PUT', headers, body: new Uint8Array(body) })
      if (!response.ok) {
        throw new Error(`R2 PUT ${key} → ${response.status} ${await response.text()}`)
      }
    },

    async get(key) {
      assertSafeKey(key)
      const { url, headers } = signedRequest(config, 'GET', key, undefined)
      const response = await fetch(url, { headers })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`R2 GET ${key} → ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    },

    async exists(key) {
      assertSafeKey(key)
      const { url, headers } = signedRequest(config, 'HEAD', key, undefined)
      const response = await fetch(url, { method: 'HEAD', headers })
      return response.ok
    },

    async remove(key) {
      assertSafeKey(key)
      const { url, headers } = signedRequest(config, 'DELETE', key, undefined)
      const response = await fetch(url, { method: 'DELETE', headers })
      // 404 — файла і так немає, це не помилка.
      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 DELETE ${key} → ${response.status}`)
      }
    },

    url(key) {
      assertSafeKey(key)
      const encoded = key.split('/').map(encodeURIComponent).join('/')
      return config.publicUrl
        ? `${config.publicUrl.replace(/\/$/, '')}/${encoded}`
        : `/api/files/${encoded}`
    },
  }
}

export { contentTypeFor }
