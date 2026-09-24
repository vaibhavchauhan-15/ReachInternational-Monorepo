"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Phone,
  Mail,
  Clock,
  Zap,
  AlertTriangle,
  FileText,
} from "lucide-react";

export interface OperationsOperatorViewProps {
  activeOperatorObj: any;
  activeOperatorName: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  totalFilteredRunHours: number;
  totalFilteredOtHours: number;
  totalFilteredBreakdowns: number;
  totalMatchingLogs: number;
}

export const OperationsOperatorView = React.memo(function OperationsOperatorView({
  activeOperatorObj,
  activeOperatorName,
  isExpanded,
  onToggleExpand,
  totalFilteredRunHours,
  totalFilteredOtHours,
  totalFilteredBreakdowns,
  totalMatchingLogs,
}: OperationsOperatorViewProps) {
  if (!activeOperatorName) return null;

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
              {activeOperatorName}
            </h3>
            <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[10px] sm:text-[11px] font-bold border border-sky-500/20 shrink-0">
              OPERATOR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-extrabold text-sky-600 dark:text-sky-400 text-xs sm:text-sm">
              {Math.round(totalFilteredRunHours * 10) / 10} hrs
            </span>
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
            key="operator-summary-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3 pt-3 border-t border-[var(--color-hairline)] space-y-3">
              {(activeOperatorObj?.phone || activeOperatorObj?.email) && (
                <div className="flex items-center gap-x-2 gap-y-1 text-xs text-[var(--color-mute)] flex-wrap">
                  {activeOperatorObj?.phone && (
                    <div
                      data-hover-parent
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--color-canvas)] border border-transparent hover:border-[var(--color-hairline)] transition-colors font-mono cursor-default"
                    >
                      <Phone size={14} className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-[var(--color-ink)]">{activeOperatorObj.phone}</span>
                    </div>
                  )}
                  {activeOperatorObj?.email && (
                    <div
                      data-hover-parent
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--color-canvas)] border border-transparent hover:border-[var(--color-hairline)] transition-colors cursor-default"
                    >
                      <Mail size={14} className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="text-[var(--color-ink)]">{activeOperatorObj.email}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 4 Summary Metrics Cards Grid in Operator Detail Box */}
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
                  <div className="text-base sm:text-lg font-extrabold font-mono text-[var(--color-ink)]">
                    {totalMatchingLogs}{" "}
                    <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">
                      {totalMatchingLogs === 1 ? "Record" : "Records"}
                    </span>
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
