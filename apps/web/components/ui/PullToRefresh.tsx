"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowDown, RefreshCw, Check } from "lucide-react";
import { refreshPageDataAction } from "@/app/actions/refresh";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { isPullToRefreshEnabledForRoute } from "@/lib/flags";

const REFRESH_THRESHOLD = 75; // Deliberate pull distance in px required to trigger refresh (AC-03)
const MAX_PULL_DISTANCE = 115; // Max visual displacement ceiling
const REFRESH_HOLD_DISTANCE = 52; // Holding distance during refresh spinner
const ACTIVATION_THRESHOLD = 12; // Deadzone in px before activating visual pull state (AC-01)
const HORIZONTAL_ANGLE_RATIO = 0.8; // Spec Section 2: Abort if |Δx| > 0.8 * |Δy|

interface PullToRefreshContextType {
  isRefreshing: boolean;
  registerRefreshHandler: (handler: () => Promise<void> | void) => () => void;
  triggerManualRefresh: () => Promise<void>;
}

const PullToRefreshContext = createContext<PullToRefreshContextType | null>(null);

export function usePullToRefresh(customHandler?: () => Promise<void> | void) {
  const context = useContext(PullToRefreshContext);

  useEffect(() => {
    if (!context || !customHandler) return;
    const unregister = context.registerRefreshHandler(customHandler);
    return unregister;
  }, [context, customHandler]);

  return context;
}

export interface PullToRefreshProps {
  children?: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

export function PullToRefresh({
  children,
  threshold = REFRESH_THRESHOLD,
  disabled = false,
}: PullToRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Viewport & capability detection: only activate on touch devices in mobile (<=640px) or tablet (641-1023px)
  const isTouchOrMobile = useMediaQuery(
    "(max-width: 1023px) and ((pointer: coarse) or (hover: none))"
  );
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Check centralized feature flag and route exclusion kill-switch
  const isFeatureEnabled =
    isPullToRefreshEnabledForRoute(pathname) &&
    process.env.NEXT_PUBLIC_DISABLE_PULL_TO_REFRESH !== "true";
  const isEffectivelyDisabled = disabled || !isFeatureEnabled || !isTouchOrMobile;

  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const customHandlersRef = useRef<Set<() => Promise<void> | void>>(new Set());
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isTouchActive = useRef(false);
  const canPullRef = useRef(false); // STRICT GUARD: Must be at scroll top at the EXACT moment touch starts (AC-04)
  const hasVibratedThreshold = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Lifecycle guard for unmount teardown (AC-07)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const registerRefreshHandler = useCallback((handler: () => Promise<void> | void) => {
    customHandlersRef.current.add(handler);
    return () => {
      customHandlersRef.current.delete(handler);
    };
  }, []);

  // Strict check if page and all scrollable ancestors are at top (AC-04)
  const isStrictlyAtScrollTop = useCallback((target: EventTarget | null, primaryContainer: HTMLElement | Window | null): boolean => {
    if (typeof window === "undefined") return false;

    // 1. Window & document scroll check (must be <= 0.5px)
    const windowScrollTop =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    if (windowScrollTop > 0.5) return false;

    // 2. Primary container scroll check if it is a specific scrollable element
    if (primaryContainer && primaryContainer !== window && (primaryContainer as HTMLElement).scrollTop > 0.5) {
      return false;
    }

    // 3. Check if touch is inside excluded interactive or horizontal/nested elements
    if (target && target instanceof HTMLElement) {
      const isExcluded = target.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="option"], [data-portal-dropdown], [data-portal-select], [data-portal-menu], [data-prevent-pull-to-refresh], .overflow-x-auto, [data-horizontal-scroll]'
      );
      if (isExcluded) return false;

      // 4. Check all scrollable ancestor containers between target and primaryContainer
      let currentEl: HTMLElement | null = target;
      while (currentEl && currentEl !== document.body && currentEl !== document.documentElement) {
        const style = window.getComputedStyle(currentEl);
        const overflowY = style.overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          currentEl.scrollHeight > currentEl.clientHeight &&
          currentEl.scrollTop > 0.5
        ) {
          return false;
        }
        if (currentEl === primaryContainer) break;
        currentEl = currentEl.parentElement;
      }
    }

    return true;
  }, []);

  const executeRefresh = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (!isMountedRef.current) return;
    setIsRefreshing(true);
    setIsPulling(false);
    setPullDistance(REFRESH_HOLD_DISTANCE);

    // Network timeout guard: abort and smoothly reset UI if request stalls > 9s
    const timeoutTimer = setTimeout(() => {
      if (!abortController.signal.aborted) {
        console.warn("[PullToRefresh] Network timeout guard triggered after 9s.");
        abortController.abort();
      }
    }, 9000);

    // Haptic feedback for refresh trigger
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore haptic errors
      }
    }

    const startTime = Date.now();

    try {
      // 1. Execute any registered custom page handlers (e.g. OperationsLogsTab subTabCache purge)
      const customPromises = Array.from(customHandlersRef.current).map(async (handler) => {
        if (abortController.signal.aborted) return;
        try {
          await handler();
        } catch (err) {
          console.error("[PullToRefresh] Custom handler error:", err);
        }
      });

      // 2. Execute Server Action cache tag purge & Next.js revalidation
      const serverRevalidatePromise = refreshPageDataAction(pathname || undefined).catch((err) => {
        console.error("[PullToRefresh] Server revalidation error:", err);
      });

      // 3. Dispatch global window event for any independent active tab/component listeners
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("reach:pull-to-refresh", {
            detail: { pathname, timestamp: Date.now() },
          })
        );
      }

      await Promise.all([...customPromises, serverRevalidatePromise]);

      if (abortController.signal.aborted || !isMountedRef.current) return;

      // 4. Trigger RSC page update
      startTransition(() => {
        router.refresh();
      });

      // Ensure minimum visual duration (600ms) for smooth UX
      const elapsed = Date.now() - startTime;
      if (elapsed < 600) {
        await new Promise((r) => setTimeout(r, 600 - elapsed));
      }

      if (abortController.signal.aborted || !isMountedRef.current) return;

      // 5. Show brief success completion checkmark
      setIsCompleted(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(8);
        } catch {
          // Ignore
        }
      }

      await new Promise((r) => setTimeout(r, 350));
    } catch (error) {
      console.error("[PullToRefresh] Error executing refresh:", error);
    } finally {
      clearTimeout(timeoutTimer);
      if (isMountedRef.current) {
        // Retract indicator back up smoothly (AC-02)
        setPullDistance(0);
        setIsRefreshing(false);
        setIsCompleted(false);
        canPullRef.current = false;
        hasVibratedThreshold.current = false;
      }
    }
  }, [pathname, router]);

  const triggerManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    await executeRefresh();
  }, [isRefreshing, executeRefresh]);

  // Scoped Event Attachment to Primary Scroll Container (data-primary-scroll or window)
  useEffect(() => {
    if (isEffectivelyDisabled || typeof window === "undefined") return;

    // Resolve primary scroll target: look for [data-primary-scroll="true"] inside or fall back to window
    const primaryScrollEl: HTMLElement | Window =
      containerRef.current?.querySelector<HTMLElement>('[data-primary-scroll="true"]') ||
      document.querySelector<HTMLElement>('[data-primary-scroll="true"]') ||
      window;

    if (!primaryScrollEl) return;

    let targetElement: EventTarget | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isRefreshing) {
        canPullRef.current = false;
        return;
      }

      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      targetElement = e.target;
      isTouchActive.current = true;
      hasVibratedThreshold.current = false;

      // ACCIDENTAL REFRESH PREVENTION:
      // The touch MUST strictly begin while scroll is at the top (AC-04).
      // If the user touched the screen while scrolled down (even slightly),
      // this touch gesture is permanently disqualified from pulling to refresh.
      canPullRef.current = isStrictlyAtScrollTop(targetElement, primaryScrollEl);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchActive.current || !canPullRef.current || isRefreshing || e.touches.length !== 1) {
        return;
      }

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const deltaX = touch.clientX - touchStartX.current;

      // Upwards drag cancels pull-to-refresh
      if (deltaY < 0) {
        canPullRef.current = false;
        if (isPulling) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }

      // HORIZONTAL ANGLE FILTER (AC-05):
      // Reject gestures outside 60° vertical cone (|deltaX| > |deltaY| * 0.6)
      // Prevents interference with horizontal carousels, tabs, or swipeable cards
      if (Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_ANGLE_RATIO) {
        canPullRef.current = false;
        if (isPulling) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }

      // Verify that page is still strictly at scroll top
      if (!isStrictlyAtScrollTop(targetElement, primaryScrollEl)) {
        canPullRef.current = false;
        if (isPulling) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }

      // DEADZONE GUARD (AC-01): Only activate after user pulls past ACTIVATION_THRESHOLD (12px)
      if (deltaY > ACTIVATION_THRESHOLD) {
        const effectiveDelta = deltaY - ACTIVATION_THRESHOLD;
        // Dampened logarithmic resistance curve
        const dampened = Math.min(MAX_PULL_DISTANCE, Math.pow(effectiveDelta, 0.8) * 1.5);

        if (dampened > 2) {
          // Suppress browser native overscroll navigation without freezing standard scrolling
          if (e.cancelable && dampened > 6) {
            e.preventDefault();
          }

          setIsPulling(true);
          setPullDistance(dampened);

          const thresholdReached = dampened >= threshold;
          if (thresholdReached && !hasVibratedThreshold.current) {
            hasVibratedThreshold.current = true;
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              try {
                navigator.vibrate(12);
              } catch {
                // Ignore
              }
            }
          } else if (!thresholdReached && hasVibratedThreshold.current) {
            hasVibratedThreshold.current = false;
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isTouchActive.current || isRefreshing) return;
      isTouchActive.current = false;

      // THRESHOLD RELEASE EVALUATION (AC-02 vs AC-03)
      if (canPullRef.current && pullDistance >= threshold) {
        executeRefresh();
      } else {
        // Smoothly spring back to top in <= 280ms
        setIsPulling(false);
        setPullDistance(0);
        hasVibratedThreshold.current = false;
      }
      canPullRef.current = false;
    };

    const handleTouchCancel = () => {
      isTouchActive.current = false;
      canPullRef.current = false;
      if (!isRefreshing) {
        setIsPulling(false);
        setPullDistance(0);
        hasVibratedThreshold.current = false;
      }
    };

    // Scoped touch event listeners attached strictly to the primary scroll container (data-primary-scroll or window)
    const target = primaryScrollEl as EventTarget;
    target.addEventListener("touchstart", handleTouchStart as EventListener, { passive: true });
    target.addEventListener("touchmove", handleTouchMove as EventListener, { passive: false });
    target.addEventListener("touchend", handleTouchEnd as EventListener, { passive: true });
    target.addEventListener("touchcancel", handleTouchCancel as EventListener, { passive: true });

    return () => {
      target.removeEventListener("touchstart", handleTouchStart as EventListener);
      target.removeEventListener("touchmove", handleTouchMove as EventListener);
      target.removeEventListener("touchend", handleTouchEnd as EventListener);
      target.removeEventListener("touchcancel", handleTouchCancel as EventListener);
    };
  }, [
    isEffectivelyDisabled,
    isRefreshing,
    pullDistance,
    threshold,
    isPulling,
    isStrictlyAtScrollTop,
    executeRefresh,
  ]);

  const progress = Math.min(1, pullDistance / threshold);
  const isThresholdReached = pullDistance >= threshold;

  // SVG Circular progress math (radius: 7, circumference: ~43.98)
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <PullToRefreshContext.Provider
      value={{
        isRefreshing,
        registerRefreshHandler,
        triggerManualRefresh,
      }}
    >
      <div ref={containerRef} className="contents">
        {/* Floating Refresh Indicator (AC-06: 60 FPS GPU-accelerated translateY) */}
        <div
          aria-live="polite"
          aria-label={
            isCompleted
              ? "Data updated"
              : isRefreshing
              ? "Refreshing page data"
              : isThresholdReached
              ? "Release to refresh"
              : "Pull down to refresh"
          }
          className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none flex justify-center items-start px-4"
          style={{
            transform: prefersReducedMotion
              ? (isRefreshing || isCompleted ? "translate3d(0, 14px, 0)" : "translate3d(0, -58px, 0)")
              : `translate3d(0, ${
                  isRefreshing || isCompleted
                    ? 14
                    : isPulling
                    ? Math.max(0, pullDistance - 42)
                    : -58
                }px, 0)`,
            transition: prefersReducedMotion
              ? "opacity 0.15s ease"
              : isPulling
              ? "none"
              : "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
            opacity: isPulling || isRefreshing || isCompleted ? 1 : 0,
            willChange: "transform, opacity",
          }}
        >
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[var(--color-canvas-elevated)]/95 dark:bg-[var(--color-canvas-elevated)]/95 border border-[var(--color-hairline)] shadow-[0_4px_16px_-2px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-md text-[var(--color-ink)]">
            {/* Animated Indicator Icon */}
            <div className="relative w-4.5 h-4.5 flex items-center justify-center">
              {isCompleted ? (
                <Check
                  className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in-75 duration-200"
                  strokeWidth={2.5}
                />
              ) : isRefreshing ? (
                <RefreshCw
                  className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 animate-spin"
                  strokeWidth={2.5}
                />
              ) : (
                <>
                  {/* Background Ring */}
                  <svg className="w-4.5 h-4.5 -rotate-90" viewBox="0 0 18 18">
                    <circle
                      cx="9"
                      cy="9"
                      r={radius}
                      className="stroke-[var(--color-hairline-soft)] dark:stroke-neutral-800"
                      strokeWidth="2"
                      fill="none"
                    />
                    {/* Active Progress Ring */}
                    <circle
                      cx="9"
                      cy="9"
                      r={radius}
                      className="stroke-sky-500 dark:stroke-sky-400 transition-[stroke-dashoffset] duration-75"
                      strokeWidth="2"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  {/* Downward Arrow rotating smoothly 180° upon reaching release threshold */}
                  <ArrowDown
                    className="absolute w-2.5 h-2.5 text-[var(--color-ink)] transition-transform duration-200"
                    strokeWidth={2.5}
                    style={{
                      transform: `rotate(${isThresholdReached ? 180 : 0}deg)`,
                    }}
                  />
                </>
              )}
            </div>

            {/* Clean Typography Status Text */}
            <span className="text-[12px] font-medium tracking-tight whitespace-nowrap">
              {isCompleted ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Updated
                </span>
              ) : isRefreshing ? (
                <span className="text-[var(--color-ink)]">Refreshing...</span>
              ) : isThresholdReached ? (
                <span className="text-sky-600 dark:text-sky-400 font-semibold">
                  Release to refresh
                </span>
              ) : (
                <span className="text-[var(--color-mute)]">Pull to refresh</span>
              )}
            </span>
          </div>
        </div>

        {children}
      </div>
    </PullToRefreshContext.Provider>
  );
}
