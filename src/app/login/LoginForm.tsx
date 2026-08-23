'use client'

import { useActionState } from 'react'

import { login, type LoginState } from './actions'
import type { Author } from '@/lib/users'

const initialState: LoginState = { error: null }

export function LoginForm({ names, next }: { names: Record<Author, string>; next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState)
  // Після досягнення ліміту наступний POST зустріне 429 у middleware,
  // а відповідь у форматі 429 зламала б серверну дію на клієнті. Тому замикаємо тут.
  const disabled = pending || state.blocked === true

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <label
          htmlFor="password"
          className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
        >
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="mt-1.5 h-12 w-full rounded-card border border-line bg-white px-3 font-mono text-[16px] tracking-wide text-ink placeholder:text-muted"
          placeholder="••••••••"
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Хто ви</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <button
            type="submit"
            name="author"
            value="me"
            disabled={disabled}
            className="h-12 rounded-card border border-ink bg-white px-3 text-[15px] font-semibold text-ink active:bg-concrete disabled:opacity-50"
          >
            Я — {names.me}
          </button>
          <button
            type="submit"
            name="author"
            value="dad"
            disabled={disabled}
            className="h-12 rounded-card border border-ink bg-white px-3 text-[15px] font-semibold text-ink active:bg-concrete disabled:opacity-50"
          >
            Я — {names.dad}
          </button>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="border-l-[3px] border-signal bg-white py-2 pl-3 text-[13px] text-ink"
        >
          {state.blocked
            ? `Забагато спроб входу. Спробуй за ${Math.ceil((state.retryAfterSeconds ?? 0) / 60)} хв.`
            : state.error}
        </p>
      ) : null}
    </form>
  )
}
