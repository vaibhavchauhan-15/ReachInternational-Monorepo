"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui";
import {
  ChevronDown,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Clock,
  Zap,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";

export interface OperationsClientViewProps {
  activeClient: any;
  activeClientName: string;
  clientMachines: any[];
  clientAddress?: string;
  clientMobile?: string;
  clientEmail?: string;
  displayWorkingDays: number;
  selectedMonthLabel: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  totalFilteredRunHours: number;
  totalFilteredOtHours: number;
  totalFilteredBreakdowns: number;
  totalMatchingLogs: number;
  isLoadingLogs?: boolean;
}

export const OperationsClientView = React.memo(function OperationsClientView({
  activeClient,
  activeClientName,
  clientMachines,
  clientAddress,
  clientMobile,
  clientEmail,
  displayWorkingDays,
  selectedMonthLabel,
  isExpanded,
  onToggleExpand,
  totalFilteredRunHours,
  totalFilteredOtHours,
  totalFilteredBreakdowns,
  totalMatchingLogs,
  isLoadingLogs = false,
}: OperationsClientViewProps) {
  if (!activeClientName) return null;

  return (
    <div
      onClick={() => {
        if (!isExpanded) {
          onToggleExpand();
        }
      }}
      className={`p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-sm transition-all duration-200 ${
        !isExpanded ? "cursor-pointer" : ""
      }`}
    >
      {/* Header (always visible & clickable to toggle) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--color-ink)] tracking-tight truncate max-w-full">
              {activeClientName}
            </h3>
            
            <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[10px] sm:text-[11px] font-bold border border-sky-500/20 shrink-0">
              {clientMachines.length} {clientMachines.length === 1 ? "Machine" : "Machines"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-hairline)] font-mono text-xs font-extrabold">
              {Math.round(totalFilteredRunHours * 10) / 10} hrs
            </span>
            <Badge
              data-hover-parent
              variant="success"
              className="font-bold flex items-center gap-1.5 py-0.5 px-2.5 text-xs cursor-pointer select-none"
            >
              <Calendar size={14} className="w-3.5 h-3.5 shrink-0" />
              <span>
                {displayWorkingDays} Days ({selectedMonthLabel})
              </span>
            </Badge>
          </div>
          {isLoadingLogs && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-bold border border-sky-500/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Loading...</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-lg hover:bg-[var(--color-canvas)] text-[var(--color-mute)] transition-colors">
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible details & KPI grid */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="client-summary-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3 pt-3 border-t border-[var(--color-hairline)] space-y-3">
              {/* Clean Location & Contact Meta Strip */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-x-2 gap-y-1 text-xs text-[var(--color-mute)] flex-wrap">
                  {clientAddress && clientAddress !== "—" && (
                    <div
                      data-hover-parent
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--color-canvas)] border border-transparent hover:border-[var(--color-hairline)] transition-colors cursor-default"
                    >
                      <MapPin size={14} className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="text-[var(--color-ink)] font-medium">
                        {clientAddress}
                      </span>
                    </div>
                  )}
                  {clientMobile && clientMobile !== "—" && (
                    <div
                      data-hover-parent
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--color-canvas)] border border-transparent hover:border-[var(--color-hairline)] transition-colors font-mono cursor-default"
                    >
                      <Phone size={14} className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-[var(--color-ink)]">{clientMobile}</span>
                    </div>
                  )}
                  {clientEmail && clientEmail !== "—" && (
                    <div
                      data-hover-parent
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--color-canvas)] border border-transparent hover:border-[var(--color-hairline)] transition-colors cursor-default"
                    >
                      <Mail size={14} className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="text-[var(--color-ink)]">{clientEmail}</span>
                    </div>
                  )}
                </div>

                {/* Mobile Working Days Badge */}
                <div className="sm:hidden">
                  <Badge
                    data-hover-parent
                    variant="success"
                    className="font-bold flex items-center gap-1.5 py-0.5 px-2 text-[10px] cursor-pointer select-none"
                  >
                    <Calendar size={12} className="w-3 h-3 shrink-0" />
                    <span>
                      {displayWorkingDays} Days ({selectedMonthLabel})
                    </span>
                  </Badge>
                </div>
              </div>

              {/* 4 Summary Metrics Cards Grid in Client Detail Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-0.5">
                <div
                  data-hover-parent
                  className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] space-y-1 transition-colors cursor-default select-none"
                >
                  <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                    <Clock size={16} className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                      <span className="sm:hidden">Run</span>
                      <span className="hidden sm:inline">Run Hours</span>
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold font-mono text-sky-600 dark:text-sky-400">
                    {Math.round(totalFilteredRunHours * 10) / 10}{" "}
                    <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">
                      hrs
                    </span>
                  </div>
                </div>

                <div
                  data-hover-parent
                  className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] space-y-1 transition-colors cursor-default select-none"
                >
                  <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                    <Zap size={16} className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                      <span className="sm:hidden">OT</span>
                      <span className="hidden sm:inline">Overtime</span>
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {Math.round(totalFilteredOtHours * 10) / 10}{" "}
                    <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">
                      hrs
                    </span>
                  </div>
                </div>

                <div
                  data-hover-parent
                  className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] space-y-1 transition-colors cursor-default select-none"
                >
                  <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                    <AlertTriangle size={16} className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                      <span className="sm:hidden">Breakdown</span>
                      <span className="hidden sm:inline">Breakdowns</span>
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400">
                    {totalFilteredBreakdowns}{" "}
                    <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">
                      {totalFilteredBreakdowns === 1 ? "Event" : "Events"}
                    </span>
                  </div>
                </div>

                <div
                  data-hover-parent
                  className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] space-y-1 transition-colors cursor-default select-none"
                >
                  <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                    <FileText size={16} className="w-4 h-4 text-[var(--color-mute)] shrink-0" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                      Logs
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold font-mono text-[var(--color-ink)] flex items-center gap-1.5">
                    {isLoadingLogs ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-sans font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        <span>Loading...</span>
                      </span>
                    ) : (
                      <>
                        {totalMatchingLogs}{" "}
                        <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">
                          {totalMatchingLogs === 1 ? "Record" : "Records"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
