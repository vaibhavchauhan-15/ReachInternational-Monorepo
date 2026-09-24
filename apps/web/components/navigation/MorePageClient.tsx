"use client";

import Link from "next/link";
import {
  Gauge,
  Wrench,
  Building2,
  Users,
  Shield,
  LogOut,
  Settings,
  ChevronRight,
  Banknote,
  CalendarCheck,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui";
import { UserProfileHeaderCard } from "@/components/profile/UserProfileHeaderCard";

// Icon string key → Lucide component (same mapping as BottomNav)
const ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  gauge: Gauge,
  wrench: Wrench,
  building: Building2,
  users: Users,
  shield: Shield,
  banknote: Banknote,
  "calendar-check": CalendarCheck,
};

interface OverflowItem {
  key: string;
  label: string;
  href: string;
  icon: string;
}

interface MorePageClientProps {
  user: {
    full_name: string;
    email: string;
    role: string;
  };
  overflowItems: OverflowItem[];
}

export function MorePageClient({ user, overflowItems }: MorePageClientProps) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* ─── Profile Header ─── */}
      <UserProfileHeaderCard user={user} />

      {/* ─── Overflow Navigation Tiles ─── */}
      {overflowItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)] px-1">
            More Pages
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {overflowItems.map((item) => {
              const Icon = ICONS[item.icon] || Shield;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-3 p-4 min-h-[88px] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors group group/tile interactive-parent"
                >
                  <Icon
                    size={22}
                    className="text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-colors shrink-0"
                  />
                  <span className="text-sm font-medium text-[var(--color-ink)] leading-tight">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Settings ─── */}
      <div className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl overflow-hidden shadow-xs">
        <Link
          href="/settings"
          className="flex items-center justify-between px-4 py-3.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors group interactive-parent"
        >
          <span className="flex items-center gap-2.5">
            <Settings size={17} className="text-[var(--color-mute)] group-hover:text-sky-500 transition-colors shrink-0" />
            Settings
          </span>
          <ChevronRight size={16} className="text-[var(--color-mute)] shrink-0" />
        </Link>
      </div>

      {/* ─── Sign Out ─── */}
      <form action={logout}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          fullWidth
          icon={<LogOut className="h-4 w-4 text-rose-500" />}
          className="justify-center px-4 py-3 rounded-2xl text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 transition-all cursor-pointer shadow-2xs"
        >
          Sign Out
        </Button>
      </form>
    </div>
  );
}
