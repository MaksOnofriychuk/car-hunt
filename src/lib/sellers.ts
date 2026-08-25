import type { SellerType } from '@/db/schema'

/** Підписи типів продавця — однакові на всіх екранах. */
export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  owner: 'Власник',
  dealer: 'Перекуп',
  showroom: 'Автосалон',
  unknown: 'Невідомо',
}

/**
 * Схоже на перекупа. Рахуємо самі, за поведінкою: три авто одночасно або пʼять
 * за весь час — це вже не «продаю бабусину машину».
 *
 * Позначка окрема, а не перезапис `sellers.type`: той тип або з майданчика, або
 * введений руками, і SPEC каже його не затирати. Останнє слово лишається за
 * людиною.
 */
export function looksLikeDealer(stats: { active: number; total: number }): boolean {
  return stats.active >= 3 || stats.total >= 5
}
