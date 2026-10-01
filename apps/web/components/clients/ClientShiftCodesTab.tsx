"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Button, TooltipWrapper, EmptyState, useToast } from "@/components/ui";
import {
  upsertClientShiftCodeAction,
  deleteClientShiftCodeAction,
  applyClientShiftPresetAction,
} from "@/app/actions/clients";
import type { ClientShiftCode } from "@reachinternational/types";
import { formatTo12Hour, CLIENT_SHIFT_PRESETS } from "@reachinternational/utils";
import { invalidateClientShiftsCache } from "@/lib/cache/client-shifts-cache";

export interface ClientShiftCodesTabProps {
  clientId: string;
  clientName: string;
  initialShiftCodes?: ClientShiftCode[];
  canManage?: boolean;
}

export function ClientShiftCodesTab({
  clientId,
  clientName,
  initialShiftCodes = [],
  canManage = true,
}: ClientShiftCodesTabProps) {
  const { toast } = useToast();
  const [shiftCodes, setShiftCodes] = useState<ClientShiftCode[]>(initialShiftCodes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ClientShiftCode | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [scheduledMinutes, setScheduledMinutes] = useState(480);
  const [normalMinutes, setNormalMinutes] = useState(480);
  const [crossesMidnight, setCrossesMidnight] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Calculate durations whenever start/end times change
  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);

    if (newStart && newEnd) {
      const [sH, sM] = newStart.split(":").map(Number);
      const [eH, eM] = newEnd.split(":").map(Number);
      let diff = (eH * 60 + eM) - (sH * 60 + sM);
      const isOvernight = diff <= 0;
      if (diff <= 0) {
        diff += 1440; // 24 hours in minutes
      }
      setCrossesMidnight(isOvernight);
      setScheduledMinutes(diff);
      // If normal minutes was previously equal to scheduled or default 480, adjust sensibly
      if (diff <= 480) {
        setNormalMinutes(diff);
      } else {
        // e.g. 12-hour shift: 480 normal minutes (8h) + remainder OT
        setNormalMinutes(480);
      }
    }
  };

  const openCreateModal = () => {
    setEditingShift(null);
    setCode(
      shiftCodes.length === 0
        ? "A"
        : shiftCodes.length === 1
        ? "B"
        : shiftCodes.length === 2
        ? "C"
        : String.fromCharCode(65 + shiftCodes.length)
    );
    setName("");
    setStartTime("06:00");
    setEndTime("14:00");
    setScheduledMinutes(480);
    setNormalMinutes(480);
    setCrossesMidnight(false);
    setDisplayOrder((shiftCodes.length + 1) * 10);
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (shift: ClientShiftCode) => {
    setEditingShift(shift);
    setCode(shift.code);
    setName(shift.name || "");
    // Extract HH:mm from ISO or time string
    const parseTime = (t: string) => (t && t.length >= 5 ? t.slice(0, 5) : t);
    setStartTime(parseTime(shift.start_time));
    setEndTime(parseTime(shift.end_time));
    setScheduledMinutes(shift.scheduled_minutes);
    setNormalMinutes(shift.normal_minutes);
    setCrossesMidnight(shift.crosses_midnight);
    setDisplayOrder(shift.display_order ?? 0);
    setIsActive(shift.is_active);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setFormError("Shift code is required (e.g. A, B, C).");
      return;
    }
    if (!startTime || !endTime) {
      setFormError("Both start time and end time are required.");
      return;
    }
    if (normalMinutes > scheduledMinutes) {
      setFormError("Normal working minutes cannot exceed total scheduled minutes.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      id: editingShift?.id,
      clientId,
      code: code.trim().toUpperCase(),
      name: name.trim() || `Shift ${code.trim().toUpperCase()}`,
      startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
      endTime: endTime.length === 5 ? `${endTime}:00` : endTime,
      scheduledMinutes: Number(scheduledMinutes),
      normalMinutes: Number(normalMinutes),
      crossesMidnight: Boolean(crossesMidnight),
      displayOrder: Number(displayOrder || 0),
      isActive: Boolean(isActive),
    };

    const res = await upsertClientShiftCodeAction(payload);
    setIsSubmitting(false);

    if (res.success && res.data) {
      const saved = res.data as ClientShiftCode;
      setShiftCodes((prev) => {
        const exists = prev.some((s) => s.id === saved.id);
        if (exists) {
          return prev.map((s) => (s.id === saved.id ? saved : s));
        }
        return [...prev, saved].sort((a, b) => a.display_order - b.display_order);
      });
      setIsModalOpen(false);
      invalidateClientShiftsCache(clientId);
      toast("success", `Shift ${saved.code} saved successfully.`);
    } else {
      setFormError(res.error || "Failed to save shift code.");
      toast("error", res.error || "Failed to save shift code.");
    }
  };

  const handleDeleteShift = async (shiftId: string, shiftCodeName: string) => {
    setIsDeleting(shiftId);
    const res = await deleteClientShiftCodeAction(shiftId, clientId);
    setIsDeleting(null);
    setDeleteConfirmId(null);

    if (res.success) {
      setShiftCodes((prev) => prev.filter((s) => s.id !== shiftId));
      invalidateClientShiftsCache(clientId);
      toast("success", `Shift ${shiftCodeName} removed successfully.`);
    } else {
      toast("error", res.error || "Failed to delete shift code.");
    }
  };

  const [isApplyingPreset, setIsApplyingPreset] = useState<string | null>(null);

  const handleApplyPreset = async (presetId: string, mode: "replace" | "append" = "replace") => {
    setIsApplyingPreset(presetId);
    const res = await applyClientShiftPresetAction(clientId, presetId, mode);
    setIsApplyingPreset(null);

    if (res.success && res.data) {
      setShiftCodes(res.data as ClientShiftCode[]);
      invalidateClientShiftsCache(clientId);
      const preset = CLIENT_SHIFT_PRESETS.find((p) => p.id === presetId);
      toast("success", `Shift preset "${preset?.name || presetId}" applied successfully.`);
    } else {
      toast("error", res.error || "Failed to apply preset.");
    }
  };

  const formatHours = (minutes: number) => {
    const hrs = minutes / 60;
    return hrs % 1 === 0 ? `${hrs}h` : `${hrs.toFixed(1)}h`;
  };

  return (
    <div className="space-y-4">
      {/* ─── Header & Add Action ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--color-hairline)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">
              Operational Shift Templates
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              {shiftCodes.length} {shiftCodes.length === 1 ? "Shift" : "Shifts"}
            </span>
          </div>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Configured shift windows (A/B/C) and built-in overtime policies for {clientName}. Active machine assignments dynamically reflect these shifts.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={openCreateModal}
              size="sm"
              className="self-start sm:self-auto gap-1.5 font-bold shadow-xs active:scale-95"
            >
              <Plus size={14} />
              <span>Add Shift Code</span>
            </Button>
          </div>
        )}
      </div>

      {/* ─── Shift Codes List / Empty State with 1-Click Presets ─── */}
      {shiftCodes.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 space-y-4">
          <div className="text-center max-w-lg mx-auto space-y-1.5">
            <div className="inline-flex p-3 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-1 border border-sky-500/20">
              <Sparkles size={22} />
            </div>
            <h4 className="text-sm font-bold text-[var(--color-ink)]">
              Configure Operational Shifts for {clientName}
            </h4>
            <p className="text-xs text-[var(--color-mute)] leading-relaxed">
              Standardize shift selection for operators and supervisors. Click any 1-click industry template below to provision immediately, or configure custom timings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {CLIENT_SHIFT_PRESETS.filter((p) => p.shifts.length > 0).map((preset) => {
              const isThisApplying = isApplyingPreset === preset.id;
              return (
                <div
                  key={preset.id}
                  data-hover-parent
                  className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-xs space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                        {preset.badge}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-[var(--color-ink)] leading-snug">
                      {preset.name}
                    </h5>
                    <p className="text-[11px] text-[var(--color-mute)] leading-relaxed">
                      {preset.description}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1.5 border-t border-[var(--color-hairline)]">
                      {preset.shifts.map((s) => (
                        <span
                          key={s.code}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)]"
                        >
                          <strong className="text-sky-600 dark:text-sky-400">{s.code}:</strong>
                          <span>{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</span>
                          {s.crossesMidnight && <Moon size={9} className="text-purple-500 shrink-0" />}
                        </span>
                      ))}
                    </div>
                  </div>

                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      loading={isThisApplying}
                      disabled={Boolean(isApplyingPreset)}
                      onClick={() => handleApplyPreset(preset.id, "replace")}
                      className="w-full text-xs font-bold gap-1 mt-2"
                    >
                      <Sparkles size={12} />
                      <span>1-Click Apply</span>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {canManage && (
            <div className="text-center pt-2 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openCreateModal}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus size={13} />
                <span>Configure Custom Shift Manually</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {shiftCodes.map((shift) => {
            const builtInOt = Math.max(0, shift.scheduled_minutes - shift.normal_minutes);
            const isDeletingThis = isDeleting === shift.id;
            const isConfirmingDelete = deleteConfirmId === shift.id;

            return (
              <div
                key={shift.id}
                data-hover-parent
                className={`rounded-xl border p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                  shift.is_active
                    ? "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-sky-500/40 shadow-2xs"
                    : "bg-[var(--color-canvas)] border-[var(--color-hairline)]/60 opacity-75"
                }`}
              >
                {/* Top Badge & Code */}
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg font-mono font-extrabold text-sm bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        {shift.code}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-[var(--color-ink)] leading-snug">
                          {shift.name || `Shift ${shift.code}`}
                        </h4>
                        <span className="text-[10px] text-[var(--color-mute)] font-mono">
                          Order #{shift.display_order}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {shift.crosses_midnight && (
                        <TooltipWrapper content="Shift crosses midnight into the next calendar day (+1d)">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <Moon size={10} />
                            <span>+1d</span>
                          </span>
                        </TooltipWrapper>
                      )}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          shift.is_active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-[var(--color-hairline)] text-[var(--color-mute)]"
                        }`}
                      >
                        {shift.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  {/* Shift Timing Strip */}
                  <div className="mt-3 p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]/70">
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-[var(--color-ink)]">
                      <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                        <Clock size={13} />
                        <span>{formatTo12Hour(shift.start_time) || shift.start_time}</span>
                      </div>
                      <ArrowRight size={12} className="text-[var(--color-mute)]" />
                      <div>
                        <span>{formatTo12Hour(shift.end_time) || shift.end_time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hour Breakdown Metrics */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-md bg-[var(--color-hairline-soft-surface)]">
                      <span className="text-[9px] uppercase tracking-wider text-[var(--color-mute)] block font-semibold">
                        Scheduled
                      </span>
                      <span className="text-xs font-mono font-bold text-[var(--color-ink)]">
                        {formatHours(shift.scheduled_minutes)}
                      </span>
                    </div>
                    <div className="p-2 rounded-md bg-sky-500/5 border border-sky-500/10">
                      <span className="text-[9px] uppercase tracking-wider text-sky-600 dark:text-sky-400 block font-semibold">
                        Normal
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                        {formatHours(shift.normal_minutes)}
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-md border ${
                        builtInOt > 0
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-[var(--color-hairline-soft-surface)] border-transparent text-[var(--color-mute)]"
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider block font-semibold">
                        Built-in OT
                      </span>
                      <span className="text-xs font-mono font-bold">
                        {builtInOt > 0 ? `+${formatHours(builtInOt)}` : "0h"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                {canManage && (
                  <div className="mt-4 pt-2.5 border-t border-[var(--color-hairline)] flex items-center justify-between gap-2">
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-2 w-full justify-between animate-in fade-in duration-200">
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          Confirm deletion?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteShift(shift.id, shift.code)}
                            disabled={isDeletingThis}
                            className="h-7 px-2 text-xs"
                          >
                            {isDeletingThis ? "Deleting..." : "Delete"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setDeleteConfirmId(null)}
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="text-[10px] text-[var(--color-mute)]">
                          {builtInOt > 0 ? "Includes standard OT" : "Standard 8h shift"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditModal(shift)}
                            className="h-7 w-7 p-0"
                            title="Edit Shift"
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setDeleteConfirmId(shift.id)}
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete Shift"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add / Edit Shift Modal ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 sm:p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline)]">
              <div>
                <h3 className="text-base font-bold text-[var(--color-ink)]">
                  {editingShift ? `Edit Shift ${editingShift.code}` : "Configure New Shift"}
                </h3>
                <p className="text-xs text-[var(--color-mute)]">
                  Define shift timings and normal vs overtime working hours
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline)] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="mt-4 space-y-4">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Shift Code & Name */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="A"
                    className="w-full h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono font-bold text-center uppercase focus:outline-hidden focus:border-sky-500 text-sm"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Shift Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`Shift ${code || "A"}`}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] text-xs focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleTimeChange(e.target.value, endTime)}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono text-xs focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    End Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleTimeChange(startTime, e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono text-xs focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              {/* Calculated Timing & Midnight flag */}
              <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-mute)] font-medium">Scheduled Duration:</span>
                  <span className="font-mono font-bold text-[var(--color-ink)]">
                    {formatHours(scheduledMinutes)} ({scheduledMinutes} mins)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-mute)] font-medium">Crosses Midnight (+1d):</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={crossesMidnight}
                      onChange={(e) => setCrossesMidnight(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-[var(--color-ink)]">
                      {crossesMidnight ? "Yes (Overnight)" : "No"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Normal vs Overtime Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Normal Working Hours
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={scheduledMinutes}
                      step={30}
                      value={normalMinutes}
                      onChange={(e) => setNormalMinutes(Number(e.target.value))}
                      className="w-full h-9 px-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono text-xs focus:outline-hidden focus:border-sky-500"
                    />
                    <span className="text-[10px] text-[var(--color-mute)] font-mono whitespace-nowrap">
                      {formatHours(normalMinutes)}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5 block">
                    e.g. 480 mins = 8h
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Built-in Overtime
                  </label>
                  <div className="h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-center font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                    +{formatHours(Math.max(0, scheduledMinutes - normalMinutes))}
                  </div>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5 block">
                    Auto-derived portion
                  </span>
                </div>
              </div>

              {/* Display Order & Active */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--color-hairline)]">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono text-xs focus:outline-hidden focus:border-sky-500"
                  />
                </div>
                <div className="flex flex-col justify-center pt-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-[var(--color-ink)]">
                      Active Shift
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingShift ? "Update Shift" : "Create Shift"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
