"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { removeListing, toggleArchived } from "@/app/(app)/listing/actions";
import { cn } from "@/lib/cn";
import { IDLE } from "@/lib/forms";

/**
 * «···» на картці. Прибрати авто з черги або видалити його зовсім — не
 * відкриваючи саму картку: у черзі на сотню авто перехід туди-назад заради
 * одного тапу коштує дорожче за саму дію.
 *
 * Панель малюється **порталом у body** і позиціюється фіксовано. Інакше вона
 * ховається за наступною карткою: у кожної `.surface` власний контекст
 * накладання (`isolation: isolate` заради світної волосіні), і будь-який
 * z-index усередині картки лишається всередині неї.
 *
 * Напрямок вибирається за місцем на екрані: якщо внизу не влазить — панель
 * розкривається вгору. Для картки в кінці списку це єдиний спосіб побачити її
 * цілком, не прокручуючи наосліп.
 *
 * Видалення питає підтвердження і робиться другим тапом: воно стирає картку,
 * архів сторінки, історію цін і всю стрічку — на відміну від архіву, звідки
 * все повертається.
 */

const PANEL_WIDTH = 248;
/** Відступ від краю екрана, щоб панель не лягала впритул. */
const EDGE = 12;
/** Проміжок між кнопкою і панеллю. */
const GAP = 6;

export function CardMenu({
  listingId,
  archived,
  title,
  className,
}: {
  listingId: string;
  archived: boolean;
  /** Назва — щоб у підтвердженні було видно, що саме зникне. */
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [spot, setSpot] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const [archiveState, archiveAction, archivePending] = useActionState(
    toggleArchived,
    IDLE,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    removeListing,
    IDLE,
  );

  // Позицію рахуємо перед першим малюванням — інакше панель встигає блимнути
  // не там, де треба. Висоту беремо з уже намальованої панелі: у підтвердження
  // вона інша, ніж у звичайного меню, і напрямок від цього залежить.
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;

      const height = panel.current?.offsetHeight ?? 0;
      const room = window.innerHeight - EDGE * 2;
      const left = Math.min(
        Math.max(rect.right - PANEL_WIDTH, EDGE),
        window.innerWidth - PANEL_WIDTH - EDGE,
      );

      const below = rect.bottom + GAP;
      const above = rect.top - GAP - height;
      // Вниз — якщо влазить; інакше вгору; якщо не влазить і так — притискаємо
      // до верху і даємо панелі прокрутитись.
      const top =
        below + height <= window.innerHeight - EDGE
          ? below
          : above >= EDGE
            ? above
            : EDGE;

      setSpot({ top, left, maxHeight: room });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, confirming]);

  // Тап повз панель і Escape закривають її — як будь-яке випадне меню.
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || button.current?.contains(target))
        return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Спрацювало — панель закривається сама: картка вже поїхала зі списку.
  useEffect(() => {
    if (archiveState.ok || deleteState.ok) setOpen(false);
  }, [archiveState.ok, deleteState.ok]);

  const menu = open ? (
    <div
      ref={panel}
      style={{
        top: spot?.top ?? 0,
        left: spot?.left ?? 0,
        width: PANEL_WIDTH,
        maxHeight: spot?.maxHeight,
        // Поки місце не порахували, панель уже в DOM (інакше нічого міряти),
        // але її ще не видно.
        visibility: spot ? "visible" : "hidden",
      }}
      className="panel-in surface fixed z-50 overflow-y-auto p-2"
    >
      <form action={archiveAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <input
          type="hidden"
          name="archived"
          value={archived ? "false" : "true"}
        />
        <button
          type="submit"
          disabled={archivePending}
          className="btn btn-quiet tap w-full"
        >
          {archived ? "Повернути в чергу" : "Прибрати з черги"}
        </button>
      </form>

      {confirming ? (
        <form action={deleteAction} className="mt-2">
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="confirm" value="yes" />
          <p className="t-body sunken rib border-l-danger px-2.5 py-2 text-muted">
            Видалити «{title}» назавжди? Зникнуть картка, збережена сторінка,
            історія цін і всі записи розмов. Повернути не вийде.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={deletePending}
              className="btn btn-danger tap flex-1"
            >
              {deletePending ? "Видаляю…" : "Так, видалити"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn btn-quiet tap px-3"
            >
              Ні
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn btn-quiet tap mt-2 w-full text-danger"
        >
          Видалити назавжди
        </button>
      )}

      {archiveState.error || deleteState.error ? (
        <p className="t-body mt-2 text-danger">
          {archiveState.error ?? deleteState.error}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setConfirming(false);
        }}
        aria-expanded={open}
        aria-label="Ще дії"
        className={cn(
          "btn btn-quiet tap w-11 shrink-0",
          open && "border-ink",
          className,
        )}
      >
        ···
      </button>

      {menu && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </>
  );
}
