/**
 * Вигляд інтерфейсу: тема, розмір, шрифт, щільність.
 *
 * Живе на пристрої, а не в базі: у кожного свій пристрій і свої очі. Батько
 * дивиться з телефона більшим шрифтом, я — з компʼютера меншим, і синхронізувати
 * це між ними було б не послугою, а шкодою.
 *
 * Сховище — `localStorage` із дзеркалом у cookie (`src/lib/device-store.ts`):
 * сервер читає значення при рендері й одразу малює потрібне, інакше сторінка
 * блимала б світлою темою перед темною.
 */

import { writeDevice } from './device-store'

export const THEMES = ['dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Темна',
  light: 'Світла',
}

/** Підказка під перемикачем. Теми рівно дві — системної «авто» немає. */
export const THEME_HINT = 'Темна — основна. Світла — повноцінна пара, не інверсія. Перехід 320 мс.'

/**
 * Чотири рівні розміру. Міняють самі типографічні ролі, а не масштаб усього:
 * підпис мусить лишатись компактним, навіть коли ціна виростає. Значення — у
 * `globals.css`, тут лише перелік і підписи.
 */
export const SIZES = ['s', 'm', 'l', 'xl'] as const
export type Size = (typeof SIZES)[number]

export const SIZE_LABELS: Record<Size, string> = {
  s: 'Дрібний',
  m: 'Звичайний',
  l: 'Більший',
  xl: 'Великий',
}

/**
 * Шрифти інтерфейсу. Усі чотири — з кирилицею, інакше український текст
 * посипався б на системний шрифт.
 *
 * Типовий — Inter: саме він на макетах нової системи. Роль «читабельного»
 * грає Fira Sans, бо ні Archivo зі SPEC, ні Atkinson Hyperlegible кирилиці не
 * мають — український текст сипався б на системний шрифт.
 */
export const FONTS = ['inter', 'plex', 'fira', 'rubik'] as const
export type Font = (typeof FONTS)[number]

export const FONT_LABELS: Record<Font, string> = {
  inter: 'Inter',
  plex: 'IBM Plex Sans',
  fira: 'Fira Sans — розбірливіша',
  rubik: 'Rubik',
}

export const DENSITIES = ['compact', 'normal', 'roomy'] as const
export type Density = (typeof DENSITIES)[number]

export const DENSITY_LABELS: Record<Density, string> = {
  compact: 'Компактна',
  normal: 'Звичайна',
  roomy: 'Просторa',
}

export type Look = {
  theme: Theme
  size: Size
  font: Font
  density: Density
}

export const LOOK_COOKIE = 'car_hunt_look'

export const DEFAULT_LOOK: Look = {
  // Темна — основна тема системи, а не наслідок системних налаштувань.
  theme: 'dark',
  size: 'm',
  font: 'inter',
  density: 'normal',
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

export function parseLook(raw: string | undefined): Look {
  if (!raw) return DEFAULT_LOOK

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (!parsed || typeof parsed !== 'object') return DEFAULT_LOOK

    const record = parsed as Record<string, unknown>
    return {
      theme: pick(record.theme, THEMES, DEFAULT_LOOK.theme),
      size: pick(record.size, SIZES, DEFAULT_LOOK.size),
      font: pick(record.font, FONTS, DEFAULT_LOOK.font),
      density: pick(record.density, DENSITIES, DEFAULT_LOOK.density),
    }
  } catch {
    return DEFAULT_LOOK
  }
}

export function writeLook(look: Look): void {
  writeDevice(LOOK_COOKIE, encodeURIComponent(JSON.stringify(look)))
}

/** Класи щільності для списку і таблиці — щоб не тримати їх у трьох місцях. */
export const DENSITY_CLASSES: Record<Density, { card: string; gap: string; row: string }> = {
  compact: { card: 'p-2', gap: 'space-y-1.5', row: 'py-1' },
  normal: { card: 'p-3', gap: 'space-y-2', row: 'py-1.5' },
  roomy: { card: 'p-4', gap: 'space-y-3', row: 'py-2.5' },
}
