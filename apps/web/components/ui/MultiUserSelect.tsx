"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AnimatedChevronDown,
  AnimatedCheck,
  AnimatedX,
} from "./animated-icons";
import { Search, Clock, Users, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDynamicDropdownPosition } from "@/lib/hooks/useDynamicDropdownPosition";

export interface MultiUserSelectItem {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  shift_time?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  [key: string]: any;
}

export interface MultiUserSelectProps {
  users: MultiUserSelectItem[];
  values?: string[];
  onChange: (userIds: string[], selectedUsers?: MultiUserSelectItem[]) => void;
  label?: ReactNode;
  placeholder?: string;
  emptySelectionText?: string;
  disabled?: boolean;
  required?: boolean;
  roleFilter?: string[];
  error?: string;
  className?: string;
  maxDisplayChips?: number;
}

function formatRoleLabel(role?: string | null): string {
  if (!role) return "Staff";
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
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    default:
      return "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border-[var(--color-hairline)]";
  }
}

export function MultiUserSelect({
  users = [],
  values = [],
  onChange,
  label,
  placeholder = "Search and assign staff (multiple shifts)...",
  emptySelectionText = "None assigned",
  disabled = false,
  required = false,
  roleFilter,
  error,
  className = "",
  maxDisplayChips = 6,
}: MultiUserSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { mounted, position, isPositioned, portalTarget, updatePosition } = useDynamicDropdownPosition({
    isOpen,
    triggerRef,
    popoverRef,
    onClose: () => {
      setIsOpen(false);
      setSearchQuery("");
    },
    minWidth: 260,
    maxHeightCap: 320,
    matchTriggerWidth: true,
  });

  // Filter eligible users by role/status
  const eligibleUsers = useMemo(() => {
    let filtered = users;
    if (roleFilter && roleFilter.length > 0) {
      filtered = filtered.filter((u) => u.role && roleFilter.includes(u.role));
    }
    return filtered.filter((u) => !u.status || u.status === "active");
  }, [users, roleFilter]);

  // Selected user objects
  const selectedUsers = useMemo(() => {
    const valSet = new Set(values || []);
    return eligibleUsers.filter((u) => valSet.has(u.id));
  }, [eligibleUsers, values]);

  // Search filtered candidates (with currently assigned/selected users placed at the top)
  const filteredCandidates = useMemo(() => {
    let list = eligibleUsers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = eligibleUsers.filter((u) => {
        const nameMatch = (u.full_name || u.name)?.toLowerCase().includes(q);
        const roleMatch = u.role?.toLowerCase().includes(q) || formatRoleLabel(u.role).toLowerCase().includes(q);
        const shiftMatch = u.shift_time?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        const phoneMatch = u.phone?.toLowerCase().includes(q);
        return nameMatch || roleMatch || shiftMatch || emailMatch || phoneMatch;
      });
    }

    return [...list].sort((a, b) => {
      const nameA = a.full_name || a.name || "";
      const nameB = b.full_name || b.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [eligibleUsers, searchQuery]);

  const handleToggleOpen = () => {
    if (disabled) return;
    const nextState = !isOpen;
    if (nextState) {
      updatePosition();
    }
    setIsOpen(nextState);
    if (nextState) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  };

  const handleToggleUser = (userId: string) => {
    const currentSet = new Set(values || []);
    if (currentSet.has(userId)) {
      currentSet.delete(userId);
    } else {
      currentSet.add(userId);
    }
    const newValues = Array.from(currentSet);
    const newSelected = eligibleUsers.filter((u) => currentSet.has(u.id));
    onChange(newValues, newSelected);
  };

  const handleRemoveChip = (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const newValues = (values || []).filter((id) => id !== userId);
    const newSelected = eligibleUsers.filter((u) => newValues.includes(u.id));
    onChange(newValues, newSelected);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onChange([], []);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <div
      className={`relative flex flex-col gap-1.5 w-full ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="block text-[12px] sm:text-[13px] font-semibold text-[var(--color-ink)] select-none">
          <div className="flex items-center justify-between">
            <span>
              {label} {required && <span className="text-rose-500 font-semibold">*</span>}
            </span>
            {selectedUsers.length > 0 && (
              <span className="text-[10px] font-mono text-[var(--color-mute)]">
                {selectedUsers.length} assigned
              </span>
            )}
          </div>
        </label>
      )}

      {/* Main Trigger Box */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggleOpen}
        className={`w-full min-h-[44px] p-1.5 sm:p-2 rounded-xl border text-xs font-medium text-[var(--color-ink)] flex items-center justify-between gap-2 transition-all shadow-2xs ${
          error
            ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10"
            : isOpen
            ? "border-sky-500 dark:border-sky-400 bg-[var(--color-canvas)] ring-2 ring-sky-500/15"
            : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
          {selectedUsers.length === 0 ? (
            <span className="text-[var(--color-mute)] px-1.5 py-0.5 font-normal text-xs sm:text-[13px]">
              {placeholder}
            </span>
          ) : (
            <>
              {selectedUsers.slice(0, maxDisplayChips).map((u) => {
                const name = u.full_name || u.name || "Staff";
                return (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] text-xs font-semibold max-w-[200px] shadow-2xs"
                  >
                    <span className="truncate">{name}</span>
                    {u.shift_time && (
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-medium hidden sm:inline truncate max-w-[90px]">
                        ({u.shift_time})
                      </span>
                    )}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveChip(u.id, e)}
                        className="p-0.5 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                        title={`Remove ${name}`}
                      >
                        <AnimatedX size={11} />
                      </button>
                    )}
                  </span>
                );
              })}

              {selectedUsers.length > maxDisplayChips && (
                <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold border border-sky-500/20">
                  +{selectedUsers.length - maxDisplayChips} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {selectedUsers.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] font-bold text-[var(--color-mute)] hover:text-rose-500 px-1 py-0.5 transition-colors cursor-pointer"
              title="Clear all selected"
            >
              Clear
            </button>
          )}
          <AnimatedChevronDown
            size={16}
            className={`text-[var(--color-mute)] transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5 flex items-center gap-1">
          {error}
        </p>
      )}

      {/* Dynamic Viewport Dropdown Popover Portaled into the nearest dialog card (or body) */}
      {mounted && portalTarget && createPortal(
        <AnimatePresence>
          {isOpen && isPositioned && (
            <motion.div
              ref={popoverRef}
              key="multi-user-select-popover"
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
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden flex flex-col backdrop-blur-md"
            >
              {/* Search Header */}
              <div className="p-2 border-b border-[var(--color-hairline)] flex items-center gap-2 bg-[var(--color-canvas)] shrink-0">
                <Search className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 ml-1" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff by name, shift, role, phone..."
                  className="w-full bg-transparent text-xs text-[var(--color-ink)] focus:outline-none placeholder:text-[var(--color-mute)] py-1"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-[var(--color-mute)] hover:text-[var(--color-ink)] p-1 cursor-pointer"
                  >
                    <AnimatedX size={12} />
                  </button>
                )}
              </div>

              {/* Quick Selection Status Banner */}
              <div className="px-3 py-1.5 bg-[var(--color-hairline-soft-surface)]/50 border-b border-[var(--color-hairline)] flex items-center justify-between text-[11px] text-[var(--color-mute)] font-medium shrink-0">
                <span>
                  {selectedUsers.length} of {eligibleUsers.length} selected
                </span>
                {selectedUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange([], []);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                )}
              </div>

              {/* Candidate User List */}
              <div className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar flex-1 min-h-0">
                {filteredCandidates.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--color-mute)]">
                    No matching staff found
                  </div>
                ) : (
                  filteredCandidates.map((u) => {
                    const isSelected = (values || []).includes(u.id);
                    const name = u.full_name || u.name || "Staff";
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleUser(u.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`w-full flex items-center justify-between p-2 sm:p-2.5 rounded-xl text-xs text-left transition-all cursor-pointer min-h-[44px] ${
                          isSelected
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold border border-sky-500/20"
                            : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)] border border-transparent"
                        }`}
                      >
                        <div className="min-w-0 pr-2 flex-1 flex flex-col gap-0.5">
                          <div className="font-bold flex items-center gap-2 truncate">
                            <span className="truncate text-xs sm:text-[13px]">{name}</span>
                            {u.role && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border ${getRoleBadgeStyle(
                                  u.role
                                )}`}
                              >
                                {formatRoleLabel(u.role)}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--color-mute)] font-mono">
                            {u.shift_time && (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <Clock size={10} className="shrink-0" />
                                <span>{u.shift_time}</span>
                              </span>
                            )}
                            {u.phone && <span>📞 {u.phone}</span>}
                            {u.email && <span className="truncate">✉️ {u.email}</span>}
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          <div
                            className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-sky-600 border-sky-600 text-white shadow-xs"
                                : "border-[var(--color-hairline)] bg-[var(--color-canvas)]"
                            }`}
                          >
                            {isSelected && <AnimatedCheck size={12} className="text-white stroke-[2.5]" />}
                          </div>
                        </div>
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
