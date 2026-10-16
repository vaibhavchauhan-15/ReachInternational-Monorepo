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

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  LayoutAnimation,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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
import { useToast, EmptyState, ErrorState, FormError, Skeleton, SearchableSelect, type SelectOption } from '../ui';
import type { OperatorEntryContext, ClientShiftCode } from '@reachinternational/types';
import { supabase } from '../../lib/supabase';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { offlineQueueManager } from '../../lib/offline/OfflineQueueManager';
import { notifyLogEntryCreated, notifyMachineStatusChanged, postNotification } from '../../lib/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/useAuth';
import { Text, useTypeStyle } from '../ui/Text';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { TimeInput } from '../ui/TimeInput';
import { ShiftCardSelector, formatCompactShiftRange, getShiftDisplayTitle, type ShiftCardItem } from '../ui/ShiftCardSelector';
import { OperatorEntrySkeleton } from './OperationsSkeleton';
import {
  useOperationsMachinesLazy,
  useOperationsClientsLazy,
  useOperationsClientShifts,
  type LazyMachineOption,
  type LazyClientOption,
} from '../../lib/hooks/useOperationsData';

const DRAFT_STORAGE_KEY = '@reach_operator_log_draft';

export const DEFAULT_CLIENT_SHIFTS: ClientShiftCode[] = [
  {
    id: 'default-s1',
    client_id: '',
    code: 'Shift A',
    name: 'Shift A',
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
    code: 'Shift B',
    name: 'Shift B',
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
    code: 'Shift C',
    name: 'Shift C',
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
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onSuccess?: () => void | Promise<void>;
  initialShift?: string;
}

export const MobileOperatorEntryCard: React.FC<MobileOperatorEntryCardProps> = React.memo(
  function MobileOperatorEntryCard({
    entryContext,
    isLoading = false,
    isError = false,
    error,
    onRetry,
    onSuccess,
    initialShift,
  }) {
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

  // Machine and Client Selection State (Interactive Dropdown with Lazy Loading per user feedback)
  const [selectedMachineId, setSelectedMachineId] = useState<string>(() => entryContext?.machine?.id || '');
  const [selectedClientId, setSelectedClientId] = useState<string>(() => entryContext?.client?.id || '');
  const [hasOpenedMachineSelect, setHasOpenedMachineSelect] = useState<boolean>(false);
  const [hasOpenedClientSelect, setHasOpenedClientSelect] = useState<boolean>(false);

  // Lazy loading queries: ONLY fetch all fleet machines/clients on-demand when user opens dropdown or if unassigned
  const shouldFetchMachines = !entryContext?.machine?.id || hasOpenedMachineSelect;
  const shouldFetchClients = !entryContext?.client?.id || hasOpenedClientSelect;
  const { data: lazyMachines, isLoading: isLoadingMachines } = useOperationsMachinesLazy(shouldFetchMachines);
  const { data: lazyClients, isLoading: isLoadingClients } = useOperationsClientsLazy(shouldFetchClients);

  // Active machine & active client resolution
  const activeMachine = useMemo(() => {
    if (selectedMachineId) {
      const match = (lazyMachines || []).find((m) => m.id === selectedMachineId);
      if (match) return match;
    }
    return entryContext?.machine || null;
  }, [selectedMachineId, lazyMachines, entryContext?.machine]);

  const activeClient = useMemo(() => {
    if (selectedClientId) {
      const match = (lazyClients || []).find((c) => c.id === selectedClientId);
      if (match) return match;
    }
    return entryContext?.client || null;
  }, [selectedClientId, lazyClients, entryContext?.client]);

  // Effective rented client ID from client selector, machine's client link, or entry context
  const effectiveClientId =
    selectedClientId ||
    (activeMachine as any)?.client_id ||
    entryContext?.client?.id ||
    '';

  // Fetch canonical shift times directly from the rented client's shift configuration
  const { data: clientShiftsData } = useOperationsClientShifts(effectiveClientId);

  // Available shifts for this rented client (Cleanly normalized to Shift A / Shift B / Shift C)
  const availableShifts = useMemo<ClientShiftCode[]>(() => {
    let list: ClientShiftCode[] = [];
    if (clientShiftsData && clientShiftsData.length > 0) {
      list = clientShiftsData;
    } else if (entryContext?.shift_codes && entryContext.shift_codes.length > 0) {
      list = entryContext.shift_codes;
    } else {
      list = DEFAULT_CLIENT_SHIFTS;
    }

    return list.map((sc, idx) => {
      let codeLabel = sc.code;
      const cUpper = sc.code.trim().toUpperCase();
      if (cUpper === 'S1' || cUpper === 'A' || cUpper === 'SHIFT 1') codeLabel = 'Shift A';
      else if (cUpper === 'S2' || cUpper === 'B' || cUpper === 'SHIFT 2') codeLabel = 'Shift B';
      else if (cUpper === 'S3' || cUpper === 'C' || cUpper === 'SHIFT 3') codeLabel = 'Shift C';
      else if (!/^shift/i.test(sc.code)) {
        const letter = String.fromCharCode(65 + (idx % 26));
        codeLabel = `Shift ${letter}`;
      }
      return {
        ...sc,
        name: codeLabel,
      };
    });
  }, [clientShiftsData, entryContext?.shift_codes]);

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

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const submittingRef = useRef<boolean>(false);

  // Sync with entryContext when loaded
  useEffect(() => {
    if (entryContext) {
      if (entryContext.machine?.id && !selectedMachineId) {
        setSelectedMachineId(entryContext.machine.id);
      }
      if (entryContext.client?.id && !selectedClientId) {
        setSelectedClientId(entryContext.client.id);
      }
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
  }, [entryContext, resolvedInitialShift, selectedMachineId, selectedClientId]);

  // Auto-sync start and end times whenever available shifts change (e.g. rented client shifts loaded)
  useEffect(() => {
    if (availableShifts && availableShifts.length > 0) {
      const match =
        availableShifts.find((s) => {
          const sNorm = s.code.replace(/^shift\s*/i, '').trim().toUpperCase();
          const selNorm = selectedShiftCode.replace(/^shift\s*/i, '').trim().toUpperCase();
          return s.code.toUpperCase() === selectedShiftCode.toUpperCase() || (selNorm !== '' && sNorm === selNorm);
        }) || availableShifts[0];

      if (match) {
        if (match.code !== selectedShiftCode) {
          setSelectedShiftCode(match.code);
        }
        const s = formatTo12Hour(match.start_time || (match as any).raw_start_time);
        if (s) setStartTime(s);
        const e = formatTo12Hour(match.end_time || (match as any).raw_end_time);
        if (e) setEndTime(e);
        if ((match as any).default_ot_minutes && (match as any).default_ot_minutes > 0) {
          setOvertimeHours(((match as any).default_ot_minutes / 60).toString());
        }
      }
    }
  }, [availableShifts]);

  const handleSelectMachine = useCallback((machineId: string) => {
    setSelectedMachineId(machineId);
    const m = (lazyMachines || []).find((x) => x.id === machineId) || (entryContext?.machine?.id === machineId ? (entryContext.machine as any) : null);
    if (m) {
      if (typeof (m as any).hour_meter === 'number') {
        const hmrStr = String((m as any).hour_meter);
        setStartMeter(hmrStr);
        setEndMeter(hmrStr);
      }
      if ((m as any).client_id) {
        setSelectedClientId((m as any).client_id);
      }
    }
  }, [lazyMachines, entryContext?.machine]);

  const handleSelectClient = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
  }, []);

  const handleToggleBreakdown = useCallback(() => {
    haptics.toggle(!isBreakdown);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsBreakdown((prev) => !prev);
  }, [isBreakdown]);

  const machineSelectOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [];
    const seenIds = new Set<string>();

    const formatMachineOption = (m: any, isAssigned: boolean): SelectOption => {
      const model = m.model || m.machine_id;
      const serial = m.serial_number ? `S/N: ${m.serial_number}` : undefined;
      const isRented = m.status === 'rented';

      return {
        value: m.id,
        label: model,
        code: m.machine_id,
        description: serial,
        badge: isAssigned ? 'ASSIGNED' : isRented ? 'RENTED' : undefined,
        badgeVariant: isAssigned ? 'success' : isRented ? 'info' : 'neutral',
      };
    };

    if (entryContext?.machine?.id) {
      seenIds.add(entryContext.machine.id);
      list.push(formatMachineOption(entryContext.machine, true));
    }

    (lazyMachines || []).forEach((m) => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        list.push(formatMachineOption(m, false));
      }
    });

    return list;
  }, [entryContext?.machine, lazyMachines]);

  const clientSelectOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [];
    const seenIds = new Set<string>();

    const formatClientOption = (c: any, isAssigned: boolean): SelectOption => {
      const city = c.city || c.site || undefined;
      return {
        value: c.id,
        label: c.company_name,
        code: c.code || undefined,
        description: city,
        badge: isAssigned ? 'ASSIGNED' : 'UNASSIGNED',
        badgeVariant: isAssigned ? 'success' : 'neutral',
      };
    };

    if (entryContext?.client?.id) {
      seenIds.add(entryContext.client.id);
      list.push(formatClientOption(entryContext.client, true));
    }

    (lazyClients || []).forEach((c) => {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        list.push(formatClientOption(c, false));
      }
    });

    return list;
  }, [entryContext?.client, lazyClients]);

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

  const shiftTiming = useMemo(() => {
    return computeShiftTiming({
      logDate,
      startTime,
      endTime,
    });
  }, [logDate, startTime, endTime]);

  const isFutureShift = Boolean(
    shiftTiming?.endDateTime && shiftTiming.endDateTime.getTime() > Date.now() + 60 * 1000
  );

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
    if (submittingRef.current || isSubmitting) return;

    if (!entryContext?.operator?.id && !user?.id) {
      haptics.reject();
      const err = { title: 'Operator Profile Missing', message: 'Operator profile not found.' };
      postNotification({ category: 'log_entry', title: err.title, body: err.message, severity: 'error' });
      toast('error', err.title, err.message);
      return;
    }

    const effectiveMachine = activeMachine || entryContext?.machine;
    if (!effectiveMachine?.id) {
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
      submittingRef.current = true;
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
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const effectiveClient = activeClient || entryContext?.client;
      const effectiveLocation = (effectiveClient as any)?.site || (effectiveClient as any)?.city || (effectiveClient as any)?.address || null;
      const effectiveDate = shiftTiming?.resolvedStartDate || logDate;
      const effectiveShift = selectedShiftCode || 'S1';
      const idempotencyKey = `ihl_op_${effectiveMachine.id}_${effectiveOperatorId}_${effectiveDate}_${effectiveShift}`;

      // Pre-queue duplicate validation against local offline queue and cached server records
      const cachedOperatorLogs = queryClient.getQueryData<any[]>(['operator', 'history-logs', effectiveOperatorId]) || [];
      const dupCheck = offlineQueueManager.checkDuplicateShiftLog({
        machineId: effectiveMachine.id,
        operatorId: effectiveOperatorId,
        logDate: effectiveDate,
        shiftCode: effectiveShift,
        existingLogs: cachedOperatorLogs,
      });

      if (dupCheck.isDuplicate) {
        haptics.reject();
        const dupTitle = 'Shift Already Logged';
        const dupMessage = dupCheck.reason || `A log for Shift ${effectiveShift} on ${effectiveDate} has already been recorded or queued.`;
        postNotification({
          category: 'log_entry',
          title: dupTitle,
          body: dupMessage,
          severity: 'warning',
        });
        toast('warning', dupTitle, dupMessage);
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const rpcParams = {
        p_machine_id: effectiveMachine.id,
        p_operator_id: effectiveOperatorId,
        p_client_id: effectiveClient?.id || null,
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
        p_location: effectiveLocation,
        p_remarks: breakdownReason.trim() || null,
        p_idempotency_key: idempotencyKey,
        p_entered_by: user?.id || effectiveOperatorId,
      };

      logPayload = {
        machine_id: effectiveMachine.id,
        shift_code: selectedShiftCode,
        client_id: effectiveClient?.id || null,
        location: effectiveLocation,
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
        machine_id: effectiveMachine.id,
        log_date: shiftTiming.resolvedStartDate || logDate,
        start_meter: startNum,
        end_meter: endNum,
        running_hours: runningHours,
        overtime_hours: shiftTiming.overtimeHours,
        shift_code: selectedShiftCode,
        is_breakdown: isBreakdown,
        sync_status: isOffline ? 'queued' : 'pending',
        syncState: isOffline ? 'queued' : 'pending',
        machine: effectiveMachine,
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
        notifyLogEntryCreated(effectiveMachine.machine_id || 'Machine', runningHours, shiftTiming.overtimeHours);
        if (isBreakdown) {
          notifyMachineStatusChanged(effectiveMachine.machine_id || 'Machine', 'breakdown');
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
          if ((rpcRes as any).already_logged) {
            toast('info', 'Shift Already Recorded', 'This shift log was already recorded with identical meter readings.');
          }
        } else if (rpcErr) {
          const rpcMsg = (rpcErr.message || '').toLowerCase();
          if (
            rpcErr.code === '23505' ||
            rpcMsg.includes('duplicate') ||
            rpcMsg.includes('already has a log') ||
            rpcMsg.includes('already been logged') ||
            rpcMsg.includes('another machine') ||
            rpcMsg.includes('uq_machine_hour_logs') ||
            rpcMsg.includes('cannot be less than start meter') ||
            rpcMsg.includes('cannot exceed 24 hours') ||
            rpcMsg.includes('shift end timestamp') ||
            rpcMsg.includes('overlap') ||
            rpcMsg.includes('cannot log before shift end') ||
            rpcMsg.includes('breakdown duration') ||
            rpcMsg.includes('maintenance or') ||
            rpcMsg.includes('inactive') ||
            rpcMsg.includes('unauthorized operator') ||
            rpcMsg.includes('client id does not match') ||
            rpcMsg.includes('previous 7 days') ||
            rpcMsg.includes('assigned to shift') ||
            rpcMsg.includes('unassigned shift') ||
            rpcMsg.includes('please select your assigned shift') ||
            rpcErr.code === '23514' ||
            rpcErr.code === '42501' ||
            rpcErr.code === '23503'
          ) {
            throw rpcErr;
          }
        }
      } catch (rpcCatchErr: any) {
        const catchMsg = (rpcCatchErr?.message || '').toLowerCase();
        if (
          rpcCatchErr.code === '23505' ||
          catchMsg.includes('duplicate') ||
          catchMsg.includes('already has a log') ||
          catchMsg.includes('already been logged') ||
          catchMsg.includes('another machine') ||
          catchMsg.includes('uq_machine_hour_logs') ||
          catchMsg.includes('cannot be less than start meter') ||
          catchMsg.includes('cannot exceed 24 hours') ||
          catchMsg.includes('shift end timestamp') ||
          catchMsg.includes('overlap') ||
          catchMsg.includes('cannot log before shift end') ||
          catchMsg.includes('breakdown duration') ||
          catchMsg.includes('maintenance or') ||
          catchMsg.includes('inactive') ||
          catchMsg.includes('unauthorized operator') ||
          catchMsg.includes('client id does not match') ||
          catchMsg.includes('previous 7 days') ||
          catchMsg.includes('assigned to shift') ||
          catchMsg.includes('unassigned shift') ||
          catchMsg.includes('please select your assigned shift') ||
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
          .eq('id', effectiveMachine.id);
      }

      // Optimistic update for operator dashboard
      queryClient.setQueriesData({ queryKey: ['dashboard'] }, (old: any) => {
        if (!old || !old.today) return old;
        const newSubmittedCount = (old.today.submittedCount || 0) + 1;
        const totalAssigned = old.today.totalAssignedCount || (old.assigned_shifts?.length || 1);
        const updatedShifts = (old.assigned_shifts || []).map((s: any) => {
          if (s.code === selectedShiftCode || (!selectedShiftCode && !s.is_logged_today)) {
            return {
              ...s,
              is_logged_today: true,
              running_hours_today: runningHours,
              end_meter_today: endNum,
            };
          }
          return s;
        });

        return {
          ...old,
          today: {
            ...old.today,
            submittedCount: newSubmittedCount,
            totalRunningHoursToday: Number(((old.today.totalRunningHoursToday || 0) + runningHours).toFixed(1)),
            entryStatus: newSubmittedCount >= totalAssigned ? 'submitted' : 'partial',
            lastHmr: endNum,
          },
          assigned_shifts: updatedShifts,
        };
      });

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
      queryClient.invalidateQueries({
        queryKey: ['dashboard'],
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
          notifyLogEntryCreated(effectiveMachine?.machine_id || 'Machine', runningHours, shiftTiming?.overtimeHours || 0);
          if (isBreakdown) {
            notifyMachineStatusChanged(effectiveMachine?.machine_id || 'Machine', 'breakdown');
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
      submittingRef.current = false;
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

  // Popover date select options for SearchableSelect
  const dateSelectOptions = useMemo<SelectOption[]>(() => {
    return selectableDates.map((item) => ({
      value: item.date,
      label: item.label,
      badge: item.badge || undefined,
      badgeVariant: item.isToday ? 'success' : 'neutral',
      icon: <Calendar size={14} color="#0284c7" />,
    }));
  }, [selectableDates]);

  if (isError && !entryContext) {
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
        <ErrorState
          error={error}
          onRetry={onRetry || onSuccess}
          title="Failed to Load Shift Context"
          message="Could not retrieve your operator assignments or machine settings. Check your network and try again."
          retryLabel="Retry Loading"
        />
      </View>
    );
  }

  // Progressive skeleton gate: show "No Equipment" state only once we know for certain
  // there is no assignment (context loaded, no machine). While loading, fall through to the
  // full form so the static shell is instantly visible with inline skeleton placeholders.
  if (!isLoading && (!entryContext?.machine || !entryContext.machine.id)) {
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
        <View style={styles.titleBlock}>
          <Text variant="heading" style={[styles.mainHeading, { color: theme.colors.ink }]}>
            Daily Machine Log Entry
          </Text>
          <Text variant="caption" style={[styles.mainSubtitle, { color: theme.colors.mute }]}>
            Fill in your shift meters and operational status
          </Text>
        </View>

        <View style={[styles.titleDivider, { backgroundColor: theme.colors.hairline }]} />

        <EmptyState
          variant="empty"
          title="No Equipment Assigned"
          description="You do not have any machine assigned to your account for today's shift. Please contact your site supervisor to assign equipment."
          actionLabel="Refresh Assignment"
          onAction={onSuccess || onRetry}
          icon={<Truck size={28} color={theme.colors.mute} />}
        />
      </View>
    );
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

        {/* Machine Dropdown Selection with Lazy Loading */}
        <SearchableSelect
          label="Assigned Machine"
          required
          options={machineSelectOptions}
          value={selectedMachineId}
          onChange={(val) => handleSelectMachine(val)}
          onDropdownOpen={() => setHasOpenedMachineSelect(true)}
          placeholder={isLoadingMachines ? 'Loading machinery...' : 'Select machine...'}
          leftIcon={<Truck size={16} color={isDark ? '#38bdf8' : '#0284c7'} />}
          presentation="dropdown"
          searchable={true}
          searchPlaceholder="Search machine ID, model, serial..."
        />

        {/* Client & Site Dropdown Selection with Lazy Loading */}
        <View style={{ marginTop: 12 }}>
          <SearchableSelect
            label="Client & Site Location"
            required
            options={clientSelectOptions}
            value={selectedClientId}
            onChange={(val) => handleSelectClient(val)}
            onDropdownOpen={() => setHasOpenedClientSelect(true)}
            placeholder={isLoadingClients ? 'Loading clients...' : 'Select client & site...'}
            leftIcon={<Building2 size={16} color={isDark ? '#4ade80' : '#16a34a'} />}
            presentation="dropdown"
            searchable={true}
            searchPlaceholder="Search client name or site..."
          />
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
          </View>

          {/* Progressive: skeleton while HMR value is fetching, real input once ready */}
          {isLoading ? (
            <Skeleton width="100%" height={48} borderRadius={12} animate style={{ marginTop: 2 }} />
          ) : (
            <Input
              name="start_meter_val"
              id="start_meter_val"
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoComplete={Platform.OS === 'web' ? ('one-time-code' as any) : 'off'}
              textContentType="none"
              importantForAutofill="no"
              autoCorrect={false}
              spellCheck={false}
              aria-autocomplete="none"
              value={startMeter}
              onChangeText={handleStartMeterChange}
              editable={true}
              style={[
                styles.meterInput,
                monoTypeStyle,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                  color: theme.colors.ink,
                },
              ]}
            />
          )}
          <Text variant="caption" style={[styles.helperText, { color: theme.colors.mute }]}>
            Auto-filled from last recorded data. Tap to change.
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
            name="end_meter_val"
            id="end_meter_val"
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoComplete={Platform.OS === 'web' ? ('one-time-code' as any) : 'off'}
            textContentType="none"
            importantForAutofill="no"
            autoCorrect={false}
            spellCheck={false}
            aria-autocomplete="none"
            value={endMeter}
            onChangeText={setEndMeter}
            error={isMeterRegressed}
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
            <FormError message={`End meter must be ≥ ${startNum.toFixed(1)}.`} />
          )}
          {isOver24Hours && (
            <FormError message="Running hours cannot exceed 24 hours per shift." />
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

        {/* Progressive skeleton rows while last_log fetches, real values once resolved */}
        {isLoading ? (
          <View style={[styles.lastShiftRows, { gap: 8 }]}>
            {/* Row 1: Last Recorded Date */}
            <View style={styles.lastShiftRow}>
              <Text variant="caption" style={[styles.lastShiftRowLabel, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                Last Recorded Date
              </Text>
              <Skeleton width={100} height={14} borderRadius={4} animate />
            </View>
            {/* Row 2: Shift End Time */}
            <View style={styles.lastShiftRow}>
              <Text variant="caption" style={[styles.lastShiftRowLabel, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                Shift End Time
              </Text>
              <Skeleton width={80} height={14} borderRadius={4} animate />
            </View>
            {/* Row 3: Last Entry By */}
            <View style={styles.lastShiftRow}>
              <Text variant="caption" style={[styles.lastShiftRowLabel, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                Last Entry By
              </Text>
              <Skeleton width={90} height={14} borderRadius={4} animate />
            </View>
          </View>
        ) : last_log ? (
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

          {/* Duration Badge */}
          {shiftDurationHours > 0 && (
            <Text variant="mono" style={[styles.durationBadge, { color: theme.colors.ink }]}>
              {shiftDurationHours.toFixed(1)} hrs
            </Text>
          )}
        </View>

        {/* Date Selector Popover (SearchableSelect Dropdown) */}
        <View style={{ marginTop: 10 }}>
          <SearchableSelect
            label="Select Date"
            required
            options={dateSelectOptions}
            value={logDate}
            onChange={(val) => setLogDate(val)}
            placeholder="Select shift date..."
            leftIcon={<Calendar size={15} color="#0284c7" />}
            presentation="dropdown"
            searchable={false}
          />
        </View>

        {/* Shift Card Selector (Shift A / B / C badges) */}
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

          {/* Warning if unassigned shift selected */}
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
                  flex: 1,
                }}
              >
                Assigned to Shift {assignedShiftCodes.join(', ')} only.
              </Text>
            </View>
          )}

          {/* In-progress shift advisory banner */}
          {isFutureShift && (
            <View
              style={[
                styles.unassignedWarningBanner,
                {
                  backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
                  borderColor: isDark ? 'rgba(2, 132, 199, 0.3)' : '#bae6fd',
                  marginTop: 8,
                },
              ]}
            >
              <Clock size={11} color={isDark ? '#38bdf8' : '#0284c7'} />
              <Text
                variant="micro"
                style={{
                  color: isDark ? '#38bdf8' : '#0369a1',
                  flex: 1,
                }}
              >
                Shift in progress · Submit logs after {formatTo12Hour(endTime) || endTime}.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 5. MACHINE BREAKDOWN SECTION (Smooth Transition, White Button Text) */}
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
            onPress={handleToggleBreakdown}
            style={[
              styles.breakdownToggleBtn,
              {
                backgroundColor: isBreakdown ? '#e11d48' : '#0284c7',
                borderColor: isBreakdown ? '#e11d48' : '#0284c7',
              },
            ]}
          >
            <Text
              variant="label"
              style={{
                color: '#ffffff',
              }}
            >
              {isBreakdown ? 'Remove' : '+ Add'}
            </Text>
          </Pressable>
        </View>

        {/* Expanded Breakdown Fields with Smooth Animation */}
        {isBreakdown && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.breakdownExpandedContent}>
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

            {/* Duration Window Pink Badge */}
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
                    color: isDark ? '#fb7185' : '#e11d48',
                  }}
                >
                  Duration Window: {breakdownStartTime} - {breakdownEndTime} ({breakdownStats.durationDecimalHours} hrs)
                </Text>
              </View>
            )}

            {/* Reason Textarea */}
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
              {isBreakdown && !breakdownReason.trim() && (
                <FormError message="Breakdown reason & action taken is required when reporting a breakdown." />
              )}
            </View>
          </Animated.View>
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
    </View>
  );
});

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
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
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
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  selectionMetaRow: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  metaBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
