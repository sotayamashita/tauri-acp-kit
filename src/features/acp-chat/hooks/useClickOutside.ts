import { useEffect, useCallback } from "react";

/**
 * Call `onClickOutside` when a mousedown event occurs outside the given ref element.
 * The listener is only active when `active` is true.
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClickOutside: () => void,
  active = true,
): void {
  const handler = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    },
    [ref, onClickOutside],
  );

  useEffect(() => {
    if (!active) return;
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, handler]);
}
