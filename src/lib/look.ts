/**
 * Вигляд інтерфейсу: тема, розмір, шрифт, щільність.
 *
 * Живе в cookie, а не в базі: у кожного свій пристрій і свої очі. Батько
 * дивиться з телефона більшим шрифтом, я — з компʼютера меншим, і синхронізувати
 * це між ними було б не послугою, а шкодою. Сервер читає cookie при рендері й
 * одразу малює потрібне — інакше сторінка блимала б світлою темою перед темною.
 */

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Як у системи',
  light: 'Світла',
  dark: 'Темна',
}

/** Чотири рівні. Множник іде в `zoom`, тому росте весь інтерфейс, не лише текст. */
export const SIZES = ['s', 'm', 'l', 'xl'] as const
export type Size = (typeof SIZES)[number]

export const SIZE_LABELS: Record<Size, string> = {
  s: 'Дрібний',
  m: 'Звичайний',
  l: 'Більший',
  xl: 'Великий',
}

export const SIZE_ZOOM: Record<Size, number> = { s: 0.92, m: 1, l: 1.14, xl: 1.3 }

/**
 * Шрифти інтерфейсу. Усі чотири — з кирилицею, інакше український текст
 * посипався б на системний шрифт.
 *
 * SPEC просить Archivo, а серед «підвищеної читабельності» проситься Atkinson
 * Hyperlegible — але **в жодного з них немає кирилиці**. Тому роль «читабельного»
 * грає Fira Sans: її малювали саме заради розбірливості на екрані, і в неї
 * повна кирилиця.
 */
export const FONTS = ['plex', 'fira', 'inter', 'rubik'] as const
export type Font = (typeof FONTS)[number]

export const FONT_LABELS: Record<Font, string> = {
  plex: 'IBM Plex Sans',
  fira: 'Fira Sans — розбірливіша',
  inter: 'Inter',
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
export const LOOK_MAX_AGE = 365 * 24 * 60 * 60

export const DEFAULT_LOOK: Look = {
  theme: 'system',
  size: 'm',
  font: 'plex',
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
  const value = encodeURIComponent(JSON.stringify(look))
  document.cookie = `${LOOK_COOKIE}=${value}; path=/; max-age=${LOOK_MAX_AGE}; samesite=lax`
}

/** Класи щільності для списку і таблиці — щоб не тримати їх у трьох місцях. */
export const DENSITY_CLASSES: Record<Density, { card: string; gap: string; row: string }> = {
  compact: { card: 'p-2', gap: 'space-y-1.5', row: 'py-1' },
  normal: { card: 'p-3', gap: 'space-y-2', row: 'py-1.5' },
  roomy: { card: 'p-4', gap: 'space-y-3', row: 'py-2.5' },
}
