"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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
} from "lucide-react";
import {
  getNavForRole,
  labelFor,
} from "@reachinternational/permissions";
import type { UserRole } from "@reachinternational/types";

// Icon string key → Lucide component
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  home: Home,
  gauge: Gauge,
  wrench: Wrench,
  building: Building2,
  users: Users,
  shield: Shield,
  menu: Menu,
  user: User,
  banknote: Banknote,
  "calendar-check": CalendarCheck,
};

// CSS selector for focusable text fields (hide bar when keyboard is open)
const TEXT_FIELD =
  "input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=hidden]), textarea, select";

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { primary, more, hasMore } = getNavForRole(role);

  // Build tab list: primary items + More/Account as last slot
  const tabs = [
    ...primary.map((i) => ({
      key: i.key,
      label: labelFor(i, role),
      href: i.href,
      icon: i.icon,
      match: i.match,
    })),
    {
      key: "more" as const,
      label: hasMore ? "More" : "Account",
      href: "/more",
      icon: hasMore ? "menu" : "user",
      match: [
        "/more",
        "/profile",
        "/settings",
        "/privacy",
        "/terms",
        "/delete-account",
        "/account-deletion-guide",
        "/account-deletion",
        ...more.flatMap((i) => i.match),
      ],
    },
  ];

  // Hide bar while a text field is focused (keyboard collision fix)
  useEffect(() => {
    const el = document.documentElement;
    const handler = (e: FocusEvent) => {
      const isFocusIn = e.type === "focusin";
      const isTextField =
        isFocusIn && (e.target as HTMLElement)?.matches?.(TEXT_FIELD);
      el.toggleAttribute("data-nav-hidden", !!isTextField);
    };
    document.addEventListener("focusin", handler);
    document.addEventListener("focusout", handler);
    return () => {
      document.removeEventListener("focusin", handler);
      document.removeEventListener("focusout", handler);
      el.removeAttribute("data-nav-hidden");
    };
  }, []);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden print:hidden border-t border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]/95 backdrop-blur-xl shadow-[0_-1px_3px_rgba(0,0,0,0.06)] transition-transform"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <ul
        className="flex items-center justify-between h-14 max-w-md mx-auto px-1 sm:px-4"
        role="tablist"
      >
        {tabs.map((t) => {
          const active = t.match.some((p) => pathname.startsWith(p));
          const Icon = ICONS[t.icon] || Menu;

          return (
            <li key={t.key} role="presentation" className="flex-1 min-w-0 h-full flex items-center justify-center">
              <Link
                href={t.href}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                aria-label={t.label}
                className={`group group/nav interactive-parent relative flex flex-col items-center justify-center w-full h-full min-h-[44px] px-0.5 py-1 rounded-md transition-all duration-150 active:scale-95 ${
                  active
                    ? "text-[var(--color-ink)] font-semibold"
                    : "text-[var(--color-mute)] font-medium hover:text-[var(--color-ink)]"
                }`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors duration-150 ${
                    active
                      ? "text-[var(--color-ink)]"
                      : "text-[var(--color-mute)] group-hover:text-[var(--color-ink)]"
                  }`}
                  aria-hidden
                />
                <span className="truncate max-w-full text-center leading-none mt-1 text-[10px] sm:text-[11px] tracking-tight">
                  {t.label}
                </span>
                {/* Active dot indicator (in-flow below label, never overlaps text) */}
                <span
                  className={`h-1 w-1 rounded-full mt-1 transition-all duration-150 ${
                    active ? "bg-[var(--color-ink)] opacity-100" : "opacity-0"
                  }`}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
