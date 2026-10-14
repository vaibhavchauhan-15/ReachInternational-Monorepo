import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Platform,
  StatusBar,
  LayoutAnimation} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable } from '../../components/ui/touch/Pressable';
import { Card, Badge, Button, useTheme, MobileHeader, HeaderActionItem, SearchableSelect, type SelectOption, KPICard, KPIGrid, Text, useTypeStyle, SegmentedToggle, useToast, ConfirmDialog, ErrorState, PermissionDeniedView } from '../../components/ui';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { MobileConflictResolutionModal } from '../../components/operations/MobileConflictResolutionModal';
import { OperationsExportModal } from '../../components/operations/OperationsExportModal';
import {
  OperationLogListSkeleton,
} from '../../components/operations/OperationsSkeleton';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  useOperationsMasterData,
  useOperationsLogs,
  useOperatorEntryContext,
  useOperatorHistoryLogs,
  type HourLogRecord,
} from '../../lib/hooks/useOperationsData';
import { MobileOperatorEntryCard } from '../../components/operations/MobileOperatorEntryCard';
import { MobileOperatorHistoryTab } from '../../components/operations/MobileOperatorHistoryTab';
import { MobileTodayShiftMonitorTab } from '../../components/operations/MobileTodayShiftMonitorTab';
import { MobileAssignPersonnelModal } from '../../components/operations/MobileAssignPersonnelModal';
import type { TodayShiftMonitorRow } from '@reachinternational/types';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  formatShiftTimingRange,
  formatCompactTiming,
  formatTo12Hour,
  formatExactTimestamp,
  formatCompactExactTimestamp,
  splitExactTimestamp,
  formatDate,
  parseBreakdownString,
  parseBreakdownDetails,
  parseProfileShiftTime,
  parseTimeToMinutes,
  getISTDateString,
  parseConflictReason,
} from '@reachinternational/utils';
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue';
import { offlineQueueManager } from '../../lib/offline/OfflineQueueManager';
import { useScreenSync } from '../../lib/offline';
import { SyncStatusBadge } from '../../components/offline/SyncStatusBadge';
import { QueuedMutation, MutationStatus } from '../../lib/offline/types';
import {
  Clock,
  User,
  AlertTriangle,
  Search,
  Calendar,
  Truck,
  ShieldAlert,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  Printer,
  ChevronLeft,
  ChevronRight,
  Zap,
  FileText,
  Edit2,
  Trash2,
  UserPlus,
} from '../../components/ui/icon';
import { isManagerOrAbove } from '@reachinternational/permissions';

export type OpsTab = 'logs' | 'entry' | 'history' | 'today';
export type LogsViewMode = 'machine' | 'client' | 'operator';

export type { HourLogRecord };

export interface ActiveShiftAssignment {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_start_time: string;
  shift_end_time: string;
  shift_code?: string | null;
  crosses_midnight: boolean;
  assigned_at: string;
  assigned_by?: string;
  assigner?: { id: string; full_name: string; phone?: string } | null;
  operator?: { id: string; full_name: string; phone?: string; shift_time?: string | null } | null;
}

export interface MachineWithAssignments {
  id: string;
  machine_id: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  status: string;
  hour_meter?: number;
  client_id?: string;
  current_supervisor_id?: string;
  supervisor?: { full_name: string } | null;
  active_assignments: ActiveShiftAssignment[];
}

export interface ClientRecord {
  id: string;
  code?: string;
  company_name: string;
  phone?: string;
  email?: string;
  street?: string;
  Street?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export const MONTH_OPTIONS = [
  { id: '01', label: 'January' },
  { id: '02', label: 'February' },
  { id: '03', label: 'March' },
  { id: '04', label: 'April' },
  { id: '05', label: 'May' },
  { id: '06', label: 'June' },
  { id: '07', label: 'July' },
  { id: '08', label: 'August' },
  { id: '09', label: 'September' },
  { id: '10', label: 'October' },
  { id: '11', label: 'November' },
  { id: '12', label: 'December' },
  { id: 'all', label: 'All Months' },
];

export default function OperationsScreen() {
  const { theme, isDark } = useTheme();
  const { role, user, userProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isHr = (role || '').toLowerCase() === 'hr';
  const isOperator = (role || '').toLowerCase() === 'operator';
  const {
    data: entryContext,
    isLoading: isEntryLoading,
    isError: isEntryError,
    error: entryError,
    refetch: refetchEntryContext,
  } = useOperatorEntryContext(isOperator ? user?.id : undefined);
  // Operator logs count query for history tab badge (100% Web Parity)
  const { data: operatorHistoryLogs } = useOperatorHistoryLogs(
    isOperator ? user?.id : undefined,
    entryContext?.machine
  );
  const params = useLocalSearchParams<{ tab?: string; shift?: string }>();

  const [activeTab, setActiveTab] = useState<OpsTab>(() => {
    if (params.tab === 'logs' || params.tab === 'entry' || params.tab === 'history' || params.tab === 'today') {
      return params.tab as OpsTab;
    }
    return isOperator ? 'entry' : 'today';
  });

  useEffect(() => {
    if (params.tab && (params.tab === 'logs' || params.tab === 'entry' || params.tab === 'history' || params.tab === 'today')) {
      setActiveTab(params.tab as OpsTab);
    } else if (params.shift && isOperator) {
      setActiveTab('entry');
    }
  }, [params.tab, params.shift, isOperator]);

  // Assisted Shift Entry state for Supervisors/Managers/Admins
  const [assistedRow, setAssistedRow] = useState<TodayShiftMonitorRow | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Master Data State
  const [logs, setLogs] = useState<HourLogRecord[]>([]);
  const [machinesList, setMachinesList] = useState<MachineWithAssignments[]>([]);
  const [clientsList, setClientsList] = useState<ClientRecord[]>([]);
  const [activeOperators, setActiveOperators] = useState<
    { id: string; full_name: string; phone?: string; shift_time?: string; email?: string }[]
  >([]);

  // Daily Running Hours Sub-tab View Mode
  const [logsViewMode, setLogsViewMode] = useState<LogsViewMode>('machine');

  // Filtering selections under Daily Running Hours
  const getCurrentMonthValue = (): string => {
    const m = new Date().getMonth() + 1;
    return m < 10 ? `0${m}` : `${m}`;
  };

  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSiteLocation, setSelectedSiteLocation] = useState<string>('');
  const [selectedClientMachineId, setSelectedClientMachineId] = useState<string>('all');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthValue());

  // Search & Status filters
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [logsPage, setLogsPage] = useState<number>(1);
  const logsPageSize = 10;

  // Refreshing State (isLoading is derived from TanStack Query)
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals States
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [selectedConflictLog, setSelectedConflictLog] = useState<HourLogRecord | null>(null);
  const [showAllConflicts, setShowAllConflicts] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Collapsible section states (Default: COLLAPSED per feedback)
  const [isClientSummaryExpanded, setIsClientSummaryExpanded] = useState<boolean>(false);
  const [isMachineSummaryExpanded, setIsMachineSummaryExpanded] = useState<boolean>(false);
  const [isOperatorSummaryExpanded, setIsOperatorSummaryExpanded] = useState<boolean>(false);

  const toggleWithAnimation = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((prev) => !prev);
  };


  // Offline Sync State
  const { queue, isSyncing } = useOfflineQueue();
  const [logToDelete, setLogToDelete] = useState<HourLogRecord | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  // Operator Fast Entry Modal State
  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [targetMachineForLog, setTargetMachineForLog] = useState<{
    id: string;
    machine_id: string;
    model?: string;
    serial_number?: string;
  } | null>(null);

  // Debounce search input for logs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setLogsPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Log Entry Modal
  const openLogEntryModal = (machineId?: string, machineCode?: string, model?: string, serial?: string) => {
    if (machineId && machineCode) {
      setTargetMachineForLog({
        id: machineId,
        machine_id: machineCode,
        model,
        serial_number: serial,
      });
    } else {
      setTargetMachineForLog(null);
    }
    setMeterModalVisible(true);
  };

  // TanStack Query v5 Data Fetching & Caching
  const {
    data: masterData,
    isLoading: isMasterLoading,
    isError: isMasterError,
    error: masterError,
    refetch: refetchMaster,
  } = useOperationsMasterData();

  const {
    data: logsData,
    isLoading: isLogsLoading,
    isError: isLogsError,
    error: logsError,
    refetch: refetchLogs,
  } = useOperationsLogs();

  const isLoading = isMasterLoading || isLogsLoading;

  // Synchronize master data into component state
  useEffect(() => {
    if (!masterData) return;
    setActiveOperators(masterData.activeOperators as any);
    setClientsList(masterData.clientsList as any);
    setMachinesList(masterData.machinesList as any);

    // Auto-select first machine if none selected
    if (!selectedMachineId && masterData.machinesList.length > 0) {
      setSelectedMachineId(masterData.machinesList[0].id);
    }
    if (!selectedOperatorId && masterData.activeOperators.length > 0) {
      setSelectedOperatorId(masterData.activeOperators[0].id);
    }
  }, [masterData, selectedMachineId, selectedOperatorId]);

  // Synchronize logs data into component state
  useEffect(() => {
    if (!logsData) return;
    setLogs(logsData);

    // Default to the client with the most recent log, or first client as fallback
    if (clientsList.length > 0 && !selectedClientId) {
      const rawLogs = logsData as any[];
      const recentLog = rawLogs.find((l) => l.client_id || (Array.isArray(l.client) ? l.client[0]?.id : l.client?.id));
      const recentClient = Array.isArray(recentLog?.client) ? recentLog?.client[0] : recentLog?.client;
      const recentId = recentLog?.client_id || recentClient?.id || null;
      const validRecent = recentId && clientsList.some((c: any) => c.id === recentId);
      setSelectedClientId(validRecent ? recentId : clientsList[0]?.id);
    }
  }, [logsData, clientsList, selectedClientId]);

  const handleDataRefresh = useCallback(async () => {
    await Promise.all([
      refetchMaster(),
      refetchLogs(),
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'entry-context'] }),
      queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-monitor'] }),
    ]);
  }, [refetchMaster, refetchLogs, queryClient]);

  useScreenSync({
    screen: 'operations',
    onRefresh: handleDataRefresh,
  });

  const userRoleLower = (role || '').toLowerCase();
  const isSuperAdmin = userRoleLower === 'super_admin';
  const isManagerTier = isManagerOrAbove(userRoleLower);

  const canEditLogRecord = useCallback(
    (log: HourLogRecord) => {
      if (isManagerTier) return true;
      if (userRoleLower === 'operator' && (log.operator_id === user?.id || !log.operator_id)) {
        if (log.log_date) {
          const parts = log.log_date.split('T')[0].split('-').map(Number);
          const now = new Date();
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            const logDateMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
            const diffDays = Math.floor((todayMidnight - logDateMidnight) / (1000 * 60 * 60 * 24));
            return diffDays <= 7 && diffDays >= 0;
          }
        }
        return true;
      }
      return false;
    },
    [isManagerTier, userRoleLower, user?.id]
  );

  const canDeleteLogRecord = isSuperAdmin;
  const [editingLogRecord, setEditingLogRecord] = useState<HourLogRecord | null>(null);

  const handleEditLog = useCallback((log: HourLogRecord) => {
    setEditingLogRecord(log);
  }, []);

  const handleDeleteLog = useCallback(
    (log: HourLogRecord) => {
      if (!isSuperAdmin) {
        toast('error', 'Permission Denied', 'Only Super Admin is authorized to delete daily running hour logs.');
        return;
      }
      setLogToDelete(log);
    },
    [isSuperAdmin, toast]
  );

  const handleConfirmDeleteLog = useCallback(async () => {
    if (!logToDelete) return;
    const log = logToDelete;
    setIsDeletingLog(true);
    const previousLogs = logs;
    // 1. Optimistic Cache Patch
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
    queryClient.setQueriesData<HourLogRecord[]>(
      { queryKey: ['operations', 'logs'] },
      (old) => (old ? old.filter((l) => l.id !== log.id) : [])
    );
    if (log.operator_id) {
      queryClient.setQueriesData<HourLogRecord[]>(
        { queryKey: ['operator', 'history-logs', log.operator_id] },
        (old) => (old ? old.filter((l) => l.id !== log.id) : [])
      );
    }
    try {
      const { error } = await supabase
        .from('machine_hour_logs')
        .delete()
        .eq('id', log.id);
      if (error) {
        // Rollback
        setLogs(previousLogs);
        queryClient.setQueriesData({ queryKey: ['operations', 'logs'] }, previousLogs);
        toast('error', 'Delete Failed', error.message || 'Failed to delete log.');
        return;
      }
      if (log.machine_id) {
        const { data: latest } = await supabase
          .from('machine_hour_logs')
          .select('end_meter')
          .eq('machine_id', log.machine_id)
          .order('log_date', { ascending: false })
          .order('end_meter', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest && typeof latest.end_meter === 'number') {
          await supabase
            .from('machines')
            .update({ hour_meter: latest.end_meter, updated_at: new Date().toISOString() })
            .eq('id', log.machine_id);
        }
      }
      toast('success', 'Daily Log Deleted', `The running hour log for ${log.machine?.model || log.machine_code || 'equipment'} has been deleted.`);
      setLogToDelete(null);
      refetchLogs();
    } catch (err: any) {
      setLogs(previousLogs);
      queryClient.setQueriesData({ queryKey: ['operations', 'logs'] }, previousLogs);
      toast('error', 'Delete Failed', err?.message || 'Failed to delete log.');
    } finally {
      setIsDeletingLog(false);
    }
  }, [logToDelete, logs, queryClient, refetchLogs, toast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await handleDataRefresh();
    setRefreshing(false);
  }, [handleDataRefresh]);

  // Realized Overtime Shift Conflicts
  const pendingConflicts = useMemo(() => {
    return logs.filter((l) => l.conflict_flag && l.conflict_status !== 'resolved');
  }, [logs]);

  // Client Specific Locations and Machines (Unified Address: Street, City, District, State, Pincode)
  const clientLocations = useMemo(() => {
    if (!selectedClientId) return [];
    const sites = new Set<string>();
    const activeClient = clientsList.find((c) => c.id === selectedClientId);
    const activeClientName = activeClient?.company_name?.trim().toLowerCase();

    // 1. Collect address from all client records matching this company name
    const matchingClients = clientsList.filter(
      (c) => c.id === selectedClientId || (activeClientName && c.company_name?.trim().toLowerCase() === activeClientName)
    );
    const matchingClientIds = new Set(matchingClients.map((c) => c.id));

    matchingClients.forEach((c) => {
      const fullAddr = [
        c.street,
        c.city,
        c.district,
        c.state,
        c.pincode,
      ]
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter(Boolean)
        .join(', ');
      if (fullAddr) sites.add(fullAddr);
    });

    // 2. Add log locations for matching clients
    logs.forEach((l) => {
      const isClientMatch =
        (l.client_id && matchingClientIds.has(l.client_id)) ||
        (activeClientName && l.client?.company_name?.trim().toLowerCase() === activeClientName);
      if (isClientMatch && l.location && l.location.trim()) {
        sites.add(l.location.trim());
      }
    });

    // 3. Normalize & deduplicate: collapse partial fragments into full canonical addresses
    const normalized: string[] = [];
    Array.from(sites).forEach((s) => {
      const existingIdx = normalized.findIndex(
        (item) => item.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(item.toLowerCase())
      );
      if (existingIdx === -1) {
        normalized.push(s);
      } else if (s.length > normalized[existingIdx].length) {
        normalized[existingIdx] = s;
      }
    });
    return normalized.filter(Boolean);
  }, [logs, selectedClientId, clientsList]);

  // Default to the most recent location used instead of 'all' (unselected)
  const mostRecentClientLocation = useMemo(() => {
    if (!selectedClientId) return '';
    const activeClient = clientsList.find((c) => c.id === selectedClientId);
    const activeClientName = activeClient?.company_name?.trim().toLowerCase();
    const matchingClientIds = new Set(
      clientsList
        .filter((c) => c.id === selectedClientId || (activeClientName && c.company_name?.trim().toLowerCase() === activeClientName))
        .map((c) => c.id)
    );
    const clientLogs = logs.filter(
      (l) => (l.client_id && matchingClientIds.has(l.client_id)) || (activeClientName && l.client?.company_name?.trim().toLowerCase() === activeClientName)
    );
    const recentWithLoc = clientLogs.find((l) => (l.location || '').trim().length > 0);
    const recentLoc = recentWithLoc?.location?.trim();
    if (recentLoc) {
      const match = clientLocations.find(
        (site) => site.toLowerCase() === recentLoc.toLowerCase() ||
                  recentLoc.toLowerCase().includes(site.toLowerCase()) ||
                  site.toLowerCase().includes(recentLoc.toLowerCase())
      );
      return match || recentLoc;
    }
    return clientLocations[0] || '';
  }, [selectedClientId, logs, clientLocations, clientsList]);

  // Effective location selection (defaults to "all" so all logs across client sites are visible unless a specific site is chosen)
  const effectiveSiteLocation = selectedSiteLocation || 'all';

  // Filtered Logs for Supervisor View
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. View Mode Filter
      if (logsViewMode === 'machine') {
        if (selectedMachineId && selectedMachineId !== 'all' && log.machine_id !== selectedMachineId) {
          return false;
        }
      } else if (logsViewMode === 'client') {
        if (selectedClientId && selectedClientId !== 'all') {
          const mObj = machinesList.find((m) => m.id === log.machine_id);
          const activeClient = clientsList.find((c) => c.id === selectedClientId);
          const activeClientName = activeClient?.company_name?.trim().toLowerCase();
          const matchingClientIds = new Set(
            clientsList
              .filter((c) => c.id === selectedClientId || (activeClientName && c.company_name?.trim().toLowerCase() === activeClientName))
              .map((c) => c.id)
          );
          const matchesClientId =
            (log.client_id && matchingClientIds.has(log.client_id)) ||
            (mObj && mObj.client_id && matchingClientIds.has(mObj.client_id)) ||
            (activeClientName && log.client?.company_name?.trim().toLowerCase() === activeClientName);
          if (!matchesClientId) return false;
        }
        if (effectiveSiteLocation && effectiveSiteLocation !== 'all') {
          const locStr = (log.location || '').toLowerCase();
          const targetLoc = effectiveSiteLocation.toLowerCase();
          let matches = locStr.includes(targetLoc) || targetLoc.includes(locStr);
          if (!matches) {
            const tokens = targetLoc.split(',').map((t) => t.trim()).filter((t) => t.length >= 3);
            matches = tokens.some((t) => locStr.includes(t));
          }
          if (!matches) return false;
        }
        if (selectedClientMachineId && selectedClientMachineId !== 'all') {
          if (log.machine_id !== selectedClientMachineId) return false;
        }
      } else if (logsViewMode === 'operator') {
        if (selectedOperatorId && selectedOperatorId !== 'all' && log.operator_id !== selectedOperatorId) {
          return false;
        }
      }

      // 2. Month Filter
      if (selectedMonth && selectedMonth !== 'all') {
        const logMonth = log.log_date ? log.log_date.split('-')[1] : '';
        if (logMonth !== selectedMonth) return false;
      }

      // 3. Search Filter
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const mCode = (log.machine_code || '').toLowerCase();
        const mModel = (log.machine?.model || '').toLowerCase();
        const mSerial = (log.machine?.serial_number || '').toLowerCase();
        const opName = (log.operator?.full_name || '').toLowerCase();
        const cName = (log.client?.name || log.client?.company_name || '').toLowerCase();
        const loc = (log.location || '').toLowerCase();
        const rem = (log.remarks || '').toLowerCase();

        const match =
          mCode.includes(q) ||
          mModel.includes(q) ||
          mSerial.includes(q) ||
          opName.includes(q) ||
          cName.includes(q) ||
          loc.includes(q) ||
          rem.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    logs,
    logsViewMode,
    selectedMachineId,
    selectedClientId,
    effectiveSiteLocation,
    selectedClientMachineId,
    selectedOperatorId,
    selectedMonth,
    debouncedSearch,
    machinesList,
  ]);

  // Paginated Logs
  const paginatedLogs = useMemo(() => {
    const start = (logsPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, logsPage]);

  const totalPages = Math.ceil(filteredLogs.length / logsPageSize) || 1;

  // Aggregate Metrics for Active Selection
  const activeMetrics = useMemo(() => {
    let runHours = 0;
    let otHours = 0;
    let breakdowns = 0;

    filteredLogs.forEach((l) => {
      const start = l.start_meter ?? 0;
      const end = l.end_meter ?? start;
      runHours += l.running_hours ?? Math.max(0, Math.round((end - start) * 10) / 10);
      otHours += l.overtime_hours ?? 0;
      if (l.is_breakdown) breakdowns += 1;
    });

    return {
      runHours,
      otHours,
      breakdowns,
      totalLogs: filteredLogs.length,
    };
  }, [filteredLogs]);

  // Selected Machine Object
  const selectedMachineObj = useMemo(() => {
    return machinesList.find((m) => m.id === selectedMachineId) || machinesList[0] || null;
  }, [machinesList, selectedMachineId]);

  // Selected Client Object
  const selectedClientObj = useMemo(() => {
    return clientsList.find((c) => c.id === selectedClientId) || clientsList[0] || null;
  }, [clientsList, selectedClientId]);

  // Selected Operator Object
  const selectedOperatorObj = useMemo(() => {
    return activeOperators.find((o) => o.id === selectedOperatorId) || activeOperators[0] || null;
  }, [activeOperators, selectedOperatorId]);



  const clientMachines = useMemo(() => {
    if (!selectedClientId) return [];
    const activeClient = clientsList.find((c) => c.id === selectedClientId);
    const activeClientName = activeClient?.company_name?.trim().toLowerCase();
    const matchingClientIds = new Set(
      clientsList
        .filter((c) => c.id === selectedClientId || (activeClientName && c.company_name?.trim().toLowerCase() === activeClientName))
        .map((c) => c.id)
    );
    return machinesList.filter((m) => m.client_id && matchingClientIds.has(m.client_id));
  }, [machinesList, selectedClientId, clientsList]);

  // Memoized Options for SearchableSelect
  const machineSelectOptions = useMemo<SelectOption[]>(() => {
    return machinesList.map((m) => ({
      value: m.id,
      label: m.machine_id,
      description: [m.manufacturer, m.model].filter(Boolean).join(' ') || undefined,
      code: m.serial_number ? `S/N: ${m.serial_number}` : undefined,
      badge: m.status ? m.status.toUpperCase() : undefined,
      badgeVariant: m.status === 'rented' ? 'info' : m.status === 'available' ? 'success' : 'neutral',
    }));
  }, [machinesList]);

  const monthSelectOptions = useMemo<SelectOption[]>(() => {
    return MONTH_OPTIONS.map((m) => ({
      value: m.id,
      label: m.label,
    }));
  }, []);

  const clientSelectOptions = useMemo<SelectOption[]>(() => {
    return clientsList.map((c) => {
      const machineCount = machinesList.filter((m) => m.client_id === c.id).length;
      const parts = [(c as any).street, c.city, (c as any).district, c.state, (c as any).pincode]
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter(Boolean);
      const fullLoc =
        parts.length > 0
          ? parts.join(', ')
          : ((c as any).address ? String((c as any).address).trim() : undefined);
      return {
        value: c.id,
        label: c.company_name,
        description: fullLoc,
        badge: machineCount > 0 ? `${machineCount} ${machineCount === 1 ? 'M/C' : 'M/Cs'}` : undefined,
        badgeVariant: 'info',
      };
    });
  }, [clientsList, machinesList]);

  const locationSelectOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: 'all', label: 'All Sites & Locations' },
      ...clientLocations.map((loc) => ({
        value: loc,
        label: loc,
      })),
    ];
  }, [clientLocations]);

  const clientMachineSelectOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: 'all', label: `All Machines (${clientMachines.length} Total)` },
      ...clientMachines.map((m) => ({
        value: m.id,
        label: m.machine_id,
        description: m.model,
        code: m.serial_number ? `S/N: ${m.serial_number}` : undefined,
      })),
    ];
  }, [clientMachines]);

  const operatorSelectOptions = useMemo<SelectOption[]>(() => {
    return activeOperators.map((op) => ({
      value: op.id,
      label: op.full_name,
      description: op.phone ? `📞 ${op.phone}` : undefined,
      badge: 'OPERATOR',
      badgeVariant: 'warning',
    }));
  }, [activeOperators]);

  // Open Conflict Modal
  const handleOpenConflictModal = (log: HourLogRecord) => {
    setSelectedConflictLog(log);
    setShowConflictModal(true);
  };

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    if (!isOperator) {
      list.push({
        id: 'assign-operator',
        label: 'Assign Operator',
        icon: <UserPlus size={16} color={theme.colors.link} />,
        onPress: () => setIsAssignModalOpen(true),
      });
    }

    list.push({
      id: 'export-print',
      label: 'Export / Print Report',
      icon: <Printer size={16} color={theme.colors.ink} />,
      onPress: () => setShowExportModal(true),
    });

    if (pendingConflicts.length > 0) {
      list.push({
        id: 'review-conflict',
        label: `Review Conflicts (${pendingConflicts.length})`,
        icon: <AlertTriangle size={16} color="#d97706" />,
        badge: pendingConflicts.length,
        onPress: () => handleOpenConflictModal(pendingConflicts[0]),
      });
    }

    return list;
  }, [theme.colors.ink, theme.colors.link, isOperator, onRefresh, pendingConflicts]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 1. TOP STANDARDIZED MOBILE HEADER: [Logo] + [Page Title] + [Quick Access] + [3-Dot Actions] */}
      <MobileHeader
        title="Operations"
        showBack={true}
        onPressBack={() => router.back()}
        actions={headerActions}
      />

      {/* 2. TOP NAVBAR (SEGMENTED CONTROL: LOG ENTRY VS LOG HISTORY - 100% Webapp Parity) */}
      {(isOperator || activeTab === 'entry' || activeTab === 'history') && (
        <View style={styles.segmentedToggleWrapper}>
          <SegmentedToggle<'entry' | 'history'>
            items={[
              { id: 'entry', label: 'Shift' },
              {
                id: 'history',
                label: 'Log History',
                count: isOperator && operatorHistoryLogs && operatorHistoryLogs.length > 0 ? operatorHistoryLogs.length : undefined,
              },
            ]}
            value={activeTab === 'history' ? 'history' : 'entry'}
            onChange={(tab) => {
              setActiveTab(tab);
              router.setParams({ tab });
            }}
            size="md"
          />
        </View>
      )}

      {/* 2. TAB: OPERATOR LOG ENTRY */}
      {(isOperator || activeTab === 'entry') && activeTab !== 'history' && activeTab !== 'today' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[styles.contentContainer, { paddingHorizontal: 0, paddingTop: 4 }]}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          indicatorStyle={isDark ? 'white' : 'black'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        >
          <MobileOperatorEntryCard
            entryContext={entryContext}
            isLoading={isEntryLoading}
            isError={isEntryError}
            error={entryError}
            onRetry={refetchEntryContext}
            onSuccess={handleDataRefresh}
            initialShift={typeof params.shift === 'string' ? params.shift : undefined}
          />
        </ScrollView>
      )}

      {/* 2.5. TODAY'S SHIFT MONITOR (SUPERVISORS / MANAGERS / ADMINS) */}
      {!isOperator && activeTab === 'today' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          indicatorStyle={isDark ? 'white' : 'black'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        >
          <MobileTodayShiftMonitorTab
            actorId={user?.id}
            userRole={role || userProfile?.role}
            onEnterLog={(row) => {
              if (isManagerTier) {
                setAssistedRow(row);
              }
            }}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </ScrollView>
      )}

      {/* 3. TAB: OPERATOR LOG HISTORY (100% Visual and Behavioral Parity with Screenshot 4) */}
      {(isOperator || activeTab === 'history') && activeTab === 'history' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[styles.contentContainer, { paddingHorizontal: 0, paddingTop: 4 }]}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          indicatorStyle={isDark ? 'white' : 'black'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        >
          {/* Overtime Conflict Alert Banner */}
          {pendingConflicts.length > 0 && (
            <View
              style={[
                styles.conflictBanner,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
                  marginHorizontal: 16,
                  marginBottom: 12,
                },
              ]}
            >
              {/* Header: Title + Action Required Badge + Show All Toggle */}
              <View style={styles.conflictBannerHeader}>
                <View style={styles.conflictBannerTitleWrap}>
                  <ShieldAlert size={16} color={isDark ? '#fbbf24' : '#d97706'} />
                  <Text style={[styles.conflictBannerTitle, { color: theme.colors.ink }]}>
                    {pendingConflicts.length} Overtime Shift Conflict{pendingConflicts.length > 1 ? 's' : ''}
                  </Text>
                  <View
                    style={[
                      styles.conflictActionBadge,
                      {
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#fef3c7',
                        borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.conflictActionBadgeText,
                        { color: isDark ? '#fbbf24' : '#92400e' },
                      ]}
                    >
                      Action Required
                    </Text>
                  </View>
                </View>

                {pendingConflicts.length > 2 && (
                  <Pressable
                    variant="buttonGhost"
                    hitSlopToMin48
                    onPress={() => setShowAllConflicts(!showAllConflicts)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Text variant="caption" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                      {showAllConflicts ? 'Show Fewer' : `View All (${pendingConflicts.length})`}
                    </Text>
                    {showAllConflicts ? (
                      <ChevronUp size={13} color={isDark ? '#fbbf24' : '#d97706'} />
                    ) : (
                      <ChevronDown size={13} color={isDark ? '#fbbf24' : '#d97706'} />
                    )}
                  </Pressable>
                )}
              </View>

              {/* Clean, Structured Conflict Cards */}
              {(showAllConflicts ? pendingConflicts : pendingConflicts.slice(0, 2)).map((cLog) => {
                const parsed = parseConflictReason(cLog.conflict_reason, {
                  machineCode: cLog.machine_code,
                  machineModel: cLog.machine?.model,
                  operatorName: cLog.operator?.full_name,
                  startTime: cLog.start_time,
                  endTime: cLog.end_time,
                  runningHours: cLog.running_hours,
                  overtimeHours: cLog.overtime_hours,
                  logDate: cLog.log_date,
                });

                return (
                  <View
                    key={cLog.id}
                    style={[
                      styles.cleanConflictCard,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a',
                        borderLeftColor: isDark ? '#fbbf24' : '#d97706',
                      },
                    ]}
                  >
                    {/* Top Tier: Machine Code & Model (Left) | Conflict Badge & Review Button (Right) */}
                    <View style={styles.cleanConflictCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 160 }}>
                        <View style={[styles.cleanMachineIconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }]}>
                          <Truck size={13} color={theme.colors.ink} />
                        </View>
                        <Text style={[styles.cleanConflictMachineCode, { color: theme.colors.ink }]}>
                          {cLog.machine_code}
                        </Text>
                        {cLog.machine?.model ? (
                          <Text style={[styles.cleanConflictMachineModel, { color: theme.colors.mute }]}>
                            ({cLog.machine.model})
                          </Text>
                        ) : null}
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={[
                            styles.cleanSeverityPill,
                            {
                              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                              borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                            },
                          ]}
                        >
                          <Text style={[styles.cleanSeverityPillText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                            {parsed.badgeText || 'DUAL MACHINE CONFLICT'}
                          </Text>
                        </View>
                        <Pressable
                          variant="buttonSecondary"
                          hitSlopToMin48
                          onPress={() => handleOpenConflictModal(cLog)}
                          style={[
                            styles.cleanReviewBtn,
                            {
                              borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a',
                              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                            },
                          ]}
                        >
                          <ShieldAlert size={12} color={isDark ? '#fbbf24' : '#b45309'} style={{ marginRight: 4 }} />
                          <Text style={[styles.cleanReviewBtnText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                            Review
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Bottom Tier: 4-Column High-Density Info Grid */}
                    <View style={[styles.cleanInfoStrip, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : theme.colors.hairline }]}>
                      {/* 1. Operator */}
                      <View style={styles.cleanInfoItem}>
                        <Text style={[styles.cleanInfoLabel, { color: theme.colors.mute }]}>OPERATOR</Text>
                        <View style={styles.cleanInfoValueRow}>
                          <User size={12} color={theme.colors.mute} />
                          <Text style={[styles.cleanInfoValueText, { color: theme.colors.ink }]} numberOfLines={1}>
                            {cLog.operator?.full_name || 'Operator'}
                          </Text>
                        </View>
                      </View>

                      {/* 2. Shift Date */}
                      <View style={styles.cleanInfoItem}>
                        <Text style={[styles.cleanInfoLabel, { color: theme.colors.mute }]}>SHIFT DATE</Text>
                        <View style={styles.cleanInfoValueRow}>
                          <Calendar size={12} color={theme.colors.mute} />
                          <Text style={[styles.cleanInfoValueText, { color: theme.colors.ink }]}>
                            {formatDate(cLog.log_date)}
                          </Text>
                        </View>
                      </View>

                      {/* 3. Shift Time & Overtime */}
                      <View style={styles.cleanInfoItem}>
                        <Text style={[styles.cleanInfoLabel, { color: theme.colors.mute }]}>SHIFT & OVERTIME</Text>
                        <View style={styles.cleanInfoValueRow}>
                          <Clock size={12} color={theme.colors.mute} />
                          <Text style={[styles.cleanInfoValueMono, { color: theme.colors.ink }]}>
                            {formatShiftTimingRange(cLog.start_time, cLog.end_time)}
                          </Text>
                          {cLog.overtime_hours ? (
                            <View
                              style={[
                                styles.cleanOtPill,
                                {
                                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                                  borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                                },
                              ]}
                            >
                              <Text style={[styles.cleanOtPillText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                                +{cLog.overtime_hours}h OT
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {/* 4. Conflict With */}
                      <View style={styles.cleanInfoItemConflict}>
                        <Text style={[styles.cleanConflictTargetLabel, { color: isDark ? '#f87171' : '#dc2626' }]}>
                          CONFLICTS WITH
                        </Text>
                        <View style={styles.cleanInfoValueRow}>
                          <AlertTriangle size={12} color={isDark ? '#f87171' : '#dc2626'} />
                          <View
                            style={[
                              styles.cleanConflictEntityBadge,
                              {
                                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2',
                                borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.cleanConflictEntityBadgeText,
                                { color: isDark ? '#f87171' : '#b91c1c' },
                              ]}
                            >
                              {parsed.conflictingEntity ? parsed.conflictingEntity : 'Subsequent Shift Roster'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Historical Machine Logs Tab Component (100% Visual and Behavioral Parity with Screenshot 4) */}
          <MobileOperatorHistoryTab
            user={user}
            assignedMachine={entryContext?.machine}
            onEditLog={handleEditLog}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </ScrollView>
      )}

      {/* Edit Machine Hour Log Modal */}
      {editingLogRecord && (
        <MeterLogModal
          visible={Boolean(editingLogRecord)}
          onClose={() => setEditingLogRecord(null)}
          existingLog={editingLogRecord}
          machineId={editingLogRecord.machine_id}
          machineCode={editingLogRecord.machine?.machine_id || editingLogRecord.machine_code}
          model={editingLogRecord.machine?.model}
          serialNumber={editingLogRecord.machine?.serial_number}
          onSubmit={async (updatedLog?: any) => {
            const targetLog = editingLogRecord;
            setEditingLogRecord(null);
            if (updatedLog && targetLog) {
              setLogs((prev) =>
                prev.map((l) => (l.id === targetLog.id ? { ...l, ...updatedLog, sync_status: 'synced' } : l))
              );
              queryClient.setQueriesData<any[]>({ queryKey: ['operations', 'logs'] }, (old) => {
                if (!old) return old;
                return old.map((l) => (l.id === targetLog.id ? { ...l, ...updatedLog, sync_status: 'synced' } : l));
              });
            }
            await handleDataRefresh();
          }}
        />
      )}

      {/* Review Overtime Conflict Modal */}
      <MobileConflictResolutionModal
        visible={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        log={selectedConflictLog}
        currentUserId={user?.id || ''}
        onSuccess={handleDataRefresh}
      />

      {/* Export / Print Modal (Loaded strictly on demand) */}
      {showExportModal && (
        <OperationsExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          logs={filteredLogs}
          viewMode={logsViewMode}
          selectedEntityName={
            logsViewMode === 'machine'
              ? selectedMachineObj?.machine_id || 'Machine'
              : logsViewMode === 'client'
              ? selectedClientObj?.company_name || 'Client'
              : selectedOperatorObj?.full_name || 'Operator'
          }
          selectedMonthLabel={MONTH_OPTIONS.find((m) => m.id === selectedMonth)?.label || 'All Months'}
          selectedLocationLabel={selectedSiteLocation}
          selectedMachineLabel={
            selectedClientMachineId === 'all'
              ? 'All Machines'
              : machinesList.find((m) => m.id === selectedClientMachineId)?.machine_id
          }
          totalRunningHours={activeMetrics.runHours}
          totalOtHours={activeMetrics.otHours}
          totalBreakdowns={activeMetrics.breakdowns}
          supervisorName={userProfile?.full_name || 'Supervisor'}
        />
      )}


      {/* Fast Log Entry Modal for Operators */}
      {targetMachineForLog && (
        <MeterLogModal
          visible={meterModalVisible}
          onClose={() => setMeterModalVisible(false)}
          machineId={targetMachineForLog.id}
          machineCode={targetMachineForLog.machine_id}
          model={targetMachineForLog.model}
          serialNumber={targetMachineForLog.serial_number}
          currentUserId={user?.id || userProfile?.id}
          currentUserRole={role || userProfile?.role}
          currentUserName={userProfile?.full_name}
          initialShiftCode={(entryContext?.assigned_shift_code || entryContext?.operator?.shift_code) ?? undefined}
          initialAssignedShiftCodes={entryContext?.assigned_shift_codes}
          onSubmit={(newLog?: any) => {
            setMeterModalVisible(false);
            if (newLog) {
              setLogs((prev) => [newLog, ...prev]);
              queryClient.setQueriesData<any[]>({ queryKey: ['operations', 'logs'] }, (old) => {
                if (!old) return [newLog];
                return [newLog, ...old];
              });
              if (user?.id) {
                queryClient.setQueriesData<any[]>({ queryKey: ['operator', 'history-logs', user.id] }, (old) => {
                  if (!old) return [newLog];
                  return [newLog, ...old];
                });
              }
            }
            handleDataRefresh();
          }}
        />
      )}

      {/* Edit Log Modal for Managers/Supervisors */}
      {editingLogRecord && (
        <MeterLogModal
          visible={Boolean(editingLogRecord)}
          onClose={() => setEditingLogRecord(null)}
          machineId={editingLogRecord.machine_id || ''}
          machineCode={editingLogRecord.machine_code || ''}
          model={editingLogRecord.machine?.model}
          serialNumber={editingLogRecord.machine?.serial_number}
          currentUserId={user?.id || userProfile?.id}
          currentUserRole={role || userProfile?.role}
          currentUserName={userProfile?.full_name}
          existingLog={editingLogRecord}
          onSubmit={(updatedLog?: any) => {
            const targetLog = editingLogRecord;
            setEditingLogRecord(null);
            if (updatedLog && targetLog) {
              setLogs((prev) =>
                prev.map((l) => (l.id === targetLog.id ? { ...l, ...updatedLog, sync_status: 'synced' } : l))
              );
              queryClient.setQueriesData<any[]>({ queryKey: ['operations', 'logs'] }, (old) => {
                if (!old) return old;
                return old.map((l) => (l.id === targetLog.id ? { ...l, ...updatedLog, sync_status: 'synced' } : l));
              });
            }
            handleDataRefresh();
          }}
        />
      )}

      {/* Assisted Shift Entry Modal for Managers & Admins (Strictly above supervisor) */}
      {assistedRow && isManagerTier && (
        <MeterLogModal
          visible={Boolean(assistedRow && isManagerTier)}
          onClose={() => setAssistedRow(null)}
          machineId={assistedRow.machine_id}
          machineCode={assistedRow.machine_code}
          model={assistedRow.machine_model || undefined}
          serialNumber={assistedRow.machine_serial_number || undefined}
          targetOperatorId={assistedRow.operator_id || undefined}
          targetOperatorName={assistedRow.operator_name || undefined}
          currentUserId={user?.id || userProfile?.id}
          currentUserRole={role || userProfile?.role}
          currentUserName={userProfile?.full_name}
          initialClientId={assistedRow.client_id || undefined}
          initialShiftCode={assistedRow.shift_code || undefined}
          initialAssignedShiftCodes={assistedRow.shift_code ? [assistedRow.shift_code] : undefined}
          initialStartMeter={assistedRow.status === 'entered' && assistedRow.start_meter != null ? assistedRow.start_meter : (assistedRow.current_meter != null ? assistedRow.current_meter : (assistedRow.start_meter ?? undefined))}
          initialLogDate={assistedRow.log_date || undefined}
          existingLog={assistedRow.log_id ? {
            id: assistedRow.log_id,
            machine_id: assistedRow.machine_id,
            machine_code: assistedRow.machine_code,
            log_date: assistedRow.log_date,
            start_meter: assistedRow.start_meter,
            end_meter: assistedRow.end_meter,
            running_hours: assistedRow.running_hours,
            shift_code: assistedRow.shift_code,
            operator_id: assistedRow.operator_id,
            client_id: assistedRow.client_id,
          } : undefined}
          onSubmit={(submittedLog?: any) => {
            const targetAssisted = assistedRow;
            setAssistedRow(null);
            if (targetAssisted) {
              queryClient.setQueriesData<TodayShiftMonitorRow[]>(
                { queryKey: ['operations', 'today-shift-monitor'] },
                (oldRows) => {
                  if (!oldRows) return oldRows;
                  return oldRows.map((r) => {
                    const isMatch =
                      (r.machine_id === targetAssisted.machine_id && r.operator_id === targetAssisted.operator_id) ||
                      (r.machine_id === targetAssisted.machine_id && r.shift_code === targetAssisted.shift_code);
                    if (isMatch) {
                      return {
                        ...r,
                        status: 'entered' as const,
                        end_meter: submittedLog?.end_meter ?? r.end_meter,
                        running_hours: submittedLog?.running_hours ?? r.running_hours,
                      };
                    }
                    return r;
                  });
                }
              );
            }
            handleDataRefresh();
          }}
        />
      )}

      {/* 5. GLOBAL ASSIGN PERSONNEL MODAL (ACCESSIBLE FROM 3-DOT MENU ACROSS ALL TABS) */}
      <MobileAssignPersonnelModal
        visible={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['operations-today-shift-monitor'] });
          refetchMaster();
          refetchLogs();
        }}
      />

      {/* Delete Daily Running Hour Log Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(logToDelete)}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleConfirmDeleteLog}
        title="Delete Daily Running Hour Log"
        message={
          logToDelete
            ? `Are you sure you want to permanently delete the ${formatDate(logToDelete.log_date)} running hour log for ${
                logToDelete.machine?.model || logToDelete.machine_code || 'equipment'
              }? The machine hour meter will be recalculated.`
            : ''
        }
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingLog}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1 },
  segmentedToggleWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  aboveNavbar: {
    borderBottomWidth: 1,
    paddingVertical: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.md },
  aboveNavbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 },
  aboveNavbarTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 9999 },
  aboveNavbarTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2 },
  aboveNavbarTabInactive: {
    borderWidth: 1 },
  aboveNavbarTabText: {
    },
  aboveNavbarTabTextActive: {
    },
  contentScroll: {
    flex: 1 },
  contentContainer: {
    padding: spacingNumeric.md,
    paddingBottom: 110,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  conflictBanner: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
    gap: 8 },
  conflictBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between' },
  conflictBannerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 },
  conflictBannerTitle: {
    },
  conflictActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999 },
  conflictActionBadgeText: {
    },
  conflictBannerDesc: {
    },
  cleanConflictCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacingNumeric.sm + 2,
    gap: 8 },
  cleanConflictCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8 },
  cleanMachineIconBox: {
    width: 24,
    height: 24,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center' },
  cleanConflictMachineCode: {
    },
  cleanConflictMachineModel: {
    },
  cleanSeverityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1 },
  cleanSeverityPillText: {
    },
  cleanReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1 },
  cleanReviewBtnText: {
    },
  cleanInfoStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 12 },
  cleanInfoItem: {
    gap: 2,
    minWidth: 120,
    flexGrow: 1 },
  cleanInfoItemConflict: {
    gap: 2,
    minWidth: 140,
    flexGrow: 1 },
  cleanInfoLabel: {
    },
  cleanConflictTargetLabel: {
    },
  cleanInfoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5 },
  cleanInfoValueText: {
    },
  cleanInfoValueMono: {
    },
  cleanOtPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1 },
  cleanOtPillText: {
    },
  cleanConflictEntityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1 },
  cleanConflictEntityBadgeText: {
    },
  conflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1 },
  conflictBadgeText: {
    },
  conflictResolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1 },
  conflictResolvedBadgeText: {
    },
  logConflictAdvisoryWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginTop: spacingNumeric.xs,
    gap: 4 },
  logConflictHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between' },
  logConflictTitle: {
    },
  logConflictDesc: {
    },
  logConflictNotes: {
    marginTop: 2 },
  resolveInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1 },
  resolveInlineBtnText: {
    },
  filterCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    marginBottom: spacingNumeric.md,
    gap: 10 },
  subTabPillsRow: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radiusNumeric.md,
    borderWidth: 1 },
  subTabPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm },
  subTabPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1 },
  subTabPillText: {
    },
  exportBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radiusNumeric.sm,
    gap: 6 },
  exportBtnText: {
    },
  dropdownsContainer: {
    gap: 8,
    paddingTop: 4 },
  dropdownField: {
    gap: 4 },
  fieldLabel: {
    },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 12 },
  selectorTriggerText: {
    flex: 1 },
  summaryHeaderCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    marginBottom: spacingNumeric.md,
    gap: 10 },
  summaryHeaderTitleRow: {
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
    gap: 6 },
  summaryHeaderTitle: {
    },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 },
  statusPrefix: {
    },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4 },
  statusBadgeText: {
    },
  machineSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12 },
  specItem: {
    minWidth: '45%',
    flex: 1 },
  specLabel: {
    marginBottom: 2 },
  specValue: {
    },
  specValueMono: {
    },
  clientBadgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4 },
  infoPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  infoPillText: {
    },
  clientContactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4 },
  logsListContainer: {
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.xs },
  logCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    gap: 8 },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between' },
  logCardHeaderLeft: {
    flex: 1,
    gap: 2 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap' },
  logDateText: {
    },
  timestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4 },
  timestampText: {
    },
  logMachineModel: {
    marginTop: 1 },
  logMachineSerial: {
    },
  breakdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4 },
  breakdownBadgeText: {
    },
  normalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1 },
  normalBadgeText: {
    },
  logDetailsBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 6 },
  logDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8 },
  logDetailLabel: {
    },
  logDetailValue: {
    },
  logDetailSub: {
    },
  logDetailPhone: {
    },
  logTimingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth },
  logDetailValueMono: {
    },
  logHoursValue: {
    },
  logRemarksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6 },
  logOtValue: {
    },
  logRemarksText: {
    flex: 1 },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.md,
    borderTopWidth: 1 },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 4 },
  paginationBtnText: {
    },
  paginationPageText: {
    },
  emptyCard: {
    padding: spacingNumeric.xl,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center' },
  emptyCardText: {
    textAlign: 'center' },
  logCardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth },
  logIdMono: {
    },
  logCardActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 },
  logActionTouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    minHeight: 32 } });
