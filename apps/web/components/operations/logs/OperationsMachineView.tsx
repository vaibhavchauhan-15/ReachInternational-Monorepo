"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui";
import { ChevronDown, History } from "lucide-react";

export interface OperationsMachineViewProps {
  machine: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  totalFilteredRunHours: number;
  totalFilteredBreakdowns: number;
  onOpenHistoryModal?: () => void;
}

export const OperationsMachineView = React.memo(function OperationsMachineView({
  machine: activeMachineObj,
  isExpanded,
  onToggleExpand,
  totalFilteredRunHours,
  totalFilteredBreakdowns,
  onOpenHistoryModal,
}: OperationsMachineViewProps) {
  if (!activeMachineObj) return null;

  const model = activeMachineObj.model?.trim() || "";
  const serialNo = activeMachineObj.serial_number?.trim() || "";

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
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        className="flex items-center justify-between gap-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-extrabold text-[var(--color-ink)]">
            {model && serialNo ? (
              <>
                <span>{model}</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-[var(--color-mute)] ml-1.5">
                  ({serialNo})
                </span>
              </>
            ) : (
              model || serialNo || "Machine"
            )}
          </h3>
          <Badge
            variant={
              activeMachineObj.status === "active"
                ? "success"
                : activeMachineObj.status === "on_rent"
                ? "info"
                : activeMachineObj.status === "under_maintenance"
                ? "warning"
                : "neutral"
            }
            className="font-bold text-[10px]"
          >
            {activeMachineObj.status
              ? activeMachineObj.status.replace("_", " ").toUpperCase()
              : "ACTIVE"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {onOpenHistoryModal && (
            <button
              type="button"
              data-hover-parent
              onClick={(e) => {
                e.stopPropagation();
                onOpenHistoryModal();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold text-xs transition-colors shadow-2xs cursor-pointer"
              title="View machine running history and meter timeline on-demand"
            >
              <History size={14} className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>History</span>
            </button>
          )}
          <div className="p-1 rounded-lg hover:bg-[var(--color-canvas)] text-[var(--color-mute)] transition-colors inline-flex items-center justify-center">
            <ChevronDown
              size={16}
              className={`w-4 h-4 transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="machine-summary-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2.5 mt-2.5 border-t border-[var(--color-hairline)]">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">
                    Manufacturer
                  </span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {activeMachineObj.manufacturer || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">
                    Model
                  </span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {activeMachineObj.model || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">
                    Serial No / Code
                  </span>
                  <span className="font-bold font-mono text-[var(--color-ink)]">
                    {activeMachineObj.serial_number || activeMachineObj.machine_code || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">
                    Total Run Hours
                  </span>
                  <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
                    {Math.round(totalFilteredRunHours * 10) / 10} hrs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">
                    Breakdown Events
                  </span>
                  <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                    {totalFilteredBreakdowns} Events
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
