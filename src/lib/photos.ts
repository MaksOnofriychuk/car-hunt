import type { Listing } from '@/db/schema'
import { storage } from '@/lib/storage'
import { signedFilePath } from '@/lib/storage/signed'

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
  /**
   * Ключі фото з постів. Вони живуть окремо від картки (`telegram_posts`) — і
   * саме тому передаються сюди аргументом: у `listings.photos_local` їх класти
   * не можна, звідти їх знищив би перерозбір або прибирання фото завершених
   * авто. Для telegram-картки це єдині фото, які взагалі є.
   */
  postKeys: string[] = [],
): string[] {
  const local = listing.photosLocal.map(fileUrl)
  const manual = listing.photosManual.map(fileUrl)

  const archived = local.length > 0 && listing.photosLocal.length >= listing.photos.length
  const base = archived || listing.photos.length === 0 ? local : listing.photos

  const own = [...base, ...manual]
  return own.length > 0 ? own : postKeys.map(fileUrl)
}

/**
 * Адреса файлу для показу. Наш роут віддає файли під автентифікацією, а
 * оптимізатор `next/image` качає їх **власним серверним запитом без cookie** —
 * і отримував би редирект на вхід замість картинки. Тому шлях підписується на
 * конкретний ключ (година життя, стабільний у межах години заради кешу).
 *
 * Якщо сховище роздає файли саме (публічний домен R2), підписувати нічого не
 * треба — адреса й так відкрита.
 */
export function fileUrl(key: string): string {
  const url = storage().url(key)
  if (!url.startsWith('/api/files/')) return url

  return signedFilePath(key) ?? url
}
