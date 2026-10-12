"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Home,
  Gauge,
  Wrench,
  Building2,
  Users,
  Shield,
  Menu,
  User,
  Settings,
  Banknote,
  CalendarCheck,
  Activity,
} from "lucide-react";
import {
  getNavForRole,
  labelFor,
} from "@reachinternational/permissions";
import type { UserRole } from "@reachinternational/types";
import { logout } from "@/app/actions/auth";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { isRedirectError } from "@/lib/utils";

const MobileMenuDrawer = dynamic(() => import("./MobileMenuDrawer"));

// Icon string key +' Lucide component
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

// CSS selector for focusable text fields (hide bar when keyboard is open)
const TEXT_FIELD =
  "input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=hidden]), textarea, select";

export function BottomNav({ role, user }: { role: UserRole; user?: { full_name?: string; email?: string } }) {
  const pathname = usePathname();
  const { primary, more, hasMore } = getNavForRole(role);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      label: hasMore ? "Menu" : "Account",
      href: hasMore ? "#" : "/profile",
      icon: hasMore ? "menu" : "user",
      match: hasMore
        ? more.flatMap((i) => i.match)
        : ["/profile"],
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
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 md:hidden print:hidden rounded-t-2xl border-t border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-none transition-transform"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <ul
          className="flex items-center justify-between h-14 max-w-md mx-auto px-1 sm:px-4"
          role="tablist"
        >
          {tabs.map((t) => {
            const isMenuTab = t.key === "more" && hasMore;
            const active = t.match.some((p) => pathname.startsWith(p)) || (isMenuTab && drawerOpen);
            const Icon = ICONS[t.icon] || Menu;

            const content = (
              <>
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors duration-150 ${
                    active
                      ? "text-[#0284c7] dark:text-[#0ea5e9]"
                      : "text-[var(--color-mute)] group-hover:text-[var(--color-ink)]"
                  }`}
                  aria-hidden
                />
                <span className={`truncate max-w-full text-center leading-none mt-1 text-[10px] sm:text-[11px] tracking-tight ${
                  active ? "text-[#0284c7] dark:text-[#0ea5e9] font-medium" : "text-[var(--color-mute)]"
                }`}>
                  {t.label}
                </span>
                {/* Active dot indicator (in-flow below label, never overlaps text) */}
                <span
                  className={`h-1 w-1 rounded-full mt-1 transition-all duration-150 ${
                    active ? "bg-[#0284c7] dark:bg-[#0ea5e9] opacity-100" : "opacity-0"
                  }`}
                  aria-hidden
                />
              </>
            );

            const className = `group group/nav interactive-parent relative flex flex-col items-center justify-center w-full max-w-[72px] h-full min-h-[44px] px-0.5 py-1 rounded-xl transition-all duration-150 active:bg-[var(--color-canvas)] dark:active:bg-white/[0.06] active:scale-100 ${
              active
                ? "text-[#0284c7] dark:text-[#0ea5e9] font-medium"
                : "text-[var(--color-mute)] font-normal hover:text-[var(--color-ink)]"
            }`;

            return (
              <li key={t.key} role="presentation" className="flex-1 min-w-0 h-full flex items-center justify-center">
                {isMenuTab ? (
                  <button
                    role="tab"
                    aria-selected={active}
                    aria-label={t.label}
                    data-analytics-click="Menu Open"
                    onPointerDown={() => {
                      // Preload chunk
                      import("./MobileMenuDrawer");
                    }}
                    onClick={() => setDrawerOpen(true)}
                    className={className}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    href={isMenuTab ? "#" : t.href}
                    role="tab"
                    aria-selected={active}
                    aria-current={active ? "page" : undefined}
                    aria-label={t.label}
                    className={className}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {drawerOpen && (
        <MobileMenuDrawer
          items={more.map((i) => ({
            key: i.key,
            label: labelFor(i, role),
            href: i.href,
            icon: i.icon,
            match: i.match,
          }))}
          user={{
            name: user?.full_name || "User",
            email: user?.email || "",
            initials: user?.full_name
              ? user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
              : "U",
          }}
          onClosed={() => setDrawerOpen(false)}
          onLogout={() => setLogoutConfirmOpen(true)}
        />
      )}

      {logoutConfirmOpen && (
        <ConfirmationDialog
          isOpen={logoutConfirmOpen}
          onClose={() => {
            if (!isLoggingOut) setLogoutConfirmOpen(false);
          }}
          title="Sign Out"
          description="Are you sure you want to sign out?"
          confirmLabel={isLoggingOut ? "Signing Out..." : "Sign Out"}
          cancelLabel="Cancel"
          variant="danger"
          loading={isLoggingOut}
          onConfirm={async () => {
            try {
              setIsLoggingOut(true);
              await logout();
            } catch (err) {
              if (isRedirectError(err)) {
                return;
              }
              console.error("[BottomNav] Logout error:", err);
              setIsLoggingOut(false);
            }
          }}
        />
      )}
    </>
  );
}
