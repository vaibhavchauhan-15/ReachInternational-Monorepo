/**
 * Reach International Mobile — Operator Entry Card Component
 * 100% Visual and Behavioral Parity with Web OperatorEntryClient (Screenshots 1, 2, 3).
 * Features:
 * - Title Block: "Daily Machine Log Entry", "Fill in your shift meters and operational status"
 * - Section 1: "ASSIGNED MACHINE & SITE" with Sky Truck & Emerald Building cards, S/N badge, MapPin
 * - Section 2: "HMR" with Live RT chip, Start Meter Synced/Manual toggle, End Meter Min constraint
 * - Section 3: "LAST SHIFT" Mint-green card with Last Recorded Date, Shift End Time, Last Entry By
 * - Section 4: "SHIFT" with Shift A pill, Manual mode toggle, duration badge, Date dropdown picker,
 *   ShiftCardSelector (A/B/C grow & shrink pills), and "Assigned to Shift A only" warning
 * - Section 5: "Machine Breakdown" Collapsible card (+ Add / Remove), Time inputs with AM/PM toggle,
 *   Duration Window pink pill badge, and reason textarea
 * - Footer: "Draft is auto-saved on this device.", "Save Draft" outline button, and "Submit Daily Log" blue CTA
 * - Local draft persistence via AsyncStorage, TanStack cache invalidation, and Offline Queue support
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Truck,
  Building2,
  MapPin,
  Lock,
  Unlock,
  AlertTriangle,
  SlidersHorizontal,
  Calendar,
  Clock,
  Send,
  CheckCircle2,
  ChevronDown,
  UserCheck,
  Check,
  X,
  AlertCircle,
} from '../ui/icon';
import {
  computeShiftTiming,
  computeBreakdownDuration,
  getISTDateString,
  formatTo12Hour,
  formatDate,
  addDaysToDateStr,
  resolveDefaultOperatorShift,
  calculateEffectiveShiftDurationHours,
  parseOperationalErrorMessage,
  type ShiftMatchTarget,
} from '@reachinternational/utils';
import { useToast } from '../ui';
import type { OperatorEntryContext, ClientShiftCode } from '@reachinternational/types';
import { supabase } from '../../lib/supabase';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { offlineQueueManager } from '../../lib/offline/OfflineQueueManager';
import { notifyLogEntryCreated, notifyMachineStatusChanged, postNotification } from '../../lib/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/useAuth';
import { Text, useTypeStyle } from '../ui/Text';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/textarea';
import { TimeInput } from '../ui/TimeInput';
import { ShiftCardSelector, formatCompactShiftRange, getShiftDisplayTitle, type ShiftCardItem } from '../ui/ShiftCardSelector';
import { OperatorEntrySkeleton } from './OperationsSkeleton';

const DRAFT_STORAGE_KEY = '@reach_operator_log_draft';

export const DEFAULT_CLIENT_SHIFTS: ClientShiftCode[] = [
  {
    id: 'default-s1',
    client_id: '',
    code: 'S1',
    name: 'Shift S1',
    start_time: '06:00 AM',
    end_time: '02:00 PM',
    raw_start_time: '06:00 AM',
    raw_end_time: '02:00 PM',
    scheduled_minutes: 480,
    normal_minutes: 480,
    crosses_midnight: false,
    display_order: 1,
    is_active: true,
  },
  {
    id: 'default-s2',
    client_id: '',
    code: 'S2',
    name: 'Shift S2',
    start_time: '02:00 PM',
    end_time: '10:00 PM',
    raw_start_time: '02:00 PM',
    raw_end_time: '10:00 PM',
    scheduled_minutes: 480,
    normal_minutes: 480,
    crosses_midnight: false,
    display_order: 2,
    is_active: true,
  },
  {
    id: 'default-s3',
    client_id: '',
    code: 'S3',
    name: 'Shift S3',
    start_time: '10:00 PM',
    end_time: '06:00 AM',
    raw_start_time: '10:00 PM',
    raw_end_time: '06:00 AM',
    scheduled_minutes: 480,
    normal_minutes: 480,
    crosses_midnight: true,
    display_order: 3,
    is_active: true,
  },
];

export interface MobileOperatorEntryCardProps {
  entryContext: OperatorEntryContext | null | undefined;
  isLoading?: boolean;
  onSuccess?: () => void | Promise<void>;
  initialShift?: string;
}

export const MobileOperatorEntryCard: React.FC<MobileOperatorEntryCardProps> = ({
  entryContext,
  isLoading = false,
  onSuccess,
  initialShift,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const { isOffline } = useNetworkStatus();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const monoTypeStyle = useTypeStyle('mono');
  const microTypeStyle = useTypeStyle('micro');

  // 1. Initial State from context
  const initialHmrStr =
    entryContext?.last_hmr !== undefined && entryContext?.last_hmr !== null
      ? String(entryContext.last_hmr)
      : '0';

  const [logDate, setLogDate] = useState<string>(() => getISTDateString());
  const [startMeter, setStartMeter] = useState<string>(() => initialHmrStr);
  const [endMeter, setEndMeter] = useState<string>(() => initialHmrStr);
  const [isStartMeterLocked, setIsStartMeterLocked] = useState<boolean>(true);

  // Available shifts for this machine
  const availableShifts = useMemo<ClientShiftCode[]>(() => {
    return entryContext?.shift_codes && entryContext.shift_codes.length > 0
      ? entryContext.shift_codes
      : DEFAULT_CLIENT_SHIFTS;
  }, [entryContext?.shift_codes]);

  // Assigned shifts for this operator
  const assignedShiftCodes = useMemo<string[]>(() => {
    if (entryContext?.assigned_shift_codes && entryContext.assigned_shift_codes.length > 0) {
      return entryContext.assigned_shift_codes;
    }
    if (entryContext?.assigned_shift_code) {
      return [entryContext.assigned_shift_code];
    }
    return [];
  }, [entryContext?.assigned_shift_codes, entryContext?.assigned_shift_code]);

  // Resolve default shift
  const resolvedInitialShift = useMemo(() => {
    return entryContext ? resolveDefaultOperatorShift(entryContext, availableShifts) : null;
  }, [entryContext, availableShifts]);

  const [selectedShiftCode, setSelectedShiftCode] = useState<string>(
    resolvedInitialShift?.code || entryContext?.assigned_shift_code || 'S1'
  );

  const [showManualTimes, setShowManualTimes] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>(() => {
    const raw =
      resolvedInitialShift?.start_time ||
      resolvedInitialShift?.raw_start_time ||
      entryContext?.operator?.shift_start;
    return (raw ? formatTo12Hour(raw) : '') || '06:00 AM';
  });
  const [endTime, setEndTime] = useState<string>(() => {
    const raw =
      resolvedInitialShift?.end_time ||
      resolvedInitialShift?.raw_end_time ||
      entryContext?.operator?.shift_end;
    return (raw ? formatTo12Hour(raw) : '') || '02:00 PM';
  });
  const [overtimeHours, setOvertimeHours] = useState<string>(
    resolvedInitialShift?.default_ot_minutes && resolvedInitialShift.default_ot_minutes > 0
      ? (resolvedInitialShift.default_ot_minutes / 60).toString()
      : '0'
  );

  // Breakdown State
  const [isBreakdown, setIsBreakdown] = useState<boolean>(false);
  const [breakdownStartTime, setBreakdownStartTime] = useState<string>('02:00 PM');
  const [breakdownEndTime, setBreakdownEndTime] = useState<string>('03:00 PM');
  const [breakdownReason, setBreakdownReason] = useState<string>('');

  // Modals & Submission State
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync with entryContext when loaded
  useEffect(() => {
    if (entryContext) {
      if (entryContext.last_hmr !== undefined && entryContext.last_hmr !== null) {
        const hmrStr = String(entryContext.last_hmr);
        setStartMeter(hmrStr);
        setEndMeter((prev) => (prev === '' || prev === '0' ? hmrStr : prev));
      }

      if (resolvedInitialShift) {
        setSelectedShiftCode(resolvedInitialShift.code);
        const s = formatTo12Hour(resolvedInitialShift.start_time || resolvedInitialShift.raw_start_time);
        if (s) setStartTime(s);
        const e = formatTo12Hour(resolvedInitialShift.end_time || resolvedInitialShift.raw_end_time);
        if (e) setEndTime(e);
        if (resolvedInitialShift.default_ot_minutes && resolvedInitialShift.default_ot_minutes > 0) {
          setOvertimeHours((resolvedInitialShift.default_ot_minutes / 60).toString());
        }
      }
    }
  }, [entryContext, resolvedInitialShift]);

  // Load auto-saved draft from AsyncStorage on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.logDate === getISTDateString()) {
            if (parsed.endMeter) setEndMeter(parsed.endMeter);
            if (parsed.selectedShiftCode) setSelectedShiftCode(parsed.selectedShiftCode);
            if (parsed.startTime) setStartTime(parsed.startTime);
            if (parsed.endTime) setEndTime(parsed.endTime);
            if (parsed.overtimeHours) setOvertimeHours(parsed.overtimeHours);
            if (parsed.isBreakdown !== undefined) setIsBreakdown(parsed.isBreakdown);
            if (parsed.breakdownStartTime) setBreakdownStartTime(parsed.breakdownStartTime);
            if (parsed.breakdownEndTime) setBreakdownEndTime(parsed.breakdownEndTime);
            if (parsed.breakdownReason) setBreakdownReason(parsed.breakdownReason);
          }
        }
      } catch (err) {
        console.warn('[Draft] Failed to load draft from storage:', err);
      }
    };
    loadDraft();
  }, []);

  // Auto-save draft on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            logDate,
            endMeter,
            selectedShiftCode,
            startTime,
            endTime,
            overtimeHours,
            isBreakdown,
            breakdownStartTime,
            breakdownEndTime,
            breakdownReason,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {
        // Non-blocking draft save error
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    logDate,
    endMeter,
    selectedShiftCode,
    startTime,
    endTime,
    overtimeHours,
    isBreakdown,
    breakdownStartTime,
    breakdownEndTime,
    breakdownReason,
  ]);

  // Start meter change handler
  const handleStartMeterChange = (val: string) => {
    setStartMeter(val);
    if (endMeter === startMeter || endMeter === '') {
      setEndMeter(val);
    }
  };

  // Toggle Start Meter Lock
  const handleToggleLock = () => {
    haptics.select();
    setIsStartMeterLocked((prev) => !prev);
  };

  // Switch Shift
  const handleSelectShift = (sc: ShiftCardItem | ClientShiftCode) => {
    haptics.select();
    setSelectedShiftCode(sc.code);

    const s = formatTo12Hour(sc.start_time || (sc as any).raw_start_time);
    if (s) setStartTime(s);
    const e = formatTo12Hour(sc.end_time || (sc as any).raw_end_time);
    if (e) setEndTime(e);

    const otHours =
      (sc as any).default_ot_minutes && (sc as any).default_ot_minutes > 0
        ? ((sc as any).default_ot_minutes / 60).toString()
        : '0';
    setOvertimeHours(otHours);
  };

  // Auto-select initial shift when passed via navigation params
  useEffect(() => {
    if (initialShift && availableShifts.length > 0) {
      const match = availableShifts.find((s) => {
        const sNorm = s.code.replace(/^shift\s*/i, '').trim().toUpperCase();
        const initNorm = initialShift.replace(/^shift\s*/i, '').trim().toUpperCase();
        return s.code.toUpperCase() === initialShift.toUpperCase() || (initNorm !== '' && sNorm === initNorm);
      });
      if (match) {
        handleSelectShift(match);
      }
    }
  }, [initialShift, availableShifts]);

  // Derived Meters and Running Hours
  const startNum = parseFloat(startMeter) || 0;
  const endNum = parseFloat(endMeter) || 0;
  const runningHours = useMemo(() => {
    if (endMeter === '' || isNaN(endNum) || endNum < startNum) return 0;
    return Math.max(0, Math.round((endNum - startNum) * 10) / 10);
  }, [startNum, endNum, endMeter]);

  const isMeterRegressed = endMeter !== '' && !isNaN(endNum) && endNum < startNum;
  const isOver24Hours = runningHours > 24;

  // Breakdown duration calculation
  const breakdownStats = useMemo(() => {
    if (!isBreakdown || !breakdownStartTime || !breakdownEndTime) return null;
    return computeBreakdownDuration(breakdownStartTime, breakdownEndTime);
  }, [isBreakdown, breakdownStartTime, breakdownEndTime]);

  // Active shift resolution for duration calculation
  const activeShift = useMemo(() => {
    return availableShifts.find((s) => {
      const sNorm = s.code.replace(/^shift\s+/i, '').trim().toUpperCase();
      const selNorm = (selectedShiftCode || '').replace(/^shift\s+/i, '').trim().toUpperCase();
      return s.code.toUpperCase() === (selectedShiftCode || '').toUpperCase() || (selNorm !== '' && sNorm === selNorm);
    });
  }, [availableShifts, selectedShiftCode]);

  const shiftDurationHours = useMemo(() => {
    return calculateEffectiveShiftDurationHours({
      startTime,
      endTime,
      scheduledMinutes: activeShift?.scheduled_minutes,
      normalMinutes: activeShift?.normal_minutes,
      overtimeHours,
    });
  }, [startTime, endTime, activeShift, overtimeHours]);

  // Unassigned shift warning check
  const isCurrentShiftUnassigned = Boolean(
    activeShift &&
      assignedShiftCodes &&
      assignedShiftCodes.length > 0 &&
      !assignedShiftCodes.some(
        (c) =>
          c.replace(/^shift\s*/i, '').trim().toUpperCase() ===
          activeShift.code.replace(/^shift\s*/i, '').trim().toUpperCase()
      )
  );

  // Manual Draft Save
  const handleSaveDraft = async () => {
    try {
      await AsyncStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          logDate,
          endMeter,
          selectedShiftCode,
          startTime,
          endTime,
          overtimeHours,
          isBreakdown,
          breakdownStartTime,
          breakdownEndTime,
          breakdownReason,
          savedAt: new Date().toISOString(),
        })
      );
      haptics.confirm();
      postNotification({
        category: 'log_entry',
        title: 'Draft Saved',
        body: 'Draft saved locally on this device.',
        severity: 'success',
      });
      toast('success', 'Draft Saved', 'Draft saved locally on this device.');
    } catch {
      haptics.reject();
      postNotification({
        category: 'log_entry',
        title: 'Save Failed',
        body: 'Could not save draft.',
        severity: 'error',
      });
      toast('error', 'Save Failed', 'Could not save draft.');
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!entryContext?.operator?.id && !user?.id) {
      haptics.reject();
      const err = { title: 'Operator Profile Missing', message: 'Operator profile not found.' };
      postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
      toast('error', err.title, err.message);
      return;
    }

    if (!entryContext?.machine?.id) {
      haptics.reject();
      const err = { title: 'No Machine Assigned', message: 'No machine assigned to your account.' };
      postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
      toast('error', err.title, err.message);
      return;
    }

    if (!selectedShiftCode || !selectedShiftCode.trim()) {
      haptics.reject();
      const err = { title: 'Shift Required', message: 'Please select an operational shift.' };
      postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
      toast('error', err.title, err.message);
      return;
    }

    if (!endMeter.trim() || isNaN(endNum) || endNum < startNum) {
      haptics.reject();
      const err = {
        title: 'Invalid Meter Reading',
        message: `End meter must be ≥ start meter (${startNum.toFixed(1)}).`,
      };
      postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
      toast('error', err.title, err.message);
      return;
    }

    if (runningHours > 24) {
      haptics.reject();
      const err = { title: 'Operating Limit Exceeded', message: 'Running hours cannot exceed 24h per shift.' };
      postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
      toast('error', err.title, err.message);
      return;
    }

    if (isBreakdown) {
      if (!breakdownStartTime || !breakdownEndTime) {
        haptics.reject();
        const err = { title: 'Breakdown Incomplete', message: 'Enter breakdown start and end times.' };
        postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
        toast('error', err.title, err.message);
        return;
      }
      const maxAllowed = shiftDurationHours > 0 ? shiftDurationHours : 24;
      if (breakdownStats && breakdownStats.durationDecimalHours > maxAllowed) {
        haptics.reject();
        const err = {
          title: 'Invalid Breakdown Time',
          message: `Breakdown (${breakdownStats.durationDecimalHours}h) cannot exceed shift (${maxAllowed}h).`,
        };
        postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
        toast('error', err.title, err.message);
        return;
      }
    }

    const effectiveOperatorId = entryContext?.operator?.id || user?.id;
    let prevHistory: any = null;
    let prevContext: any = null;
    let shiftTiming: any = null;
    let logPayload: any = null;

    try {
      setIsSubmitting(true);

      if (effectiveOperatorId) {
        prevHistory = queryClient.getQueryData(['operator', 'history-logs', effectiveOperatorId]);
        prevContext = queryClient.getQueryData(['operator', 'entry-context', effectiveOperatorId]);
      }

      shiftTiming = computeShiftTiming({
        logDate,
        startTime,
        endTime,
      });

      // Future Shift End Validation (Shift is in progress)
      // 1-minute grace margin accommodates minor client-server clock drift
      const nowWithGrace = Date.now() + 60 * 1000;
      if (shiftTiming?.endDateTime && shiftTiming.endDateTime.getTime() > nowWithGrace) {
        const formattedEndTime = formatTo12Hour(endTime) || endTime;
        const errTitle = 'Shift In Progress';
        const errMessage = `Shift has not ended yet. You can submit logs after ${formattedEndTime}.`;
        haptics.reject();
        postNotification({
          category: 'log_entry',
          title: errTitle,
          body: errMessage,
          severity: 'error',
        });
        toast('error', errTitle, errMessage);
        setIsSubmitting(false);
        return;
      }

      const idempotencyKey = `ihl_op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const rpcParams = {
        p_machine_id: entryContext.machine.id,
        p_operator_id: effectiveOperatorId,
        p_client_id: entryContext.client?.id || null,
        p_shift_code: selectedShiftCode || null,
        p_log_date: shiftTiming.resolvedStartDate || logDate,
        p_end_date: shiftTiming.resolvedEndDate || logDate,
        p_start_datetime: shiftTiming.startDateTime?.toISOString() || null,
        p_end_datetime: shiftTiming.endDateTime?.toISOString() || null,
        p_start_meter: startNum,
        p_end_meter: endNum,
        p_start_time: startTime.trim(),
        p_end_time: endTime.trim(),
        p_overtime_hours: parseFloat(overtimeHours) || shiftTiming.overtimeHours || 0,
        p_normal_working_hours: shiftTiming.normalWorkingHours || 8,
        p_is_breakdown: isBreakdown,
        p_breakdown_start_time: isBreakdown ? breakdownStartTime : null,
        p_breakdown_end_time: isBreakdown ? breakdownEndTime : null,
        p_breakdown_duration: isBreakdown && breakdownStats ? breakdownStats.durationFormatted : null,
        p_breakdown_hours: isBreakdown && breakdownStats ? breakdownStats.durationDecimalHours : 0,
        p_shift: selectedShiftCode ? `Shift ${selectedShiftCode}` : null,
        p_machine_condition: isBreakdown ? 'breakdown' : 'good',
        p_location: entryContext.client?.site || null,
        p_remarks: breakdownReason.trim() || null,
        p_idempotency_key: idempotencyKey,
        p_entered_by: user?.id || effectiveOperatorId,
      };

      logPayload = {
        machine_id: entryContext.machine.id,
        shift_code: selectedShiftCode,
        client_id: entryContext.client?.id || null,
        location: entryContext.client?.site || null,
        start_meter: startNum,
        end_meter: endNum,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        overtime_hours: parseFloat(overtimeHours) || shiftTiming.overtimeHours || 0,
        normal_working_hours: shiftTiming.normalWorkingHours || 8,
        is_breakdown: isBreakdown,
        breakdown_start_time: isBreakdown ? breakdownStartTime : null,
        breakdown_end_time: isBreakdown ? breakdownEndTime : null,
        breakdown_duration: isBreakdown && breakdownStats ? breakdownStats.durationFormatted : null,
        breakdown_hours: isBreakdown && breakdownStats ? breakdownStats.durationDecimalHours : 0,
        shift: selectedShiftCode ? `Shift ${selectedShiftCode}` : null,
        machine_condition: isBreakdown ? 'breakdown' : 'good',
        remarks: breakdownReason.trim() || null,
        operator_id: effectiveOperatorId,
        entered_by: user?.id || effectiveOperatorId,
        entry_source: 'operator',
        log_date: shiftTiming.resolvedStartDate || logDate,
        end_date: shiftTiming.resolvedEndDate || logDate,
        start_datetime: shiftTiming.startDateTime?.toISOString(),
        end_datetime: shiftTiming.endDateTime?.toISOString(),
        idempotency_key: idempotencyKey,
      };

      const optimisticHistoryRow = {
        id: idempotencyKey,
        client_mutation_id: idempotencyKey,
        machine_id: entryContext.machine.id,
        log_date: shiftTiming.resolvedStartDate || logDate,
        start_meter: startNum,
        end_meter: endNum,
        running_hours: runningHours,
        overtime_hours: shiftTiming.overtimeHours,
        shift_code: selectedShiftCode,
        is_breakdown: isBreakdown,
        sync_status: isOffline ? 'queued' : 'pending',
        syncState: isOffline ? 'queued' : 'pending',
        machine: entryContext.machine,
      };

      if (effectiveOperatorId) {
        queryClient.setQueriesData<any[]>({ queryKey: ['operator', 'history-logs', effectiveOperatorId] }, (old: any) => {
          return [optimisticHistoryRow, ...(old || [])];
        });
        queryClient.setQueriesData<any>({ queryKey: ['operator', 'entry-context', effectiveOperatorId] }, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            start_meter: endNum,
            machine: old.machine ? { ...old.machine, hour_meter: endNum } : old.machine,
          };
        });
      }

      if (isOffline) {
        await offlineQueueManager.enqueue('SUBMIT_HOUR_LOG', logPayload);
        notifyLogEntryCreated(entryContext.machine.machine_id || 'Machine', runningHours, shiftTiming.overtimeHours);
        if (isBreakdown) {
          notifyMachineStatusChanged(entryContext.machine.machine_id || 'Machine', 'breakdown');
        }
        await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
        haptics.confirm();
        postNotification({
          category: 'log_entry',
          title: 'Shift Log Queued',
          body: 'Shift log saved locally! Will sync automatically when back online.',
          severity: 'info',
        });
        toast('info', 'Shift Log Queued', 'Shift log saved locally! Will sync automatically when back online.');
        setStartMeter(String(endNum));
        setEndMeter(String(endNum));
        if (onSuccess) onSuccess();
        return;
      }

      // 1. Try atomic PostgreSQL RPC execution first (syncs machines.hour_meter, current_operator_id, health_status, and audit_logs in 1 transaction)
      let rpcSucceeded = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('submit_operator_hour_log_atomic', rpcParams);
        if (!rpcErr && rpcRes && (rpcRes as any).success) {
          rpcSucceeded = true;
        } else if (rpcErr) {
          if (
            rpcErr.message?.includes('cannot be less than start meter') ||
            rpcErr.message?.includes('cannot exceed 24 hours') ||
            rpcErr.message?.includes('Shift end timestamp') ||
            rpcErr.message?.includes('overlap') ||
            rpcErr.message?.includes('Cannot log before shift end') ||
            rpcErr.message?.includes('Breakdown duration') ||
            rpcErr.message?.includes('maintenance or') ||
            rpcErr.message?.includes('inactive') ||
            rpcErr.message?.includes('Unauthorized operator') ||
            rpcErr.message?.includes('Client ID does not match') ||
            rpcErr.message?.includes('previous 7 days') ||
            rpcErr.message?.includes('assigned to Shift') ||
            rpcErr.message?.includes('unassigned shift') ||
            rpcErr.message?.includes('Please select your assigned shift') ||
            rpcErr.code === '23514' ||
            rpcErr.code === '42501' ||
            rpcErr.code === '23503'
          ) {
            throw rpcErr;
          }
        }
      } catch (rpcCatchErr: any) {
        if (
          rpcCatchErr.message?.includes('cannot be less than start meter') ||
          rpcCatchErr.message?.includes('cannot exceed 24 hours') ||
          rpcCatchErr.message?.includes('Shift end timestamp') ||
          rpcCatchErr.message?.includes('overlap') ||
          rpcCatchErr.message?.includes('Cannot log before shift end') ||
          rpcCatchErr.message?.includes('Breakdown duration') ||
          rpcCatchErr.message?.includes('maintenance or') ||
          rpcCatchErr.message?.includes('inactive') ||
          rpcCatchErr.message?.includes('Unauthorized operator') ||
          rpcCatchErr.message?.includes('Client ID does not match') ||
          rpcCatchErr.message?.includes('previous 7 days') ||
          rpcCatchErr.message?.includes('assigned to Shift') ||
          rpcCatchErr.message?.includes('unassigned shift') ||
          rpcCatchErr.message?.includes('Please select your assigned shift') ||
          rpcCatchErr.code === '23514' ||
          rpcCatchErr.code === '42501' ||
          rpcCatchErr.code === '23503'
        ) {
          throw rpcCatchErr;
        }
      }

      // 2. Resilient direct table insert fallback if RPC is unavailable
      if (!rpcSucceeded) {
        const { error: insertErr } = await supabase.from('machine_hour_logs').insert(logPayload);
        if (insertErr) throw insertErr;

        // Update machine hour_meter and health_status
        await supabase
          .from('machines')
          .update({
            hour_meter: endNum,
            current_operator_id: effectiveOperatorId,
            health_status: isBreakdown ? 'breakdown' : 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', entryContext.machine.id);
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['operator', 'entry-context', effectiveOperatorId],
      });
      queryClient.invalidateQueries({
        queryKey: ['operator', 'history-logs', effectiveOperatorId],
      });
      queryClient.invalidateQueries({
        queryKey: ['operations', 'logs'],
      });
      queryClient.invalidateQueries({
        queryKey: ['operations', 'today-shift-monitor'],
      });
      queryClient.invalidateQueries({
        queryKey: ['machines'],
      });

      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
      haptics.confirm();

      const successTitle = 'Daily Log Submitted';
      const successBody = `Log recorded successfully! (${runningHours} operating hours)`;

      postNotification({
        category: 'log_entry',
        title: successTitle,
        body: successBody,
        severity: 'success',
      });
      toast('success', successTitle, successBody);

      // Advance start meter
      setStartMeter(String(endNum));
      setEndMeter(String(endNum));
      setIsBreakdown(false);
      setBreakdownReason('');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const errMsg = (err?.message || '').toLowerCase();
      const isNetworkDrop =
        errMsg.includes('failed to fetch') ||
        errMsg.includes('network request failed') ||
        errMsg.includes('network error') ||
        errMsg.includes('request dropped') ||
        errMsg.includes('timeout') ||
        errMsg.includes('aborted') ||
        errMsg.includes('connection');

      if (isNetworkDrop && logPayload) {
        try {
          await offlineQueueManager.enqueue('SUBMIT_HOUR_LOG', logPayload);
          notifyLogEntryCreated(entryContext?.machine?.machine_id || 'Machine', runningHours, shiftTiming?.overtimeHours || 0);
          if (isBreakdown) {
            notifyMachineStatusChanged(entryContext?.machine?.machine_id || 'Machine', 'breakdown');
          }
          await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
          haptics.confirm();
          postNotification({
            category: 'log_entry',
            title: 'Saved Offline',
            body: 'Network lost. Shift log saved locally and will sync when back online.',
            severity: 'info',
          });
          toast('info', 'Saved Offline', 'Network lost: Shift log saved locally! Will sync automatically when back online.');
          setStartMeter(String(endNum));
          setEndMeter(String(endNum));
          setIsBreakdown(false);
          setBreakdownReason('');
          if (onSuccess) onSuccess();
          return;
        } catch (enqueueErr) {
          console.warn('[OperatorEntry] Failed to fallback enqueue:', enqueueErr);
        }
      }

      console.error('[SubmitLog] Error:', err);
      if (effectiveOperatorId && prevHistory) {
        queryClient.setQueryData(['operator', 'history-logs', effectiveOperatorId], prevHistory);
      }
      if (effectiveOperatorId && prevContext) {
        queryClient.setQueryData(['operator', 'entry-context', effectiveOperatorId], prevContext);
      }

      const parsedErr = parseOperationalErrorMessage(err, {
        endTime,
        startMeter: startNum,
        endMeter: endNum,
        assignedShifts: assignedShiftCodes,
      });

      haptics.reject();
      postNotification({
        category: 'log_entry',
        title: parsedErr.title,
        body: parsedErr.message,
        severity: 'error',
      });
      toast('error', parsedErr.title, parsedErr.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate selectable dates for past 7 days
  const selectableDates = useMemo(() => {
    const today = getISTDateString();
    const dates = [];
    for (let i = 0; i <= 7; i++) {
      const d = addDaysToDateStr(today, -i);
      let label = formatDate(d);
      let badge = '';
      if (i === 0) badge = 'Today';
      else if (i === 1) badge = 'Yesterday';
      else badge = `${i} days ago`;
      dates.push({ date: d, label, badge, isToday: i === 0 });
    }
    return dates;
  }, []);

  if (isLoading) {
    return <OperatorEntrySkeleton />;
  }

  const { machine, client, last_log } = entryContext || {};

  return (
    <View
      style={[
        styles.outerCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Title Block (Screenshot 1) */}
      <View style={styles.titleBlock}>
        <Text variant="heading" style={[styles.mainHeading, { color: theme.colors.ink }]}>
          Daily Machine Log Entry
        </Text>
        <Text variant="caption" style={[styles.mainSubtitle, { color: theme.colors.mute }]}>
          Fill in your shift meters and operational status
        </Text>
      </View>

      <View style={[styles.titleDivider, { backgroundColor: theme.colors.hairline }]} />

      {/* 1. ASSIGNED MACHINE & SITE SECTION (Screenshot 1) */}
      <View
        style={[
          styles.sectionBox,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Text variant="mono" style={[styles.sectionLabel, { color: theme.colors.mute }]}>
          ASSIGNED MACHINE & SITE
        </Text>

        {/* Machine Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe',
                borderColor: isDark ? 'rgba(2, 132, 199, 0.35)' : '#bae6fd',
              },
            ]}
          >
            <Truck size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
          </View>
          <View style={styles.infoContent}>
            <Text variant="subheading" style={[styles.infoTitle, { color: theme.colors.ink }]}>
              {machine?.model ? `${machine.model} (${machine.machine_id})` : machine?.machine_id || 'Unassigned Equipment'}
            </Text>
            <View
              style={[
                styles.serialBadge,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5',
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="mono" style={[styles.serialBadgeText, { color: theme.colors.mute }]}>
                S/N: {machine?.serial_number || '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Site & Client Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
              marginTop: 8,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#bbf7d0',
              },
            ]}
          >
            <Building2 size={16} color={isDark ? '#4ade80' : '#16a34a'} />
          </View>
          <View style={styles.infoContent}>
            <Text variant="subheading" style={[styles.infoTitle, { color: theme.colors.ink }]}>
              {client?.company_name || 'Internal Yard / Unassigned'}
            </Text>
            <View style={styles.locationRow}>
              <MapPin size={13} color="#f43f5e" style={{ marginTop: 1, marginRight: 3 }} />
              <Text variant="caption" style={[styles.locationText, { color: theme.colors.mute }]}>
                {client?.site || (client as any)?.address || 'Barakhamba Road, Connaught Place, Delhi, New Delhi, Delhi'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. HMR SECTION (Screenshot 1) */}
      <View
        style={[
          styles.sectionBox,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderColor: theme.colors.hairline,
            marginTop: 12,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <Text variant="mono" style={[styles.sectionLabel, { color: theme.colors.mute }]}>
            HMR
          </Text>

          {/* Running Hours Dynamic Badge */}
          <View
            style={[
              styles.rtChip,
              {
                backgroundColor: isMeterRegressed
                  ? isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6'
                  : isOver24Hours
                  ? isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'
                  : runningHours > 0
                  ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7'
                  : isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                borderColor: isMeterRegressed
                  ? '#fecdd3'
                  : isOver24Hours
                  ? '#fde68a'
                  : runningHours > 0
                  ? '#bbf7d0'
                  : theme.colors.hairline,
              },
            ]}
          >
            {isMeterRegressed ? (
              <Text variant="mono" style={{ color: '#e11d48' }}>
                Invalid Meter
              </Text>
            ) : isOver24Hours ? (
              <Text variant="mono" style={{ color: '#d97706' }}>
                &gt;24 hrs
              </Text>
            ) : (
              <Text
                variant="mono"
                style={{
                  color: runningHours > 0 ? (isDark ? '#4ade80' : '#15803d') : theme.colors.mute }}
              >
                RT: {runningHours.toFixed(1)} hrs
              </Text>
            )}
          </View>
        </View>

        {/* Start Meter Field */}
        <View style={styles.meterField}>
          <View style={styles.meterLabelRow}>
            <Text variant="label" style={[styles.inputLabel, { color: theme.colors.ink }]}>
              Start Meter (HMR) <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <Pressable
              variant="iconButton"
              haptic="toggle"
              onPress={handleToggleLock}
              style={styles.lockToggleBtn}
              accessibilityLabel={isStartMeterLocked ? 'Start meter locked to last reading' : 'Start meter unlocked for manual edit'}
            >
              {isStartMeterLocked ? (
                <View style={styles.lockRow}>
                  <Lock size={12} color="#10b981" />
                  <Text variant="caption" style={{ color: '#10b981', marginLeft: 3 }}>
                    Synced
                  </Text>
                </View>
              ) : (
                <View style={styles.lockRow}>
                  <Unlock size={12} color="#f59e0b" />
                  <Text variant="caption" style={{ color: '#f59e0b', marginLeft: 3 }}>
                    Manual
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <Input
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            autoCorrect={false}
            spellCheck={false}
            aria-autocomplete="none"
            value={startMeter}
            onChangeText={handleStartMeterChange}
            editable={!isStartMeterLocked}
            style={[
              styles.meterInput,
              monoTypeStyle,
              {
                backgroundColor: isStartMeterLocked
                  ? (isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb')
                  : theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                color: isStartMeterLocked ? theme.colors.mute : theme.colors.ink,
              },
            ]}
          />
          <Text variant="caption" style={[styles.helperText, { color: theme.colors.mute }]}>
            {isStartMeterLocked ? 'Locked to last recorded meter reading.' : 'Manually adjusted starting meter.'}
          </Text>
        </View>

        {/* End Meter Field */}
        <View style={[styles.meterField, { marginTop: 10 }]}>
          <View style={styles.meterLabelRow}>
            <Text variant="label" style={[styles.inputLabel, { color: theme.colors.ink }]}>
              End Meter (HMR) <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <Text variant="mono" style={{ color: theme.colors.mute }}>
              Min: {startNum.toFixed(1)}
            </Text>
          </View>

          <Input
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            autoCorrect={false}
            spellCheck={false}
            aria-autocomplete="none"
            value={endMeter}
            onChangeText={setEndMeter}
            style={[
              styles.meterInput,
              monoTypeStyle,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: isMeterRegressed ? '#ef4444' : theme.colors.hairline,
                color: theme.colors.ink,
              },
            ]}
          />
          {isMeterRegressed && (
            <Text variant="micro" style={{ color: '#ef4444', marginTop: 3 }}>
              End meter must be ≥ {startNum.toFixed(1)}.
            </Text>
          )}
          {isOver24Hours && (
            <Text variant="micro" style={{ color: '#d97706', marginTop: 3 }}>
              Running hours cannot exceed 24h.
            </Text>
          )}
        </View>
      </View>

      {/* 3. LAST SHIFT SECTION (Screenshot 1 & 2) */}
      <View
        style={[
          styles.lastShiftCard,
          {
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4',
            borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#bbf7d0',
          },
        ]}
      >
        <View style={styles.lastShiftHeader}>
          <Text variant="mono" style={[styles.lastShiftLabel, { color: isDark ? '#6ee7b7' : '#047857' }]}>
            LAST SHIFT
          </Text>
          {last_log?.entry_source && last_log.entry_source !== 'operator' && (
            <View style={styles.assistedBadge}>
              <UserCheck size={11} color={isDark ? '#38bdf8' : '#0284c7'} />
              <Text variant="caption" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                Assisted Entry
              </Text>
            </View>
          )}
        </View>

        {last_log ? (
          <View style={styles.lastShiftRows}>
            <View style={styles.lastShiftRow}>
              <Text variant="caption" style={[styles.lastShiftRowLabel, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                Last Recorded Date
              </Text>
              <Text variant="mono" style={[styles.lastShiftRowValue, { color: isDark ? '#ecfdf5' : '#064e3b' }]}>
                {formatDate(last_log.log_date)}
              </Text>
            </View>

            <View style={styles.lastShiftRow}>
              <Text variant="caption" style={[styles.lastShiftRowLabel, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                Shift End Time
              </Text>
              <Text variant="mono" style={[styles.lastShiftRowValue, { color: isDark ? '#ecfdf5' : '#064e3b' }]}>
                {formatTo12Hour(last_log.end_time) || last_log.end_time || '—'}
              </Text>
            </View>

            <View style={styles.lastShiftRow}>
              <Text variant="caption" style={[styles.lastShiftRowLabel, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                Last Entry By
              </Text>
              <Text variant="mono" style={[styles.lastShiftRowValue, { color: isDark ? '#ecfdf5' : '#064e3b' }]}>
                {last_log.entered_by_name || last_log.operator_name || 'Rohit Singh'}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="caption" style={{ color: isDark ? '#a7f3d0' : '#065f46', marginTop: 4 }}>
            No previous shift log recorded for this machine yet. First Entry
          </Text>
        )}
      </View>

      {/* 4. SHIFT SECTION (Screenshot 2 & 3) */}
      <View
        style={[
          styles.sectionBox,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderColor: theme.colors.hairline,
            marginTop: 12,
          },
        ]}
      >
        {/* Shift Header Row */}
        <View style={styles.shiftHeaderRow}>
          <Text variant="mono" style={[styles.sectionLabel, { color: theme.colors.mute }]}>
            SHIFT
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Manual Toggle */}
            <Pressable
              variant="chip"
              haptic="select"
              onPress={() => setShowManualTimes(!showManualTimes)}
              style={[
                styles.manualToggleBtn,
                {
                  backgroundColor: showManualTimes
                    ? '#0284c7'
                    : (isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'),
                  borderColor: showManualTimes ? '#0284c7' : theme.colors.hairline,
                },
              ]}
            >
              <SlidersHorizontal size={12} color={showManualTimes ? '#ffffff' : theme.colors.mute} />
              <Text
                variant="mono"
                style={{
                  color: showManualTimes ? '#ffffff' : theme.colors.mute,
                }}
              >
                {showManualTimes ? 'Shift' : 'Manual'}
              </Text>
            </Pressable>

            {/* Duration Badge */}
            {shiftDurationHours > 0 && (
              <Text variant="mono" style={[styles.durationBadge, { color: theme.colors.ink }]}>
                {shiftDurationHours.toFixed(1)} hrs
              </Text>
            )}
          </View>
        </View>

        {/* Date Selector Dropdown Button (Screenshot 2) */}
        <View style={{ marginTop: 10 }}>
          <Text variant="label" style={[styles.inputLabel, { color: theme.colors.ink, marginBottom: 6 }]}>
            Select Date <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>

          <Pressable
            variant="card"
            haptic="select"
            onPress={() => setIsDatePickerModalOpen(true)}
            style={[
              styles.datePickerBtn,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color="#0284c7" />
              <Text variant="mono" style={[styles.datePickerText, { color: theme.colors.ink }]}>
                {formatDate(logDate)}
              </Text>
              {logDate === getISTDateString() && (
                <View
                  style={[
                    styles.todayBadge,
                    {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#bbf7d0',
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: isDark ? '#4ade80' : '#15803d' }}>
                    Today
                  </Text>
                </View>
              )}
            </View>
            <ChevronDown size={15} color={theme.colors.mute} />
          </Pressable>
        </View>

        {/* Shift Card Selector / Manual Pickers (Screenshot 2 & 3) */}
        {!showManualTimes ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Clock size={15} color="#0284c7" />
              <Text variant="label" style={[styles.inputLabel, { color: theme.colors.ink }]}>
                Select Shift <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
            </View>

            <ShiftCardSelector
              shiftCodes={availableShifts as unknown as ShiftCardItem[]}
              selectedCode={selectedShiftCode}
              onSelect={handleSelectShift}
            />

            {/* Warning if unassigned shift selected (Screenshot 3) */}
            {isCurrentShiftUnassigned && (
              <View
                style={[
                  styles.unassignedWarningBanner,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
                  },
                ]}
              >
                <AlertTriangle size={11} color={isDark ? '#fbbf24' : '#d97706'} />
                <Text
                  variant="micro"
                  style={{
                    color: isDark ? '#fbbf24' : '#92400e',
                    flex: 1 }}
                >
                  Assigned to Shift {assignedShiftCodes.join(', ')} only.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <TimeInput
              label="Shift Start"
              value={startTime}
              onChangeText={setStartTime}
              toggleLayout="side-by-side"
              required
            />
            <TimeInput
              label="Shift End"
              value={endTime}
              onChangeText={setEndTime}
              toggleLayout="side-by-side"
              required
            />
          </View>
        )}
      </View>

      {/* 5. MACHINE BREAKDOWN SECTION (Screenshot 2 & 3) */}
      <View
        style={[
          styles.breakdownCard,
          {
            backgroundColor: isBreakdown
              ? isDark ? 'rgba(244, 63, 94, 0.08)' : '#fff1f2'
              : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderColor: isBreakdown
              ? isDark ? 'rgba(244, 63, 94, 0.3)' : '#fecdd3'
              : theme.colors.hairline,
            marginTop: 12,
          },
        ]}
      >
        <View style={styles.breakdownHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} color={isBreakdown ? '#e11d48' : theme.colors.mute} />
            <Text variant="subheading" style={[styles.breakdownTitle, { color: theme.colors.ink }]}>
              Machine Breakdown
            </Text>
          </View>

          <Pressable
            variant="buttonDanger"
            haptic="toggle"
            onPress={() => {
              setIsBreakdown(!isBreakdown);
            }}
            style={[
              styles.breakdownToggleBtn,
              {
                backgroundColor: isBreakdown ? '#e11d48' : (isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'),
                borderColor: isBreakdown ? '#e11d48' : theme.colors.hairline,
              },
            ]}
          >
            <Text
              variant="label"
              style={{
                color: isBreakdown ? '#ffffff' : theme.colors.mute }}
            >
              {isBreakdown ? 'Remove' : '+ Add'}
            </Text>
          </Pressable>
        </View>

        {/* Expanded Breakdown Fields (Screenshot 3) */}
        {isBreakdown && (
          <View style={styles.breakdownExpandedContent}>
            {/* Breakdown Start */}
            <TimeInput
              label="Breakdown Start"
              value={breakdownStartTime}
              onChangeText={setBreakdownStartTime}
              toggleLayout="side-by-side"
              required
            />

            {/* Breakdown End */}
            <View style={{ marginTop: 8 }}>
              <TimeInput
                label="Breakdown End"
                value={breakdownEndTime}
                onChangeText={setBreakdownEndTime}
                toggleLayout="side-by-side"
                required
              />
            </View>

            {/* Duration Window Pink Badge (Screenshot 3) */}
            {breakdownStats && (
              <View
                style={[
                  styles.durationWindowBadge,
                  {
                    backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
                    borderColor: isDark ? 'rgba(244, 63, 94, 0.35)' : '#fecdd3',
                  },
                ]}
              >
                <Text
                  variant="mono"
                  style={{
                    color: isDark ? '#fb7185' : '#e11d48' }}
                >
                  Duration Window: {breakdownStartTime} - {breakdownEndTime} ({breakdownStats.durationDecimalHours} hrs)
                </Text>
              </View>
            )}

            {/* Reason Textarea (Screenshot 3) */}
            <View style={{ marginTop: 8 }}>
              <Text variant="label" style={[styles.inputLabel, { color: theme.colors.ink, marginBottom: 4 }]}>
                Breakdown Reason & Action Taken
              </Text>
              <Textarea
                numberOfLines={2}
                value={breakdownReason}
                onChangeText={setBreakdownReason}
                placeholder="e.g. Pipe leak, repair note..."
                placeholderTextColor={theme.colors.mute}
                style={[
                  styles.reasonInput,
                  microTypeStyle,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                    color: theme.colors.ink,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Footer Auto-save Notice & CTAs (Screenshot 2 & 3) */}
      <Text variant="caption" style={[styles.draftNotice, { color: theme.colors.mute }]}>
        Draft is auto-saved on this device.
      </Text>

      <View style={styles.actionButtonsRow}>
        {/* Save Draft Button */}
        <Pressable
          variant="buttonSecondary"
          haptic={false}
          onPress={handleSaveDraft}
          style={[
            styles.saveDraftBtn,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text variant="label" style={[styles.saveDraftBtnText, { color: theme.colors.ink }]}>
            Save Draft
          </Text>
        </Pressable>

        {/* Submit Daily Log CTA */}
        <Pressable
          variant="fab"
          haptic={false}
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={styles.submitBtn}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Send size={15} color="#ffffff" style={{ marginRight: 6 }} />
              <Text variant="label" style={styles.submitBtnText}>
                Submit Daily Log
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Date Picker Modal */}
      <AppModal
        visible={isDatePickerModalOpen}
        onClose={() => setIsDatePickerModalOpen(false)}
        variant="bottom"
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Select Shift Date
              </Text>
              <Pressable
                variant="iconButton"
                haptic="select"
                hitSlopToMin48={true}
                onPress={() => setIsDatePickerModalOpen(false)}
              >
                <X size={18} color={theme.colors.mute} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {selectableDates.map((item) => {
                const isSelected = logDate === item.date;
                return (
                  <Pressable
                    key={item.date}
                    variant="listRow"
                    haptic="select"
                    onPress={() => {
                      setLogDate(item.date);
                      setIsDatePickerModalOpen(false);
                    }}
                    style={[
                      styles.dateSelectItem,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(0, 112, 243, 0.15)' : '#eff6ff')
                          : 'transparent',
                        borderBottomColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Calendar size={15} color={isSelected ? '#0070f3' : theme.colors.mute} />
                      <Text
                        variant="mono"
                        style={{
                          color: isSelected ? theme.colors.link : theme.colors.ink }}
                      >
                        {item.label}
                      </Text>
                      {item.badge && (
                        <View
                          style={[
                            styles.dateBadgePill,
                            {
                              backgroundColor: item.isToday
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7')
                                : (isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'),
                            },
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={{
                              color: item.isToday ? '#15803d' : theme.colors.mute }}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                    {isSelected && <Check size={16} color="#0070f3" />}
                  </Pressable>
                );
              })}
            </ScrollView>
        </View>
      </AppModal>
    </View>
  );
};

const styles = StyleSheet.create({
  outerCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 110,
  },
  loadingCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    marginBottom: 10,
  },
  mainHeading: {
  },
  mainSubtitle: {
    marginTop: 2,
  },
  titleDivider: {
    height: 1,
    marginBottom: 12,
  },
  sectionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
  },
  serialBadge: {
    marginTop: 4,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  serialBadgeText: {
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 3,
  },
  locationText: {
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rtChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  meterField: {
    marginTop: 2,
  },
  meterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inputLabel: {
  },
  lockToggleBtn: {
    padding: 2,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meterInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  helperText: {
    marginTop: 4,
  },
  lastShiftCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  lastShiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lastShiftLabel: {
  },
  assistedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#e0f2fe',
  },
  lastShiftRows: {
    gap: 4,
  },
  lastShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  lastShiftRowLabel: {
  },
  lastShiftRowValue: {
  },
  shiftHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manualToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  durationBadge: {
  },
  datePickerBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerText: {
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 14,
    borderWidth: 1,
  },
  unassignedWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
  },
  breakdownCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownTitle: {
  },
  breakdownToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  breakdownExpandedContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(244, 63, 94, 0.2)',
  },
  durationWindowBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  reasonInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 46,
    textAlignVertical: 'top',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  draftNotice: {
    marginTop: 12,
    marginBottom: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveDraftBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDraftBtnText: {
  },
  submitBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  dateSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 8,
  },
  dateBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
});
