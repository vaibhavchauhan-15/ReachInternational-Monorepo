"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  Check,
  Trash2,
  ChevronDown,
} from "lucide-react";
import {
  AnimatedShieldAlert,
  AnimatedUserPlus,
  AnimatedUsers,
  AnimatedShieldCheck,
  AnimatedUserCheck,
} from "@/components/ui/animated-icons";
import { AnimatedCounter } from "@/components/ui/Motion";
import { Button, PageHeader } from "@/components/ui";
import type { UserListAggregates } from "./users-helpers";

export interface UsersHeaderProps {
  totalCount: number;
  readOnly?: boolean;
  roleFilter: string;
  statusFilter: string;
  aggregates?: UserListAggregates;
  usersCount: number;
  pendingCount: number;
  profileRequestsCount: number;
  deletionRequestsCount: number;
  selectedCount: number;
  onRoleFilterChange: (val: string) => void;
  onStatusFilterChange: (val: string) => void;
  onAddUser: () => void;
  onExportCurrentPage: (format: "xlsx" | "csv" | "pdf") => void;
  onExportFiltered: (format: "xlsx" | "csv" | "pdf") => void;
  onExportAll: (format: "xlsx" | "csv" | "pdf") => void;
  onExportSelected: (format: "xlsx" | "csv" | "pdf") => void;
  onScrollToProfileRequests?: () => void;
  onScrollToDeletionRequests?: () => void;
  onScrollToPendingApprovals?: () => void;
}

export function UsersHeader({
  totalCount,
  readOnly = false,
  roleFilter,
  statusFilter,
  aggregates,
  usersCount,
  pendingCount,
  profileRequestsCount,
  deletionRequestsCount,
  selectedCount,
  onRoleFilterChange,
  onStatusFilterChange,
  onAddUser,
  onExportCurrentPage,
  onExportFiltered,
  onExportAll,
  onExportSelected,
  onScrollToProfileRequests,
  onScrollToDeletionRequests,
  onScrollToPendingApprovals,
}: UsersHeaderProps) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv" | "pdf">("xlsx");
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [isExportMenuOpen]);

  const totalUsersCount = aggregates?.total ?? aggregates?.totalUsers ?? totalCount ?? usersCount;
  const activeCount = aggregates?.active ?? aggregates?.activeUsers ?? 0;
  const operatorCount = aggregates?.operators ?? aggregates?.operatorCount ?? aggregates?.engineers ?? aggregates?.engineerCount ?? 0;
  const newRegistrationsCount = aggregates?.new_registrations ?? pendingCount;

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="User Management"
        breadcrumbs={[{ label: "Users" }]}
        actions={
          <div className="flex items-center gap-2">
            {/* Export Scope Menu Dropdown */}
            <div className="relative inline-block" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                aria-label="Export user directory options"
                className={`h-11 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all ${
                  isExportMenuOpen ? "border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]/10" : ""
                }`}
                title="Export user directory (.xlsx / .csv / .pdf)"
              >
                {exportFormat === "xlsx" && (
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                {exportFormat === "csv" && (
                  <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                )}
                {exportFormat === "pdf" && (
                  <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span className="hidden sm:inline text-xs font-semibold">Export</span>
                <ChevronDown
                  size={13}
                  className={`text-[var(--color-mute)] transition-transform duration-200 ${
                    isExportMenuOpen ? "rotate-180 text-[var(--color-ink)]" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-[300px] sm:w-[340px] max-w-[calc(100vw-24px)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl backdrop-blur-md text-[var(--color-ink)] overflow-hidden"
                  >
                    {/* Header: Title + 3-Way Format Selector */}
                    <div className="p-3 border-b border-[var(--color-hairline)]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[var(--color-mute)]">
                          Export Directory
                        </span>
                        <span className="text-[11px] font-mono text-[var(--color-mute)]">
                          {totalCount} Total
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                        <button
                          type="button"
                          onClick={() => setExportFormat("xlsx")}
                          className={`h-7 px-1 sm:px-2 rounded-md text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                            exportFormat === "xlsx"
                              ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                              : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Excel<span className="hidden sm:inline"> (.xlsx)</span></span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportFormat("csv")}
                          className={`h-7 px-1 sm:px-2 rounded-md text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                            exportFormat === "csv"
                              ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                              : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>CSV<span className="hidden sm:inline"> (.csv)</span></span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportFormat("pdf")}
                          className={`h-7 px-1 sm:px-2 rounded-md text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                            exportFormat === "pdf"
                              ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                              : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>PDF<span className="hidden sm:inline"> (.pdf)</span></span>
                        </button>
                      </div>
                    </div>

                    {/* Scope Options */}
                    <div className="p-1.5 space-y-1">
                      {/* Option 1: Current Page */}
                      <button
                        type="button"
                        onClick={() => {
                          onExportCurrentPage(exportFormat);
                          setIsExportMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--color-canvas)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                              exportFormat === "xlsx"
                                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400"
                                : exportFormat === "csv"
                                ? "bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-400"
                                : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400"
                            }`}
                          >
                            {exportFormat === "xlsx" ? (
                              <FileSpreadsheet className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--color-ink)]">
                              Current Page Only
                            </div>
                            <p className="text-[11px] text-[var(--color-mute)] truncate">
                              Rows loaded on screen
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                          {usersCount} {usersCount === 1 ? "user" : "users"}
                        </span>
                      </button>

                      {/* Option 2: Active Filtered Dataset */}
                      <button
                        type="button"
                        onClick={() => {
                          onExportFiltered(exportFormat);
                          setIsExportMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--color-canvas)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 flex items-center justify-center shrink-0 text-sky-700 dark:text-sky-400 group-hover:scale-105 transition-transform">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--color-ink)]">
                              Matching Filters
                            </div>
                            <p className="text-[11px] text-[var(--color-mute)] truncate">
                              All pages matching active criteria
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300">
                          {totalCount} {totalCount === 1 ? "user" : "users"}
                        </span>
                      </button>

                      {/* Option 3: Entire Directory */}
                      <button
                        type="button"
                        onClick={() => {
                          onExportAll(exportFormat);
                          setIsExportMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--color-canvas)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center shrink-0 text-purple-700 dark:text-purple-400 group-hover:scale-105 transition-transform">
                            <AnimatedUsers size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--color-ink)]">
                              Full Directory
                            </div>
                            <p className="text-[11px] text-[var(--color-mute)] truncate">
                              All registered staff accounts
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300">
                          All
                        </span>
                      </button>

                      {/* Option 4: Selected Rows (if any) */}
                      {selectedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            onExportSelected(exportFormat);
                            setIsExportMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--color-canvas)] transition-all cursor-pointer group border-t border-[var(--color-hairline)] mt-1 pt-2"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400 group-hover:scale-105 transition-transform">
                              <Check className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[var(--color-ink)]">
                                Selected Users
                              </div>
                              <p className="text-[11px] text-[var(--color-mute)] truncate">
                                Checked rows on current page
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                            {selectedCount} {selectedCount === 1 ? "user" : "users"}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Footer / Hint */}
                    <div className="px-3 py-2 bg-[var(--color-canvas)] border-t border-[var(--color-hairline)] rounded-b-xl flex items-center justify-between text-[10px] text-[var(--color-mute)]">
                      <span>Format: .{exportFormat}</span>
                      <span>
                        {exportFormat === "pdf" ? "Print / Save as PDF" : "Instant file download"}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!readOnly && (
              <Button
                variant="primary"
                icon={<AnimatedUserPlus size={15} />}
                responsive
                onClick={onAddUser}
                className="h-9 px-4 text-xs font-semibold whitespace-nowrap"
              >
                Add User
              </Button>
            )}
          </div>
        }
      />

      {/* Metrics Snapshot Header Cards */}
      <div className={`grid grid-cols-2 md:grid-cols-4 ${!readOnly && profileRequestsCount > 0 ? "lg:grid-cols-5" : ""} gap-3.5`}>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onRoleFilterChange("all");
            onStatusFilterChange("all");
          }}
          className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
            roleFilter === "all" && statusFilter === "all"
              ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Users</span>
            <AnimatedUsers size={16} className="text-[var(--color-ink)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--color-ink)] mt-1">
            <AnimatedCounter value={totalUsersCount} />
          </div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => onStatusFilterChange(statusFilter === "active" ? "all" : "active")}
          className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
            statusFilter === "active"
              ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Active Accounts
            </span>
            <AnimatedUserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            <AnimatedCounter value={activeCount} />
          </div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => onRoleFilterChange(roleFilter === "operator" ? "all" : "operator")}
          className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
            roleFilter === "operator"
              ? "bg-amber-50/40 border-amber-500 shadow-xs ring-1 ring-amber-500/20 dark:bg-amber-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Operators
            </span>
            <AnimatedShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
            <AnimatedCounter value={operatorCount} />
          </div>
        </motion.div>

        {!readOnly && (
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (pendingCount > 0 && onScrollToPendingApprovals) {
                onScrollToPendingApprovals();
              }
            }}
            className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
              pendingCount > 0
                ? "bg-amber-50/40 border-amber-500 shadow-xs dark:bg-amber-950/20"
                : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)]"
            }`}
          >
            <div className="flex items-center justify-between text-[var(--color-mute)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                New Registrations
              </span>
              <AnimatedShieldAlert size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
              <AnimatedCounter value={newRegistrationsCount} />
            </div>
          </motion.div>
        )}

        {!readOnly && profileRequestsCount > 0 && (
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (onScrollToProfileRequests) {
                onScrollToProfileRequests();
              }
            }}
            className="cursor-pointer p-4 rounded-[var(--radius-md)] border border-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/20 hover:border-indigo-500 transition-all col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-[var(--color-mute)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Profile Updates
              </span>
              <AnimatedShieldAlert size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-1">
              <AnimatedCounter value={profileRequestsCount} />
            </div>
          </motion.div>
        )}

        {!readOnly && deletionRequestsCount > 0 && (
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (onScrollToDeletionRequests) {
                onScrollToDeletionRequests();
              }
            }}
            className="cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all bg-rose-50/40 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
          >
            <div className="flex items-center justify-between text-[var(--color-mute)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Account Deletions
              </span>
              <Trash2 size={16} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
              <AnimatedCounter value={deletionRequestsCount} />
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}
