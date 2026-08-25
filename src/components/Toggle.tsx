import { cn } from '@/lib/cn'

/**
 * Перемикач-тумблер із макета налаштувань (аркуш 07): доріжка й кружок,
 * увімкнений — акцентний. Це звичайний `checkbox`, тому працює і в формі, і з
 * клавіатури, і зі скрін-рідером; видимість дає тільки оформлення поруч.
 */
export function Toggle({
  name,
  defaultChecked,
  label,
  className,
}: {
  name: string
  defaultChecked?: boolean
  /** Підпис для скрін-рідера, коли поруч уже є видимий текст рядка. */
  label: string
  className?: string
}) {
  return (
    <label className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center', className)}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        aria-label={label}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full border border-edge bg-sunken transition-colors duration-(--t-fast) peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-lit" />
      <span className="pointer-events-none absolute left-[3px] h-4 w-4 rounded-full bg-faint transition-transform duration-(--t-fast) peer-checked:translate-x-5 peer-checked:bg-white" />
    </label>
  )
}
