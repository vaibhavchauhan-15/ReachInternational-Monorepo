"use client";

import { useState } from "react";
import {
  AnimatedSearch,
  AnimatedSlidersHorizontal,
  AnimatedX,
  AnimatedDownload,
  AnimatedRotateCcw,
} from "@/components/ui/animated-icons";
import { Input, Button, Select } from "@/components/ui";
import type { AuditLogWithUser } from "@/lib/types/database";

interface AuditFiltersProps {
  currentParams: {
    tab?: string;
    search?: string;
    severity?: string;
    role?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  };
  onFilterChange: (params: Record<string, string | undefined>) => void;
  logs: AuditLogWithUser[];
  userRole?: string;
}

const SEVERITY_OPTIONS = [
  { value: "all", label: "All Severities" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "service_manager", label: "Service Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "operator", label: "Operator" },
  { value: "system", label: "System / Automated" },
];

export function AuditFilters({
  currentParams,
  onFilterChange,
  logs,
}: AuditFiltersProps) {
  const [search, setSearch] = useState(currentParams.search || "");
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      currentParams.role ||
        currentParams.dateRange === "custom" ||
        currentParams.startDate ||
        currentParams.endDate
    )
  );

  const hasActiveFilters = Boolean(
    currentParams.search ||
      (currentParams.severity && currentParams.severity !== "all") ||
      (currentParams.role && currentParams.role !== "all") ||
      (currentParams.dateRange && currentParams.dateRange !== "all") ||
      currentParams.startDate ||
      currentParams.endDate
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ search: search.trim() || undefined });
  };

  const handleSearchClear = () => {
    setSearch("");
    onFilterChange({ search: undefined });
  };

  const handleResetAll = () => {
    setSearch("");
    onFilterChange({
      search: undefined,
      severity: undefined,
      role: undefined,
      dateRange: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  // Quick CSV Export for current tab
  const handleExportCsv = () => {
    if (!logs || logs.length === 0) return;

    const headers = [
      "ID",
      "Timestamp",
      "Action",
      "Category",
      "Severity",
      "Actor Name",
      "Actor Role",
      "Target Entity Type",
      "Target Entity ID",
      "Target Entity Name",
      "IP Address",
    ];

    const rows = logs.map((log) => [
      log.id,
      new Date(log.created_at).toISOString(),
      `"${(log.action || "").replace(/"/g, '""')}"`,
      log.category || "",
      log.severity || "info",
      `"${(log.actor_name || log.user?.full_name || "System").replace(/"/g, '""')}"`,
      log.actor_role || log.user?.role || "system",
      log.entity_type || "",
      log.entity_id || "",
      `"${(log.entity_name || "").replace(/"/g, '""')}"`,
      log.ip_address || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `audit_${currentParams.tab || "logs"}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3">
      {/* Primary Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[220px] max-w-md relative">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search action, actor, machine, employee, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs"
            />
            <AnimatedSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none" />
            {search && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              >
                <AnimatedX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Severity Selector */}
        <div className="w-36">
          <Select
            value={currentParams.severity || "all"}
            onChange={(e) =>
              onFilterChange({
                severity: e.target.value === "all" ? undefined : e.target.value,
              })
            }
            options={SEVERITY_OPTIONS}
            className="h-9 text-xs"
          />
        </div>

        {/* Date Range Selector */}
        <div className="w-36">
          <Select
            value={currentParams.dateRange || "all"}
            onChange={(e) => {
              const val = e.target.value;
              if (val !== "custom") {
                onFilterChange({
                  dateRange: val === "all" ? undefined : val,
                  startDate: undefined,
                  endDate: undefined,
                });
              } else {
                setShowAdvanced(true);
                onFilterChange({ dateRange: "custom" });
              }
            }}
            options={DATE_RANGE_OPTIONS}
            className="h-9 text-xs"
          />
        </div>

        {/* Advanced Filters Toggle */}
        <Button
          type="button"
          variant={showAdvanced ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="h-9 gap-1.5 text-xs"
        >
          <AnimatedSlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
        </Button>

        {/* Export Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={logs.length === 0}
          className="h-9 gap-1.5 text-xs ml-auto"
        >
          <AnimatedDownload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetAll}
            className="h-9 text-xs gap-1 text-[var(--color-mute)] hover:text-[var(--color-ink)]"
          >
            <AnimatedRotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </Button>
        )}
      </div>

      {/* Advanced Filter Row (Expandable) */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-[var(--color-canvas-subtle)] border border-[var(--color-hairline)] rounded-[var(--radius-sm)] text-xs">
          {/* Actor Role Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-subtle)] font-medium">Actor Role:</span>
            <div className="w-40">
              <Select
                value={currentParams.role || "all"}
                onChange={(e) =>
                  onFilterChange({
                    role: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                options={ROLE_OPTIONS}
                className="h-8 text-xs bg-[var(--color-canvas)]"
              />
            </div>
          </div>

          {/* Custom Date Inputs if custom range selected */}
          {currentParams.dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-subtle)] font-medium">From:</span>
              <Input
                type="date"
                value={currentParams.startDate || ""}
                onChange={(e) =>
                  onFilterChange({ startDate: e.target.value || undefined })
                }
                className="h-8 text-xs w-36 bg-[var(--color-canvas)]"
              />
              <span className="text-[var(--color-subtle)] font-medium">To:</span>
              <Input
                type="date"
                value={currentParams.endDate || ""}
                onChange={(e) =>
                  onFilterChange({ endDate: e.target.value || undefined })
                }
                className="h-8 text-xs w-36 bg-[var(--color-canvas)]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
