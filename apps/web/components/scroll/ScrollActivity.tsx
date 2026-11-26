"use client";

import { useEffect } from "react";

/**
 * ScrollActivity — the only JavaScript of the unified scrollbar system
 * (see `app/globals.css` "Scrollbar" section and `docs/scrollbar-audit.md`).
 *
 * Mounts exactly once (root layout). A single capture-phase `scroll` listener
 * on `document` sees every current and future scrolling element — `scroll`
 * does not bubble, but capture reaches every descendant including portals —
 * and toggles the `data-scrolling` attribute directly on the DOM element.
 * The CSS layer reads `[data-scrolling]` to reveal the thumb.
 *
 * Guarantees:
 * - No React state, context, or re-renders; React never renders
 *   `data-scrolling`, so re-renders/hydration can never overwrite it.
 * - No ResizeObserver / MutationObserver, no layout reads, no rAF loops.
 * - No per-event timer churn: a WeakMap of last-scroll times plus one
 *   re-arming timer per active element. Detached elements self-clean via
 *   the WeakMap; the attribute removal on a detached node is a no-op.
 * - Any scroll source counts (wheel, trackpad, touch, keyboard, scrollbar
 *   drag, programmatic): drag emits continuous scroll events, so the bar
 *   stays visible while dragging and hides ~800ms after release.
 *
 * SSR-safe: renders nothing; effects run on the client only.
 */
const HIDE_DELAY = 800; // mirror --scrollbar-hide-delay in app/globals.css

const last = new WeakMap<Element, number>();

function markScrolling(el: Element) {
  if (!el || typeof el.setAttribute !== "function") return;
  const running = last.has(el);
  last.set(el, performance.now());
  if (running) return;
  el.setAttribute("data-scrolling", "");
  const tick = () => {
    const remaining = HIDE_DELAY - (performance.now() - (last.get(el) ?? 0));
    if (remaining > 0) return void setTimeout(tick, remaining);
    last.delete(el);
    el.removeAttribute("data-scrolling");
  };
  setTimeout(tick, HIDE_DELAY);
}

function onScroll(e: Event) {
  const target = e.target;
  if (!target) return;
  if (
    target === document ||
    target === document.documentElement ||
    target === document.body ||
    (typeof window !== "undefined" && target === window)
  ) {
    if (document.documentElement) markScrolling(document.documentElement);
    if (document.body) markScrolling(document.body);
    return;
  }
  if (typeof (target as Element).setAttribute === "function") {
    markScrolling(target as Element);
  }
}

export function ScrollActivity() {
  useEffect(() => {
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);
  return null;
}
