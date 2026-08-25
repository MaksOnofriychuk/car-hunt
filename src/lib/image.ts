/**
 * Стиснення фото перед завантаженням — на клієнті, у браузері.
 *
 * Айфон віддає знімки по 4-6 МБ, і без цього кроку кожне фото їхало б хвилину
 * з мобільного інтернету і займало стільки ж у сховищі. 1920 по довшій стороні
 * вистачає, щоб роздивитись подряпину на весь екран телефона.
 *
 * Нічого не вийшло (екзотичний формат, старий браузер) — віддаємо оригінал:
 * краще великий файл, ніж втрачене фото.
 */

const MAX_SIDE = 1920
const QUALITY = 0.82

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  try {
    // `imageOrientation` розвертає знімок за EXIF — інакше фото з телефона
    // лягають боком.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', QUALITY)
    })
    if (!blob || blob.size >= file.size) return file

    return new File([blob], `${file.name.replace(/\.\w+$/, '')}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}
