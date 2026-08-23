import { defineConfig } from 'drizzle-kit'

// drizzle-kit — окремий процес, він не бачить .env.local сам по собі.
// В CI/Vercel змінна вже в оточенні, тому файл читаємо тільки якщо її нема.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // .env.local може не існувати — тоді впаде нижче з нормальним текстом
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL не заданий. Додай його в .env.local (приклад — у .env.example).')
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
})
