"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
} from "@/components/ui/animated-icons";
import { LogOut, Settings, ChevronRight } from "lucide-react";
import type { User as UserType } from "@/lib/types/database";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui";

export const ROLE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  super_admin: {
    label: "Super Admin",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: AnimatedShieldAlert,
  },
  admin: {
    label: "Admin",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: AnimatedShieldCheck,
  },
  manager: {
    label: "Manager",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    icon: AnimatedShield,
  },
  supervisor: {
    label: "Supervisor",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    icon: AnimatedShield,
  },
  hr: {
    label: "HR",
    badgeClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    icon: AnimatedShield,
  },
  operator: {
    label: "Operator",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: AnimatedShield,
  },
};

export function invalidateUserProfileCardCache() {
  // Retained for backward compatibility
}

export interface UserProfileCardProps {
  user: UserType;
  onClose?: () => void;
  isMobileDrawer?: boolean;
}

export const UserProfileCard = memo(function UserProfileCard({
  user,
  onClose,
}: UserProfileCardProps) {
  const router = useRouter();

  const roleMeta = ROLE_CONFIG[user.role] || {
    label: user.role.replace("_", " "),
    badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
    icon: AnimatedShield,
  };
  const RoleIcon = roleMeta.icon;

  const handleCardClick = () => {
    router.push("/profile");
    onClose?.();
  };

  return (
    <div className="flex flex-col w-full text-[var(--color-ink)] select-none">
      {/* ─── Profile Card (Click to open Profile Page) ─── */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        aria-label={`View profile for ${user.full_name}`}
        className="w-full flex items-center justify-between gap-2.5 p-2.5 border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] rounded-xl transition-all duration-150 cursor-pointer group text-left shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/30"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Initial-letter avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs font-extrabold shadow-2xs ring-1 ring-black/5 dark:ring-white/10 group-hover:scale-105 transition-transform duration-150">
            {user.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          {/* User Info Container: Scaled down text for proper fit */}
          <div className="min-w-0 flex-1">
            {/* User Name */}
            <p className="text-xs font-bold text-[var(--color-ink)] group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate leading-snug transition-colors">
              {user.full_name}
            </p>
            {/* User Email */}
            <p className="text-[10px] text-[var(--color-mute)] truncate mt-0.5 leading-tight">
              {user.email || "No email"}
            </p>

            {/* Role Badge (Active status removed) */}
            <div className="mt-1.5 flex items-center">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${roleMeta.badgeClass}`}
              >
                <RoleIcon size={9.5} />
                {roleMeta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Affordance to /profile */}
        <ChevronRight
          size={14}
          className="text-[var(--color-mute)] group-hover:text-[var(--color-ink)] group-hover:translate-x-0.5 transition-all shrink-0 ml-1"
        />
      </div>

      {/* ─── Settings Link ─── */}
      <Link
        href="/settings"
        onClick={() => onClose?.()}
        className="w-full flex items-center justify-between px-3 py-2 mt-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-xs font-semibold text-[var(--color-ink)] transition-colors group cursor-pointer shadow-2xs"
      >
        <span className="flex items-center gap-2.5">
          <Settings size={14} className="text-[var(--color-mute)] group-hover:text-sky-500 transition-colors shrink-0" />
          Settings
        </span>
        <ChevronRight size={14} className="text-[var(--color-mute)] shrink-0" />
      </Link>

      {/* ─── Logout Button (Red Color) ─── */}
      <form action={logout} className="w-full mt-2">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          fullWidth
          icon={<LogOut className="h-3.5 w-3.5 text-rose-500" />}
          className="justify-center px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 transition-all cursor-pointer shadow-2xs"
        >
          Sign Out
        </Button>
      </form>
    </div>
  );
});
