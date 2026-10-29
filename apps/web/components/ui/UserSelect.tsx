"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedCheck,
  AnimatedX,
} from "./animated-icons";
import { Search, ChevronDown } from "lucide-react";
import { formatEmployeeId } from "@reachinternational/utils";
import { useDynamicDropdownPosition } from "@/lib/hooks/useDynamicDropdownPosition";

export interface UserSelectItem {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  employee_id?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  disabled?: boolean;
  disabledReason?: string | null;
  badge?: string | null;
  badgeVariant?: "default" | "info" | "warning" | "success" | "neutral";
  badgeTitle?: string | null;
  [key: string]: any;
}

export interface UserSelectProps {
  users: UserSelectItem[];
  value?: string;
  onChange: (userId: string, user?: UserSelectItem | null) => void;
  label?: ReactNode;
  count?: number | string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  compact?: boolean;
  roleFilter?: string[];
  error?: string;
  className?: string;
}

function formatRoleLabel(role?: string | null): string {
  if (!role) return "User";
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getRoleBadgeStyle(role?: string | null): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "manager":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "supervisor":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20";
    case "hr":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    case "operator":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
  }
}

export function UserSelect({
  users = [],
  value = "",
  onChange,
  label,
  count,
  placeholder = "Search or select user / employee...",
  disabled = false,
  required = false,
  clearable = false,
  allowAll = false,
  allLabel = "All Users",
  compact = false,
  roleFilter,
  error,
  className = "",
}: UserSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { mounted, position, isPositioned, portalTarget, updatePosition } = useDynamicDropdownPosition({
    isOpen,
    triggerRef,
    popoverRef,
    onClose: () => {
      setIsOpen(false);
    },
    minWidth: 260,
    maxHeightCap: 320,
  });

  const isAllSelected = allowAll && (value === "all" || value === "");

  // Optional role & status filtering
  const eligibleUsers = useMemo(() => {
    let filtered = users;
    if (roleFilter && roleFilter.length > 0) {
      filtered = filtered.filter((u) => u.role && roleFilter.includes(u.role));
    }
    return filtered.filter((u) => !u.status || u.status === "active");
  }, [users, roleFilter]);

  const selectedUser = useMemo(() => {
    if (isAllSelected) return null;
    return eligibleUsers.find((u) => u.id === value) || users.find((u) => u.id === value) || null;
  }, [eligibleUsers, users, value, isAllSelected]);

  // Search filter matching full name, role, email, phone, city
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return eligibleUsers;
    const q = searchQuery.toLowerCase().trim();
    return eligibleUsers.filter((u) => {
      const nameMatch = (u.full_name || u.name)?.toLowerCase().includes(q);
      const roleMatch = u.role?.toLowerCase().includes(q) || formatRoleLabel(u.role).toLowerCase().includes(q);
      const emailMatch = u.email?.toLowerCase().includes(q);
      const empIdMatch = u.employee_id?.toLowerCase().includes(q);
      const phoneMatch = u.phone?.toLowerCase().includes(q);
      const cityMatch = u.city?.toLowerCase().includes(q);
      return nameMatch || roleMatch || empIdMatch || emailMatch || phoneMatch || cityMatch;
    });
  }, [eligibleUsers, searchQuery]);

  const handleOpenToggle = () => {
    if (disabled) return;
    const nextState = !isOpen;
    if (nextState) {
      updatePosition();
    }
    setIsOpen(nextState);
    if (nextState) {
      // Only autofocus search input on desktop viewports to prevent the mobile virtual keyboard from obscuring options
      if (typeof window !== "undefined" && window.innerWidth >= 640) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  };

  const handleSelect = (userId: string) => {
    if (userId === "all") {
      onChange("all", null);
    } else {
      const target = users.find((u) => u.id === userId) || null;
      onChange(userId, target);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(allowAll ? "all" : "", null);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const userDisplayName = selectedUser?.full_name || selectedUser?.name || "User";

  return (
    <div
      className={`relative flex flex-col gap-1 w-full ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="block text-[12px] sm:text-[13px] font-semibold text-[var(--color-ink)] mb-1 flex items-center justify-between select-none">
          <span className="flex items-center gap-1.5">
            {label} {required && <span className="text-rose-500 font-semibold">*</span>}
          </span>
          {count !== undefined && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--color-canvas)] text-[var(--color-mute)] border border-[var(--color-hairline)] font-medium">
              {count} Total
            </span>
          )}
        </label>
      )}

      {/* Trigger Button — Minimum 44px on mobile, touch-manipulation & smooth active feedback */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpenToggle}
        className={`w-full px-3 sm:px-3.5 rounded-lg border text-xs sm:text-[13px] font-medium text-[var(--color-ink)] flex items-center justify-between transition-all shadow-2xs touch-manipulation select-none active:scale-[0.99] ${
          compact ? "h-[40px] min-h-[40px] sm:h-[38px] sm:min-h-[38px] py-1.5" : "h-[46px] min-h-[46px] sm:h-[44px] sm:min-h-[44px]"
        } ${
          error
            ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
            : isOpen
            ? "border-sky-500 dark:border-sky-400 bg-[var(--color-canvas)] ring-2 ring-sky-500/15"
            : "border border-neutral-300 dark:border-neutral-700 [html:not(.dark)_&]:border-neutral-300 bg-[var(--color-canvas)] hover:border-neutral-400 dark:hover:border-neutral-600"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex items-center gap-2 pr-1 min-w-0 flex-1">
          {isAllSelected ? (
            <span className="font-bold text-[var(--color-ink)] flex items-center gap-2 truncate">
              <span className="truncate">{allLabel}</span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] font-mono text-[10px] shrink-0">
                {eligibleUsers.length} Total
              </span>
            </span>
          ) : selectedUser ? (
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <span className="truncate text-xs font-medium text-[var(--color-ink)]">
                {userDisplayName}
              </span>
              {(selectedUser.employee_id || selectedUser.emp_id) && (
                <span className="px-1 py-0.2 rounded text-[9px] font-mono font-medium text-[var(--color-mute)] bg-[var(--color-canvas)] border border-neutral-200 dark:border-neutral-800 shrink-0 leading-tight">
                  {formatEmployeeId(selectedUser.employee_id || selectedUser.emp_id || selectedUser.id)}
                </span>
              )}
              {selectedUser.badge && (
                <span
                  title={selectedUser.badgeTitle || selectedUser.badge}
                  className={`px-1 py-0.2 rounded text-[9px] font-mono font-medium shrink-0 border leading-tight ${
                    selectedUser.badgeVariant === "info"
                      ? "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                      : selectedUser.badgeVariant === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-zinc-100 dark:bg-zinc-800 text-[var(--color-mute)] border-[var(--color-hairline)]"
                  }`}
                >
                  {selectedUser.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[var(--color-mute)] font-normal truncate">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0 ml-1">
          {clearable && selectedUser && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer touch-manipulation"
            >
              <AnimatedX size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </span>
      </button>

      {error && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
          {error}
        </p>
      )}

      {/* Popover Menu rendered via Portal with Dynamic Viewport Positioning & Smooth Transitions */}
      {mounted && portalTarget && createPortal(
        <AnimatePresence onExitComplete={() => setSearchQuery("")}>
          {isOpen && isPositioned && (
            <motion.div
              ref={popoverRef}
              key="user-select-popover"
              data-portal-dropdown="true"
              data-portal-select="true"
              initial={{
                opacity: 0,
                scale: 0.97,
                y: position.placement === "top" ? 6 : -6,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.97,
                y: position.placement === "top" ? 4 : -4,
              }}
              transition={{
                duration: 0.16,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                position: "fixed",
                top: position.top !== undefined ? `${position.top}px` : "auto",
                bottom: position.bottom !== undefined ? `${position.bottom}px` : "auto",
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
                zIndex: 99999,
                pointerEvents: "auto",
                transformOrigin: position.placement === "top" ? "bottom center" : "top center",
              }}
              className="rounded-xl border border-neutral-300 dark:border-neutral-700 [html:not(.dark)_&]:border-neutral-300 bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden flex flex-col backdrop-blur-md"
            >
              {/* Search Header */}
              <div className="p-2 sm:p-2.5 border-b border-[var(--color-hairline)] flex items-center gap-2 bg-[var(--color-canvas)] shrink-0">
                <Search className="h-4 w-4 text-[var(--color-mute)] shrink-0 ml-1" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, role..."
                  className="w-full bg-transparent text-base sm:text-xs text-[var(--color-ink)] focus:outline-none placeholder:text-[var(--color-mute)] py-1"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-[var(--color-mute)] hover:text-[var(--color-ink)] p-1.5 rounded-md hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer touch-manipulation"
                  >
                    <AnimatedX size={14} />
                  </button>
                )}
              </div>

              {/* Listbox — Touch-optimized scrolling with hardware acceleration & zero dialog scroll chaining */}
              <div
                className="overflow-y-auto overscroll-contain p-1.5 space-y-1.5 custom-scrollbar flex-1 min-h-0 touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {allowAll && !searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect("all")}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-2 rounded-lg text-xs text-left transition-all cursor-pointer min-h-[48px] sm:min-h-[44px] touch-manipulation active:scale-[0.99] border ${
                      isAllSelected
                        ? "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium"
                        : "border-neutral-200 dark:border-neutral-800 [html:not(.dark)_&]:border-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 bg-[var(--color-canvas)]/40 hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-[var(--color-ink)]">{allLabel}</span>
                      <span className="text-[10px] text-[var(--color-mute)] font-mono">
                        ({eligibleUsers.length} staff)
                      </span>
                    </div>
                    {isAllSelected && (
                      <AnimatedCheck size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                )}

                {filteredUsers.length === 0 ? (
                  <div className="py-5 text-center text-xs text-[var(--color-mute)]">
                    No matching users found
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = u.id === value;
                    const isDisabled = Boolean(u.disabled);
                    const name = u.full_name || u.name || "User";
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={isDisabled ? undefined : () => handleSelect(u.id)}
                        className={`w-full flex items-center justify-between p-2.5 sm:p-2 rounded-lg text-xs text-left transition-all min-h-[48px] sm:min-h-[44px] touch-manipulation active:scale-[0.99] border ${
                          isDisabled
                            ? "opacity-50 cursor-not-allowed border-neutral-200/50 dark:border-neutral-800/50 bg-transparent"
                            : isSelected
                            ? "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium cursor-pointer"
                            : "border-neutral-200 dark:border-neutral-800 [html:not(.dark)_&]:border-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 bg-[var(--color-canvas)]/40 hover:bg-[var(--color-canvas)] text-[var(--color-ink)] cursor-pointer"
                        }`}
                      >
                        <div className="min-w-0 pr-2 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs font-medium text-[var(--color-ink)] truncate">{name}</span>
                            <span className="px-1 py-0.2 rounded text-[9px] font-mono font-medium text-[var(--color-mute)] bg-[var(--color-canvas)] border border-neutral-200 dark:border-neutral-800 shrink-0 leading-tight">
                              {u.employee_id ? formatEmployeeId(u.employee_id) : (u.emp_id ? formatEmployeeId(u.emp_id) : "EMP-001")}
                            </span>
                            {u.badge && (
                              <span
                                title={u.badgeTitle || u.badge}
                                className={`px-1 py-0.2 rounded text-[9px] font-mono font-medium shrink-0 border leading-tight ${
                                  u.badgeVariant === "info"
                                    ? "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                                    : u.badgeVariant === "warning"
                                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-[var(--color-mute)] border-[var(--color-hairline)]"
                                }`}
                              >
                                {u.badge}
                              </span>
                            )}
                          </div>
                          {u.disabledReason && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate mt-0.5">
                              {u.disabledReason}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <AnimatedCheck size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        portalTarget
      )}
    </div>
  );
}
