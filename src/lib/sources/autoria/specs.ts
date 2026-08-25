import {
  allById,
  byId,
  clean,
  findNode,
  firstNumber,
  nodesIn,
  splitBullets,
  textById,
  textOf,
} from './sdui'

/**
 * Характеристики оголошення — SPEC, «максимум інформації з картки».
 * Усе береться з `window.__PINIA__` по id вузлів: RIA сама підписує їх
 * («badgesVin», «descColorColor»), і ці підписи переживають зміну верстки.
 *
 * Частина полів іде в окремі колонки `listings`, решта лишається в
 * `snapshot_raw.specs` і показується списком — заводити колонку під
 * «Гаражне зберігання • Сервісна книжка» немає сенсу.
 */

export type SpecPair = { label: string; value: string }

export type AutoRiaSpecs = {
  /* --- у колонки --- */
  vin: string | null
  plateNumber: string | null
  priceUah: number | null
  /** Літри: «Бензин, 2.36 л» → 2.36. */
  engineVolume: number | null
  driveType: string | null
  bodyType: string | null
  transmission: string | null
  fuelType: string | null
  color: string | null

  /* --- тільки для показу --- */
  power: string | null
  generation: string | null
  equipment: string | null
  doors: number | null
  seats: number | null
  geo: string | null
  /** Блок «характеристики» цілком, як на сторінці. */
  pairs: SpecPair[]
  /** «Обмін», «Офіційне обслуговування», «Тільки на AUTO.RIA». */
  badges: string[]
  /** Перевірка за держреєстрами: власники, розшук, остання операція. */
  checks: string[]
  views: number | null
  favorites: number | null
  sellerRating: number | null
  sellerReviews: number | null
  sellerSince: string | null
  sellerOtherCars: number | null
}

export const EMPTY_SPECS: AutoRiaSpecs = {
  vin: null,
  plateNumber: null,
  priceUah: null,
  engineVolume: null,
  driveType: null,
  bodyType: null,
  transmission: null,
  fuelType: null,
  color: null,
  power: null,
  generation: null,
  equipment: null,
  doors: null,
  seats: null,
  geo: null,
  pairs: [],
  badges: [],
  checks: [],
  views: null,
  favorites: null,
  sellerRating: null,
  sellerReviews: null,
  sellerSince: null,
  sellerOtherCars: null,
}

/** VIN або його маска («1HGCR2650EA7XXXXX»): 17 знаків без I, O, Q. */
const VIN = /^[A-HJ-NPR-Z0-9*X]{9,20}$/i

function asVin(value: string | null): string | null {
  const candidate = value?.replace(/\s+/g, '') ?? null
  return candidate && VIN.test(candidate) ? candidate.toUpperCase() : null
}

/** «9 600 $ • 430 176 грн» → { USD: 9600, UAH: 430176 } */
function prices(state: unknown): { uah: number | null; usd: number | null } {
  const node = findNode(
    state,
    (record) => typeof record.UAH === 'string' && typeof record.USD === 'string',
  )
  if (node) {
    return { uah: firstNumber(String(node.UAH)), usd: firstNumber(String(node.USD)) }
  }

  // Запасний шлях — рядок ціни під заголовком.
  const row = textById(state, 'basicInfoPrice') ?? textById(state, 'sidePrice')
  const uah = row?.match(/([\d\s]+)\s*грн/)?.[1] ?? null
  const usd = row?.match(/([\d\s]+)\s*\$/)?.[1] ?? null
  return { uah: firstNumber(uah), usd: firstNumber(usd) }
}

/** «Бензин, 2.36 л, (255.68 к.с. / 188 кВт)» → паливо, обʼєм, потужність. */
function engine(text: string | null): {
  fuelType: string | null
  volume: number | null
  power: string | null
} {
  if (!text) return { fuelType: null, volume: null, power: null }

  const fuelType = clean(text.split(',')[0])
  // `\b` тут не годиться: після кирилічної «л» межі слова для JS немає.
  const volume = firstNumber(text.match(/(\d+[.,]\d+|\d+)\s*л(?![а-яіїєґ'ʼ])/i)?.[1] ?? null)
  const power = clean(text.match(/\(([^)]*(?:к\.с\.|кВт)[^)]*)\)/)?.[1] ?? null)

  return { fuelType, volume, power }
}

/**
 * Блок «характеристики» — пари «підпис / значення». RIA дає їх сусідніми
 * текстовими шаблонами, де id значення продовжує id підпису
 * (`descColor` → `descColorColor`) або закінчується на `Value`.
 */
function characteristicPairs(state: unknown): SpecPair[] {
  const list = byId(state, 'descList')
  if (!list) return []

  const texts = nodesIn(list)
    .filter((node) => node.type === 'TextTemplate' && typeof node.id === 'string')
    .map((node) => ({ id: String(node.id), text: textOf(node) }))
    .filter((item): item is { id: string; text: string } => Boolean(item.text))

  const pairs: SpecPair[] = []
  for (let i = 0; i < texts.length - 1; i += 1) {
    const label = texts[i]
    const value = texts[i + 1]
    const looksLikeValue = value.id.startsWith(label.id) || /Value$/.test(value.id)
    if (!looksLikeValue) continue

    pairs.push({ label: label.text.replace(/:$/, ''), value: value.text })
    i += 1
  }
  return pairs
}

/**
 * Тексти вузлів за шаблоном id. Дублі прибираємо: той самий блок лежить у стані
 * двічі — і в структурі сторінки, і в реєстрі шаблонів.
 */
function textsById(state: unknown, id: RegExp, type?: string): string[] {
  const texts = allById(state, id)
    .filter((node) => !type || node.type === type)
    .map((node) => textOf(node))
    .filter((text): text is string => Boolean(text))
  return [...new Set(texts)]
}

export function extractSpecs(state: unknown): AutoRiaSpecs {
  if (!state) return { ...EMPTY_SPECS }

  const money = prices(state)
  const engineText =
    textById(state, 'descEngineEngine') ?? textById(state, 'basicInfoTableMainInfo2')
  const motor = engine(engineText)

  // «Седан  •  4 дверей  •  5 місць»
  const body = splitBullets(textById(state, 'descCharacteristicsValue'))
  // «IX покоління  •  2.4 AT (188 к.с.)  •  Base»
  const generationRow = splitBullets(textById(state, 'basicInfoGenerationBase'))

  const pairs = characteristicPairs(state)
  const fromPairs = (pattern: RegExp): string | null =>
    pairs.find((pair) => pattern.test(pair.label))?.value ?? null

  return {
    vin: asVin(textById(state, 'badgesVin')) ?? asVin(textById(state, 'badgesVervin')),
    plateNumber: textById(state, 'badgesPlateNumber'),
    priceUah: money.uah,
    engineVolume: motor.volume,
    driveType: textById(state, 'descDriveTypeDriveType') ?? fromPairs(/привід/i),
    bodyType: clean(body[0]),
    transmission:
      textById(state, 'descTransmissionTransmission') ??
      fromPairs(/коробка/i) ??
      textById(state, 'basicInfoTableMainInfo1'),
    fuelType: motor.fuelType,
    color: textById(state, 'descColorColor') ?? fromPairs(/колір/i),

    power: motor.power,
    generation: clean(generationRow[0]) ?? textById(state, 'descGenerationBaseValue'),
    equipment: generationRow.length > 2 ? clean(generationRow[generationRow.length - 1]) : null,
    doors: firstNumber(body.find((part) => /двер/i.test(part)) ?? null),
    seats: firstNumber(body.find((part) => /місц/i.test(part)) ?? null),
    geo: textById(state, 'basicInfoTableMainInfoGeo'),
    pairs,
    // Бейджі під заголовком, окрім VIN і номера — ті йдуть окремими полями.
    badges: textsById(state, /^badges(?!Vin|Vervin|PlateNumber|Copy)/, 'BadgeTemplate'),
    checks: textsById(state, /^mvsOptions\d+$/),
    views: firstNumber(textById(state, 'advertStatisticViews')),
    favorites: firstNumber(textById(state, 'advertStatisticNotepad')),
    sellerRating: firstNumber(textById(state, 'sellerInfoUserRatingMark')),
    sellerReviews: firstNumber(textById(state, 'sellerInfoUserRatingComm')),
    sellerSince: textById(state, 'sellerInfoWorkWithText'),
    sellerOtherCars: firstNumber(textById(state, 'sellerInfoOtherCars')),
  }
}

/** Ціна в доларах зі сторінки — запасний варіант, якщо в ld+json її немає. */
export function priceUsdFromState(state: unknown): number | null {
  return prices(state).usd
}
