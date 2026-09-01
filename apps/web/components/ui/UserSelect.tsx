"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import {
  AnimatedChevronDown,
  AnimatedCheck,
  AnimatedX,
} from "./animated-icons";
import { Search } from "lucide-react";

export interface UserSelectItem {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  [key: string]: any;
}

export interface UserSelectProps {
  users: UserSelectItem[];
  value?: string;
  onChange: (userId: string, user?: UserSelectItem | null) => void;
  label?: ReactNode;
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
    case "service_manager":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "service_engineer":
    case "engineer":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    case "supervisor":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20";
    case "operator":
    case "mechanic":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "store_manager":
    case "hr_manager":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    default:
      return "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border-[var(--color-hairline)]";
  }
}

export function UserSelect({
  users = [],
  value = "",
  onChange,
  label,
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
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const phoneMatch = u.phone?.toLowerCase().includes(q);
      const cityMatch = u.city?.toLowerCase().includes(q);
      return nameMatch || roleMatch || emailMatch || phoneMatch || cityMatch;
    });
  }, [eligibleUsers, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenToggle = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
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
        <label className="block text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] mb-1 flex items-center justify-between select-none">
          <span>
            {label} {required && <span className="text-rose-500 font-semibold">*</span>}
          </span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpenToggle}
        className={`w-full px-3 sm:px-3.5 rounded-lg border text-xs sm:text-[13px] font-medium text-[var(--color-ink)] flex items-center justify-between transition-all shadow-2xs ${
          compact ? "h-[38px] min-h-[38px] py-1.5" : "h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px]"
        } ${
          error
            ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
            : isOpen
            ? "border-sky-500 dark:border-sky-400 bg-[var(--color-canvas)] ring-2 ring-sky-500/15"
            : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex items-center gap-2 pr-1">
          {isAllSelected ? (
            <span className="font-bold text-[var(--color-ink)] flex items-center gap-2">
              <span>{allLabel}</span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] font-mono text-[10px]">
                {eligibleUsers.length} Total
              </span>
            </span>
          ) : selectedUser ? (
            <>
              <span className="truncate font-bold">
                {userDisplayName}
              </span>
              {selectedUser.role && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border ${getRoleBadgeStyle(
                    selectedUser.role
                  )}`}
                >
                  {formatRoleLabel(selectedUser.role)}
                </span>
              )}
              {!compact && selectedUser.phone && (
                <span className="text-[10px] text-[var(--color-mute)] font-mono truncate hidden md:inline">
                  ({selectedUser.phone})
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--color-mute)] font-normal">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          {clearable && selectedUser && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
            >
              <AnimatedX size={12} />
            </span>
          )}
          <AnimatedChevronDown
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

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden max-h-72 flex flex-col backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-[var(--color-hairline)] flex items-center gap-2 bg-[var(--color-canvas)]">
            <Search className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, Role, Phone, Email..."
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

          {/* Listbox */}
          <div className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {allowAll && !searchQuery.trim() && (
              <button
                type="button"
                onClick={() => handleSelect("all")}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                  isAllSelected
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                    : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{allLabel}</span>
                  <span className="text-[10px] text-[var(--color-mute)] font-mono">
                    ({eligibleUsers.length} staff)
                  </span>
                </div>
                {isAllSelected && (
                  <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                )}
              </button>
            )}

            {filteredUsers.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--color-mute)]">
                No matching users found
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = u.id === value;
                const name = u.full_name || u.name || "User";
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelect(u.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                        : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="font-bold flex items-center gap-2 truncate">
                        <span className="truncate">{name}</span>
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
                      <div className="flex items-center gap-2 text-[10px] text-[var(--color-mute)] font-mono truncate mt-0.5">
                        {u.phone && <span>{u.phone}</span>}
                        {u.email && <span className="truncate">• {u.email}</span>}
                        {u.city && <span className="truncate">• {u.city}</span>}
                      </div>
                    </div>
                    {isSelected && (
                      <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
