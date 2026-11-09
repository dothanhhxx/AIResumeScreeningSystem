import { useLayoutEffect, useRef, type RefObject } from "react";

function motionReduced(): boolean {
  if (document.documentElement.dataset.motion === "reduce") return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * FLIP animation for a reordering list: children marked with `data-flip-key`
 * slide from their previous position to the new one instead of jumping.
 * `order` should change whenever the visual order may have changed.
 */
export function useFlip(
  container: RefObject<HTMLElement | null>,
  order: string,
): void {
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>("[data-flip-key]"),
    );
    const previous = positions.current;
    const next = new Map<string, number>();
    // Older browsers (and jsdom) lack the Web Animations API: just reorder.
    const reduced = motionReduced() || typeof root.animate !== "function";

    for (const item of items) {
      const key = item.dataset.flipKey!;
      const top = item.getBoundingClientRect().top;
      next.set(key, top);
      const before = previous.get(key);
      if (reduced || before === undefined || Math.abs(before - top) < 1)
        continue;
      item.animate(
        [
          { transform: `translateY(${before - top}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    }
    positions.current = next;
  }, [container, order]);
}
