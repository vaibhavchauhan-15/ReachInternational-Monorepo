"use client";

import React from "react";
import { Modal, Button } from "@/components/ui";
import { Send, AlertTriangle, Layers, Clock, Building2 } from "lucide-react";

interface SubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  summary: {
    machineCode: string;
    machineModel?: string | null;
    clientName: string;
    site: string;
    logDate: string;
    startTime: string;
    endTime: string;
    startMeter: number;
    endMeter: number;
    runningHours: number;
    overtimeHours: number;
    isBreakdown: boolean;
    breakdownDuration?: string | null;
  };
}

export function SubmitConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  submitting,
  summary,
}: SubmitConfirmModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Confirm Shift Log Submission"
      description="Please verify your shift meter readings and timings before final submission."
      preventAutoFocus={true}
    >
      <div className="space-y-4">
        {/* Machine & Client Summary */}
        <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
              <Layers className="h-3.5 w-3.5 text-sky-500" />
              <span>Equipment:</span>
            </div>
            <span className="font-bold text-[var(--color-ink)]">
              {summary.machineModel ? `${summary.machineModel} (${summary.machineCode})` : summary.machineCode}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
              <Building2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Client / Site:</span>
            </div>
            <span className="font-semibold text-[var(--color-ink)] truncate max-w-[200px]" title={summary.site}>
              {summary.clientName} ({summary.site})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
              <Clock className="h-3.5 w-3.5 text-[var(--color-link)]" />
              <span>Shift Window:</span>
            </div>
            <span className="font-mono font-bold text-[var(--color-ink)]">
              {summary.logDate} • {summary.startTime} – {summary.endTime}
            </span>
          </div>
        </div>

        {/* Meters & Running Hours Highlight Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
            <p className="text-[10px] text-[var(--color-mute)] font-medium">Start Meter</p>
            <p className="text-sm font-mono font-bold text-[var(--color-ink)] mt-0.5">
              {summary.startMeter.toFixed(1)}
            </p>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
            <p className="text-[10px] text-[var(--color-mute)] font-medium">End Meter</p>
            <p className="text-sm font-mono font-bold text-[var(--color-ink)] mt-0.5">
              {summary.endMeter.toFixed(1)}
            </p>
          </div>

          <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Running Time</p>
            <p className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              +{summary.runningHours.toFixed(1)}h
            </p>
          </div>
        </div>

        {summary.isBreakdown && summary.breakdownDuration && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              Breakdown Duration:
            </span>
            <span className="font-mono font-bold">{summary.breakdownDuration}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="text-xs"
          >
            Edit Values
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            loading={submitting}
            icon={<Send className="h-3.5 w-3.5" />}
            className="text-xs font-semibold"
          >
            Confirm &amp; Submit Log
          </Button>
        </div>
      </div>
    </Modal>
  );
}
