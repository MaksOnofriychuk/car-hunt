'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'

import { saveSellerPhone, type PhoneFormState } from '@/app/(app)/listing/actions'
import { formatPhone } from '@/lib/phone'

/**
 * Телефон продавця. Парсер його не дістає — AUTO.RIA показує тільки маску
 * `(066) XXX XX XX`, а повний номер відкриває по кліку в себе на сайті. Тому
 * маска тут як підказка, а номер вводиться руками і йде в `sellers.phones`.
 */

type SharedSeller = { id: string; name: string | null }

const INITIAL: PhoneFormState = { error: null, saved: null, sameAs: [] }

export function SellerPhones({
  listingId,
  phones,
  masked,
  sharedWith,
}: {
  listingId: string
  phones: string[]
  /** Маска зі сторінки оголошення, якщо парсер її бачив. */
  masked: string | null
  /** Інші продавці з тим самим номером — попередження живе між перезавантаженнями. */
  sharedWith: SharedSeller[]
}) {
  const [state, formAction, pending] = useActionState(saveSellerPhone, INITIAL)
  const [open, setOpen] = useState(false)

  // Зберегли — ховаємо поле; номер уже прилетів у `phones` після revalidate.
  useEffect(() => {
    if (state.saved) setOpen(false)
  }, [state.saved])

  const warnings = [...sharedWith]
  for (const seller of state.sameAs) {
    if (!warnings.some((row) => row.id === seller.id)) warnings.push(seller)
  }

  return (
    <div className="mt-2">
      {phones.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {phones.map((phone) => (
            <a
              key={phone}
              href={`tel:${phone}`}
              className="inline-flex h-9 items-center rounded-card border border-ink px-2.5 font-mono text-[13px] tabular-nums"
            >
              {formatPhone(phone)}
            </a>
          ))}
        </div>
      ) : null}

      {open ? (
        <form action={formAction} className="mt-2 flex gap-2">
          <input type="hidden" name="listingId" value={listingId} />
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoFocus
            placeholder={masked ?? '+380 __ ___ __ __'}
            className="h-10 min-w-0 flex-1 rounded-card border border-line bg-white px-2.5 font-mono text-[14px] tabular-nums placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 shrink-0 rounded-card border border-ink bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            {pending ? 'Пишу…' : 'Зберегти'}
          </button>
        </form>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          {phones.length === 0 && masked ? (
            <span className="font-mono text-[13px] tabular-nums text-muted">{masked}</span>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 shrink-0 rounded-card border border-ink px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
          >
            {phones.length === 0 ? 'Додати номер' : 'Ще номер'}
          </button>
        </div>
      )}

      {phones.length === 0 && !masked && !open ? (
        <p className="mt-1.5 text-[12px] text-muted">
          Номера немає ні в нас, ні на сторінці оголошення.
        </p>
      ) : null}

      {state.error ? <p className="mt-1.5 text-[12px] font-semibold">{state.error}</p> : null}

      {warnings.length > 0 ? (
        <p className="mt-2 border-l-2 border-ink pl-2 text-[12px] leading-snug">
          Цей номер уже записаний{' '}
          {warnings.length === 1 ? 'у продавця' : 'у продавців'}{' '}
          {warnings.map((seller, index) => (
            <span key={seller.id}>
              {index > 0 ? ', ' : ''}
              <span className="font-semibold">{seller.name ?? 'Без імені'}</span>
            </span>
          ))}
          . Можливо, це та сама людина —{' '}
          <Link href="/sellers" className="text-plate underline underline-offset-2">
            подивись у продавцях
          </Link>
          .
        </p>
      ) : null}
    </div>
  )
}
