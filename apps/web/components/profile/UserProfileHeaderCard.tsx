"use client";

import { useState, memo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Edit, Shield } from "lucide-react";
import { ROLE_CONFIG } from "@/components/profile/UserProfileCard";
import type { User as UserType } from "@/lib/types/database";

const EditProfileModal = dynamic(
  () =>
    import("@/components/profile/EditProfileModal").then(
      (mod) => mod.EditProfileModal
    ),
  { ssr: false }
);

export interface UserProfileHeaderCardProps {
  user: Omit<Partial<UserType>, "role"> & {
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  className?: string;
  onEditSuccess?: () => void;
}

export const UserProfileHeaderCard = memo(function UserProfileHeaderCard({
  user,
  className = "",
  onEditSuccess,
}: UserProfileHeaderCardProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);

  const fullName = user?.full_name || "User";
  const email = user?.email || "";
  const roleKey = (user?.role || "operator").toLowerCase();
  const initial = fullName.charAt(0).toUpperCase() || "U";

  const roleMeta = ROLE_CONFIG[roleKey] || {
    label: roleKey.replace("_", " "),
    badgeClass:
      "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
    icon: Shield,
  };
  const RoleIcon = roleMeta.icon;

  return (
    <>
      {/* ─── Profile Header Card ─── */}
      <div
        className={`p-3.5 sm:p-4 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl shadow-xs transition-all ${className}`}
      >
        <div className="flex items-center gap-3 sm:gap-3.5">
          {/* Initial-letter Avatar (links to /profile) */}
          <Link
            href="/profile"
            aria-label={`View profile for ${fullName}`}
            className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] text-sm sm:text-base font-bold shadow-xs ring-1 ring-black/5 dark:ring-white/10 hover:opacity-90 transition-opacity"
          >
            {initial}
          </Link>

          {/* User Details (links to /profile) */}
          <Link
            href="/profile"
            className="min-w-0 flex-1 group"
            aria-label={`View profile details for ${fullName}`}
          >
            <p className="text-sm sm:text-base font-bold text-[var(--color-ink)] group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate leading-tight transition-colors">
              {fullName}
            </p>
            {email ? (
              <p className="text-xs text-[var(--color-mute)] truncate mt-0.5 select-text">
                {email}
              </p>
            ) : null}
            <div className="mt-1 flex items-center">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleMeta.badgeClass}`}
              >
                <RoleIcon size={10.5} className="shrink-0" />
                <span>{roleMeta.label}</span>
              </span>
            </div>
          </Link>

          {/* Edit Profile Button */}
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            aria-label="Edit Profile"
            title="Edit Profile"
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-sky-500 transition-colors cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            <Edit size={15} className="shrink-0" />
          </button>
        </div>
      </div>

      {/* ─── Lazy Edit Profile Modal ─── */}
      {editModalOpen && (
        <EditProfileModal
          user={user as UserType}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            setEditModalOpen(false);
            onEditSuccess?.();
          }}
        />
      )}
    </>
  );
});
