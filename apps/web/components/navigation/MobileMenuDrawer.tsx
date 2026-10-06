"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Gauge,
  Wrench,
  Building2,
  Users,
  Shield,
  Menu,
  User,
  Banknote,
  CalendarCheck,
  Activity,
  X,
  ChevronRight,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  home: Home,
  gauge: Gauge,
  wrench: Wrench,
  building: Building2,
  users: Users,
  shield: Shield,
  menu: Menu,
  user: User,
  settings: Settings,
  banknote: Banknote,
  "calendar-check": CalendarCheck,
  activity: Activity,
};

type Props = {
  items: { key: string; label: string; href: string; icon: string; match?: string[] }[];
  user: { name: string; email: string; initials: string };
  onClosed: () => void;
  onLogout: () => void;
};

export default function MobileMenuDrawer({ items, user, onClosed, onLogout }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const close = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    // Wait for animation to finish
    setTimeout(() => {
      dialogRef.current?.close();
      onClosed();
    }, 280); // matches the 280ms animation
  }, [onClosed]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      close();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [close]);

  // Close on route change (but not on mount)
  const initialPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== initialPath.current) close();
  }, [pathname, close]);

  const handleScrimClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      close();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    
    // Direction locked: must be mostly horizontal swipe, swipe right, at least 50px
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 50) {
      close();
    }
    
    touchStartRef.current = null;
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleScrimClick}
      className={cn(
        "fixed inset-0 m-0 max-w-none max-h-none h-dvh w-full p-0 bg-transparent backdrop:bg-black/0 open:backdrop:bg-black/45 open:backdrop:transition-all backdrop:duration-280 z-[100]",
        isClosing && "backdrop:!bg-black/0"
      )}
    >
      <div
        className={cn(
          "absolute right-0 top-0 h-dvh w-[min(86vw,320px)] bg-[var(--color-canvas-elevated)] flex flex-col shadow-2xl transition-transform duration-280 motion-reduce:transition-none ease-[cubic-bezier(.32,.72,0,1)] translate-x-[100%]",
          !isClosing && "translate-x-0"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-hairline)] shrink-0">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Menu</h2>
          <button
            onClick={close}
            className="p-2 -mr-2 rounded-full hover:bg-[var(--color-hairline)] transition-colors active:scale-95"
            aria-label="Close menu"
          >
            <X size={24} className="text-[var(--color-ink)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {items.map((item) => {
            const Icon = ICONS[item.icon] || Menu;
            const isActive = item.match
              ? item.match.some((p) => pathname.startsWith(p))
              : pathname === item.href;

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 p-4 min-h-[56px] rounded-xl border transition-all active:scale-[0.98]",
                  isActive
                    ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-100"
                    : "bg-white dark:bg-neutral-900/40 border-[var(--color-hairline)] hover:border-gray-300 dark:hover:border-neutral-700 text-[var(--color-ink)]"
                )}
              >
                <Icon size={20} className={cn(isActive ? "text-blue-600" : "text-[var(--color-mute)]")} />
                <span className="flex-1 font-medium">{item.label}</span>
                <ChevronRight size={16} className="text-[var(--color-mute)]" />
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-[var(--color-hairline)] shrink-0 flex items-center gap-3">
          <Link
            href="/profile"
            className="flex-1 flex items-center gap-3 p-2 -ml-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors active:scale-95 min-w-0"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-semibold text-sm shrink-0">
              {user.initials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-[var(--color-ink)] truncate">
                {user.name}
              </span>
              <span className="text-xs text-[var(--color-mute)] truncate">
                {user.email}
              </span>
            </div>
          </Link>
          <button
            onClick={() => {
              close();
              // Small delay to ensure drawer starts closing before dialog pops up over it
              setTimeout(() => {
                onLogout();
              }, 50);
            }}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors active:scale-95 shrink-0"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
