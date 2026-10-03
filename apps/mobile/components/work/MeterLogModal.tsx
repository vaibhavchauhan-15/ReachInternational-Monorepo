import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Button, Input, TimeInput, useTheme, SearchableSelect, type SelectOption, ShiftCardSelector } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Check, ChevronDown, Clock, AlertTriangle, User, CheckCircle2, Building2 } from 'lucide-react-native';
import { validateMobileClipboardInput } from '../../lib/security/clipboard';
import { HmrSchema } from '@reachinternational/validation';
import {
  computeShiftTiming,
  computeBreakdownDuration,
  findLatestMachineLogTimeline,
  formatTo12Hour,
  parseProfileShiftTime,
  formatDate,
  getISTDateString,
  resolveDefaultOperatorShift,
  getShiftSubtitle,
} from '@reachinternational/utils';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { offlineQueueManager } from '../../lib/offline/OfflineQueueManager';
import { notifyLogEntryCreated, notifyMachineStatusChanged, notifyAssistedShiftLogged } from '../../lib/notifications';

export interface MeterLogModalProps {
  visible: boolean;
  onClose: () => void;
  machineId?: string;
  machineCode?: string;
  model?: string;
  serialNumber?: string;
  onSubmit?: (log?: any) => void;
  existingLog?: any;
  targetOperatorId?: string;
  targetOperatorName?: string;
  currentUserId?: string;
  currentUserRole?: string;
  currentUserName?: string;
  initialShiftCode?: string;
  initialClientId?: string;
  initialStartMeter?: number | string;
  initialLogDate?: string;
  initialAssignedShiftCodes?: string[];
}

export const MeterLogModal: React.FC<MeterLogModalProps> = ({
  visible,
  onClose,
  machineId = '',
  machineCode = '',
  model = '',
  serialNumber = '',
  onSubmit,
  existingLog,
  targetOperatorId,
  targetOperatorName,
  currentUserId,
  currentUserRole,
  currentUserName,
  initialShiftCode,
  initialClientId,
  initialStartMeter,
  initialLogDate,
  initialAssignedShiftCodes,
}) => {
  const { theme } = useTheme();
  const { isOffline } = useNetworkStatus();

  const [logDate, setLogDate] = useState(() => getISTDateString());
  const [startMeter, setStartMeter] = useState('0');
  const [endMeter, setEndMeter] = useState('0');
  const [startTime, setStartTime] = useState('06:00 AM');
  const [endTime, setEndTime] = useState('02:00 PM');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isBreakdown, setIsBreakdown] = useState(false);
  const [breakdownStartTime, setBreakdownStartTime] = useState('02:30 PM');
  const [breakdownEndTime, setBreakdownEndTime] = useState('03:25 PM');

  useEffect(() => {
    if (visible && existingLog) {
      if (existingLog.log_date) setLogDate(existingLog.log_date.split('T')[0]);
      if (existingLog.start_meter !== undefined) setStartMeter(String(existingLog.start_meter));
      if (existingLog.end_meter !== undefined) setEndMeter(String(existingLog.end_meter));
      if (existingLog.start_time) setStartTime(formatTo12Hour(existingLog.start_time) || existingLog.start_time);
      if (existingLog.end_time) setEndTime(formatTo12Hour(existingLog.end_time) || existingLog.end_time);
      if (existingLog.overtime_hours !== undefined) setOvertimeHours(String(existingLog.overtime_hours));
      if (existingLog.location) setLocation(existingLog.location);
      if (existingLog.remarks) {
        setRemarks(existingLog.remarks.replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, '').trim());
      }
      if (existingLog.is_breakdown !== undefined) setIsBreakdown(Boolean(existingLog.is_breakdown));
      if (existingLog.breakdown_start_time) {
        setBreakdownStartTime(formatTo12Hour(existingLog.breakdown_start_time) || existingLog.breakdown_start_time);
      }
      if (existingLog.breakdown_end_time) {
        setBreakdownEndTime(formatTo12Hour(existingLog.breakdown_end_time) || existingLog.breakdown_end_time);
      }
      if (existingLog.client_id) setSelectedClientId(existingLog.client_id);
    }
  }, [visible, existingLog]);

  // Real-time computed breakdown duration
  const breakdownStats = React.useMemo(() => {
    if (!isBreakdown) return null;
    return computeBreakdownDuration(breakdownStartTime, breakdownEndTime);
  }, [isBreakdown, breakdownStartTime, breakdownEndTime]);

  // 7-day past dates list (Today + past 7 days)
  const pastDates = React.useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = getISTDateString(d);
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
      dates.push({
        str,
        label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i}d ago`,
        subLabel: `${weekday}, ${dayNum} ${monthShort}`,
      });
    }
    return dates;
  }, []);

  // Client Selection
  const [clients, setClients] = useState<Array<{ id: string; name: string; client_name?: string; street?: string; address?: string; city?: string; district?: string; state?: string; pincode?: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const clientOptions = React.useMemo<SelectOption[]>(() => {
    return clients.map((c) => {
      const parts = [c.street, c.city, c.district, c.state, c.pincode]
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter(Boolean);
      const loc = parts.length > 0 ? parts.join(', ') : (c.address ? String(c.address).trim() : '');
      return {
        value: c.id,
        label: c.name || c.client_name || 'Client',
        description: loc || undefined,
      };
    });
  }, [clients]);

  // Client Shift Codes & Operator Assigned Shifts
  const [shiftCodes, setShiftCodes] = useState<any[]>([]);
  const [selectedShiftCode, setSelectedShiftCode] = useState<string | null>(null);
  const [assignedShiftCodes, setAssignedShiftCodes] = useState<string[]>(() => initialAssignedShiftCodes || []);
  const [todayLoggedCodes, setTodayLoggedCodes] = useState<string[]>([]);
  const [todayLogs, setTodayLogs] = useState<Array<{ shift_code: string; end_meter: number; running_hours: number }>>([]);
  const [showManualTimes, setShowManualTimes] = useState(false);

  const fetchTodayLogs = async (mId?: string, opId?: string) => {
    const activeMachineId = mId || machineId;
    let activeOpId = opId || targetOperatorId;
    if (!activeOpId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        activeOpId = authData?.user?.id;
      } catch {
        // Non-blocking
      }
    }
    if (!activeMachineId || !activeOpId) return;

    try {
      const todayStr = getISTDateString();
      const { data } = await supabase
        .from('machine_hour_logs')
        .select('shift_code, end_meter, running_hours')
        .eq('machine_id', activeMachineId)
        .eq('operator_id', activeOpId)
        .eq('log_date', todayStr);

      if (data && data.length > 0) {
        const codes = data.map((d: any) => d.shift_code).filter(Boolean);
        setTodayLoggedCodes(codes);
        setTodayLogs(data as any);
      } else {
        setTodayLoggedCodes([]);
        setTodayLogs([]);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchAssignedShifts = async (mId?: string, opId?: string): Promise<string[]> => {
    const activeMachineId = mId || machineId;
    let activeOpId = opId || targetOperatorId;
    if (!activeOpId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        activeOpId = authData?.user?.id;
      } catch {
        // Non-blocking
      }
    }
    if (!activeMachineId || !activeOpId) {
      setAssignedShiftCodes([]);
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('operator_machine_assignments')
        .select('shift_code')
        .eq('machine_id', activeMachineId)
        .eq('operator_id', activeOpId)
        .eq('is_active', true);
      if (!error && data) {
        const codes = data.map((r: any) => r.shift_code).filter(Boolean);
        setAssignedShiftCodes(codes);
        return codes;
      }
    } catch {
      // Non-blocking fallback
    }
    return [];
  };

  const fetchShiftCodes = async (cId: string, currentAssignedCodes?: string[]) => {
    try {
      const { data } = await supabase
        .from('client_shift_codes')
        .select('*')
        .eq('client_id', cId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('code', { ascending: true });
      if (data && data.length > 0) {
        setShiftCodes(data);
        const effectiveAssigned = currentAssignedCodes !== undefined ? currentAssignedCodes : assignedShiftCodes;
        const assignedMatch = effectiveAssigned.length > 0
          ? data.find((sc: any) => effectiveAssigned.includes(sc.code))
          : null;
        const match = assignedMatch || resolveDefaultOperatorShift({ assigned_shift_code: initialShiftCode }, data);
        const target = match || (!selectedShiftCode ? data[0] : null);
        if (target) {
          setSelectedShiftCode(target.code);
          const s = formatTo12Hour(target.start_time) || target.start_time;
          const e = formatTo12Hour(target.end_time) || target.end_time;
          if (s) setStartTime(s);
          if (e) setEndTime(e);
          const defaultOt = target.default_ot_minutes ? String(target.default_ot_minutes / 60) : '0';
          setOvertimeHours(defaultOt);
        }
      } else {
        setShiftCodes([]);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchMachineDeployment = async () => {
    if (!machineId) return;
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('client_id')
        .eq('id', machineId)
        .single();
      if (!error && data?.client_id && data.client_id !== selectedClientId) {
        setSelectedClientId(data.client_id);
        fetchShiftCodes(data.client_id);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      fetchShiftCodes(selectedClientId);
    }
  }, [selectedClientId]);

  // Real-time listener: operator_machine_assignments, machine_hour_logs, and machines deployment
  useEffect(() => {
    if (!visible || !machineId) return;

    fetchAssignedShifts().then((codes) => {
      if (selectedClientId) {
        fetchShiftCodes(selectedClientId, codes);
      }
    });
    fetchTodayLogs();
    fetchMachineDeployment();

    // Channel for real-time table mutations on operator_machine_assignments and machines
    const realtimeChannel = supabase
      .channel(`rt-meter-log-${machineId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operator_machine_assignments',
          filter: `machine_id=eq.${machineId}`,
        },
        async () => {
          const freshCodes = await fetchAssignedShifts();
          if (selectedClientId) {
            fetchShiftCodes(selectedClientId, freshCodes);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machine_hour_logs',
          filter: `machine_id=eq.${machineId}`,
        },
        async () => {
          fetchTodayLogs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'machines',
          filter: `id=eq.${machineId}`,
        },
        (payload: any) => {
          if (payload.new?.client_id && payload.new.client_id !== selectedClientId) {
            setSelectedClientId(payload.new.client_id);
            fetchShiftCodes(payload.new.client_id);
          }
        }
      )
      .subscribe();

    // Channel for broadcast messages across supervisors and operators
    const rosterBroadcastChannel = supabase
      .channel('operations-roster')
      .on('broadcast', { event: 'assignment_changed' }, async (eventPayload: any) => {
        if (eventPayload?.payload?.machineId === machineId) {
          const freshCodes = await fetchAssignedShifts();
          if (selectedClientId) {
            fetchShiftCodes(selectedClientId, freshCodes);
          }
        }
      })
      .on('broadcast', { event: 'deployment_changed' }, (eventPayload: any) => {
        if (eventPayload?.payload?.machineId === machineId && eventPayload?.payload?.clientId) {
          setSelectedClientId(eventPayload.payload.clientId);
          fetchShiftCodes(eventPayload.payload.clientId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
      supabase.removeChannel(rosterBroadcastChannel);
    };
  }, [visible, machineId, targetOperatorId, selectedClientId]);

  const handleSelectShift = (shift: any) => {
    setSelectedShiftCode(shift.code);
    const s = formatTo12Hour(shift.start_time) || shift.start_time;
    const e = formatTo12Hour(shift.end_time) || shift.end_time;
    if (s) setStartTime(s);
    if (e) setEndTime(e);
    const defaultOt = shift.default_ot_minutes ? String(shift.default_ot_minutes / 60) : '0';
    setOvertimeHours(defaultOt);

    // Continuous 24h start-meter handoff:
    // If earlier shifts were logged today on this machine, auto-hand off the highest end meter
    if (todayLogs.length > 0) {
      const highestEndMeter = Math.max(...todayLogs.map((l) => Number(l.end_meter) || 0));
      if (highestEndMeter > 0) {
        setStartMeter(String(highestEndMeter));
        setEndMeter(String(highestEndMeter));
      }
    }
  };

  const [latestTimeline, setLatestTimeline] = useState<{
    latestLog: any | null;
    endDateTime: Date | null;
    formattedEndTime: string;
    formattedEndDate: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Interval ticker for real-time validation against current clock
  const [currentTick, setCurrentTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Shift duration, normal working time and overtime calculation via canonical helper
  const shiftStats = React.useMemo(() => {
    const ot = parseFloat(overtimeHours);
    return computeShiftTiming({
      logDate,
      startTime,
      endTime,
      manualOvertime: isNaN(ot) ? undefined : ot,
      disallowFutureEnd: true,
      currentTimestamp: currentTick,
    });
  }, [logDate, startTime, endTime, overtimeHours, currentTick]);

  // Real-time sequencing check against machine timeline
  const sequencingError = React.useMemo(() => {
    if (!latestTimeline || !latestTimeline.endDateTime || !shiftStats.isValid || !shiftStats.startDateTime) {
      return null;
    }
    const prevEndMs = latestTimeline.endDateTime.getTime();
    const currentStartMs = shiftStats.startDateTime.getTime();
    if (currentStartMs < prevEndMs) {
      return {
        isInvalid: true,
        message: `Start (${formatTo12Hour(startTime)}) cannot precede prev shift end (${latestTimeline.formattedEndDate}, ${latestTimeline.formattedEndTime}).`,
        recommendedTime: latestTimeline.formattedEndTime,
        recommendedDate: latestTimeline.latestLog?.end_date || latestTimeline.latestLog?.log_date || logDate,
      };
    }
    return null;
  }, [latestTimeline, shiftStats.isValid, shiftStats.startDateTime, startTime, logDate]);

  const fetchTargetUserShift = async () => {
    try {
      const opId = targetOperatorId || (await supabase.auth.getUser()).data?.user?.id;
      if (!opId) return;
      const { data: uData } = await supabase
        .from('users')
        .select('shift_start_time, shift_end_time')
        .eq('id', opId)
        .single();
      if (uData) {
        let s = uData.shift_start_time ? formatTo12Hour(uData.shift_start_time) : '';
        let e = uData.shift_end_time ? formatTo12Hour(uData.shift_end_time) : '';
        if (s && !initialShiftCode) setStartTime(s);
        if (e && !initialShiftCode) setEndTime(e);
      }
    } catch {
      // Non-blocking fallback to defaults
    }
  };

  useEffect(() => {
    if (visible) {
      if (initialLogDate) setLogDate(initialLogDate);
      if (initialShiftCode) setSelectedShiftCode(initialShiftCode);
      if (initialClientId) setSelectedClientId(initialClientId);
      if (initialStartMeter !== undefined && initialStartMeter !== null && initialStartMeter !== '') {
        const smStr = String(initialStartMeter);
        setStartMeter(smStr);
        const sVal = parseFloat(smStr) || 0;
        setEndMeter(String(sVal + 8));
      }
      fetchTargetUserShift();
      fetchClients();
      setError('');
      setSuccess('');
      if (machineId) {
        fetchLatestMachineLog();
      }
    }
  }, [visible, machineId, targetOperatorId, initialLogDate, initialShiftCode, initialClientId, initialStartMeter]);

  const fetchClients = async () => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, company_name, street, city, district, state, pincode')
        .order('company_name');
      if (data) {
        const clientItems = data.map((c: any) => ({
          id: c.id,
          name: c.company_name || c.client_name || 'Client',
          client_name: c.company_name || c.client_name,
          street: c.street,
          city: c.city,
          district: c.district,
          state: c.state,
          pincode: c.pincode,
        }));
        setClients(clientItems);
        if (clientItems.length > 0 && !selectedClientId && !initialClientId && !location) {
          setSelectedClientId(clientItems[0].id);
          const firstClient = clientItems[0];
          const fullAddr = [firstClient.street, firstClient.city, firstClient.district, firstClient.state, firstClient.pincode].filter(Boolean).map((s: any) => String(s).trim()).filter(Boolean).join(', ');
          if (fullAddr) setLocation(fullAddr);
        }
      }
    } catch (e) {
      console.warn('Error fetching clients:', e);
    }
  };

  const fetchLatestMachineLog = async () => {
    try {
      const { data } = await supabase
        .from('machine_hour_logs')
        .select('id, machine_id, log_date, end_date, start_time, end_time, start_datetime, end_datetime, end_meter, location, client_id')
        .eq('machine_id', machineId)
        .order('log_date', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        const timeline = findLatestMachineLogTimeline(data, machineId);
        setLatestTimeline(timeline);
        const hasInitMeter = initialStartMeter !== undefined && initialStartMeter !== null && initialStartMeter !== '';
        if (!hasInitMeter && timeline.latestLog?.end_meter) {
          setStartMeter(String(timeline.latestLog.end_meter));
          setEndMeter(String(timeline.latestLog.end_meter + 8));
        }
        if (timeline.latestLog?.location && !location) setLocation(timeline.latestLog.location);
        if (!initialClientId && timeline.latestLog?.client_id) setSelectedClientId(timeline.latestLog.client_id);
      }
    } catch (e) {
      // Ignore if no prior log
    }
  };

  const handleSelectClient = (c: { id: string; name: string; street?: string; address?: string; city?: string; district?: string; state?: string; pincode?: string }) => {
    setSelectedClientId(c.id);
    const fullAddr = [c.street, c.city, c.district, c.state, c.pincode].filter(Boolean).map((s: any) => String(s).trim()).filter(Boolean).join(', ');
    if (fullAddr) {
      setLocation(fullAddr);
    }
  };

  const handleStartMeterChange = (val: string) => {
    const res = validateMobileClipboardInput(val, HmrSchema);
    if (!res.success && val.trim() !== '') {
      setError(res.error || 'Invalid start meter reading.');
    } else {
      setError('');
    }
    setStartMeter(res.sanitizedValue);
  };

  const handleEndMeterChange = (val: string) => {
    const res = validateMobileClipboardInput(val, HmrSchema);
    if (!res.success && val.trim() !== '') {
      setError(res.error || 'Invalid end meter reading.');
    } else {
      setError('');
    }
    setEndMeter(res.sanitizedValue);
  };

  const startVal = parseFloat(startMeter) || 0;
  const endVal = parseFloat(endMeter) || 0;
  const runningHours = Math.max(0, endVal - startVal);

  const handleSubmit = async () => {
    if (!startMeter.trim()) {
      setError('Start meter reading is required.');
      return;
    }
    const startVal = parseFloat(startMeter);
    if (isNaN(startVal) || startVal < 0) {
      setError('Start meter reading must be a valid non-negative number.');
      return;
    }

    if (!endMeter.trim()) {
      setError('End meter reading is required.');
      return;
    }
    const endVal = parseFloat(endMeter);
    if (isNaN(endVal) || endVal < 0) {
      setError('End meter reading must be a valid non-negative number.');
      return;
    }

    if (endVal < startVal) {
      setError('End meter reading cannot be less than start meter.');
      return;
    }

    if (endVal - startVal > 24) {
      setError('Machine running hours cannot exceed 24 hours in a single log.');
      return;
    }

    if (shiftCodes.length > 0 && (!selectedShiftCode || !selectedShiftCode.trim())) {
      setError('Please select an operational shift.');
      return;
    }

    let userId = currentUserId;
    if (!userId) {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id;
    }
    const effectiveOperatorId = targetOperatorId || userId;
    const isAssisted = Boolean(targetOperatorId && targetOperatorId !== userId);
    const effectiveEntrySource = isAssisted ? (currentUserRole || 'admin') : 'operator';

    const isUnassigned = assignedShiftCodes.length > 0 && selectedShiftCode && !assignedShiftCodes.includes(selectedShiftCode);
    if (isUnassigned && !isAssisted) {
      setError(`Operator is assigned to Shift ${assignedShiftCodes.join(', ')} on this equipment, but attempted to log for Shift ${selectedShiftCode}. Please select your assigned shift.`);
      return;
    }

    if (shiftStats.isFutureEnd || !shiftStats.isValid) {
      setError(shiftStats.errorMessage || 'Cannot log before shift end.');
      return;
    }

    if (sequencingError?.isInvalid) {
      setError(sequencingError.message);
      return;
    }

    if (isBreakdown) {
      if (!breakdownStats?.isValid) {
        setError(breakdownStats?.errorMessage || 'Please enter valid breakdown start and end times.');
        return;
      }
      const maxAllowedDuration = shiftStats.durationHours > 0 ? shiftStats.durationHours : 24;
      if (shiftStats.isValid && breakdownStats.durationDecimalHours > maxAllowedDuration) {
        setError(`Breakdown duration (${breakdownStats.durationDecimalHours}h) cannot exceed total shift duration (${maxAllowedDuration}h).`);
        return;
      }
    }

    setError('');
    setIsSubmitting(true);

    let logPayload: Record<string, any> | null = null;

    try {
      if (isAssisted && userId) {
        const callerRole = currentUserRole || (await supabase.from('users').select('role').eq('id', userId).single()).data?.role;
        if (callerRole && !['super_admin', 'admin', 'manager'].includes(callerRole)) {
          setError('Only roles above supervisor (manager, admin, super_admin) can enter logs on behalf of operators.');
          setIsSubmitting(false);
          return;
        }
      }

      let bkdDurationFormatted = '';
      let bkdStart = '';
      let bkdEnd = '';
      let bkdDecimalHours = 0;
      if (isBreakdown && breakdownStats?.isValid) {
        bkdDurationFormatted = breakdownStats.fullBreakdownString;
        bkdStart = breakdownStartTime.trim();
        bkdEnd = breakdownEndTime.trim();
        bkdDecimalHours = breakdownStats.durationDecimalHours;
      }

      let remarksPayload = isBreakdown ? remarks.trim() : '';
      if (isBreakdown && bkdDurationFormatted) {
        remarksPayload = `[Breakdown Duration: ${bkdDurationFormatted}] ${remarksPayload}`.trim();
      }
      if (isUnassigned && isAssisted) {
        remarksPayload = `[Assisted Override: Shift ${selectedShiftCode}] ${remarksPayload}`.trim();
      }

      logPayload = {
        machine_id: machineId || null,
        machine_code: machineCode || 'Equipment',
        model: model || '',
        serial_number: serialNumber || '',
        client_id: selectedClientId || null,
        shift_code: selectedShiftCode || null,
        location: location.trim() || null,
        start_meter: startVal,
        end_meter: endVal,
        running_hours: runningHours,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        overtime_hours: shiftStats.overtimeHours,
        normal_working_hours: shiftStats.normalWorkingHours,
        is_breakdown: isBreakdown,
        breakdown_start_time: bkdStart || null,
        breakdown_end_time: bkdEnd || null,
        breakdown_duration: bkdDurationFormatted || null,
        breakdown_hours: bkdDecimalHours,
        shift: null,
        machine_condition: isBreakdown ? 'breakdown' : 'good',
        remarks: remarksPayload || null,
        operator_id: effectiveOperatorId || null,
        entered_by: userId || null,
        entry_source: effectiveEntrySource,
        log_date: shiftStats.resolvedStartDate,
        end_date: shiftStats.resolvedEndDate,
        start_datetime: shiftStats.startDateTime?.toISOString(),
        end_datetime: shiftStats.endDateTime?.toISOString(),
      };

      if (isOffline) {
        const queuedItem = await offlineQueueManager.enqueue('SUBMIT_HOUR_LOG', logPayload);
        notifyLogEntryCreated(machineCode || 'Machine', runningHours, shiftStats.overtimeHours);
        if (isBreakdown) {
          notifyMachineStatusChanged(machineCode || 'Machine', 'breakdown');
        }
        setSuccess('Working Offline: Shift log queued locally for auto-sync!');
        setTimeout(() => {
          if (onSubmit) {
            onSubmit({
              ...logPayload,
              id: queuedItem.id,
              machine_code: machineCode || 'M-OFFLINE',
              is_offline_draft: true,
              sync_status: 'pending',
              queued_item: queuedItem,
              machine: {
                machine_id: machineCode || 'M-OFFLINE',
                model: model || '',
                serial_number: serialNumber || '',
              },
            });
          }
          onClose();
        }, 800);
        return;
      }

      if (existingLog?.id) {
        const updatePayload: any = {
          start_meter: startVal,
          end_meter: endVal,
          running_hours: runningHours,
          start_time: startTime.trim(),
          end_time: endTime.trim(),
          overtime_hours: shiftStats.overtimeHours,
          normal_working_hours: shiftStats.normalWorkingHours,
          is_breakdown: isBreakdown,
          breakdown_start_time: bkdStart || null,
          breakdown_end_time: bkdEnd || null,
          breakdown_duration: bkdDurationFormatted || null,
          breakdown_hours: bkdDecimalHours,
          machine_condition: isBreakdown ? 'breakdown' : 'good',
          remarks: remarksPayload || null,
          location: location.trim() || null,
          log_date: shiftStats.resolvedStartDate,
          end_date: shiftStats.resolvedEndDate,
          start_datetime: shiftStats.startDateTime?.toISOString(),
          end_datetime: shiftStats.endDateTime?.toISOString(),
        };
        if (selectedClientId) updatePayload.client_id = selectedClientId;
        if (isAssisted && userId) {
          updatePayload.entered_by = userId;
          updatePayload.entry_source = effectiveEntrySource;
        }

        const { error: updateErr } = await supabase
          .from('machine_hour_logs')
          .update(updatePayload)
          .eq('id', existingLog.id);

        if (updateErr) throw updateErr;

        if (machineId && endVal > 0) {
          await supabase
            .from('machines')
            .update({
              hour_meter: endVal,
              health_status: isBreakdown ? 'breakdown' : 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', machineId);
        }

        setSuccess('Daily machine log updated successfully!');
        setTimeout(() => {
          if (onSubmit) onSubmit({ ...existingLog, ...updatePayload });
          onClose();
        }, 1000);
        return;
      }

      const idempotencyKey = `ihl_m_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 1. Try atomic PostgreSQL RPC execution first (syncs machines.current_operator_id, health_status, and audit_logs in 1 transaction)
      let rpcSucceeded = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
          p_machine_id: machineId,
          p_operator_id: effectiveOperatorId,
          p_client_id: selectedClientId || null,
          p_shift_code: selectedShiftCode || null,
          p_log_date: shiftStats.resolvedStartDate,
          p_end_date: shiftStats.resolvedEndDate,
          p_start_datetime: shiftStats.startDateTime?.toISOString() || null,
          p_end_datetime: shiftStats.endDateTime?.toISOString() || null,
          p_start_meter: startVal,
          p_end_meter: endVal,
          p_start_time: startTime.trim(),
          p_end_time: endTime.trim(),
          p_overtime_hours: shiftStats.overtimeHours,
          p_normal_working_hours: shiftStats.normalWorkingHours,
          p_is_breakdown: isBreakdown,
          p_breakdown_start_time: bkdStart || null,
          p_breakdown_end_time: bkdEnd || null,
          p_breakdown_duration: bkdDurationFormatted || null,
          p_breakdown_hours: bkdDecimalHours,
          p_shift: null,
          p_machine_condition: isBreakdown ? 'breakdown' : 'good',
          p_location: location.trim() || null,
          p_remarks: remarksPayload || null,
          p_idempotency_key: idempotencyKey,
          p_entered_by: userId || null,
        });

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

      // 2. Resilient Fallback Path (if RPC is not yet migrated on remote environment)
      if (!rpcSucceeded) {
        if (machineId && effectiveOperatorId && selectedShiftCode) {
          const { data: assignData } = await supabase
            .from('operator_machine_assignments')
            .select('shift_code')
            .eq('machine_id', machineId)
            .eq('operator_id', effectiveOperatorId)
            .eq('is_active', true);
          if (assignData && assignData.length > 0) {
            const codes = assignData.map((r: any) => r.shift_code).filter(Boolean);
            if (codes.length > 0 && !codes.includes(selectedShiftCode)) {
              throw new Error(`Operator is assigned to Shift ${codes.join(', ')} on this equipment, but attempted to log for Shift ${selectedShiftCode}. Please select your assigned shift.`);
            }
          }
        }

        const payload: any = {
          machine_id: machineId || null,
          client_id: selectedClientId || null,
          location: location.trim() || null,
          start_meter: startVal,
          end_meter: endVal,
          running_hours: runningHours,
          start_time: startTime.trim(),
          end_time: endTime.trim(),
          overtime_hours: shiftStats.overtimeHours,
          normal_working_hours: shiftStats.normalWorkingHours,
          is_breakdown: isBreakdown,
          breakdown_start_time: bkdStart || null,
          breakdown_end_time: bkdEnd || null,
          breakdown_duration: bkdDurationFormatted || null,
          breakdown_hours: bkdDecimalHours,
          shift: selectedShiftCode ? `Shift ${selectedShiftCode}` : null,
          shift_code: selectedShiftCode || null,
          machine_condition: isBreakdown ? 'breakdown' : 'good',
          remarks: remarksPayload || null,
          operator_id: effectiveOperatorId || null,
          entered_by: userId || null,
          entry_source: effectiveEntrySource,
          idempotency_key: idempotencyKey,
          log_date: shiftStats.resolvedStartDate,
          end_date: shiftStats.resolvedEndDate,
          start_datetime: shiftStats.startDateTime?.toISOString(),
          end_datetime: shiftStats.endDateTime?.toISOString(),
        };

        const { error: insertErr } = await supabase
          .from('machine_hour_logs')
          .insert([payload]);

        if (insertErr) throw insertErr;

        // Update machine hour_meter, current_operator_id & health status
        if (machineId && endVal > 0) {
          const mUpdate: Record<string, any> = {
            hour_meter: endVal,
            health_status: isBreakdown ? 'breakdown' : 'active',
            updated_at: new Date().toISOString(),
          };
          if (effectiveOperatorId) {
            mUpdate.current_operator_id = effectiveOperatorId;
          }
          await supabase
            .from('machines')
            .update(mUpdate)
            .eq('id', machineId);
        }
      }

      if (isAssisted && targetOperatorName) {
        notifyAssistedShiftLogged(targetOperatorName, machineCode || 'Equipment', runningHours);
        if (effectiveOperatorId) {
          try {
            const alertChannel = supabase.channel(`operator-alerts:${effectiveOperatorId}`);
            alertChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                alertChannel.send({
                  type: 'broadcast',
                  event: 'assisted_shift_logged',
                  payload: {
                    title: 'Shift Logged on Your Behalf',
                    body: `${currentUserName || 'A manager/admin'} recorded your shift on equipment ${machineCode || 'Equipment'} (${runningHours}h).`,
                    operatorId: effectiveOperatorId,
                    machineCode: machineCode || 'Equipment',
                    runningHours,
                    logDate: shiftStats.resolvedStartDate,
                  },
                });
              }
            });
          } catch {
            // Non-blocking broadcast
          }
        }
      } else {
        notifyLogEntryCreated(machineCode || 'Machine', runningHours, shiftStats.overtimeHours);
      }
      if (isBreakdown) {
        notifyMachineStatusChanged(machineCode || 'Machine', 'breakdown');
      }

      // Broadcast log_entered to operations-roster channel for supervisors & admins
      try {
        const rosterChannel = supabase.channel('operations-roster');
        rosterChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            rosterChannel.send({
              type: 'broadcast',
              event: 'log_entered',
              payload: {
                machineId,
                operatorId: effectiveOperatorId,
                shiftCode: selectedShiftCode || null,
                startMeter: startVal,
                endMeter: endVal,
                runningHours,
                logDate: shiftStats.resolvedStartDate,
              },
            });
          }
        });
      } catch {
        // Non-blocking broadcast
      }

      setSuccess('Daily machine log recorded successfully!');
      setTimeout(() => {
        if (onSubmit) onSubmit();
        onClose();
      }, 1000);
    } catch (err: any) {
      let errMsg = err?.message || 'Failed to submit meter log.';

      const isNetworkErr =
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('fetch') ||
        errMsg.toLowerCase().includes('timeout') ||
        errMsg.toLowerCase().includes('connection') ||
        err?.name === 'TypeError';

      if (isNetworkErr && logPayload) {
        try {
          const queuedItem = await offlineQueueManager.enqueue('SUBMIT_HOUR_LOG', logPayload);
          setSuccess('Connection lost: Shift log saved to offline queue!');
          setTimeout(() => {
            if (onSubmit) {
              onSubmit({
                ...logPayload,
                id: queuedItem.id,
                machine_code: machineCode || 'M-OFFLINE',
                is_offline_draft: true,
                sync_status: 'pending',
                queued_item: queuedItem,
                machine: {
                  machine_id: machineCode || 'M-OFFLINE',
                  model: model || '',
                  serial_number: serialNumber || '',
                },
              });
            }
            onClose();
          }, 800);
          return;
        } catch (queueErr) {
          console.warn('[MeterLogModal] Fallback enqueue failed:', queueErr);
        }
      }

      if (errMsg.includes('violates check constraint') || errMsg.includes('23514')) {
        if (errMsg.includes('assigned to Shift') || errMsg.includes('unassigned shift') || errMsg.includes('assigned shift')) {
          errMsg = err.message;
        } else if (errMsg.includes('machines_status_check')) {
          errMsg = "Invalid machine status value. Machine rental status must be 'available' or 'rented'.";
        } else if (errMsg.includes('chk_machine_hour_logs_meter_range') || errMsg.includes('cannot be less than start meter')) {
          errMsg = "Ending hour meter reading cannot be less than starting hour meter reading.";
        } else if (errMsg.includes('Breakdown duration') || errMsg.includes('cannot exceed total shift duration')) {
          errMsg = err.message;
        } else if (errMsg.includes('maintenance or decommissioned')) {
          errMsg = "Cannot record operational hours for equipment currently in maintenance or decommissioned status.";
        } else if (errMsg.includes('Cannot log before shift end')) {
          errMsg = "Cannot log before shift end.";
        } else {
          errMsg = "Database validation failed. Please verify meter readings and timings.";
        }
      } else if (errMsg.includes('assigned to Shift') || errMsg.includes('unassigned shift') || errMsg.includes('Please select your assigned shift')) {
        errMsg = err.message;
      } else if (errMsg.includes('Shift end timestamp') || errMsg.includes('must be strictly after start timestamp')) {
        errMsg = "Shift end time must be strictly after the start time.";
      } else if (errMsg.includes('overlap') || errMsg.includes('overlapping')) {
        errMsg = "Shift time overlaps with an existing log for this machine.";
      } else if (errMsg.includes('Unauthorized operator') || errMsg.includes('42501')) {
        errMsg = "Unauthorized: You cannot submit logs on behalf of another operator.";
      } else if (errMsg.includes('Client ID does not match') || errMsg.includes('23503')) {
        errMsg = "Client does not match assigned machine deployment.";
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClientObj = clients.find((c) => c.id === selectedClientId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.canvas }]}>
                <Clock size={18} color={theme.colors.link} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.ink }]}>
                  {targetOperatorName
                    ? 'Assisted Shift Entry'
                    : existingLog
                    ? 'Edit Machine Running Hours'
                    : 'Log Machine Running Hours'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  {targetOperatorName ? `Operator: ${targetOperatorName} • ` : ''}
                  {model || machineCode} {serialNumber ? `• S/N: ${serialNumber}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {targetOperatorName && (
            <View
              style={{
                marginHorizontal: spacingNumeric.sm,
                marginTop: spacingNumeric.xs,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: radiusNumeric.sm,
                backgroundColor: theme.colors.link + '15',
                borderWidth: 1,
                borderColor: theme.colors.link + '30',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <User size={14} color={theme.colors.link} />
              <Text style={{ fontSize: 12.5, color: theme.colors.link, fontWeight: '600', flex: 1 }}>
                Logging shift on behalf of {targetOperatorName}
              </Text>
            </View>
          )}

          {error ? (
            <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12, textAlign: 'center', fontWeight: '500' }}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={[styles.alertBox, { backgroundColor: theme.colors.success + '1a', borderColor: theme.colors.success }]}>
              <Text style={{ color: theme.colors.success, fontSize: 12, textAlign: 'center', fontWeight: '600' }}>{success}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll} contentContainerStyle={{ gap: spacingNumeric.xs }} showsVerticalScrollIndicator={false}>
            {/* Log Date Selector Strip (Today + Past 7 Days) */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink, marginBottom: 0 }]}>Select Date *</Text>
                <Text style={{ fontSize: 12, color: theme.colors.link, fontWeight: '600' }}>Allowed: 7 days window</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
                {pastDates.map((item) => {
                  const isSelected = item.str === logDate;
                  return (
                    <TouchableOpacity
                      key={item.str}
                      onPress={() => setLogDate(item.str)}
                      activeOpacity={0.8}
                      style={[
                        styles.dateChip,
                        {
                          backgroundColor: isSelected ? theme.colors.link : theme.colors.canvas,
                          borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text style={[styles.dateChipLabel, { color: isSelected ? '#ffffff' : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.dateChipSub, { color: isSelected ? 'rgba(255,255,255,0.85)' : theme.colors.mute }]}>
                        {item.subLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Client Selector */}
            <SearchableSelect
              label="Client / Customer Site"
              options={clientOptions}
              value={selectedClientId || ''}
              onChange={(val) => {
                const found = clients.find((c) => c.id === val);
                if (found) {
                  handleSelectClient(found);
                } else {
                  setSelectedClientId(val || null);
                }
              }}
              placeholder="Select assigned client..."
              modalTitle="Select Customer / Client"
              leftIcon={<Building2 size={15} color={theme.colors.mute} />}
              containerStyle={{ marginBottom: 14 }}
            />

            <Input
              label="Site Location / Address"
              placeholder="e.g. Jhajjar, Haryana"
              value={location}
              onChangeText={setLocation}
            />

            {/* Meter Inputs */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Meter (hrs) *"
                  value={startMeter}
                  onChangeText={handleStartMeterChange}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End Meter (hrs) *"
                  value={endMeter}
                  onChangeText={handleEndMeterChange}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Calculated Running Hours Box */}
            <View style={[styles.calcBox, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.calcLabel, { color: theme.colors.mute }]}>Calculated Running Hours:</Text>
              <Text style={[styles.calcValue, { color: theme.colors.link }]}>{runningHours.toFixed(1)} hrs</Text>
            </View>

            {/* Shift Timing Section */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink, marginBottom: 0 }]}>Shift</Text>
                {shiftStats.durationMinutes > 0 ? (
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                    backgroundColor: shiftStats.isOvernight ? 'rgba(99, 102, 241, 0.12)' : theme.colors.hairlineSoft,
                  }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      color: shiftStats.isOvernight ? '#6366f1' : theme.colors.link,
                    }}>
                      {shiftStats.isOvernight ? `🌙 Overnight · ${shiftStats.durationFormatted}` : shiftStats.durationFormatted}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Client Shift Codes Horizontal Touch Strip */}
              {shiftCodes.length > 0 && (
                <View style={{ marginVertical: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.mute }}>
                      Select Shift *
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowManualTimes(!showManualTimes)}
                      style={{ paddingVertical: 2, paddingHorizontal: 6 }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.colors.link }}>
                        {showManualTimes ? 'Hide Manual Times' : 'Manual Time Entry'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <ShiftCardSelector
                    shiftCodes={shiftCodes}
                    selectedCode={selectedShiftCode || undefined}
                    onSelect={(s) => handleSelectShift(s)}
                    todayLoggedShiftCodes={todayLoggedCodes}
                  />
                  {selectedShiftCode && todayLoggedCodes.includes(selectedShiftCode) && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                        borderWidth: 1,
                        borderRadius: 8,
                        padding: 8,
                        marginTop: 8,
                        gap: 6,
                      }}
                    >
                      <CheckCircle2 size={15} color="#059669" />
                      <Text style={{ fontSize: 12, color: '#047857', flex: 1, fontWeight: '500' }}>
                        This shift has already been entered for today.
                      </Text>
                    </View>
                  )}
                  {assignedShiftCodes.length > 0 && selectedShiftCode && !assignedShiftCodes.includes(selectedShiftCode) && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: targetOperatorId ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        borderColor: targetOperatorId ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                        borderWidth: 1,
                        borderRadius: 8,
                        padding: 8,
                        marginTop: 8,
                        gap: 6,
                      }}
                    >
                      <AlertTriangle size={15} color={targetOperatorId ? '#d97706' : '#ef4444'} />
                      <Text
                        style={{
                          fontSize: 12,
                          color: targetOperatorId ? '#b45309' : '#ef4444',
                          flex: 1,
                          fontWeight: '500',
                        }}
                      >
                        {targetOperatorId
                          ? `${targetOperatorName || 'Operator'} is rostered for Shift ${assignedShiftCodes.join(', ')}. Submitting will record an Assisted Override for Shift ${selectedShiftCode}.`
                          : `Assigned to Shift ${assignedShiftCodes.join(', ')} only.`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Machine Timeline Context Strip */}
              {latestTimeline?.latestLog && (
                <View style={{
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: 'rgba(14, 165, 233, 0.08)',
                  borderColor: 'rgba(14, 165, 233, 0.25)',
                  borderWidth: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <Clock size={14} color="#0284c7" />
                  <Text style={{ fontSize: 12.5, color: theme.colors.ink, fontWeight: '500', flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>Handover from</Text>{' '}
                    <Text style={{ fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                      {latestTimeline.formattedEndDate}, {latestTimeline.formattedEndTime}
                    </Text>
                  </Text>
                </View>
              )}

              {(shiftCodes.length === 0 || showManualTimes) && (
                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <TimeInput
                      label="Start Time *"
                      required
                      value={startTime}
                      onChangeText={setStartTime}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimeInput
                      label="End Time *"
                      required
                      value={endTime}
                      onChangeText={setEndTime}
                      isInvalid={shiftStats.isFutureEnd}
                    />
                  </View>
                </View>
              )}

              {/* Sequencing Error Alert */}
              {sequencingError?.isInvalid && (
                <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error, marginVertical: 2, padding: 10, gap: 8 }]}>
                  <Text style={{ color: theme.colors.error, fontSize: 12, fontWeight: '600' }}>
                    {sequencingError.message}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (sequencingError.recommendedTime) setStartTime(sequencingError.recommendedTime);
                      if (sequencingError.recommendedDate) setLogDate(sequencingError.recommendedDate);
                    }}
                    style={{
                      minHeight: 44,
                      backgroundColor: theme.colors.error,
                      borderRadius: 8,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>
                      Align to {sequencingError.recommendedTime}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {!shiftStats.isValid && !sequencingError?.isInvalid && (
                <View style={[styles.alertBox, {
                  backgroundColor: theme.colors.error + '14',
                  borderColor: theme.colors.error + '40',
                  borderWidth: 1,
                  marginVertical: 2,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }]}>
                  <AlertTriangle size={14} color={theme.colors.error} />
                  <Text style={{ color: theme.colors.error, fontSize: 12, fontWeight: '600', flex: 1 }}>
                    {shiftStats.errorMessage || 'Cannot log before shift end.'}
                  </Text>
                </View>
              )}
            </View>

            <Input
              label="Overtime Hours (Optional)"
              placeholder="e.g. 0.0"
              value={overtimeHours}
              onChangeText={setOvertimeHours}
              keyboardType="numeric"
              containerStyle={{ maxWidth: 140 }}
              style={{ textAlign: 'center', fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
            />

            {/* Breakdown Toggle */}
            <View style={[styles.breakdownRow, { backgroundColor: theme.colors.canvas, borderColor: isBreakdown ? theme.colors.error : theme.colors.hairline }]}>
              <View style={styles.breakdownLeft}>
                <AlertTriangle size={16} color={isBreakdown ? theme.colors.error : theme.colors.mute} />
                <View>
                  <Text style={[styles.breakdownTitle, { color: theme.colors.ink }]}>Equipment Breakdown</Text>
                  <Text style={[styles.breakdownDesc, { color: theme.colors.mute }]}>Did any machine stoppage occur?</Text>
                </View>
              </View>
              <Switch
                value={isBreakdown}
                onValueChange={(val) => {
                  setIsBreakdown(val);
                  if (!val) setRemarks('');
                }}
                trackColor={{ false: theme.colors.hairline, true: theme.colors.error }}
              />
            </View>

            {isBreakdown && (
              <View style={{
                gap: 8,
                marginVertical: 4,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: theme.colors.error + '30',
              }}>
                {/* Top Left Total Duration Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: theme.colors.error + '18',
                    borderWidth: 1,
                    borderColor: theme.colors.error + '35',
                  }}>
                    <Clock size={12} color={theme.colors.error} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.error, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                      Total: {breakdownStats?.isValid ? (breakdownStats.hours > 0 ? `${breakdownStats.durationFormatted} (${breakdownStats.totalMinutes} min)` : breakdownStats.durationFormatted) : '0 min'}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <TimeInput
                      label="Breakdown Start *"
                      required
                      value={breakdownStartTime}
                      onChangeText={setBreakdownStartTime}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimeInput
                      label="Breakdown End *"
                      required
                      value={breakdownEndTime}
                      onChangeText={setBreakdownEndTime}
                    />
                  </View>
                </View>

                {breakdownStats && !breakdownStats.isValid && (
                  <View style={[styles.alertBox, {
                    backgroundColor: theme.colors.warning + '14',
                    borderColor: theme.colors.warning,
                    padding: 8,
                    borderRadius: 8,
                  }]}>
                    <Text style={{ color: theme.colors.warning, fontSize: 12, fontWeight: '700' }}>
                      {breakdownStats.errorMessage || 'Invalid breakdown timing.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {isBreakdown && (
              <Input
                label="Remarks (Optional)"
                placeholder="Add any important observation, defect, or breakdown reason..."
                value={remarks}
                onChangeText={setRemarks}
                multiline
              />
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Cancel" onPress={onClose} variant="outline" size="md" />
            <Button
              label={existingLog ? 'Save Changes' : 'Submit'}
              onPress={handleSubmit}
              isLoading={isSubmitting}
              variant="primary"
              size="md"
            />
          </View>
        </View>

      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  alertBox: {
    padding: spacingNumeric.sm,
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  formScroll: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.sm,
  },
  inputGroup: {
    marginBottom: spacingNumeric.xs,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  dateChipLabel: {
    fontSize: 12.5,
  },
  dateChipSub: {
    fontSize: 12,
    marginTop: 1,
  },
  clientSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  clientSelectText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  calcBox: {
    padding: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  calcLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  calcValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginVertical: 4,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  breakdownDesc: {
    fontSize: 12.5,
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: spacingNumeric.lg,
    borderTopWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderTopWidth: 1,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '700',
  },
  modalListScroll: {
    paddingHorizontal: spacingNumeric.md,
  },
  clientItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 6,
  },
  clientItemName: {
    fontSize: 14.5,
  },
  clientItemLoc: {
    fontSize: 12.5,
    marginTop: 2,
  },
});
