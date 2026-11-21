"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { highlightText } from "./user-search";
import {
  AnimatedMail,
  AnimatedPhone,
  AnimatedMapPin,
} from "@/components/ui/animated-icons";
import { Wrench, User as SupervisorIcon } from "lucide-react";
import { maskAadhaar, formatLicenseNumber } from "@reachinternational/utils";
import type { User } from "@/lib/types/database";

/** Long-press duration (ms) that promotes a card into multi-select mode. */
const LONG_PRESS_MS = 450;

interface MobileUserCardProps {
  user: User;
  currentUser: User;
  selectable?: boolean;
  isSelected?: boolean;
  /** True once multi-select mode has been entered (via long press). */
  selectionMode?: boolean;
  onToggleSelect?: (userId: string) => void;
  onLongPressSelect?: (userId: string) => void;
  searchTerm?: string;
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  super_admin:
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80",
  admin:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80",
  manager:
    "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80",
  supervisor:
    "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/80",
  hr: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80",
  operator:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80",
};

function formatRoleLabel(role: string): string {
  if (!role) return "User";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRoleBadge(role: string) {
  const tone =
    ROLE_BADGE_CLASS[role] ??
    "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border-[var(--color-hairline)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-[1px] text-[10px] font-semibold leading-4 whitespace-nowrap shrink-0 ${tone}`}
    >
      {formatRoleLabel(role)}
    </span>
  );
}

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRoleAvatarStyle(role?: string): string {
  switch (role) {
    case "super_admin":
      return "from-rose-500/20 to-red-600/25 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    case "admin":
      return "from-amber-500/20 to-amber-600/25 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    case "manager":
      return "from-indigo-500/20 to-indigo-600/25 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800";
    case "supervisor":
      return "from-teal-500/20 to-teal-600/25 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800";
    case "hr":
      return "from-emerald-500/20 to-emerald-600/25 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    case "operator":
      return "from-amber-500/20 to-yellow-600/25 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    default:
      return "from-zinc-500/20 to-zinc-600/25 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-800";
  }
}

function getStatusIndicator(status: string) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-[1px] text-[10px] font-semibold leading-4 text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Active
        </span>
      );
    case "inactive":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-1.5 py-[1px] text-[10px] font-semibold leading-4 text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">
          <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-400" />
          Inactive
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-[1px] text-[10px] font-semibold leading-4 text-amber-700 dark:text-amber-300 whitespace-nowrap shrink-0">
          <span className="inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
          Pending
        </span>
      );
    default:
      return null;
  }
}

export const MobileUserCard = memo(function MobileUserCard({
  user,
  currentUser,
  selectable = false,
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
  onLongPressSelect,
  searchTerm,
}: MobileUserCardProps) {
  const router = useRouter();
  const userDetailUrl = `/users/${user.employee_id || user.id}`;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const handlePointerDown = useCallback(() => {
    if (!selectable || selectionMode) return;
    clearLongPressTimer();
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      onLongPressSelect?.(user.id);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(12);
        } catch {
          /* vibration unsupported — non-fatal */
        }
      }
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer, onLongPressSelect, selectable, selectionMode, user.id]);

  const handleActivate = useCallback(() => {
    // A completed long press must not also navigate to the detail page.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (selectionMode && selectable) {
      onToggleSelect?.(user.id);
      return;
    }
    router.push(userDetailUrl);
  }, [onToggleSelect, router, selectable, selectionMode, userDetailUrl]);

  const canViewContactInfo = () => {
    if (currentUser.role === "super_admin" || currentUser.role === "admin") return true;
    if (user.id === currentUser.id) return true;
    if (currentUser.role === "supervisor") {
      const isAssigned =
        user.supervisor_id === currentUser.id ||
        (user.supervisor_ids && user.supervisor_ids.includes(currentUser.id));
      if (isAssigned) return true;
    }
    return false;
  };

  const showContact = canViewContactInfo();

  const borderAccentClass =
    user.role === "super_admin"
      ? "border-l-rose-500"
      : user.role === "admin"
      ? "border-l-amber-500"
      : user.role === "manager"
      ? "border-l-indigo-500"
      : user.role === "supervisor"
      ? "border-l-teal-500"
      : user.role === "hr"
      ? "border-l-emerald-500"
      : user.role === "operator"
      ? "border-l-amber-500"
      : "border-l-slate-400";

  const locationLabel = user.city || user.location || user.district || "";
  const locationSuffix = user.state && user.state !== locationLabel ? user.state : "";
  const supervisorName =
    user.supervisors && user.supervisors.length > 0
      ? user.supervisors.map((s) => s.full_name).join(", ")
      : user.supervisor?.full_name || "";
  const hasKyc = Boolean(user.aadhaar_number || user.license_number);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      role="button"
      tabIndex={0}
      aria-label={`${user.full_name}${user.employee_id ? `, ${user.employee_id}` : ""}, ${formatRoleLabel(
        user.role
      )}, ${user.status}`}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPressTimer}
      onPointerLeave={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onContextMenu={(e) => {
        if (selectable) e.preventDefault();
      }}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={`p-3 rounded-xl border ${
        isSelected
          ? "border-[var(--color-ink)] dark:border-white ring-1 ring-[var(--color-ink)]/70 dark:ring-white/70 bg-[var(--color-link-soft)]/20"
          : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]"
      } shadow-xs hover:border-[var(--color-ink)]/30 hover:shadow-sm transition-all flex flex-col gap-2 relative overflow-hidden group cursor-pointer border-l-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-link)]/50 ${borderAccentClass}`}
    >
      {/* ── Identity: selection box (select mode only) · avatar · name ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        {selectable && selectionMode && (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(user.id)}
              aria-label={`Select ${user.full_name}`}
              className="h-4 w-4 rounded-[4px] border-[var(--color-hairline)] text-[var(--color-ink)] focus:ring-[var(--color-link)] cursor-pointer transition-all accent-[var(--color-ink)]"
            />
          </div>
        )}

        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getRoleAvatarStyle(
            user.role
          )} font-bold text-xs border shadow-xs select-none`}
        >
          <span>{getInitials(user.full_name)}</span>
        </div>

        <h3
          className="text-[15px] font-bold text-[var(--color-ink)] truncate leading-tight min-w-0 flex-1 group-hover:text-[var(--color-link)] transition-colors"
          title={user.full_name}
        >
          {highlightText(user.full_name, searchTerm)}
        </h3>
      </div>

      {/* ── Identity chips: employee ID left, status + role pushed to the right ── */}
      <div className="flex items-center justify-between gap-x-2 gap-y-1 flex-wrap min-w-0">
        {user.employee_id ? (
          <span className="font-mono text-[10px] leading-4 tracking-tight text-[var(--color-mute)] whitespace-nowrap truncate min-w-0">
            {highlightText(user.employee_id, searchTerm)}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {getStatusIndicator(user.status)}
          {getRoleBadge(user.role)}
        </div>
      </div>

      {/* ── Details: contact · location · reporting · machine ── */}
      <div className="pt-2 mt-0.5 border-t border-[var(--color-hairline)] flex flex-col gap-1 text-xs text-[var(--color-mute)] min-w-0 flex-1">
        {showContact ? (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <AnimatedMail size={12} className="flex-shrink-0 text-[var(--color-mute)]" />
              <span className="truncate" title={user.email}>
                {highlightText(user.email, searchTerm)}
              </span>
            </div>
            {user.phone && (
              <div className="flex items-center gap-1.5 min-w-0">
                <AnimatedPhone size={12} className="flex-shrink-0 text-[var(--color-mute)]" />
                <span className="truncate font-mono text-[11px]">{highlightText(user.phone, searchTerm)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-[11px] italic">Restricted contact</div>
        )}

        {(locationLabel || locationSuffix) && (
          <div className="flex items-center gap-1.5 min-w-0">
            <AnimatedMapPin size={12} className="flex-shrink-0 text-[var(--color-mute)]" />
            <span className="truncate text-[var(--color-ink)] font-medium" title={`${locationLabel}${locationSuffix ? `, ${locationSuffix}` : ""}`}>
              {locationLabel || "—"}
              {locationSuffix ? (
                <span className="text-[var(--color-mute)] font-normal">{`, ${locationSuffix}`}</span>
              ) : null}
            </span>
          </div>
        )}

        {supervisorName && (
          <div className="flex items-center gap-1.5 min-w-0">
            <SupervisorIcon
              size={12}
              className="flex-shrink-0 text-teal-600 dark:text-teal-400"
              aria-label="Supervisor"
            />
            <span className="truncate text-[var(--color-ink)] font-medium" title={supervisorName}>
              {supervisorName}
            </span>
          </div>
        )}

        {user.role === "operator" && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Wrench
              size={12}
              className={`flex-shrink-0 ${
                user.machine_category ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-mute)]"
              }`}
            />
            <span
              className={`truncate ${
                user.machine_category
                  ? "text-[var(--color-ink)] font-semibold"
                  : "text-[var(--color-mute)] italic"
              }`}
            >
              {user.machine_category || "Unassigned"}
            </span>
          </div>
        )}

        {user.working_location?.name && (
          <div className="flex items-center gap-1.5 min-w-0">
            <AnimatedMapPin size={12} className="flex-shrink-0 text-[var(--color-link)] opacity-70" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">Base</span>
            <span className="truncate text-[var(--color-ink)] font-medium">{user.working_location.name}</span>
          </div>
        )}
      </div>

      {/* ── Compliance footer: Aadhaar + DL on one line, wrapping only when tight ── */}
      {hasKyc && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-auto pt-1.5 border-t border-[var(--color-hairline)]/70 text-[11px] font-mono min-w-0">
          {user.aadhaar_number && (
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-[9px] font-sans font-bold uppercase tracking-wide text-[var(--color-mute)]">
                Aadhaar
              </span>
              <span className="text-[var(--color-ink)] font-medium">
                {maskAadhaar(user.aadhaar_number)}
              </span>
            </div>
          )}
          {user.license_number && (
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-[9px] font-sans font-bold uppercase tracking-wide text-[var(--color-mute)]">
                DL
              </span>
              <span className="text-[var(--color-ink)] font-medium">
                {formatLicenseNumber(user.license_number)}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
});
