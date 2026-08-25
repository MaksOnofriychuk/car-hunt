/**
 * Збережені набори фільтрів. Пресет — це просто рядок запиту, тобто те саме
 * посилання, яке можна кинути іншому.
 *
 * Три готові живуть тут константами: вони не про смак, а про роботу — саме ці
 * три питання ставлять до списку щодня. Створені руками лежать у базі
 * (`filter_presets`).
 */

export type Preset = {
  /** Ключ константи або id рядка в базі. */
  key: string
  name: string
  /** Серіалізований `ListQuery`. */
  query: string
  /** Заведений руками — такий можна прибрати. Вбудовані три прибрати не можна. */
  custom?: boolean
}

export const BUILT_IN_PRESETS: readonly Preset[] = [
  {
    key: 'hot',
    name: 'Мої гарячі',
    // Те, з чим уже почали розмову і про що треба нагадати цього тижня.
    query: 'stage=contacted,offer_made,negotiating,viewing_scheduled&due=week',
  },
  {
    key: 'standing',
    name: 'Довго висять',
    // 60 днів — та сама межа, після якої PlateStrip підсвічує число синім.
    query: 'days_min=60&sort=days:desc',
  },
  {
    key: 'cheaper',
    name: 'Дешевші за ціль',
    query: 'cheaper=1&sort=diff:asc',
  },
]

/** Чи це саме той пресет — щоб підсвітити активний чип. */
export function isPresetActive(preset: Preset, search: string): boolean {
  const normalize = (value: string) =>
    [...new URLSearchParams(value).entries()]
      .map(([key, item]) => `${key}=${item}`)
      .sort()
      .join('&')

  return normalize(preset.query) === normalize(search)
}
