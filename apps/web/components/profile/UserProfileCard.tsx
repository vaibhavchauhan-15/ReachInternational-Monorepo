"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import {
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
  AnimatedX,
} from "@/components/ui/animated-icons";
import {
  LogOut,
  Clock,
  Edit,
  Phone,
  MapPin,
  ShieldCheck,
  FileText,
  Trash2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { User } from "@/lib/types/database";
import { logout } from "@/app/actions/auth";
import {
  getMyProfileCardDetailsAction,
  type UserProfileCardData,
} from "@/app/actions/users";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui";

const EditProfileModal = dynamic(
  () => import("@/components/profile/EditProfileModal").then((mod) => mod.EditProfileModal),
  { ssr: false }
);

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
  service_manager: {
    label: "Service Manager",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: AnimatedShield,
  },
  engineer: {
    label: "Engineer",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    icon: AnimatedShield,
  },
  service_engineer: {
    label: "Service Engineer",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    icon: AnimatedShield,
  },
  supervisor: {
    label: "Supervisor",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    icon: AnimatedShield,
  },
  store_manager: {
    label: "Store Manager",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    icon: AnimatedShield,
  },
  operator: {
    label: "Operator",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: AnimatedShield,
  },
  mechanic: {
    label: "Mechanic",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    icon: AnimatedShield,
  },
  hr_manager: {
    label: "HR Manager",
    badgeClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    icon: AnimatedShield,
  },
};

// Global in-memory session cache for the profile card details
let globalProfileCache: UserProfileCardData | null = null;

export function invalidateUserProfileCardCache() {
  globalProfileCache = null;
}

export interface UserProfileCardProps {
  user: User;
  onClose?: () => void;
  isMobileDrawer?: boolean;
}

export const UserProfileCard = memo(function UserProfileCard({
  user,
  onClose,
  isMobileDrawer = false,
}: UserProfileCardProps) {
  const [profileData, setProfileData] = useState<UserProfileCardData | null>(globalProfileCache);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Lazy-load profile info on mount with dual-tier (in-memory + server) cache
  useEffect(() => {
    // Tier 1: In-memory session cache hit (0ms latency, zero network calls)
    if (globalProfileCache) {
      setProfileData(globalProfileCache);
      return;
    }

    // Tier 2: Fetch on-demand via fast, single-row primary key server action
    let active = true;
    setIsLoadingProfile(true);

    getMyProfileCardDetailsAction()
      .then((res) => {
        if (!active) return;
        if (res.profile) {
          globalProfileCache = res.profile;
          setProfileData(res.profile);
        }
      })
      .catch((err) => {
        console.error("[UserProfileCard] Failed to fetch profile details:", err);
      })
      .finally(() => {
        if (active) setIsLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const roleMeta = ROLE_CONFIG[user.role] || {
    label: user.role.replace("_", " "),
    badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
    icon: AnimatedShield,
  };
  const RoleIcon = roleMeta.icon;

  const activeProfile = profileData;
  const fullAddress = activeProfile
    ? [activeProfile.address, activeProfile.city, activeProfile.district, activeProfile.state]
        .filter(Boolean)
        .join(", ")
    : null;

  const maskedAadhaar = activeProfile?.aadhaar_number
    ? activeProfile.aadhaar_number.length >= 12
      ? `XXXX-XXXX-${activeProfile.aadhaar_number.slice(-4)}`
      : activeProfile.aadhaar_number
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 text-[var(--color-ink)] select-none">
      {/* 1. Profile Header Card (Pinned at Top) */}
      <div className="p-3 border border-[var(--color-hairline)] bg-[var(--color-canvas)] rounded-xl mb-2 shrink-0">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] font-bold text-sm shadow-xs ring-1 ring-black/5 dark:ring-white/10">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight">
                {user.full_name}
              </p>
              <p className="text-[11px] text-[var(--color-mute)] truncate mt-0.5">
                {activeProfile?.email || user.email || "No email"}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleMeta.badgeClass}`}
                >
                  <RoleIcon size={11} />
                  {roleMeta.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Edit Profile Icon Button */}
            <button
              type="button"
              onClick={() => {
                onClose?.();
                setEditModalOpen(true);
              }}
              title="Edit Profile"
              aria-label="Edit Profile"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-sky-500 transition-colors cursor-pointer shadow-2xs focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <Edit size={13} />
            </button>

            {/* Mobile Drawer Close Button */}
            {isMobileDrawer && onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close Drawer"
                aria-label="Close Drawer"
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
              >
                <AnimatedX size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Scrollable Middle Section: User Quick Info */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-1.5">
        {isLoadingProfile && !activeProfile ? (
          /* Lazy Loading Skeletons with 0 layout shift */
          <div className="space-y-2 p-2.5 border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 rounded-xl">
            <div className="flex items-center justify-between py-1">
              <div className="h-3 w-12 rounded bg-[var(--color-hairline)] animate-pulse" />
              <div className="h-3 w-28 rounded bg-[var(--color-hairline)] animate-pulse" />
            </div>
            <div className="flex items-center justify-between py-1 border-t border-[var(--color-hairline)]">
              <div className="h-3 w-10 rounded bg-[var(--color-hairline)] animate-pulse" />
              <div className="h-3 w-32 rounded bg-[var(--color-hairline)] animate-pulse" />
            </div>
            <div className="flex items-center justify-between py-1 border-t border-[var(--color-hairline)]">
              <div className="h-3 w-16 rounded bg-[var(--color-hairline)] animate-pulse" />
              <div className="h-3 w-36 rounded bg-[var(--color-hairline)] animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[var(--color-hairline)]">
              <div className="h-6 rounded bg-[var(--color-hairline)] animate-pulse" />
              <div className="h-6 rounded bg-[var(--color-hairline)] animate-pulse" />
            </div>
          </div>
        ) : (
          /* Loaded Quick Info Details */
          <div className="space-y-1.5 p-2.5 border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 rounded-xl text-xs">
            {/* Mobile Phone */}
            <div className="flex items-center gap-2.5 py-1">
              <Phone size={13} className="text-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                  Phone
                </span>
                <span className="text-xs font-medium font-mono text-[var(--color-ink)] truncate">
                  {activeProfile?.phone
                    ? activeProfile.phone.startsWith("+")
                      ? activeProfile.phone
                      : `+91 ${activeProfile.phone}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Shift Time */}
            <div className="flex items-center gap-2.5 py-1 border-t border-[var(--color-hairline)]">
              <Clock size={13} className="text-sky-500 shrink-0" />
              <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                  Shift
                </span>
                <span className="text-xs font-medium text-[var(--color-ink)] truncate">
                  {activeProfile?.shift_time || "General Shift"}
                </span>
              </div>
            </div>

            {/* Base Yard / Location */}
            <div className="flex items-start gap-2.5 py-1 border-t border-[var(--color-hairline)]">
              <MapPin size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)] shrink-0">
                  Location
                </span>
                <span className="text-xs font-medium text-[var(--color-ink)] text-right leading-snug line-clamp-2">
                  {fullAddress || "—"}
                </span>
              </div>
            </div>

            {/* Aadhaar & Licence Grid */}
            {(activeProfile?.aadhaar_number || activeProfile?.license_number) && (
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[var(--color-hairline)]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-indigo-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                      Aadhaar
                    </p>
                    <p className="text-[11px] font-mono font-medium text-[var(--color-ink)] truncate">
                      {maskedAadhaar || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <FileText size={12} className="text-purple-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                      Licence
                    </p>
                    <p className="text-[11px] font-mono font-medium text-[var(--color-ink)] truncate uppercase">
                      {activeProfile?.license_number || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Pinned Action Footer (NEVER clipped or pushed offscreen) */}
      <div className="pt-2 border-t border-[var(--color-hairline)] shrink-0 space-y-1 mt-1">
        {/* Appearance Theme Toggle */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-canvas)] transition-colors">
          <span className="text-xs font-medium text-[var(--color-ink)]">Appearance</span>
          <ThemeToggle />
        </div>

        {/* Protected Account Deletion (Confirmation Guarded) */}
        {showDeleteConfirm ? (
          <div className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-rose-600 dark:text-rose-400 text-xs">
                  Proceed to Account Deletion?
                </p>
                <p className="text-[11px] text-[var(--color-mute)] leading-snug">
                  This page is for permanent data erasure. It is NOT for logging out.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <Link
                href="/delete-account"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onClose?.();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-mute)] hover:text-rose-600 hover:bg-rose-500/5 transition-colors text-left cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <Trash2 size={13} className="text-[var(--color-mute)] group-hover:text-rose-500 transition-colors" />
              <span>Account Deletion</span>
            </span>
            <span className="text-[10px] text-[var(--color-mute)] font-medium">Permanent</span>
          </button>
        )}

        {/* Prominent Session Sign Out Button */}
        <form action={logout} className="w-full pt-0.5">
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

      {/* Edit Profile Modal (Lazy loaded strictly when clicked) */}
      {editModalOpen && user && (
        <EditProfileModal
          user={user}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            // Invalidate in-memory cache to load updated profile on next open
            invalidateUserProfileCardCache();
            setProfileData(null);
          }}
        />
      )}
    </div>
  );
});
