import { describe, expect, it } from 'vitest'

import { isFullVin, looksLikePost, parsePostText, textHashOf } from './post-parse'

/**
 * Розбір поста — чиста евристика, і саме тому вона під тестами: тут легко тихо
 * зламати щось правкою в сусідньому рядку, а помітиться це вже на картці з
 * вигаданим роком.
 *
 * Приклад — той самий, на який спирається розділ SPEC «Пости з Telegram-груп».
 */

const POST = `🖼 Volkswagen Passat
2015
1.8 бензин (170 к.с)
245 тис км
Передній привід
Автомобіль пройшов ТО, два комплекти гуми
Київ
💰9500$ (ріа 9799$)
☎️ 066 056 5259
@St_Nicholas3105
https://auto.ria.com/uk/auto_volkswagen_passat_39594827.html
1VWAT7A36GC003391`

describe('parsePostText', () => {
  const parsed = parsePostText(POST)

  it('дістає назву, марку і модель зі словника', () => {
    expect(parsed.title).toBe('Volkswagen Passat')
    expect(parsed.brand).toBe('Volkswagen')
    expect(parsed.model).toBe('Passat')
  })

  it('дістає рік, пробіг, привід і місто', () => {
    expect(parsed.year).toBe(2015)
    expect(parsed.mileageKm).toBe(245_000)
    expect(parsed.driveType).toBe('передній')
    expect(parsed.city).toBe('Київ')
  })

  it('дістає обʼєм, паливо і потужність окремо', () => {
    expect(parsed.engineVolume).toBe(1.8)
    expect(parsed.fuelType).toBe('бензин')
    expect(parsed.power).toBe('170 к.с.')
  })

  it('бере ціну продавця, а ціну в дужках лишає довідковою', () => {
    expect(parsed.price).toEqual({ amount: 9500, currency: 'USD' })
    expect(parsed.referencePrice).toEqual({ amount: 9799, currency: 'USD' })
  })

  it('нормалізує телефон і бере юзернейм контактом', () => {
    expect(parsed.phones).toEqual(['+380660565259'])
    expect(parsed.username).toBe('@St_Nicholas3105')
  })

  it('дістає VIN і посилання', () => {
    expect(parsed.vin).toBe('1VWAT7A36GC003391')
    expect(parsed.links).toEqual([
      'https://auto.ria.com/uk/auto_volkswagen_passat_39594827.html',
    ])
  })

  it('решту рядків лишає описом', () => {
    expect(parsed.descriptionText).toBe('Автомобіль пройшов ТО, два комплекти гуми')
  })

  it('не вигадує того, чого в тексті немає', () => {
    const short = parsePostText('Продам машину, дзвоніть')
    expect(short.brand).toBeNull()
    expect(short.year).toBeNull()
    expect(short.price).toBeNull()
    expect(short.city).toBeNull()
  })

  it('ціну без знака валюти не бере', () => {
    expect(parsePostText('Toyota Camry\n9500').price).toBeNull()
    expect(parsePostText('Toyota Camry\n9 500 у.о.').price).toBeNull()
  })

  it('розуміє гривню і пробіг без «тис»', () => {
    const uah = parsePostText('Skoda Octavia\n420000 грн\n186000 км')
    expect(uah.price).toEqual({ amount: 420_000, currency: 'UAH' })
    expect(uah.mileageKm).toBe(186_000)
  })

  it('відкидає рекламу і кредит, але лишає їх у тексті', () => {
    const noisy = parsePostText('BMW X5\nАвто в кредит від партнера\nПідписуйся на канал\nЛьвів')
    expect(noisy.city).toBe('Львів')
    expect(noisy.descriptionText).toBeNull()
  })

  it('не плутає рік із іншими чотиризначними числами', () => {
    expect(parsePostText('Audi A6\n1975').year).toBeNull()
    expect(parsePostText('Audi A6\n2015 р.').year).toBe(2015)
  })
})

describe('looksLikePost', () => {
  it('впізнає пост за телефоном, ціною або VIN', () => {
    expect(looksLikePost(POST)).toBe(true)
    expect(looksLikePost('Mazda 6\n☎️ 067 123 45 67')).toBe(true)
  })

  it('просте посилання постом не вважає', () => {
    expect(looksLikePost('https://auto.ria.com/uk/auto_mazda_6_12345678.html')).toBe(false)
    expect(looksLikePost('глянь\nhttps://auto.ria.com/uk/auto_mazda_6_12345678.html')).toBe(false)
  })
})

describe('isFullVin', () => {
  it('приймає європейський VIN, у якого контрольний розряд не сходиться', () => {
    expect(isFullVin('WVWZZZ3CZFE123456')).toBe(true)
  })

  it('приймає американський', () => {
    expect(isFullVin('1VWAT7A36GC003391')).toBe(true)
  })

  it('відкидає маску AUTO.RIA і короткі рядки', () => {
    expect(isFullVin('1HGCR2650EA7XXXXX')).toBe(false)
    expect(isFullVin('WVWZZZ3CZFE12345')).toBe(false)
    expect(isFullVin(null)).toBe(false)
  })
})

describe('textHashOf', () => {
  it('однаковий для того самого поста з іншим підписом каналу', () => {
    const a = textHashOf(`${POST}\n\nПідписуйся: https://t.me/avtorynok`)
    const b = textHashOf(POST)
    expect(a).toBe(b)
  })

  it('порожній для короткого тексту — інакше все злиплося б в одне авто', () => {
    expect(textHashOf('фото')).toBeNull()
  })
})
