import { describe, expect, it } from 'vitest'

import { extractListingRef, refForInput } from './index'

/**
 * Єдине, що покривається тестами в цьому проєкті (SPEC, «Інгест посилання»).
 * Ця функція — вхідні ворота: якщо вона помиляється, посилання або губиться,
 * або створює дубль картки.
 */

describe('extractListingRef: AUTO.RIA', () => {
  it('розбирає канонічне посилання', () => {
    expect(extractListingRef('https://auto.ria.com/uk/auto_volkswagen_passat_38123456.html')).toEqual(
      { source: 'autoria', id: '38123456' },
    )
  })

  it('не спотикається об UTM і реферальні хвости', () => {
    expect(
      extractListingRef(
        'https://auto.ria.com/uk/auto_skoda_octavia_38891234.html?utm_source=telegram&utm_medium=share&utm_campaign=car',
      ),
    ).toEqual({ source: 'autoria', id: '38891234' })
  })

  it('бере id з ?auto_id= на будь-якому піддомені', () => {
    expect(extractListingRef('https://m.auto.ria.com/uk/search/?auto_id=38123456')).toEqual({
      source: 'autoria',
      id: '38123456',
    })
  })

  it('знаходить посилання всередині пересланого повідомлення', () => {
    const forwarded = [
      'Привіт! Дивись що знайшов',
      'https://auto.ria.com/uk/auto_bmw_x5_41234567.html',
      'ціна норм, але пробіг великий',
    ].join('\n')

    expect(extractListingRef(forwarded)).toEqual({ source: 'autoria', id: '41234567' })
  })

  it('відрізає хвостову дужку і крапку', () => {
    expect(
      extractListingRef('Глянь оце (https://auto.ria.com/uk/auto_audi_a6_40270985.html), норм?'),
    ).toEqual({ source: 'autoria', id: '40270985' })

    expect(
      extractListingRef('ось воно https://auto.ria.com/uk/auto_audi_a6_40270985.html.'),
    ).toEqual({ source: 'autoria', id: '40270985' })
  })

  it('не плутає auto.ria.com із сусіднім ria.com', () => {
    expect(extractListingRef('https://ria.com/uk/something-else')).toBeNull()
    expect(extractListingRef('https://dom.ria.com/uk/realty-perevireno-12345.html')).toBeNull()
  })
})

describe('extractListingRef: OLX', () => {
  it('бере id з хвоста посилання', () => {
    expect(
      extractListingRef('https://www.olx.ua/d/uk/obyavlenie/prodam-avto-IDwEfGh.html'),
    ).toEqual({ source: 'olx', id: 'wEfGh' })
  })

  it('віддає перевагу параметру ad_id', () => {
    expect(
      extractListingRef('https://www.olx.ua/uk/obyavlenie/avto-IDxYz12.html?ad_id=abc999'),
    ).toEqual({ source: 'olx', id: 'abc999' })
  })
})

describe('extractListingRef: Telegram', () => {
  it('канонізує посилання виду /c/ без мережі', () => {
    expect(extractListingRef('https://t.me/c/1005640892/55')).toEqual({
      source: 'telegram',
      id: '-1001005640892:55',
    })
  })

  it('позначає форму з @username як тимчасову', () => {
    expect(extractListingRef('https://t.me/telegram/55')).toEqual({
      source: 'telegram',
      id: '@telegram:55',
    })
  })

  it('розуміє прев’ю-форму /s/ і старий домен telegram.me', () => {
    expect(extractListingRef('https://t.me/s/avtorynok_ua/1042')).toEqual({
      source: 'telegram',
      id: '@avtorynok_ua:1042',
    })
    expect(extractListingRef('https://telegram.me/avtorynok_ua/1042')).toEqual({
      source: 'telegram',
      id: '@avtorynok_ua:1042',
    })
  })
})

describe('extractListingRef: чого не знаємо', () => {
  it.each([
    ['невідомий домен', 'https://mobile.de/12345'],
    ['текст без посилання', 'просто текст, жодного посилання'],
    ['порожній рядок', ''],
    ['наш домен без id', 'https://auto.ria.com/uk/'],
  ])('%s → null', (_label, input) => {
    expect(extractListingRef(input)).toBeNull()
  })
})

describe('refForInput: посилання не губиться ніколи', () => {
  it('невідомий домен стає ручною карткою з uuid', () => {
    const result = refForInput('https://mobile.de/12345')

    expect(result.recognized).toBe(false)
    expect(result.ref.source).toBe('manual')
    expect(result.ref.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('щоразу видає новий id, щоб дві різні вставки не злиплись', () => {
    expect(refForInput('https://mobile.de/1').ref.id).not.toBe(
      refForInput('https://mobile.de/2').ref.id,
    )
  })

  it('розпізнане джерело проходить як є', () => {
    const result = refForInput('https://auto.ria.com/uk/auto_audi_a6_40270985.html')

    expect(result.recognized).toBe(true)
    expect(result.ref).toEqual({ source: 'autoria', id: '40270985' })
  })
})
