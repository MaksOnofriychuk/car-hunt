'use client'

import { useEffect, useState } from 'react'
import { useActionState } from 'react'

import { login, type LoginState } from './actions'
import { cn } from '@/lib/cn'
import { writeDevice } from '@/lib/device-store'
import type { Author } from '@/lib/users'

const initialState: LoginState = { error: null }

/**
 * Вхід — аркуш 00: пароль, вибір людини, широка кнопка. Пароль один на двох,
 * тому «хто ви» — це не автентифікація, а підпис під майбутніми подіями.
 */
export function LoginForm({
  names,
  next,
  lastAuthor = null,
}: {
  names: Record<Author, string>
  next?: string
  /** Хто заходив із цього пристрою минулого разу — щоб не вибирати себе щоразу. */
  lastAuthor?: Author | null
}) {
  const [state, formAction, pending] = useActionState(login, initialState)
  const [author, setAuthor] = useState<Author | null>(lastAuthor)

  /**
   * Пароль зійшовся — сервер віддав токен, але нікуди його не поклав. Кладемо
   * самі: сесія живе в `localStorage`, звідки її дістає скрипт із `<head>`.
   *
   * Далі — `location.replace`, а не `router.push`: перехід має піти новим
   * запитом, у якому вже поїде щойно записана cookie. Клієнтська навігація
   * лишила б сервер із думкою, що ми досі неавторизовані.
   */
  useEffect(() => {
    if (!state.token || !state.author) return

    writeDevice('car_hunt_session', state.token)
    // Хто заходив із цього пристрою — підказка формі на наступний раз. Це не
    // облікові дані: сама по собі вона нікуди не пускає.
    writeDevice('car_hunt_author', state.author)
    // Новий вхід знімає позначку «сесію вже відновлювали» з попереднього.
    try {
      window.sessionStorage.removeItem('ch_restored')
    } catch {
      // Приватний режим — не біда, позначка й так одноразова.
    }

    window.location.replace(state.next ?? '/')
  }, [state.token, state.author, state.next])

  // Пароль зійшовся — форма вже не потрібна: чекаємо на перехід, а не
  // пропонуємо ввести пароль ще раз.
  const leaving = Boolean(state.token)

  // Після досягнення ліміту наступний POST зустріне 429 у middleware,
  // а відповідь у форматі 429 зламала б серверну дію на клієнті. Тому замикаємо тут.
  const disabled = pending || leaving || state.blocked === true

  return (
    <form action={formAction} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <label htmlFor="password" className="t-micro block text-faint">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="field field-num mt-1.5 h-12 text-left text-[16px] tracking-[0.3em]"
          placeholder="••••••••"
        />
      </div>

      <div>
        <p className="t-micro text-faint">Хто ви</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(['me', 'dad'] as const).map((value) => (
            <label
              key={value}
              className={cn(
                'btn tap cursor-pointer',
                author === value && 'border-accent bg-accent/12 text-accent-lit',
              )}
            >
              <input
                type="radio"
                name="author"
                value={value}
                checked={author === value}
                onChange={() => setAuthor(value)}
                className="sr-only"
              />
              Я — {names[value]}
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled || author === null}
        className="btn btn-accent tap w-full"
      >
        {pending || leaving ? 'Заходжу…' : 'Увійти'}
      </button>

      {state.error ? (
        <p role="alert" className="t-body sunken rib border-l-danger px-3 py-2 text-danger">
          {state.blocked
            ? `Забагато спроб входу. Спробуй за ${Math.ceil((state.retryAfterSeconds ?? 0) / 60)} хв.`
            : state.error}
        </p>
      ) : null}

      <p className="t-body text-center text-faint">
        Один пароль на двох. Хто ти — памʼятається на цьому пристрої.
      </p>
    </form>
  )
}
