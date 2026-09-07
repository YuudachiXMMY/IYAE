"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Focusable-descendant selector. Mirrors the WAI-ARIA APG dialog pattern's notion
 * of "tabbable" — links, enabled form controls, and anything with a non-negative
 * explicit tabindex. `[tabindex="-1"]` is programmatically focusable but excluded
 * from the Tab cycle, so it is filtered out here.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Traps keyboard focus within `containerRef` while `active` is true (WAI-ARIA APG
 * dialog-modal pattern). On activate: records the currently-focused element, moves
 * focus to the first focusable descendant, and cycles Tab / Shift+Tab within the
 * container. Escape invokes `onEscape`. On deactivate/unmount: removes the listener
 * and restores focus to the element that held it before the trap engaged.
 *
 * SSR-safe (no-op without `document`). Focusable descendants are re-queried on every
 * Tab so controls that mount/unmount mid-session (e.g. AR placement buttons) stay in
 * the cycle. `onEscape` is read through a ref so the trap effect does not re-run — and
 * thus does not bounce focus — when the caller passes a fresh handler each render.
 *
 * Mirrors the SSR-guard convention of `usePrefersReducedMotion` and the cleanup shape
 * of `useGenerationStatus`.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Move focus into the overlay on activate. Fall back to the container itself
    // (it must be focusable, e.g. tabIndex={-1}) when it has no focusable children yet.
    const initial = getFocusable();
    if (initial.length > 0) {
      initial[0].focus();
    } else if (typeof container.focus === "function") {
      container.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        // Nothing tabbable — keep focus inside the container.
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
    // onEscape intentionally omitted — it is read via onEscapeRef so a fresh handler
    // each render does not re-run the trap (which would re-focus and restore focus).
  }, [active, containerRef]);
}
