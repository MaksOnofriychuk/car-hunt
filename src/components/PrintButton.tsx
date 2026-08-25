'use client'

/** Друк робить браузер — він же й зберігає в PDF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 rounded-card border border-ink px-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
    >
      Друк / PDF
    </button>
  )
}
