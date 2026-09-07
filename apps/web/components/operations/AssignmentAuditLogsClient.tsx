"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AnimatedSearch,
  AnimatedScrollText,
  AnimatedClock,
  AnimatedCheckCircle,
  AnimatedX,
  AnimatedArrowLeft,
  AnimatedBuilding2,
  AnimatedUserCheck,
} from "@/components/ui/animated-icons";
import { Badge, Button } from "@/components/ui";
import { formatDate, formatExactTimestamp, formatTo12Hour, parseTimeToMinutes } from "@reachinternational/utils";
import {
  Clock,
  Sun,
  Moon,
  ShieldCheck,
  Phone,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  RotateCcw,
  Users,
  Building,
  CheckCircle2,
  XCircle,
  Star,
} from "lucide-react";
import type { AssignmentAuditRecord } from "@/lib/queries/assignments";

interface AssignmentAuditLogsClientProps {
  initialRecords: AssignmentAuditRecord[];
  metrics: {
    total: number;
    active: number;
    ended: number;
    overnight: number;
    uniqueMachines: number;
  };
}

export function AssignmentAuditLogsClient({
  initialRecords,
  metrics,
}: AssignmentAuditLogsClientProps) {
  const router = useRouter();

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ended">("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | "day" | "overnight">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  const filteredRecords = useMemo(() => {
    return initialRecords.filter((rec) => {
      // 1. Status filter
      if (statusFilter === "active" && !rec.is_active) return false;
      if (statusFilter === "ended" && rec.is_active) return false;

      // 2. Shift type filter
      const isOvernight =
        rec.crosses_midnight ||
        (parseTimeToMinutes(rec.shift_end_time) ?? 0) <= (parseTimeToMinutes(rec.shift_start_time) ?? 0);
      if (shiftFilter === "day" && isOvernight) return false;
      if (shiftFilter === "overnight" && !isOvernight) return false;

      // 3. Reason filter
      if (reasonFilter !== "all") {
        if (!rec.end_reason || rec.end_reason.toLowerCase() !== reasonFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const machCode = rec.machine?.machine_code?.toLowerCase() || "";
      const machName = rec.machine?.machine_name?.toLowerCase() || "";
      const model = rec.machine?.model?.toLowerCase() || "";
      const serial = rec.machine?.serial_number?.toLowerCase() || "";
      const opName = rec.operator?.full_name?.toLowerCase() || "";
      const opPhone = rec.operator?.phone?.toLowerCase() || "";
      const assigner = rec.assigner?.full_name?.toLowerCase() || "";
      const ender = rec.ender?.full_name?.toLowerCase() || "";
      const reason = rec.end_reason?.toLowerCase() || "";
      const clientName = rec.machine?.client?.company_name?.toLowerCase() || "";

      return (
        machCode.includes(q) ||
        machName.includes(q) ||
        model.includes(q) ||
        serial.includes(q) ||
        opName.includes(q) ||
        opPhone.includes(q) ||
        assigner.includes(q) ||
        ender.includes(q) ||
        reason.includes(q) ||
        clientName.includes(q)
      );
    });
  }, [initialRecords, searchQuery, statusFilter, shiftFilter, reasonFilter]);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      "Machine Code",
      "Model",
      "Serial Number",
      "Client",
      "Operator Name",
      "Operator Phone",
      "Shift Start",
      "Shift End",
      "Overnight",
      "Assigned Date",
      "Assigned By",
      "Ended Date",
      "Ended By",
      "End Reason",
      "Status",
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.machine?.machine_code || r.machine_id}"`,
      `"${r.machine?.model || ""}"`,
      `"${r.machine?.serial_number || ""}"`,
      `"${r.machine?.client?.company_name || ""}"`,
      `"${r.operator?.full_name || "Operator"}"`,
      `"${r.operator?.phone || ""}"`,
      `"${formatTo12Hour(r.shift_start_time)}"`,
      `"${formatTo12Hour(r.shift_end_time)}"`,
      r.crosses_midnight ? "Yes" : "No",
      `"${r.assigned_at ? formatDate(r.assigned_at) : ""}"`,
      `"${r.assigner?.full_name || ""}"`,
      `"${r.ended_at ? formatDate(r.ended_at) : ""}"`,
      `"${r.ender?.full_name || ""}"`,
      `"${r.end_reason || ""}"`,
      r.is_active ? "Active" : "Ended",
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `assignment_audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const calculateDuration = (startTime: string, endTime: string): string => {
    const s = parseTimeToMinutes(startTime);
    const e = parseTimeToMinutes(endTime);
    if (s === null || e === null) return "";
    let diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return `${hours}h 00m`;
    return `${hours}h ${mins.toString().padStart(2, "0")}m`;
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header with Breadcrumb & Top Actions */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/operations?tab=assignments"
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
              >
                <AnimatedArrowLeft size={13} />
                <span>Back to Shift Roster</span>
              </Link>
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedScrollText size={20} className="text-sky-600 dark:text-sky-400" />
              <span>Assignment History & Audit Logs</span>
            </h1>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              Comprehensive chronological audit trail of operator equipment assignments, shift schedules, reassignments, and closures.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--color-ink)]" />
              <span>Print</span>
            </Button>
          </div>
        </div>

        {/* 2. Top Tab Navigation Strip (Unified with Operations Hub) */}
        <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] pb-2 overflow-x-auto custom-scrollbar">
          <Link
            href="/operations?tab=logs"
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Daily Running Hours</span>
          </Link>

          <Link
            href="/operations?tab=assignments"
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] whitespace-nowrap"
          >
            <Star className="w-3.5 h-3.5" />
            <span>Operator Machine Assignments</span>
          </Link>

          <div className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs whitespace-nowrap cursor-default">
            <AnimatedScrollText size={14} />
            <span>Assignment Audit Logs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-400/30">
              {metrics.total}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
            Total Records
          </div>
          <div className="text-xl font-extrabold text-[var(--color-ink)] font-mono">
            {metrics.total}
          </div>
          <div className="text-[10px] text-[var(--color-mute)]">
            Across {metrics.uniqueMachines} machines
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active Shifts
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {metrics.active}
          </div>
          <div className="text-[10px] text-[var(--color-mute)]">
            Currently deployed
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Ended / Reassigned
          </div>
          <div className="text-xl font-extrabold text-[var(--color-ink)] font-mono">
            {metrics.ended}
          </div>
          <div className="text-[10px] text-[var(--color-mute)]">
            Historical closures
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
            <Moon className="w-3.5 h-3.5" /> Overnight Shifts
          </div>
          <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
            {metrics.overnight}
          </div>
          <div className="text-[10px] text-[var(--color-mute)]">
            Spanning midnight
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <AnimatedSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by machine, operator, supervisor, or reason..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[var(--color-faint)] focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            >
              <AnimatedX size={14} />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center rounded-xl border border-[var(--color-hairline)] p-0.5 bg-[var(--color-canvas)] text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ended")}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "ended"
                  ? "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              Ended
            </button>
          </div>

          {/* Shift Filter */}
          <div className="flex items-center rounded-xl border border-[var(--color-hairline)] p-0.5 bg-[var(--color-canvas)] text-xs font-bold">
            <button
              type="button"
              onClick={() => setShiftFilter("all")}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                shiftFilter === "all"
                  ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              All Shifts
            </button>
            <button
              type="button"
              onClick={() => setShiftFilter("day")}
              className={`px-2 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                shiftFilter === "day"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Sun className="w-3 h-3 text-amber-500" /> Day
            </button>
            <button
              type="button"
              onClick={() => setShiftFilter("overnight")}
              className={`px-2 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                shiftFilter === "overnight"
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Moon className="w-3 h-3 text-indigo-500" /> Overnight
            </button>
          </div>

          {/* Reset Filters */}
          {(searchQuery || statusFilter !== "all" || shiftFilter !== "all" || reasonFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setShiftFilter("all");
                setReasonFilter("all");
              }}
              className="text-xs font-bold text-[var(--color-mute)] hover:text-[var(--color-ink)] flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* 5. Results Counter */}
      <div className="flex items-center justify-between text-xs text-[var(--color-mute)] px-1">
        <span>
          Showing <strong className="text-[var(--color-ink)]">{filteredRecords.length}</strong> of{" "}
          {initialRecords.length} recorded assignments
        </span>
      </div>

      {/* 6. Authoritative High-Density Desktop Data Table (hidden sm:block) */}
      <div className="hidden sm:block rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
              <tr>
                <th className="px-4 py-3.5">Machine</th>
                <th className="px-4 py-3.5">Assigned Operator</th>
                <th className="px-4 py-3.5">Shift Window</th>
                <th className="px-4 py-3.5">Assigned Timeline</th>
                <th className="px-4 py-3.5">End / Closure Info</th>
                <th className="px-4 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-mute)]">
                    <div className="max-w-sm mx-auto space-y-2">
                      <AnimatedScrollText size={32} className="mx-auto text-[var(--color-faint)]" />
                      <p className="font-bold text-sm text-[var(--color-ink)]">No assignment audit records found</p>
                      <p className="text-xs">
                        Try adjusting your search query, status filters, or shift window selections.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((ass) => {
                  const isOvernight =
                    ass.crosses_midnight ||
                    (parseTimeToMinutes(ass.shift_end_time) ?? 0) <= (parseTimeToMinutes(ass.shift_start_time) ?? 0);
                  const durationStr = calculateDuration(ass.shift_start_time, ass.shift_end_time);

                  return (
                    <tr
                      key={ass.id}
                      className="hover:bg-[var(--color-hairline-soft)] transition-colors group"
                    >
                      {/* 1. Machine Details */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-extrabold text-[var(--color-ink)] text-sm">
                          {ass.machine?.machine_code || ass.machine_id}
                        </div>
                        {ass.machine?.model && (
                          <div className="text-[11px] text-[var(--color-mute)]">
                            {ass.machine.model}
                          </div>
                        )}
                        {ass.machine?.client?.company_name && (
                          <div className="text-[10px] text-[var(--color-mute)] flex items-center gap-1 mt-0.5 font-medium">
                            <Building className="w-3 h-3 text-[var(--color-faint)] shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {ass.machine.client.company_name}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 2. Operator Details */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-extrabold text-[var(--color-ink)] text-sm flex items-center gap-1.5">
                          <AnimatedUserCheck size={14} className="text-sky-500 shrink-0" />
                          <span>{ass.operator?.full_name || "Unassigned Operator"}</span>
                        </div>
                        {ass.operator?.phone ? (
                          <a
                            href={`tel:${ass.operator.phone}`}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:underline mt-0.5"
                            title="Call operator"
                          >
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{ass.operator.phone}</span>
                          </a>
                        ) : (
                          <div className="text-[10px] text-[var(--color-faint)] font-mono mt-0.5">
                            No contact
                          </div>
                        )}
                      </td>

                      {/* 3. Shift Window & Duration */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-mono text-xs font-bold flex items-center gap-1.5">
                          {isOvernight ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                              <Moon className="w-3 h-3 text-indigo-500 shrink-0" />
                              {formatTo12Hour(ass.shift_start_time)} – {formatTo12Hour(ass.shift_end_time)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              <Sun className="w-3 h-3 text-amber-500 shrink-0" />
                              {formatTo12Hour(ass.shift_start_time)} – {formatTo12Hour(ass.shift_end_time)}
                            </span>
                          )}
                        </div>
                        {durationStr && (
                          <div className="text-[10px] font-mono text-[var(--color-mute)] mt-1 font-semibold">
                            Duration: {durationStr}
                          </div>
                        )}
                      </td>

                      {/* 4. Assigned Timeline & Assigner */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-mono text-xs text-[var(--color-ink)] font-semibold">
                          {formatDate(ass.assigned_at)}
                        </div>
                        <div className="text-[11px] text-[var(--color-mute)] mt-0.5">
                          By: <strong className="text-[var(--color-ink)] font-medium">{ass.assigner?.full_name || "Supervisor"}</strong>
                        </div>
                      </td>

                      {/* 5. End / Closure Info */}
                      <td className="px-4 py-3.5 align-top">
                        {ass.ended_at ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs text-[var(--color-mute)]">
                              Ended: {formatDate(ass.ended_at)}
                            </div>
                            {ass.ender && (
                              <div className="text-[11px] text-[var(--color-mute)]">
                                By: <strong className="text-[var(--color-ink)] font-medium">{ass.ender.full_name}</strong>
                              </div>
                            )}
                            {ass.end_reason && (
                              <div className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 capitalize border border-neutral-200 dark:border-neutral-800">
                                {ass.end_reason.replace(/_/g, " ")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Currently Active
                          </div>
                        )}
                      </td>

                      {/* 6. Status Badge */}
                      <td className="px-4 py-3.5 align-top text-right">
                        {ass.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="inactive">Ended</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Mobile Touch Card Reflow (block sm:hidden) */}
      <div className="block sm:hidden space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-mute)]">
            <AnimatedScrollText size={28} className="mx-auto text-[var(--color-faint)] mb-2" />
            <p className="font-bold text-sm text-[var(--color-ink)]">No assignment records</p>
            <p className="text-xs mt-1">Try resetting your filters.</p>
          </div>
        ) : (
          filteredRecords.map((ass) => {
            const isOvernight =
              ass.crosses_midnight ||
              (parseTimeToMinutes(ass.shift_end_time) ?? 0) <= (parseTimeToMinutes(ass.shift_start_time) ?? 0);
            const durationStr = calculateDuration(ass.shift_start_time, ass.shift_end_time);

            return (
              <div
                key={ass.id}
                className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs space-y-3"
              >
                {/* Header: Machine & Status */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[var(--color-hairline)]">
                  <div>
                    <div className="font-extrabold text-sm text-[var(--color-ink)]">
                      {ass.machine?.machine_code || ass.machine_id}
                    </div>
                    {ass.machine?.model && (
                      <div className="text-xs text-[var(--color-mute)]">
                        {ass.machine.model}
                      </div>
                    )}
                  </div>
                  <div>
                    {ass.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="inactive">Ended</Badge>
                    )}
                  </div>
                </div>

                {/* Operator Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-sm text-[var(--color-ink)] flex items-center gap-1.5">
                    <AnimatedUserCheck size={15} className="text-sky-500 shrink-0" />
                    <span>{ass.operator?.full_name || "Operator"}</span>
                  </div>
                  {ass.operator?.phone && (
                    <a
                      href={`tel:${ass.operator.phone}`}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                  )}
                </div>

                {/* Shift Timing Strip */}
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {isOvernight ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-mono">
                        <Moon className="w-3 h-3 text-indigo-500" /> Overnight
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-mono">
                        <Sun className="w-3 h-3 text-amber-500" /> Day
                      </span>
                    )}
                    <span className="font-mono font-bold text-[var(--color-ink)]">
                      {formatTo12Hour(ass.shift_start_time)} – {formatTo12Hour(ass.shift_end_time)}
                    </span>
                  </div>
                  {durationStr && (
                    <span className="font-mono text-[10px] text-[var(--color-mute)] font-semibold">
                      {durationStr}
                    </span>
                  )}
                </div>

                {/* Assigned & Closure Details */}
                <div className="text-xs space-y-1 text-[var(--color-mute)] pt-1">
                  <div className="flex items-center justify-between">
                    <span>Assigned:</span>
                    <strong className="text-[var(--color-ink)] font-mono">
                      {formatDate(ass.assigned_at)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Assigned by:</span>
                    <span className="text-[var(--color-ink)]">
                      {ass.assigner?.full_name || "Supervisor"}
                    </span>
                  </div>

                  {ass.ended_at && (
                    <>
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]">
                        <span>Ended:</span>
                        <strong className="text-[var(--color-ink)] font-mono">
                          {formatDate(ass.ended_at)}
                        </strong>
                      </div>
                      {ass.end_reason && (
                        <div className="flex items-center justify-between">
                          <span>End Reason:</span>
                          <span className="capitalize font-medium text-[var(--color-ink)]">
                            {ass.end_reason.replace(/_/g, " ")}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
