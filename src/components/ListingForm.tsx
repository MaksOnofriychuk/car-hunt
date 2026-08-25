'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { DateField } from './DateField'

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
          <label className="block">
            <span className="t-micro text-faint">Опубліковано</span>
            <DateField
              name="publishedAt"
              defaultValue={values.publishedAt}
              ariaLabel="Дата публікації"
              className="mt-1"
            />
            <span className="t-micro mt-1 block normal-case tracking-normal text-faint">
              З цього рахуються дні в оголошенні
            </span>
          </label>
          <Field label="Посилання" name="url" defaultValue={values.url} placeholder="https://" />
        </div>
        <label className="mt-2 block">
          <span className="t-micro text-faint">
            Опис
          </span>
          <textarea
            name="descriptionText"
            rows={5}
            defaultValue={values.descriptionText}
            className="field mt-1"
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
          <span className="t-micro text-faint">
            Хто продає
          </span>
          <div className="mt-1 flex gap-1.5">
            {SELLER_TYPES.map((type) => (
              <label
                key={type.value}
                className="chip tap flex-1 cursor-pointer has-checked:border-accent has-checked:bg-accent/12 has-checked:text-accent-lit"
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
                  className="h-[54px] w-[72px] rounded-chip border border-edge object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((item) => item.key !== photo.key))}
                  aria-label="Прибрати фото"
                  className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border border-edge bg-raised text-[11px] leading-none text-muted"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <label className="btn tap w-full cursor-pointer border-dashed text-muted">
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
        <p className={cn('t-body mt-1.5', photoError ? 'text-danger' : 'text-faint')}>
          {photoError ?? 'Стискаються в браузері до 1920 px, щоб не летіли по 5 МБ з телефона.'}
        </p>
      </Section>

      {state.error ? (
        <p className="t-body sunken rib border-l-danger px-3 py-2 text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-accent tap flex-1"
        >
          {pending ? 'Зберігаю…' : listingId ? 'Зберегти' : 'Додати авто'}
        </button>
        <Link
          href={listingId ? `/listing/${listingId}` : '/'}
          className="btn btn-quiet tap px-3 text-muted"
        >
          Скасувати
        </Link>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-3">
      <h2 className="t-micro mb-2 text-faint">{title}</h2>
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
      <span className="t-micro text-faint">
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
        className={cn('field mt-1', numeric && 'field-num')}
      />
      {hint ? <span className="t-micro mt-1 block normal-case tracking-normal text-faint">{hint}</span> : null}
    </label>
  )
}
