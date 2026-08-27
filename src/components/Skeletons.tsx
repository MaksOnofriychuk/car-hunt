/**
 * Скелетони маршрутів — те, що видно, поки сервер збирає сторінку.
 *
 * Це не «крутилка посеред екрана»: форма майбутнього вмісту вже стоїть на
 * місці, тому готова сторінка не смикає верстку, а очікування читається як
 * робота, а не як зависання. Клас `.skeleton` — той самий, що й для картки,
 * яка ще парситься; окремої мови для завантаження застосунок не заводить.
 */

function Bar({ className }: { className: string }) {
  return <span className={`skeleton block ${className}`} />
}

/** Рядок черги: фото, назва, два рядки дрібниць, ціна праворуч. */
export function CardSkeleton() {
  return (
    <div className="surface flex gap-3 p-3">
      <Bar className="h-[72px] w-[96px] shrink-0" />
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <Bar className="h-4 w-3/5" />
        <Bar className="h-3 w-4/5" />
        <Bar className="h-3 w-2/5" />
      </div>
      <Bar className="h-5 w-16 shrink-0" />
    </div>
  )
}

export function QueueSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[560px] space-y-3">
        <div className="flex items-baseline gap-2 px-1">
          <Bar className="h-6 w-24" />
          <Bar className="h-3 w-12" />
        </div>

        <Bar className="h-11 w-full" />

        <div className="flex gap-2">
          <Bar className="h-8 w-28" />
          <Bar className="h-8 w-24" />
          <Bar className="h-8 w-20" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: rows }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ListingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[560px] space-y-3">
      <Bar className="aspect-[4/3] w-full" />
      <Bar className="h-6 w-4/5" />
      <Bar className="h-4 w-2/5" />

      <div className="surface space-y-2 p-3">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-5/6" />
        <Bar className="h-3 w-3/4" />
      </div>

      <div className="flex gap-2">
        <Bar className="h-10 flex-1" />
        <Bar className="h-10 flex-1" />
        <Bar className="h-10 flex-1" />
      </div>
    </div>
  )
}

export function SellersSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-[560px] space-y-3">
      <Bar className="h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="surface flex items-center gap-3 p-3">
            <Bar className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bar className="h-4 w-2/5" />
              <Bar className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
