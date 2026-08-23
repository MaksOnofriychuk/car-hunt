/**
 * Пошук посилання у вставленому тексті. Окремий модуль без жодних залежностей:
 * його імпортує клієнтський компонент, тому сюди не має заїхати ні БД, ні токени.
 */
const KNOWN_LINK =
  /https?:\/\/(?:[\w-]+\.)*(?:auto\.ria\.com|olx\.ua|t\.me|telegram\.me)\/[^\s<>"']*/i

/** Перше посилання, яке ми в принципі приймаємо. Для глобального paste на головній. */
export function findListingLink(input: string): string | null {
  const match = input.match(KNOWN_LINK)
  return match ? match[0].replace(/[.,;:!?)\]}»"'>]+$/, '') : null
}
