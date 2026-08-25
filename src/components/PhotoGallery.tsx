'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

/**
 * Галерея оголошення. Тап по фото відкриває повний екран, свайп гортає,
 * тап повз фото закриває.
 *
 * Гортання зроблене нативним скролом зі snap, а не обробкою жестів: на телефоні
 * це та сама інерція, що і в усіх застосунках, і працює однаково у всіх
 * браузерах. JS лишається тільки для лічильника і клавіатури.
 */

type Props = {
  photos: string[]
  /** Назва авто — в alt, щоб фото мали сенс без картинок. */
  title: string
}

export function PhotoGallery({ photos, title }: Props) {
  const [openAt, setOpenAt] = useState<number | null>(null)

  if (photos.length === 0) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpenAt(0)}
        aria-label="Відкрити фото на весь екран"
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-card border border-line bg-concrete"
      >
        <Image
          src={photos[0]}
          alt={title}
          fill
          sizes="(max-width: 560px) 100vw, 560px"
          className="object-cover"
          priority
        />
        <span className="absolute bottom-2 right-2 rounded-card bg-ink/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white">
          {photos.length}
        </span>
      </button>

      {photos.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.slice(1).map((photo, index) => (
            <button
              key={photo}
              type="button"
              onClick={() => setOpenAt(index + 1)}
              aria-label={`Фото ${index + 2}`}
              className="relative h-[54px] w-[72px] shrink-0 overflow-hidden rounded-card border border-line"
            >
              <Image src={photo} alt="" fill sizes="72px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {openAt !== null ? (
        <Lightbox photos={photos} title={title} startAt={openAt} onClose={() => setOpenAt(null)} />
      ) : null}
    </div>
  )
}

function Lightbox({
  photos,
  title,
  startAt,
  onClose,
}: Props & { startAt: number; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(startAt)

  // Відкриваємось одразу на потрібному фото, без прокрутки перед очима.
  useEffect(() => {
    const node = track.current
    if (node) node.scrollLeft = startAt * node.clientWidth
  }, [startAt])

  // Поки дивимось фото, сторінка під ним не має їхати.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const step = useCallback((delta: number) => {
    const node = track.current
    if (!node) return
    node.scrollBy({ left: delta * node.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95">
      <header className="flex shrink-0 items-center justify-between px-3 py-2 text-white">
        <span className="font-mono text-[13px] tabular-nums">
          {current + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрити"
          className="h-9 px-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
        >
          Закрити
        </button>
      </header>

      <div
        ref={track}
        onScroll={(event) => {
          const node = event.currentTarget
          setCurrent(Math.round(node.scrollLeft / Math.max(node.clientWidth, 1)))
        }}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {photos.map((photo, index) => (
          // Тап повз фото — закрити; сам знімок клік не пропускає далі.
          <div
            key={photo}
            onClick={onClose}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center"
          >
            {/* Тут навмисно звичайний <img>, а не next/image: із `fill` елемент
                займає весь екран, і «повз фото» натиснути було б нікуди. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`${title} — фото ${index + 1}`}
              loading={index === startAt ? 'eager' : 'lazy'}
              decoding="async"
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ))}
      </div>

      {photos.length > 1 ? (
        <footer className="flex shrink-0 items-center justify-between px-3 py-2">
          <ArrowButton label="Попереднє" disabled={current === 0} onClick={() => step(-1)}>
            ←
          </ArrowButton>
          <ArrowButton
            label="Наступне"
            disabled={current >= photos.length - 1}
            onClick={() => step(1)}
          >
            →
          </ArrowButton>
        </footer>
      ) : null}
    </div>
  )
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'h-11 w-14 rounded-card border border-white/30 font-mono text-[18px] text-white',
        disabled && 'opacity-30',
      )}
    >
      {children}
    </button>
  )
}
