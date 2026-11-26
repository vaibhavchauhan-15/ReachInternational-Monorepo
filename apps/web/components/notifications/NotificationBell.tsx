"use client";

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bell } from "lucide-react";
import { useCurrentUser } from "@/components/auth/CurrentUserContext";
import { useNotification } from "./NotificationContext";
import { capNotificationCount } from "@reachinternational/utils";
import { NotificationPanel } from "./NotificationPanel";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/utils";

export interface NotificationBellProps {
  className?: string;
  initialUnreadCount?: number;
  placement?: "header" | "sidebar";
}

export function NotificationBell({
  className = "",
  placement,
}: NotificationBellProps) {
  const { role } = useCurrentUser();
  const {
    unreadCount,
    setUnreadCount,
    realtimeNewItems,
    consumeRealtimeItems,
  } = useNotification();

  const [isOpen, setIsOpen] = useState(false);

  // Desktop vs Mobile/Tablet detection via useSyncExternalStore to avoid hydration mismatch and setState in effect
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const isDesktop = useSyncExternalStore(
    (callback) => {
      window.addEventListener("resize", callback);
      return () => window.removeEventListener("resize", callback);
    },
    () => window.innerWidth >= 1024,
    () => false
  );

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Dynamic Popover Coordinates for Desktop (adaptive to sidebar or header placement)
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left?: number;
    right?: number;
  }>({
    top: 64,
    left: 292,
  });

  // Update popover coordinates when opening on desktop
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 420;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Detect if button is on the left half of screen (sidebar) vs right half (header)
    const isLeftSide = placement === "sidebar" || rect.left < viewportWidth / 2;

    if (isLeftSide) {
      // Sidebar placement: anchor to the left, opening cleanly beside the sidebar
      const leftOffset = Math.max(
        16,
        Math.min(rect.right + 12, viewportWidth - popoverWidth - 16)
      );
      const topOffset = Math.max(
        16,
        Math.min(rect.top, viewportHeight - 560)
      );
      setPopoverPos({ top: topOffset, left: leftOffset, right: undefined });
    } else {
      // Header placement: anchor from the right edge
      const rightOffset = Math.max(16, viewportWidth - rect.right);
      const topOffset = rect.bottom + 8;
      setPopoverPos({ top: topOffset, right: rightOffset, left: undefined });
    }
  }, [placement]);

  useEffect(() => {
    if (isOpen && isDesktop) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen, isDesktop, updatePosition]);

  // Click outside listener for desktop popover
  useEffect(() => {
    if (!isOpen || !isDesktop) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, isDesktop]);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const badgeText = capNotificationCount(unreadCount);
  const accessibleLabel = `Notifications, ${
    unreadCount > 0 ? `${unreadCount} unread` : "no unread"
  }`;

  return (
    <>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label={accessibleLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={accessibleLabel}
        className={cn(
          "relative flex items-center justify-center h-8.5 w-8.5 rounded-lg transition-all cursor-pointer shrink-0 select-none",
          isOpen
            ? "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)]"
            : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]",
          "active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-500/30",
          className
        )}
      >
        <Bell className="h-4.5 w-4.5" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-sky-500 text-[10px] font-bold text-white font-mono shadow-xs ring-2 ring-[var(--color-canvas)] leading-none select-none pointer-events-none"
          >
            {badgeText}
          </span>
        )}

        {/* Screen Reader Live Count Announcement */}
        <span className="sr-only" aria-live="polite">
          {accessibleLabel}
        </span>
      </button>

      {/* Render Panel: Desktop Popover vs Mobile/Tablet Drawer */}
      {mounted &&
        (isDesktop ? (
          // Desktop Floating Popover
          createPortal(
            <AnimatePresence>
              {isOpen && (
                <div
                  ref={popoverRef}
                  style={{
                    position: "fixed",
                    top: popoverPos.top,
                    left: popoverPos.left,
                    right: popoverPos.right,
                    width: 420,
                    maxWidth: "calc(100vw - 32px)",
                    zIndex: 60,
                  }}
                >
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.96, y: -8 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.96, y: -8 }
                    }
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] shadow-2xl overflow-hidden"
                  >
                    <NotificationPanel
                      isOpen={isOpen}
                      onClose={() => setIsOpen(false)}
                      userRole={role || undefined}
                      unreadCount={unreadCount}
                      onUnreadCountChange={setUnreadCount}
                      realtimeNewItems={realtimeNewItems}
                      onConsumeRealtimeItems={consumeRealtimeItems}
                    />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body
          )
        ) : (
          // Mobile & Tablet Slide-over Drawer
          <Drawer
            open={isOpen}
            onClose={() => setIsOpen(false)}
            position="right"
            size="md"
            className="p-0 sm:max-w-md"
          >
            <div className="h-full w-full flex flex-col bg-[var(--color-canvas)]">
              <NotificationPanel
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                userRole={role || undefined}
                unreadCount={unreadCount}
                onUnreadCountChange={setUnreadCount}
                realtimeNewItems={realtimeNewItems}
                onConsumeRealtimeItems={consumeRealtimeItems}
              />
            </div>
          </Drawer>
        ))}
    </>
  );
}
