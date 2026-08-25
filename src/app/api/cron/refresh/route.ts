import { NextResponse } from 'next/server'

import { appendPostPhotos, deleteOldInbox, postsAwaitingPhotos } from '@/db/telegram'
import { sweepStaleInbox } from '@/lib/telegram/inbox'
import { savePostPhotos, type PhotoRef } from '@/lib/telegram/post-photos'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Фонове добирання. Поки що вузьке — рівно те, без чого губляться пости:
 *
 *   1. групи, які хтось узяв і не доробив: `after()` міг не дожити до кінця
 *      паузи, а інстанс на Vercel не живе між запитами;
 *   2. фото постів, які не влізли в бюджет часу при обробці;
 *   3. прибирання оброблених апдейтів старших за добу — сирий апдейт уже
 *      лежить у `telegram_posts.raw`.
 *
 * Решта зі SPEC (оновлення цін, архів оголошень, доканонізація) додасться сюди
 * ж окремим кроком.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  const groups = await sweepStaleInbox(5)
  const photos = await finishPostPhotos()
  const cleaned = await deleteOldInbox(1)

  return NextResponse.json({ groups, photos, cleaned })
}

/** Доякати фото постів, яким не вистачило часу під час обробки. */
async function finishPostPhotos(): Promise<number> {
  const posts = await postsAwaitingPhotos(5)
  let finished = 0

  for (const post of posts) {
    const raw = post.raw as { photo?: { file_id: string; file_unique_id: string }[] }[] | null
    const photos: PhotoRef[] = (Array.isArray(raw) ? raw : [])
      .map((message) => message.photo?.at(-1))
      .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
      .map((photo) => ({ fileId: photo.file_id, fileUniqueId: photo.file_unique_id }))

    if (photos.length === 0) {
      // Фото не було взагалі — архів такого поста повний за визначенням.
      await appendPostPhotos(post.id, [], true)
      continue
    }

    const saved = await savePostPhotos(post.chatId, photos)
    await appendPostPhotos(post.id, saved.keys, saved.complete)
    if (saved.complete) finished += 1
  }

  return finished
}
