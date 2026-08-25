'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { createListing, saveListing } from '@/app/(app)/listing/actions'
import { cn } from '@/lib/cn'
import { IDLE } from '@/lib/forms'
import { compressImage } from '@/lib/image'

/**
 * Ручне заповнення картки — і нове авто, і правка вже наявного.
 *
 * Обовʼязкові тільки марка і модель: решта дописується, коли зʼявиться. Усе, що
 * тут ввели, парсер більше не перезаписує (`manual_fields`), тому форма годиться
 * і для виправлення того, що майданчик показав невірно.
 */

export type ListingFormValues = {
  brand: string
  model: string
  year: string
  mileageKm: string
  priceUsd: string
  city: string
  publishedAt: string
  url: string
  descriptionText: string
  sellerName: string
  sellerPhone: string
  sellerType: string
}

export type Photo = { key: string; url: string }

type Props = {
  /** Є id — редагуємо наявну картку, немає — заводимо нову. */
  listingId?: string
  values: ListingFormValues
  photos: Photo[]
}

const SELLER_TYPES: { value: string; label: string }[] = [
  { value: 'owner', label: 'Власник' },
  { value: 'dealer', label: 'Перекуп' },
  { value: 'showroom', label: 'Салон' },
]

export function ListingForm({ listingId, values, photos: initialPhotos }: Props) {
  const [state, formAction, pending] = useActionState(
    listingId ? saveListing : createListing,
    IDLE,
  )
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(0)
  const [photoError, setPhotoError] = useState<string | null>(null)

  async function addFiles(files: FileList | null) {
    if (!files) return
    setPhotoError(null)

    for (const file of Array.from(files)) {
      setUploading((count) => count + 1)
      try {
        const body = new FormData()
        body.append('file', await compressImage(file))

        const response = await fetch('/api/photos', { method: 'POST', body })
        const data: { key?: string; url?: string; error?: string } = await response.json()
        if (!response.ok || !data.key || !data.url) throw new Error(data.error ?? 'Не вдалось')

        setPhotos((list) => [...list, { key: data.key as string, url: data.url as string }])
      } catch (error) {
        setPhotoError(error instanceof Error ? error.message : 'Не вдалось завантажити фото')
      } finally {
        setUploading((count) => count - 1)
      }
    }
  }

  const busy = pending || uploading > 0

  return (
    <form action={formAction} className="space-y-4">
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      <input type="hidden" name="photos" value={JSON.stringify(photos.map((photo) => photo.key))} />

      <Section title="Авто">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Марка *" name="brand" defaultValue={values.brand} autoFocus required />
          <Field label="Модель *" name="model" defaultValue={values.model} required />
          <Field label="Рік" name="year" defaultValue={values.year} numeric placeholder="2015" />
          <Field
            label="Пробіг, км"
            name="mileageKm"
            defaultValue={values.mileageKm}
            numeric
            placeholder="245000"
          />
          <Field
            label="Ціна, $"
            name="priceUsd"
            defaultValue={values.priceUsd}
            numeric
            placeholder="9500"
          />
          <Field label="Місто" name="city" defaultValue={values.city} placeholder="Київ" />
        </div>
      </Section>

      <Section title="Оголошення">
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Опубліковано"
            name="publishedAt"
            type="date"
            defaultValue={values.publishedAt}
            hint="З цього рахуються дні в оголошенні"
          />
          <Field label="Посилання" name="url" defaultValue={values.url} placeholder="https://" />
        </div>
        <label className="mt-2 block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Опис
          </span>
          <textarea
            name="descriptionText"
            rows={5}
            defaultValue={values.descriptionText}
            className="mt-1 w-full rounded-card border border-line bg-white px-2.5 py-2 text-[14px] leading-snug placeholder:text-muted"
          />
        </label>
      </Section>

      <Section title="Продавець">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Імʼя" name="sellerName" defaultValue={values.sellerName} />
          <Field
            label="Телефон"
            name="sellerPhone"
            defaultValue={values.sellerPhone}
            placeholder="066 056 5259"
          />
        </div>
        <div className="mt-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Хто продає
          </span>
          <div className="mt-1 flex gap-1.5">
            {SELLER_TYPES.map((type) => (
              <label
                key={type.value}
                className="flex h-9 flex-1 cursor-pointer items-center justify-center rounded-card border border-line text-[12px] font-semibold has-checked:border-ink has-checked:bg-concrete"
              >
                <input
                  type="radio"
                  name="sellerType"
                  value={type.value}
                  defaultChecked={values.sellerType === type.value}
                  className="sr-only"
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Фото">
        {photos.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {photos.map((photo) => (
              <div key={photo.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="h-[54px] w-[72px] rounded-card border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((item) => item.key !== photo.key))}
                  aria-label="Прибрати фото"
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full border border-ink bg-white text-[11px] leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <label className="flex h-10 cursor-pointer items-center justify-center rounded-card border border-line text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          {uploading > 0 ? `Завантажую… ${uploading}` : 'Додати фото'}
        </label>
        <p className="mt-1.5 text-[12px] text-muted">
          {photoError ?? 'Стискаються в браузері до 1920 px, щоб не летіли по 5 МБ з телефона.'}
        </p>
      </Section>

      {state.error ? (
        <p className="border-l-[3px] border-signal bg-white py-2 pl-3 text-[13px]" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className={cn(
            'h-11 flex-1 rounded-card border border-ink bg-ink text-[12px] font-semibold uppercase tracking-[0.08em] text-white',
            busy && 'opacity-50',
          )}
        >
          {pending ? 'Зберігаю…' : listingId ? 'Зберегти' : 'Додати авто'}
        </button>
        <Link
          href={listingId ? `/listing/${listingId}` : '/'}
          className="flex h-11 items-center rounded-card border border-line px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
        >
          Скасувати
        </Link>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-3">
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  type = 'text',
  numeric = false,
  required = false,
  autoFocus = false,
}: {
  label: string
  name: string
  defaultValue: string
  placeholder?: string
  hint?: string
  type?: string
  numeric?: boolean
  required?: boolean
  autoFocus?: boolean
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        inputMode={numeric ? 'numeric' : undefined}
        className={cn(
          'mt-1 h-10 w-full rounded-card border border-line bg-white px-2.5 text-[14px] placeholder:text-muted',
          numeric && 'font-mono tabular-nums',
        )}
      />
      {hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  )
}
