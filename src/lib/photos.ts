import type { Listing } from '@/db/schema'

/**
 * Поки сховище не підключене (крок «Інгест і парсер»), показуємо оригінальні URL з RIA.
 * Далі тут буде storage.url(key) по photos_local, а photos лишиться запасним варіантом —
 * SPEC, «Повний архів оголошення».
 */
export function displayPhotos(listing: Pick<Listing, 'photos' | 'photosLocal'>): string[] {
  return listing.photos
}
