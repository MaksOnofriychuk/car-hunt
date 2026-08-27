/**
 * Пристроєве сховище — усе, що памʼятає **пристрій**, а не база.
 *
 * Джерело правди — `localStorage`. Cookie лишається, але вже не як сховище, а
 * як спосіб донести значення до сервера в тому ж запиті: middleware і серверні
 * компоненти читають автора й вигляд ще до того, як на сторінці виконається
 * бодай рядок нашого JS, і без цього черга малювалась би порожньою.
 *
 * Тому запис завжди подвійний — у `localStorage` і в cookie з тим самим імʼям і
 * тим самим байт-у-байт значенням, — а на кожному завантаженні скрипт із
 * `<head>` відновлює зниклу cookie з `localStorage`. Cookie може зникнути
 * (Safari чистить, «очистити дані сайту», інший день) — сесія від цього не
 * зникає, бо лежить не там.
 *
 * Ключі `localStorage` навмисно збігаються з іменами cookie: одне імʼя — одна
 * річ, і в DevTools видно, що це те саме значення.
 */

export const DEVICE_KEYS = [
  'car_hunt_session',
  'car_hunt_author',
  'car_hunt_look',
  'car_hunt_view',
] as const

export type DeviceKey = (typeof DEVICE_KEYS)[number]

/** Рік. Ні сесія, ні вигляд не з тих речей, які варто перепитувати щомісяця. */
export const DEVICE_MAX_AGE = 365 * 24 * 60 * 60

/**
 * Записати значення на пристрої. Обидва сховища або жодне: розʼїхавшись, вони
 * дали б «на сервері одна тема, на клієнті інша».
 *
 * `localStorage` кидає у приватному режимі й на заблокованих сховищах — там
 * лишається сама cookie, і застосунок працює як раніше.
 */
export function writeDevice(key: DeviceKey, value: string): void {
  if (typeof document === 'undefined') return

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Сховище недоступне — cookie нижче все одно поставиться.
  }

  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${key}=${value}; path=/; max-age=${DEVICE_MAX_AGE}; samesite=lax${secure}`
}

export function readDevice(key: DeviceKey): string | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Забути значення. Вихід має прибирати сесію з обох сховищ, а не з одного. */
export function forgetDevice(key: DeviceKey): void {
  if (typeof document === 'undefined') return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Те саме: cookie нижче однаково гасимо.
  }

  document.cookie = `${key}=; path=/; max-age=0; samesite=lax`
}

/**
 * Скрипт, що виконується в `<head>` **до першого малювання**.
 *
 * Робить дві речі й обидві — синхронно, бо після малювання було б пізно:
 *
 *   1. відновлює зниклі cookie з `localStorage`. Наступний запит поїде вже з
 *      ними, і сервер знову бачитиме автора;
 *   2. одразу вішає атрибути вигляду на `<html>`, якщо сервер малював сторінку
 *      без cookie вигляду. Інакше темна тема блимнула б світлою.
 *
 * Якщо сервер устиг відправити нас на `/login`, а сесія в `localStorage` є —
 * повертаємось туди, куди йшли. Прапорець у `sessionStorage` тримає це
 * одноразовим: із простроченим токеном сервер віддасть `/login` знову, і
 * замість вічного кола людина побачить форму.
 */
export const DEVICE_BOOTSTRAP = `(function(){try{
var K=${JSON.stringify(DEVICE_KEYS)},S=location.protocol==='https:'?'; secure':'',c=document.cookie,restored=0;
for(var i=0;i<K.length;i++){var k=K[i],v=null;try{v=localStorage.getItem(k)}catch(e){}
if(v===null)continue;
if(c.indexOf(k+'=')>-1)continue;
document.cookie=k+'='+v+'; path=/; max-age=${DEVICE_MAX_AGE}; samesite=lax'+S;restored++}
if(restored){var l=null;try{l=localStorage.getItem('car_hunt_look')}catch(e){}
if(l){try{var o=JSON.parse(decodeURIComponent(l)),d=document.documentElement;
if(o.theme)d.dataset.theme=o.theme;if(o.size)d.dataset.size=o.size;
if(o.font)d.dataset.font=o.font;if(o.density)d.dataset.density=o.density}catch(e){}}
var s=null;try{s=localStorage.getItem('car_hunt_session')}catch(e){}
if(s&&location.pathname==='/login'&&!sessionStorage.getItem('ch_restored')){
sessionStorage.setItem('ch_restored','1');
var n=new URLSearchParams(location.search).get('next');
location.replace(n&&n.charAt(0)==='/'&&n.charAt(1)!=='/'?n:'/')}}
}catch(e){}})()`
