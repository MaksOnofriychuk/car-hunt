'use client'

/** Друк робить браузер — він же й зберігає в PDF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn tap px-3"
    >
      Друк / PDF
    </button>
  )
}
