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

/**
 * Вбудовані три. «Довго висять» бере поріг із налаштувань — той самий, за яким
 * підсвічується смуга на картці: два різні уявлення про «довго» в одному
 * застосунку були б дивними.
 */
export function builtInPresets(longStandingDays: number): Preset[] {
  return [
    {
      key: 'hot',
      name: 'Мої гарячі',
      // Те, з чим уже почали розмову і про що треба нагадати цього тижня.
      query: 'stage=contacted,offer_made,negotiating,viewing_scheduled&due=week',
    },
    {
      key: 'standing',
      name: 'Довго висять',
      query: `days_min=${longStandingDays}&sort=days:desc`,
    },
    {
      key: 'cheaper',
      name: 'Дешевші за ціль',
      query: 'cheaper=1&sort=diff:asc',
    },
  ]
}

/** Чи це саме той пресет — щоб підсвітити активний чип. */
export function isPresetActive(preset: Preset, search: string): boolean {
  const normalize = (value: string) =>
    [...new URLSearchParams(value).entries()]
      .map(([key, item]) => `${key}=${item}`)
      .sort()
      .join('&')

  return normalize(preset.query) === normalize(search)
}
