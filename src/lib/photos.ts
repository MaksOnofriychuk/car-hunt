import type { Listing } from '@/db/schema'
import { storage } from '@/lib/storage'

/**
 * Що показувати на картці. Порядок такий:
 *
 *   1. наші копії з `photos_local`, коли завантажені **всі** — оголошення
 *      колись знімуть, і тільки вони переживуть це (SPEC, «Повний архів»);
 *   2. поки копії ще доякуються — оригінальні URL з майданчика;
 *   3. в кінці — фото, додані руками: вони не з оголошення, тому й не мають
 *      витісняти його галерею.
 *
 * Для карток, заведених руками, і для telegram інших фото не буває взагалі.
 */
export function displayPhotos(
  listing: Pick<Listing, 'photos' | 'photosLocal' | 'photosManual'>,
): string[] {
  const files = storage()
  const local = listing.photosLocal.map((key) => files.url(key))
  const manual = listing.photosManual.map((key) => files.url(key))

  const archived = local.length > 0 && listing.photosLocal.length >= listing.photos.length
  const base = archived || listing.photos.length === 0 ? local : listing.photos

  return [...base, ...manual]
}
