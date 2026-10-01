"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Clock,
  Moon,
  Sun,
  AlertCircle,
  Check,
  Plus,
  Trash2,
  Users,
  Search,
  ChevronDown,
} from "lucide-react";
import type { ClientShiftCode, ActiveOperatorOtherAssignment } from "@reachinternational/types";
import { getClientShiftCodesAction } from "@/app/actions/clients";
import { getActiveOperatorAssignmentsAction } from "@/app/actions/machines";
import { DEFAULT_CLIENT_SHIFTS } from "../operations/entry/ShiftInputs";
import { formatTo12Hour, parseTimeToMinutes } from "@reachinternational/utils";
import {
  getCachedClientShifts,
  setCachedClientShifts,
  CLIENT_SHIFTS_INVALIDATED_EVENT,
} from "@/lib/cache/client-shifts-cache";

export type { ActiveOperatorOtherAssignment };

function shiftToMinuteRanges(startStr: string, endStr: string): Array<[number, number]> {
  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);
  if (start === null || end === null || start === end) return [];
  if (start < end) {
    return [[start, end]];
  }
  return [[start, 1440], [0, end]];
}

function doRangesOverlap(ranges1: Array<[number, number]>, ranges2: Array<[number, number]>): boolean {
  for (const [s1, e1] of ranges1) {
    for (const [s2, e2] of ranges2) {
      if (Math.max(s1, s2) < Math.min(e1, e2)) {
        return true;
      }
    }
  }
  return false;
}

export interface OperatorShiftAssignmentItem {
  operatorId: string;
  operatorName: string;
  phone?: string | null;
  email?: string | null;
  shiftCode: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
}

export interface OperatorShiftRosterEditorProps {
  machineId: string;
  clientId?: string | null;
  allOperators: Array<{
    id: string;
    full_name: string;
    phone?: string | null;
    email?: string | null;
    shift_time?: string | null;
    shift_code?: string | null;
    shift_start_time?: string | null;
    shift_end_time?: string | null;
    role?: string | null;
    status?: string | null;
  }>;
  assignedOperators: OperatorShiftAssignmentItem[];
  onChange: (items: OperatorShiftAssignmentItem[]) => void;
  onErrorChange?: (hasError: boolean, errorMessage?: string) => void;
  clientShifts?: ClientShiftCode[];
  onShiftsLoaded?: (shifts: ClientShiftCode[]) => void;
  otherAssignments?: ActiveOperatorOtherAssignment[];
  disabled?: boolean;
  isLoadingOptions?: boolean;
}

export function OperatorShiftRosterEditor({
  machineId,
  clientId,
  allOperators,
  assignedOperators,
  onChange,
  onErrorChange,
  clientShifts: propClientShifts,
  onShiftsLoaded,
  otherAssignments: propOtherAssignments,
  disabled = false,
  isLoadingOptions = false,
}: OperatorShiftRosterEditorProps) {
  const [internalShifts, setInternalShifts] = useState<ClientShiftCode[]>(() => propClientShifts || DEFAULT_CLIENT_SHIFTS);
  const [internalOtherAssignments, setInternalOtherAssignments] = useState<ActiveOperatorOtherAssignment[]>(() => propOtherAssignments || []);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync propOtherAssignments when passed
  useEffect(() => {
    if (propOtherAssignments && propOtherAssignments.length > 0) {
      setInternalOtherAssignments(propOtherAssignments);
    }
  }, [propOtherAssignments]);

  // Lazy-load active operator assignments across fleet if not provided
  useEffect(() => {
    if (propOtherAssignments && propOtherAssignments.length > 0) return;
    let active = true;
    getActiveOperatorAssignmentsAction()
      .then((res) => {
        if (active && res.success && res.data) {
          setInternalOtherAssignments(res.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [propOtherAssignments]);

  // Sync propClientShifts when passed
  useEffect(() => {
    if (propClientShifts && propClientShifts.length > 0) {
      setInternalShifts(propClientShifts);
    }
  }, [propClientShifts]);

  // Fetch client shifts when clientId changes (if prop not provided)
  useEffect(() => {
    if (propClientShifts && propClientShifts.length > 0) return;
    let active = true;
    if (clientId) {
      const cached = getCachedClientShifts(clientId);
      if (cached && cached.length > 0) {
        setInternalShifts(cached);
        onShiftsLoaded?.(cached);
      } else {
        getClientShiftCodesAction(clientId)
          .then((res) => {
            if (!active) return;
            if (res.success && res.data && res.data.length > 0) {
              const formatted: ClientShiftCode[] = res.data
                .filter((s: any) => s.is_active !== false)
                .map((s: any) => ({
                  ...s,
                  raw_start_time: formatTo12Hour(s.start_time) || s.start_time,
                  raw_end_time: formatTo12Hour(s.end_time) || s.end_time,
                  start_time: formatTo12Hour(s.start_time) || s.start_time,
                  end_time: formatTo12Hour(s.end_time) || s.end_time,
                }));
              const result = formatted.length > 0 ? formatted : DEFAULT_CLIENT_SHIFTS;
              setCachedClientShifts(clientId, result);
              setInternalShifts(result);
              onShiftsLoaded?.(result);
            } else {
              setInternalShifts(DEFAULT_CLIENT_SHIFTS);
              onShiftsLoaded?.(DEFAULT_CLIENT_SHIFTS);
            }
          })
          .catch(() => {
            if (active) {
              setInternalShifts(DEFAULT_CLIENT_SHIFTS);
              onShiftsLoaded?.(DEFAULT_CLIENT_SHIFTS);
            }
          });
      }
    } else {
      setInternalShifts(DEFAULT_CLIENT_SHIFTS);
      onShiftsLoaded?.(DEFAULT_CLIENT_SHIFTS);
    }

    return () => {
      active = false;
    };
  }, [clientId, propClientShifts, onShiftsLoaded]);

  // Synchronize shifts dynamically when client shift codes are created, renamed or applied
  useEffect(() => {
    if (!clientId) return;
    const handleShiftInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ clientId?: string | null }>;
      if (!customEvent.detail?.clientId || customEvent.detail.clientId === clientId) {
        getClientShiftCodesAction(clientId).then((res) => {
          if (res.success && res.data && res.data.length > 0) {
            const formatted: ClientShiftCode[] = res.data
              .filter((s: any) => s.is_active !== false)
              .map((s: any) => ({
                ...s,
                raw_start_time: formatTo12Hour(s.start_time) || s.start_time,
                raw_end_time: formatTo12Hour(s.end_time) || s.end_time,
                start_time: formatTo12Hour(s.start_time) || s.start_time,
                end_time: formatTo12Hour(s.end_time) || s.end_time,
              }));
            const result = formatted.length > 0 ? formatted : DEFAULT_CLIENT_SHIFTS;
            setCachedClientShifts(clientId, result);
            setInternalShifts(result);
            onShiftsLoaded?.(result);
          }
        });
      }
    };
    window.addEventListener(CLIENT_SHIFTS_INVALIDATED_EVENT, handleShiftInvalidation);
    return () => {
      window.removeEventListener(CLIENT_SHIFTS_INVALIDATED_EVENT, handleShiftInvalidation);
    };
  }, [clientId, onShiftsLoaded]);

  const clientShifts = propClientShifts && propClientShifts.length > 0 ? propClientShifts : internalShifts;
  const maxCapacity = clientShifts.length > 0 ? clientShifts.length : 3;

  // Reconcile assigned operators' shift codes with loaded client shifts
  useEffect(() => {
    if (!clientShifts || clientShifts.length === 0 || !assignedOperators || assignedOperators.length === 0) return;
    let changed = false;
    const reconciled = assignedOperators.map((item) => {
      const exactMatch = clientShifts.find((sc) => sc.code.toUpperCase() === item.shiftCode.toUpperCase());
      if (exactMatch) {
        if (!item.shiftStartTime || !item.shiftEndTime) {
          changed = true;
          return {
            ...item,
            shiftStartTime: exactMatch.start_time,
            shiftEndTime: exactMatch.end_time,
          };
        }
        return item;
      }

      // Try matching by timing
      const timeMatch = clientShifts.find(
        (sc) =>
          item.shiftStartTime &&
          item.shiftEndTime &&
          (sc.start_time === item.shiftStartTime || sc.raw_start_time === item.shiftStartTime) &&
          (sc.end_time === item.shiftEndTime || sc.raw_end_time === item.shiftEndTime)
      );
      if (timeMatch) {
        changed = true;
        return {
          ...item,
          shiftCode: timeMatch.code,
          shiftStartTime: timeMatch.start_time,
          shiftEndTime: timeMatch.end_time,
        };
      }

      // Try matching legacy S1/S2/S3 index to client shifts
      const legacyIdxMatch = item.shiftCode.match(/^S(\d+)$/i);
      if (legacyIdxMatch) {
        const sIndex = parseInt(legacyIdxMatch[1], 10) - 1;
        if (sIndex >= 0 && sIndex < clientShifts.length) {
          changed = true;
          const target = clientShifts[sIndex];
          return {
            ...item,
            shiftCode: target.code,
            shiftStartTime: target.start_time,
            shiftEndTime: target.end_time,
          };
        }
      }

      return item;
    });

    if (changed) {
      onChange(reconciled);
    }
  }, [clientShifts, assignedOperators, onChange]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAddOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const otherAssignments = propOtherAssignments && propOtherAssignments.length > 0 ? propOtherAssignments : internalOtherAssignments;

  // Filter out any assignments belonging to THIS machine (so we only track other machines)
  const otherAssignmentsMap = useMemo(() => {
    const map = new Map<string, ActiveOperatorOtherAssignment[]>();
    for (const a of otherAssignments) {
      if (a.machineId === machineId) continue;
      const list = map.get(a.operatorId) || [];
      list.push(a);
      map.set(a.operatorId, list);
    }
    return map;
  }, [otherAssignments, machineId]);

  // Compute available operators (max 2 shifts allowed per operator platform-wide)
  const availableOperators = useMemo(
    () =>
      allOperators.filter((op) => {
        if (op.role && op.role !== "operator") return false;
        if (op.status === "inactive") return false;

        const thisCount = assignedOperators.filter((a) => a.operatorId === op.id).length;
        const otherCount = (otherAssignmentsMap.get(op.id) || []).length;
        const totalShifts = thisCount + otherCount;

        if (totalShifts >= 3) return false;
        if (thisCount >= 3) return false;

        const query = searchQuery.toLowerCase();
        return (
          query === "" ||
          op.full_name?.toLowerCase().includes(query) ||
          op.phone?.includes(query) ||
          op.email?.toLowerCase().includes(query)
        );
      }),
    [allOperators, assignedOperators, otherAssignmentsMap, searchQuery]
  );

  // Validation: Check for duplicate shifts among assigned operators
  const duplicateShiftCodes = useMemo(() => {
    const shiftCounts = new Map<string, number>();
    for (const a of assignedOperators) {
      if (!a.shiftCode) continue;
      const code = a.shiftCode.toUpperCase();
      shiftCounts.set(code, (shiftCounts.get(code) || 0) + 1);
    }
    const duplicates: string[] = [];
    for (const [code, count] of shiftCounts.entries()) {
      if (count > 1) duplicates.push(code);
    }
    return duplicates;
  }, [assignedOperators]);

  // Validation: Check for overlapping shift windows among assigned operators on THIS machine
  const overlappingShifts = useMemo(() => {
    const conflicts: string[] = [];
    for (let i = 0; i < assignedOperators.length; i++) {
      for (let j = i + 1; j < assignedOperators.length; j++) {
        const op1 = assignedOperators[i];
        const op2 = assignedOperators[j];
        if (op1.shiftStartTime && op1.shiftEndTime && op2.shiftStartTime && op2.shiftEndTime) {
          const r1 = shiftToMinuteRanges(op1.shiftStartTime, op1.shiftEndTime);
          const r2 = shiftToMinuteRanges(op2.shiftStartTime, op2.shiftEndTime);
          if (doRangesOverlap(r1, r2)) {
            conflicts.push(
              `${op1.operatorName} (Shift ${op1.shiftCode}: ${op1.shiftStartTime}–${op1.shiftEndTime}) overlaps with ${op2.operatorName} (Shift ${op2.shiftCode}: ${op2.shiftStartTime}–${op2.shiftEndTime})`
            );
          }
        }
      }
    }
    return conflicts;
  }, [assignedOperators]);

  // Validation: Check for overlapping shift windows with active assignments on OTHER machines
  const otherMachineConflicts = useMemo(() => {
    const conflicts: Array<{
      operatorId: string;
      operatorName: string;
      otherMachineCode: string;
      otherShiftTiming: string;
      thisShiftCode: string;
      thisShiftTiming: string;
      shortMessage: string;
    }> = [];

    for (const item of assignedOperators) {
      const others = otherAssignmentsMap.get(item.operatorId);
      if (!others || others.length === 0) continue;

      let thisStart = item.shiftStartTime;
      let thisEnd = item.shiftEndTime;
      if (!thisStart || !thisEnd) {
        const sc = clientShifts.find((s) => s.code.toUpperCase() === item.shiftCode.toUpperCase());
        if (sc) {
          thisStart = sc.start_time;
          thisEnd = sc.end_time;
        }
      }
      if (!thisStart || !thisEnd) continue;

      const rThis = shiftToMinuteRanges(thisStart, thisEnd);
      if (rThis.length === 0) continue;

      for (const other of others) {
        if (!other.shiftStartTime || !other.shiftEndTime) continue;
        const rOther = shiftToMinuteRanges(other.shiftStartTime, other.shiftEndTime);
        if (doRangesOverlap(rThis, rOther)) {
          const otherTimes = `${formatTo12Hour(other.shiftStartTime)} – ${formatTo12Hour(other.shiftEndTime)}`;
          const thisTimes = `${formatTo12Hour(thisStart)} – ${formatTo12Hour(thisEnd)}`;
          conflicts.push({
            operatorId: item.operatorId,
            operatorName: item.operatorName,
            otherMachineCode: other.machineCode,
            otherShiftTiming: otherTimes,
            thisShiftCode: item.shiftCode,
            thisShiftTiming: thisTimes,
            shortMessage: `${item.operatorName} is already assigned to ${other.machineCode} (${otherTimes}).`,
          });
          break;
        }
      }
    }

    return conflicts;
  }, [assignedOperators, otherAssignmentsMap, clientShifts]);

  // Validation: Check if any operator exceeds 2 shifts platform-wide
  const operatorShiftExceeded = useMemo(() => {
    const opCounts = new Map<string, number>();
    for (const a of assignedOperators) {
      opCounts.set(a.operatorId, (opCounts.get(a.operatorId) || 0) + 1);
    }
    const exceeded: string[] = [];
    for (const [opId, count] of opCounts.entries()) {
      const others = (otherAssignmentsMap.get(opId) || []).length;
      if (count + others > 3) {
        const opName = assignedOperators.find((m) => m.operatorId === opId)?.operatorName || "Operator";
        exceeded.push(`${opName} is assigned to ${count + others} shifts (maximum allowed is 3 shifts or 24h).`);
      }
    }
    return exceeded;
  }, [assignedOperators, otherAssignmentsMap]);

  useEffect(() => {
    if (duplicateShiftCodes.length > 0) {
      onErrorChange?.(
        true,
        `Shift ${duplicateShiftCodes.join(", ")} is assigned to multiple operators. Each operator must have a distinct shift for 24h machine operations.`
      );
    } else if (overlappingShifts.length > 0) {
      onErrorChange?.(
        true,
        `Shift window overlap: ${overlappingShifts.join("; ")}. Each operator must cover a distinct, non-overlapping shift window.`
      );
    } else if (operatorShiftExceeded.length > 0) {
      onErrorChange?.(true, operatorShiftExceeded[0]);
    } else if (otherMachineConflicts.length > 0) {
      onErrorChange?.(
        true,
        otherMachineConflicts[0].shortMessage
      );
    } else {
      onErrorChange?.(false);
    }
  }, [duplicateShiftCodes, overlappingShifts, operatorShiftExceeded, otherMachineConflicts, onErrorChange]);

  // Helper to pick next available shift code
  const getNextAvailableShift = (): ClientShiftCode => {
    const usedShiftCodes = new Set(assignedOperators.map((a) => a.shiftCode.toUpperCase()));
    const unused = clientShifts.find((s) => !usedShiftCodes.has(s.code.toUpperCase()));
    return unused || clientShifts[assignedOperators.length % clientShifts.length] || clientShifts[0];
  };

  const handleAddOperator = (op: typeof allOperators[0]) => {
    if (assignedOperators.length >= maxCapacity) return;
    const nextShift = getNextAvailableShift();
    const newItem: OperatorShiftAssignmentItem = {
      operatorId: op.id,
      operatorName: op.full_name || "Operator",
      phone: op.phone,
      email: op.email,
      shiftCode: nextShift.code,
      shiftStartTime: nextShift.start_time,
      shiftEndTime: nextShift.end_time,
      notes: "Assigned via machine operator management",
    };
    onChange([...assignedOperators, newItem]);
    setIsAddOpen(false);
    setSearchQuery("");
  };

  const handleRemoveOperator = (index: number) => {
    onChange(assignedOperators.filter((_, idx) => idx !== index));
  };

  const handleShiftChange = (index: number, shift: ClientShiftCode) => {
    onChange(
      assignedOperators.map((a, idx) => {
        if (idx !== index) return a;
        return {
          ...a,
          shiftCode: shift.code,
          shiftStartTime: shift.start_time,
          shiftEndTime: shift.end_time,
        };
      })
    );
  };

  const isFullCapacity = assignedOperators.length >= maxCapacity;

  return (
    <div className="space-y-3.5">
      {/* Other Machine Collision Warning Banner */}
      {otherMachineConflicts.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">Operator Machine Conflict Detected</div>
            <p className="text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
              {otherMachineConflicts.map((c) => c.shortMessage).join(" ")}
            </p>
          </div>
        </div>
      )}

      {/* Duplicate Shift Warning Banner */}
      {duplicateShiftCodes.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">Shift Schedule Collision Detected</div>
            <p className="text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
              Shift <span className="font-mono font-bold">{duplicateShiftCodes.join(", ")}</span> is assigned to multiple operators. Each operator must cover a distinct shift to guarantee continuous 24h operational logging.
            </p>
          </div>
        </div>
      )}

      {/* Overlapping Shift Warning Banner */}
      {overlappingShifts.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">Shift Timing Overlap Detected</div>
            <p className="text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
              {overlappingShifts.join(". ")}.
            </p>
          </div>
        </div>
      )}

      {/* Operator Shift Limit Exceeded Warning Banner */}
      {operatorShiftExceeded.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">Operator Shift Limit Exceeded</div>
            <p className="text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
              {operatorShiftExceeded.join(" ")}
            </p>
          </div>
        </div>
      )}

      {/* Assigned Operators List */}
      <div className="space-y-2.5">
        {assignedOperators.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--color-mute)] italic bg-[var(--color-hairline-soft-surface)]/40 rounded-xl border border-dashed border-[var(--color-hairline)] p-4">
            <Users className="h-7 w-7 text-[var(--color-mute)] mx-auto mb-1.5 opacity-40" />
            <p className="font-bold text-[var(--color-ink)] text-xs">No Operators Assigned</p>
            <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
              Add operators below to designate shift responsibilities for this machine.
            </p>
          </div>
        ) : (
          assignedOperators.map((item, idx) => {
            const otherConflict = otherMachineConflicts.find((c) => c.operatorId === item.operatorId);
            const hasShiftConflict = duplicateShiftCodes.includes(item.shiftCode.toUpperCase()) || !!otherConflict;
            const isMultiShiftOnMachine = assignedOperators.filter((o) => o.operatorId === item.operatorId).length > 1;

            return (
              <div
                key={`${item.operatorId}-${item.shiftCode}-${idx}`}
                className={`p-3 rounded-xl border transition-colors ${
                  hasShiftConflict
                    ? "bg-rose-500/5 border-rose-500/40"
                    : "bg-[var(--color-canvas)] border-[var(--color-hairline)]"
                }`}
              >
                {/* Operator Header: Name + Badge + Remove */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-[var(--color-ink)] truncate">
                          {item.operatorName}
                        </span>
                        {isMultiShiftOnMachine && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            {assignedOperators.filter((o) => o.operatorId === item.operatorId).length === 3 ? "3 Shifts (24h) on Machine" : "2 Shifts on Machine"}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                            hasShiftConflict
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/25"
                              : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25"
                          }`}
                        >
                          {clientShifts.find((s) => s.code.toUpperCase() === item.shiftCode.toUpperCase())?.name
                            ? `${clientShifts.find((s) => s.code.toUpperCase() === item.shiftCode.toUpperCase())?.name} (${item.shiftCode})`
                            : `Shift ${item.shiftCode}`}
                        </span>
                      </div>
                      {(item.phone || item.email) && (
                        <div className="text-[10px] text-[var(--color-mute)] truncate mt-0.5">
                          {[item.phone, item.email].filter(Boolean).join(" • ")}
                        </div>
                      )}
                      {otherConflict && (
                        <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-[10px] font-semibold animate-in fade-in">
                          <AlertCircle size={11} className="text-rose-600 shrink-0" />
                          <span>Already assigned to {otherConflict.otherMachineCode} ({otherConflict.otherShiftTiming})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOperator(idx)}
                      title={`Remove ${item.operatorName}`}
                      className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Shift Selector Pills for this Operator */}
                <div className="mt-2.5 pt-2.5 border-t border-[var(--color-hairline)]">
                  <div className="text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock size={11} className="text-sky-500" />
                    <span>Select Assigned Shift:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {clientShifts.map((sc) => {
                      const isSelected = item.shiftCode.toUpperCase() === sc.code.toUpperCase();
                      const others = otherAssignmentsMap.get(item.operatorId);
                      const isShiftOverlappingOther = others?.some((other) => {
                        const rOther = shiftToMinuteRanges(other.shiftStartTime, other.shiftEndTime);
                        const rSc = shiftToMinuteRanges(sc.start_time, sc.end_time);
                        return doRangesOverlap(rOther, rSc);
                      });

                      return (
                        <button
                          key={sc.id || sc.code}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleShiftChange(idx, sc)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[50px] ${
                            isSelected
                              ? isShiftOverlappingOther
                                ? "bg-rose-600 text-white border-rose-700 shadow-2xs ring-1 ring-rose-600 font-semibold"
                                : "bg-sky-500 text-white border-sky-600 shadow-2xs ring-1 ring-sky-500 font-semibold"
                              : isShiftOverlappingOther
                              ? "bg-rose-500/5 text-[var(--color-ink)] border-rose-500/30 hover:border-rose-500/50"
                              : "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-sky-500/40"
                          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-1.5 w-full">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                                  isSelected
                                    ? "bg-white/25 text-white"
                                    : isShiftOverlappingOther
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                    : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25"
                                }`}
                              >
                                {sc.code}
                              </span>
                              <span
                                className={`text-xs font-bold truncate ${
                                  isSelected ? "text-white" : "text-[var(--color-ink)]"
                                }`}
                                title={sc.name || `Shift ${sc.code}`}
                              >
                                {sc.name || `Shift ${sc.code}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isShiftOverlappingOther && !isSelected && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"
                                  title="Overlaps with another machine"
                                />
                              )}
                              {sc.crosses_midnight && (
                                <Moon
                                  size={11}
                                  className={isSelected ? "text-white/80" : "text-indigo-500"}
                                />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px] font-mono">
                            <span
                              className={`truncate ${
                                isSelected
                                  ? "text-white/90"
                                  : isShiftOverlappingOther
                                  ? "text-rose-600 dark:text-rose-400 font-medium"
                                  : "text-[var(--color-mute)]"
                              }`}
                            >
                              {sc.start_time} – {sc.end_time}
                            </span>
                            {sc.scheduled_minutes ? (
                              <span
                                className={`text-[9px] shrink-0 font-medium ${
                                  isSelected ? "text-white/80" : "text-[var(--color-mute)]"
                                }`}
                              >
                                {Math.round(sc.scheduled_minutes / 60)}h
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Operator Controls */}
      {!disabled && (
        <div className="pt-1">
          {isFullCapacity ? (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Full shift coverage roster ({maxCapacity}/{maxCapacity} operator shifts assigned).</span>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsAddOpen(!isAddOpen)}
                disabled={isLoadingOptions}
                className="w-full h-10 px-3.5 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)]/60 text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-1.5 text-[var(--color-ink)] group-hover:text-sky-600 transition-colors">
                  <Plus size={14} className="text-sky-500" />
                  <span>
                    {isLoadingOptions
                      ? "Loading active operators from database..."
                      : `Assign Operator (${assignedOperators.length}/${maxCapacity}) — Next Shift: ${getNextAvailableShift().code}`}
                  </span>
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[var(--color-mute)] transition-transform duration-150 ${
                    isAddOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isAddOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl shadow-lg z-30 overflow-hidden animate-in fade-in duration-100">
                  {/* Search inside dropdown */}
                  <div className="p-2 border-b border-[var(--color-hairline)]">
                    <div className="relative flex items-center">
                      <Search
                        size={13}
                        className="absolute left-2.5 text-[var(--color-mute)] pointer-events-none"
                      />
                      <input
                        type="text"
                        placeholder="Search active operator by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* List of unassigned operators */}
                  <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {availableOperators.length === 0 ? (
                      <div className="p-3 text-center text-xs text-[var(--color-mute)] italic">
                        {searchQuery ? "No matching operators found" : "All active operators assigned"}
                      </div>
                    ) : (
                      availableOperators.map((op) => {
                        const thisCount = assignedOperators.filter((a) => a.operatorId === op.id).length;
                        const otherAssList = otherAssignmentsMap.get(op.id) || [];
                        const otherAss = otherAssList[0];
                        const totalCount = thisCount + otherAssList.length;

                        const nextShift = getNextAvailableShift();
                        const willOverlapNext = otherAss && doRangesOverlap(
                          shiftToMinuteRanges(nextShift.start_time, nextShift.end_time),
                          shiftToMinuteRanges(otherAss.shiftStartTime, otherAss.shiftEndTime)
                        );

                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => handleAddOperator(op)}
                            className="w-full p-2 text-left rounded-lg hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold truncate flex items-center gap-1.5 flex-wrap">
                                <span>{op.full_name}</span>
                                {thisCount > 0 ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                                    Already on this machine ({thisCount}/3)
                                  </span>
                                ) : totalCount > 0 ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                    {totalCount}/3 Shifts
                                  </span>
                                ) : null}
                                {otherAss && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                                      willOverlapNext
                                        ? "bg-rose-500/10 text-rose-600 border-rose-500/25"
                                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                    }`}
                                  >
                                    {otherAss.machineCode} ({formatTo12Hour(otherAss.shiftStartTime)}–{formatTo12Hour(otherAss.shiftEndTime)})
                                  </span>
                                )}
                              </div>
                              {op.phone && (
                                <div className="text-[10px] text-[var(--color-mute)] font-mono">
                                  {op.phone}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-bold text-sky-600 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 shrink-0">
                              + Shift {nextShift.code}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
