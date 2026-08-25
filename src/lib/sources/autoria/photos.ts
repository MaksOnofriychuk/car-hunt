import * as cheerio from 'cheerio'

import { findAll, findNode, type JsonRecord } from './sdui'

/**
 * Фото оголошення. Раніше тут була регулярка по всьому документу — і в архів
 * летіли чужі машини з блоків «інші пропозиції продавця» та «схожі авто».
 * На живих сторінках це 6 знімків із 44 у Honda Accord (аж до екскаватора)
 * і 9 із 15 у Nissan Qashqai — там чужі авто тієї ж моделі, тому за назвою
 * файла їх не відрізнити взагалі.
 *
 * Тому джерело тепер структурне — вузол галереї в `window.__PINIA__`:
 *
 *   1. `PhotoSliderTemplate` — власне галерея оголошення, кожне фото одразу
 *      в чотирьох розмірах;
 *   2. будь-які вузли `Image` з набором `formats` — картки чужих авто його не
 *      мають, тож навіть при перейменуванні шаблону чуже не пролізе;
 *   3. розмітка: перша карусель у документі — це галерея; блоки з чужими авто
 *      йдуть нижче.
 */

// slug буває з дефісами: `hyundai_santa-fe`, `mercedes-benz_e-class`. Поки тут
// стояло [a-z0-9_], усі фото такої машини лишались нерозпізнаними.
const PARTS = /\/photo\/([a-z0-9_.-]+)__(\d+)([a-z]*)\.(\w+)$/i

/** Від найбільшого до найменшого. */
const OG_IMAGE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i

const SIZE_RANK = ['fhd', 'hd', 'fx', 'bx', 's', '']

/** Порядок форматів у вузлі галереї — від найбільшого. */
const FORMATS = ['fullHD', 'large', 'middle', 'small'] as const

export function extractPhotos(html: string, state: unknown): string[] {
  return fromGallery(state) ?? fromStateImages(state) ?? fromMarkup(html)
}

function photoId(url: string): string | null {
  return url.match(PARTS)?.[2] ?? null
}

function isPhoto(url: unknown): url is string {
  return typeof url === 'string' && PARTS.test(url)
}

/** Найбільший з форматів, які RIA дає для одного знімка. */
function bestFormat(image: JsonRecord): string | null {
  const formats = image.formats
  if (formats && typeof formats === 'object') {
    for (const size of FORMATS) {
      const url = (formats as JsonRecord)[size]
      if (isPhoto(url)) return url
    }
  }
  return isPhoto(image.src) ? image.src : null
}

/** Порядок показу зберігаємо, дублі одного знімка прибираємо. */
function collect(images: JsonRecord[]): string[] | null {
  const urls = new Map<string, string>()

  for (const image of images) {
    const url = bestFormat(image)
    if (!url) continue
    const id = photoId(url) ?? String(image.id ?? url)
    if (!urls.has(id)) urls.set(id, url)
  }

  return urls.size > 0 ? [...urls.values()] : null
}

/* ------------------------------ шар 1: галерея ------------------------------ */

function fromGallery(state: unknown): string[] | null {
  const slider =
    findNode(state, (node) => node.type === 'PhotoSliderTemplate') ??
    findNode(state, (node) => node.id === 'photoSlider')
  if (!slider || !Array.isArray(slider.elements)) return null

  const images = slider.elements.filter(
    (element): element is JsonRecord =>
      Boolean(element) && typeof element === 'object' && !Array.isArray(element),
  )
  return collect(images)
}

/* --------------------------- шар 2: вузли з форматами ------------------------ */

/**
 * Фото оголошення RIA віддає з набором розмірів, а картки чужих авто —
 * одним `src` без `formats`. Саме це й відрізняє своє від чужого, коли шаблон
 * галереї називається якось інакше.
 */
function fromStateImages(state: unknown): string[] | null {
  const images = findAll(state, (node) => {
    if (node.type !== 'Image') return false
    const formats = node.formats
    if (!formats || typeof formats !== 'object') return false
    return FORMATS.some((size) => isPhoto((formats as JsonRecord)[size]))
  })
  return collect(images)
}

/* ------------------------------ шар 3: розмітка ----------------------------- */

/**
 * Остання лінія: у документі перша карусель — галерея оголошення, а «схожі
 * авто» та «інші пропозиції продавця» лежать нижче. Беремо тільки її вміст.
 */
function fromMarkup(html: string): string[] {
  const $ = cheerio.load(html)
  const containers = $('.carousel__track, .carousel, [class*="gallery"]').toArray()
  // Головне фото сторінки називає slug самого оголошення — по ньому і впізнаємо
  // галерею серед каруселей: нижче на сторінці такі ж каруселі з чужими авто.
  const ownSlug = slugOf(html.match(OG_IMAGE)?.[1] ?? null)

  let fallback: string[] = []

  for (const container of containers) {
    const shots = new Map<string, { url: string; rank: number }>()

    $(container)
      .find('source, img')
      .each((_, element) => {
        const node = $(element)
        for (const attr of ['srcset', 'data-srcset', 'src', 'data-src']) {
          const value = node.attr(attr)?.split(',')[0]?.trim().split(' ')[0]
          if (!isPhoto(value)) continue

          const parts = value.match(PARTS)
          if (!parts) continue
          const [, slug, id, size, ext] = parts
          if (ownSlug && slug.toLowerCase() !== ownSlug) continue

          // webp дає ту саму картинку меншим файлом; jpg лишаємо як запасний
          const rank = SIZE_RANK.indexOf(size.toLowerCase()) * 2 + (ext === 'webp' ? 0 : 1)
          if (rank < 0) continue

          const current = shots.get(id)
          if (!current || rank < current.rank) shots.set(id, { url: value, rank })
        }
      })

    if (shots.size === 0) continue
    const urls = [...shots.values()].map((shot) => shot.url)
    if (ownSlug) return urls
    if (fallback.length === 0) fallback = urls
  }

  return fallback
}

function slugOf(url: string | null): string | null {
  return url?.match(/\/([a-z0-9_.-]+)__\d+/i)?.[1]?.toLowerCase() ?? null
}
