import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL не заданий. Додай його в .env.local (приклад — у .env.example).')
}

/**
 * Neon і Supabase віддають пул через PgBouncer у transaction mode,
 * а він не вміє prepared statements → prepare: false.
 * На Vercel кожна функція живе окремо, тому одне зʼєднання на процес.
 */
function createClient() {
  return postgres(connectionString!, {
    prepare: false,
    max: process.env.NODE_ENV === 'production' ? 1 : 5,
  })
}

// next dev перевантажує модулі на кожну правку — інакше зʼєднання течуть.
const globalForDb = globalThis as unknown as { carHuntPg?: ReturnType<typeof createClient> }
const client = globalForDb.carHuntPg ?? createClient()
if (process.env.NODE_ENV !== 'production') globalForDb.carHuntPg = client

export const db = drizzle(client, { schema })
export { client, schema }
export * from './schema'
