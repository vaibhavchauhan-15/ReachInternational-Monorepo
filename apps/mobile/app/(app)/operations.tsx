import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  TextInput,
  StatusBar,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, Badge, Input, Button, useTheme, MobileHeader, HeaderActionItem } from '../../components/ui';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { MobileAssignmentModal } from '../../components/operations/MobileAssignmentModal';
import { MobileConflictResolutionModal } from '../../components/operations/MobileConflictResolutionModal';
import { OperationsExportModal } from '../../components/operations/OperationsExportModal';
import {
  OperationsFilterSelectorModal,
  FilterSelectOption,
} from '../../components/operations/OperationsFilterSelectorModal';
import {
  OperationLogListSkeleton,
  AssignmentListSkeleton,
} from '../../components/operations/OperationsSkeleton';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  formatShiftTimingRange,
  formatCompactTiming,
  formatTo12Hour,
  formatExactTimestamp,
  splitExactTimestamp,
  formatDate,
  parseBreakdownString,
  parseProfileShiftTime,
  parseTimeToMinutes,
  getISTDateString,
  parseConflictReason,
} from '@reachinternational/utils';
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue';
import { offlineQueueManager } from '../../lib/offline/OfflineQueueManager';
import { SyncStatusBadge } from '../../components/offline/SyncStatusBadge';
import { OfflineCollisionModal } from '../../components/offline/OfflineCollisionModal';
import { QueuedMutation, MutationStatus } from '../../lib/offline/types';
import {
  Clock,
  Gauge,
  UserCheck,
  AlertTriangle,
  Search,
  Plus,
  Building2,
  Calendar,
  Truck,
  User,
  Sun,
  Moon,
  Users,
  ShieldAlert,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  RefreshCw,
  Printer,
  X,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Zap,
  FileText,
} from 'lucide-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type OpsTab = 'logs' | 'assignments' | 'entry' | 'history';
export type LogsViewMode = 'machine' | 'client' | 'operator';

export interface HourLogRecord {
  id: string;
  machine_id?: string;
  machine_code: string;
  log_date: string;
  shift?: string;
  start_meter: number;
  end_meter: number;
  running_hours: number;
  start_time?: string;
  end_time?: string;
  overtime_hours?: number;
  normal_working_hours?: number;
  location?: string;
  is_breakdown: boolean;
  remarks?: string;
  operator_id?: string;
  client_id?: string;
  created_at?: string;
  conflict_flag?: boolean;
  conflict_reason?: string;
  conflict_status?: string;
  conflict_resolved_by?: string;
  conflict_resolved_at?: string;
  conflict_resolution_notes?: string;
  is_offline_draft?: boolean;
  sync_status?: MutationStatus;
  queued_item?: QueuedMutation;
  machine?: {
    id?: string;
    machine_id: string;
    model?: string;
    serial_number?: string;
    manufacturer?: string;
    status?: string;
    customer_name?: string;
    customer_address?: string;
    city?: string;
    state?: string;
  } | null;
  operator?: { id?: string; full_name: string; phone?: string } | null;
  client?: {
    id?: string;
    name?: string;
    company_name?: string;
    client_name?: string;
    street?: string;
    Street?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    address?: string;
  } | null;
}

export interface ActiveShiftAssignment {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_start_time: string;
  shift_end_time: string;
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

  const isOperator = (role || '').toLowerCase() === 'operator';
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<OpsTab>(() => {
    if (params.tab === 'assignments' || params.tab === 'logs' || params.tab === 'entry' || params.tab === 'history') {
      return params.tab as OpsTab;
    }
    return isOperator ? 'entry' : 'logs';
  });

  useEffect(() => {
    if (params.tab && (params.tab === 'assignments' || params.tab === 'logs' || params.tab === 'entry' || params.tab === 'history')) {
      setActiveTab(params.tab as OpsTab);
    }
  }, [params.tab]);

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

  // Assignments Tab States
  const [assignmentSearch, setAssignmentSearch] = useState<string>('');
  const [debouncedAssignmentSearch, setDebouncedAssignmentSearch] = useState<string>('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned' | 'full'>('all');
  const [expandedMachineIds, setExpandedMachineIds] = useState<Set<string>>(() => new Set());

  // Loading & Refreshing States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals States
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignModalTargetMachineId, setAssignModalTargetMachineId] = useState<string>('');
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [selectedConflictLog, setSelectedConflictLog] = useState<HourLogRecord | null>(null);
  const [showAllConflicts, setShowAllConflicts] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Collapsible section states (Default: COLLAPSED per feedback)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);
  const [isClientSummaryExpanded, setIsClientSummaryExpanded] = useState<boolean>(false);
  const [isMachineSummaryExpanded, setIsMachineSummaryExpanded] = useState<boolean>(false);
  const [isOperatorSummaryExpanded, setIsOperatorSummaryExpanded] = useState<boolean>(false);

  const toggleWithAnimation = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((prev) => !prev);
  };

  // Reusable Selector Modal State
  const [selectorModalConfig, setSelectorModalConfig] = useState<{
    visible: boolean;
    title: string;
    options: FilterSelectOption[];
    selectedValue: string;
    onSelect: (val: string) => void;
  }>({
    visible: false,
    title: '',
    options: [],
    selectedValue: '',
    onSelect: () => {},
  });

  // Offline Sync State
  const { queue, isSyncing } = useOfflineQueue();
  const [collisionModalVisible, setCollisionModalVisible] = useState(false);
  const [collidedLog, setCollidedLog] = useState<HourLogRecord | null>(null);

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

  // Debounce search input for assignments
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAssignmentSearch(assignmentSearch);
    }, 280);
    return () => clearTimeout(timer);
  }, [assignmentSearch]);

  const isSearchingLogs = search.trim() !== debouncedSearch.trim();
  const isSearchingAssignments = assignmentSearch.trim() !== debouncedAssignmentSearch.trim();

  // Expand / Collapse Single Machine Card
  const toggleMachineExpanded = (machineId: string) => {
    setExpandedMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  };

  // Expand / Collapse All Cards
  const handleToggleExpandAll = (allIds: string[]) => {
    if (expandedMachineIds.size === allIds.length && allIds.length > 0) {
      setExpandedMachineIds(new Set());
    } else {
      setExpandedMachineIds(new Set(allIds));
    }
  };

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

  // Fetch Master Operations Data
  const fetchOperationsData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [mchRes, assRes, opsRes, clientsRes, logsRes] = await Promise.all([
        supabase
          .from('machines')
          .select(`
            id,
            machine_id,
            model,
            serial_number,
            manufacturer,
            status,
            hour_meter,
            client_id,
            current_supervisor_id,
            supervisor:users!machines_current_supervisor_id_fkey(id, full_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('operator_machine_assignments')
          .select(`
            id,
            machine_id,
            operator_id,
            shift_start_time,
            shift_end_time,
            crosses_midnight,
            assigned_at,
            assigned_by,
            ended_at,
            ended_by,
            end_reason,
            is_active,
            machine:machines(id, machine_id, model, serial_number),
            operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone),
            assigner:users!operator_machine_assignments_assigned_by_fkey(id, full_name),
            ender:users!operator_machine_assignments_ended_by_fkey(id, full_name)
          `)
          .order('assigned_at', { ascending: false })
          .limit(200),
        supabase
          .from('users')
          .select('id, full_name, phone, shift_time')
          .eq('role', 'operator')
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('clients')
          .select('id, code, company_name, phone, street, city, district, state, pincode')
          .order('company_name'),
        supabase
          .from('machine_hour_logs')
          .select(`
            id,
            machine_id,
            operator_id,
            client_id,
            log_date,
            start_meter,
            end_meter,
            running_hours,
            start_time,
            end_time,
            overtime_hours,
            normal_working_hours,
            location,
            is_breakdown,
            remarks,
            created_at,
            conflict_flag,
            conflict_reason,
            conflict_status,
            conflict_resolved_by,
            conflict_resolved_at,
            conflict_resolution_notes,
            machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, manufacturer, status),
            operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone),
            client:clients!machine_hour_logs_client_id_fkey(id, company_name, phone, street, city, district, state, pincode)
          `)
          .order('log_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);

      if (opsRes.data) {
        setActiveOperators(opsRes.data as any);
      }

      if (clientsRes.data) {
        setClientsList(clientsRes.data as any);
      }

      let allMachinesData: MachineWithAssignments[] = [];
      if (mchRes.data) {
        const activeAssList = (assRes.data || []).filter((a: any) => a.is_active) as unknown as ActiveShiftAssignment[];
        allMachinesData = mchRes.data.map((m: any) => ({
          ...m,
          active_assignments: activeAssList.filter((a) => a.machine_id === m.id),
        }));
        setMachinesList(allMachinesData);

        // Auto-select first machine if none selected
        if (!selectedMachineId && allMachinesData.length > 0) {
          setSelectedMachineId(allMachinesData[0].id);
        }
      }

      if (clientsRes.data && clientsRes.data.length > 0 && !selectedClientId) {
        // Default to the client with the most recent log, or first client as fallback
        const rawLogs = (logsRes.data || []) as any[];
        const recentLog = rawLogs.find((l) => l.client_id || (Array.isArray(l.client) ? l.client[0]?.id : l.client?.id));
        const recentClient = Array.isArray(recentLog?.client) ? recentLog?.client[0] : recentLog?.client;
        const recentId = recentLog?.client_id || recentClient?.id || null;
        const cList = clientsRes.data as any[];
        const validRecent = recentId && cList.some((c: any) => c.id === recentId);
        setSelectedClientId(validRecent ? recentId : cList[0]?.id);
      }

      if (opsRes.data && opsRes.data.length > 0 && !selectedOperatorId) {
        setSelectedOperatorId(opsRes.data[0].id);
      }

      if (logsRes.data) {
        const formattedLogs: HourLogRecord[] = logsRes.data.map((l: any) => {
          const clientData = Array.isArray(l.client) ? l.client[0] : l.client;
          return {
            ...l,
            machine_code: l.machine?.machine_id || l.machine_id || 'Equipment',
            client: clientData ? { ...clientData, name: clientData.company_name || clientData.client_name } : null,
          };
        });
        setLogs(formattedLogs);
      }
    } catch (err) {
      console.error('Error fetching operations master data:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [selectedMachineId, selectedClientId, selectedOperatorId]);

  useEffect(() => {
    fetchOperationsData();
  }, [fetchOperationsData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOperationsData();
  }, [fetchOperationsData]);

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

  // Assignments Tab Metrics & Filtered List
  const activeAssignmentsList = useMemo(() => {
    const list: ActiveShiftAssignment[] = [];
    machinesList.forEach((m) => {
      list.push(...(m.active_assignments || []));
    });
    return list;
  }, [machinesList]);

  const totalMachinesCount = machinesList.length;
  const activeShiftOperatorsCount = activeAssignmentsList.length;
  const fullCapacityCount = machinesList.filter((m) => (m.active_assignments || []).length >= 3).length;
  const unassignedCount = machinesList.filter((m) => (m.active_assignments || []).length === 0).length;

  const filteredMachinesForAssignments = useMemo(() => {
    return machinesList.filter((m) => {
      const assCount = (m.active_assignments || []).length;
      if (assignmentFilter === 'assigned' && assCount === 0) return false;
      if (assignmentFilter === 'unassigned' && assCount > 0) return false;
      if (assignmentFilter === 'full' && assCount < 3) return false;

      if (!assignmentSearch.trim()) return true;
      const q = assignmentSearch.toLowerCase().trim();
      const code = (m.machine_id || '').toLowerCase();
      const model = (m.model || '').toLowerCase();
      const serial = (m.serial_number || '').toLowerCase();
      const hasOpMatch = (m.active_assignments || []).some((a) => {
        const name = (a.operator?.full_name || '').toLowerCase();
        return name.includes(q);
      });

      return code.includes(q) || model.includes(q) || serial.includes(q) || hasOpMatch;
    });
  }, [machinesList, assignmentFilter, assignmentSearch]);

  // Handlers for Selectors
  const openMachineSelector = () => {
    const options: FilterSelectOption[] = machinesList.map((m) => ({
      id: m.id,
      label: m.machine_id,
      subLabel: [m.manufacturer, m.model].filter(Boolean).join(' ') || undefined,
      code: m.serial_number ? `S/N: ${m.serial_number}` : undefined,
      badge: m.status ? m.status.toUpperCase() : undefined,
      badgeVariant: m.status === 'rented' ? 'info' : m.status === 'available' ? 'success' : 'neutral',
    }));

    setSelectorModalConfig({
      visible: true,
      title: 'Select Machine',
      options,
      selectedValue: selectedMachineId,
      onSelect: (val) => {
        setSelectedMachineId(val);
        setLogsPage(1);
      },
    });
  };

  const openMonthSelector = () => {
    const options: FilterSelectOption[] = MONTH_OPTIONS.map((m) => ({
      id: m.id,
      label: m.label,
    }));

    setSelectorModalConfig({
      visible: true,
      title: 'Select Month',
      options,
      selectedValue: selectedMonth,
      onSelect: (val) => {
        setSelectedMonth(val);
        setLogsPage(1);
      },
    });
  };

  const openClientSelector = () => {
    const options: FilterSelectOption[] = clientsList.map((c) => {
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
        id: c.id,
        label: c.company_name,
        subLabel: fullLoc,
        badge: machineCount > 0 ? `${machineCount} ${machineCount === 1 ? 'M/C' : 'M/Cs'}` : undefined,
        badgeVariant: 'info',
      };
    });

    setSelectorModalConfig({
      visible: true,
      title: 'Select Client',
      options,
      selectedValue: selectedClientId,
      onSelect: (val) => {
        setSelectedClientId(val);
        setSelectedSiteLocation('');
        setSelectedClientMachineId('all');
        setLogsPage(1);
      },
    });
  };

  const openLocationSelector = () => {
    const options: FilterSelectOption[] = [
      { id: 'all', label: 'All Sites & Locations' },
      ...clientLocations.map((loc) => ({
        id: loc,
        label: loc,
      })),
    ];

    setSelectorModalConfig({
      visible: true,
      title: 'Select Location',
      options,
      selectedValue: effectiveSiteLocation,
      onSelect: (val) => {
        setSelectedSiteLocation(val);
        setLogsPage(1);
      },
    });
  };

  const openClientMachineSelector = () => {
    const options: FilterSelectOption[] = [
      { id: 'all', label: `All Machines (${clientMachines.length} Total)` },
      ...clientMachines.map((m) => ({
        id: m.id,
        label: m.machine_id,
        subLabel: m.model,
        code: m.serial_number ? `S/N: ${m.serial_number}` : undefined,
      })),
    ];

    setSelectorModalConfig({
      visible: true,
      title: 'Select Machine',
      options,
      selectedValue: selectedClientMachineId,
      onSelect: (val) => {
        setSelectedClientMachineId(val);
        setLogsPage(1);
      },
    });
  };

  const openOperatorSelector = () => {
    const options: FilterSelectOption[] = activeOperators.map((op) => ({
      id: op.id,
      label: op.full_name,
      subLabel: op.phone ? `📞 ${op.phone}` : undefined,
      badge: 'OPERATOR',
      badgeVariant: 'warning',
    }));

    setSelectorModalConfig({
      visible: true,
      title: 'Select Operator',
      options,
      selectedValue: selectedOperatorId,
      onSelect: (val) => {
        setSelectedOperatorId(val);
        setLogsPage(1);
      },
    });
  };

  // Open Assign Operator Modal
  const handleOpenAssignModal = (targetMachId?: string) => {
    setAssignModalTargetMachineId(targetMachId || selectedMachineId || (machinesList[0]?.id || ''));
    setShowAssignModal(true);
  };

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
        icon: <UserCheck size={16} color={theme.colors.link} />,
        onPress: () => handleOpenAssignModal(),
      });
    }

    list.push({
      id: 'export-print',
      label: 'Export / Print Report',
      icon: <Printer size={16} color={theme.colors.ink} />,
      onPress: () => setShowExportModal(true),
    });

    list.push({
      id: 'refresh-data',
      label: 'Refresh Operations Data',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => onRefresh(),
    });

    if (!isOperator) {
      if (activeTab === 'logs') {
        list.push({
          id: 'switch-assignments',
          label: 'Switch to Shift Assignments',
          icon: <Gauge size={16} color={theme.colors.ink} />,
          onPress: () => setActiveTab('assignments'),
        });
      } else {
        list.push({
          id: 'switch-logs',
          label: 'Switch to Running Hours',
          icon: <Clock size={16} color={theme.colors.ink} />,
          onPress: () => setActiveTab('logs'),
        });
      }
    }

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
  }, [isOperator, activeTab, theme.colors.link, theme.colors.ink, onRefresh, pendingConflicts]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 1. TOP STANDARDIZED MOBILE HEADER: [Logo] + [Page Title] + [Assign CTA] + [Quick Access] + [3-Dot Actions] */}
      <MobileHeader
        title="Fleet Operations"
        actions={headerActions}
        rightAction={
          !isOperator ? (
            <TouchableOpacity
              onPress={() => handleOpenAssignModal()}
              activeOpacity={0.8}
              style={[
                styles.headerAssignBtn,
                { backgroundColor: theme.colors.ink },
              ]}
              accessibilityLabel="Assign Operator"
            >
              <UserCheck size={13} color={theme.colors.canvas} style={{ marginRight: 4 }} />
              <Text style={[styles.headerAssignBtnText, { color: theme.colors.canvas }]}>
                Assign
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* 2. TOP NAVBAR (ABOVE NAVBAR) DIRECTLY BELOW HEADER */}
      <View
        style={[
          styles.aboveNavbar,
          {
            backgroundColor: theme.colors.canvas,
            borderBottomColor: theme.colors.hairline,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.aboveNavbarContent}
        >
          {isOperator ? (
            <>
              {/* Operator Tab 1: Log Entry */}
              <TouchableOpacity
                onPress={() => setActiveTab('entry')}
                activeOpacity={0.8}
                style={[
                  styles.aboveNavbarTab,
                  activeTab === 'entry'
                    ? [styles.aboveNavbarTabActive, { backgroundColor: theme.colors.ink }]
                    : [
                        styles.aboveNavbarTabInactive,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.aboveNavbarTabText,
                    {
                      color:
                        activeTab === 'entry'
                          ? theme.colors.canvas
                          : theme.colors.body,
                    },
                    activeTab === 'entry' && styles.aboveNavbarTabTextActive,
                  ]}
                >
                  Log Entry
                </Text>
              </TouchableOpacity>

              {/* Operator Tab 2: Log History */}
              <TouchableOpacity
                onPress={() => setActiveTab('history')}
                activeOpacity={0.8}
                style={[
                  styles.aboveNavbarTab,
                  activeTab === 'history'
                    ? [styles.aboveNavbarTabActive, { backgroundColor: theme.colors.ink }]
                    : [
                        styles.aboveNavbarTabInactive,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.aboveNavbarTabText,
                    {
                      color:
                        activeTab === 'history'
                          ? theme.colors.canvas
                          : theme.colors.body,
                    },
                    activeTab === 'history' && styles.aboveNavbarTabTextActive,
                  ]}
                >
                  Log History
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Daily Running Hours Tab */}
              <TouchableOpacity
                onPress={() => setActiveTab('logs')}
                activeOpacity={0.8}
                style={[
                  styles.aboveNavbarTab,
                  activeTab === 'logs'
                    ? [styles.aboveNavbarTabActive, { backgroundColor: theme.colors.ink }]
                    : [
                        styles.aboveNavbarTabInactive,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.aboveNavbarTabText,
                    {
                      color:
                        activeTab === 'logs'
                          ? theme.colors.canvas
                          : theme.colors.body,
                    },
                    activeTab === 'logs' && styles.aboveNavbarTabTextActive,
                  ]}
                >
                  Daily Running Hours
                </Text>
              </TouchableOpacity>

              {/* Machine Assignments Tab */}
              <TouchableOpacity
                onPress={() => setActiveTab('assignments')}
                activeOpacity={0.8}
                style={[
                  styles.aboveNavbarTab,
                  activeTab === 'assignments'
                    ? [styles.aboveNavbarTabActive, { backgroundColor: theme.colors.ink }]
                    : [
                        styles.aboveNavbarTabInactive,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.aboveNavbarTabText,
                    {
                      color:
                        activeTab === 'assignments'
                          ? theme.colors.canvas
                          : theme.colors.body,
                    },
                    activeTab === 'assignments' && styles.aboveNavbarTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Machine Assignments
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* 2. TAB 1: DAILY RUNNING HOURS FEED */}
      {activeTab === 'logs' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
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
                  <TouchableOpacity
                    onPress={() => setShowAllConflicts(!showAllConflicts)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#fbbf24' : '#d97706' }}>
                      {showAllConflicts ? 'Show Fewer' : `View All (${pendingConflicts.length})`}
                    </Text>
                    {showAllConflicts ? (
                      <ChevronUp size={13} color={isDark ? '#fbbf24' : '#d97706'} />
                    ) : (
                      <ChevronDown size={13} color={isDark ? '#fbbf24' : '#d97706'} />
                    )}
                  </TouchableOpacity>
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
                        <TouchableOpacity
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
                        </TouchableOpacity>
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

          {/* Sub-Tabs Toolbar Box */}
          <Card variant="elevated" style={styles.filterCard}>
            {/* Top Row: Sub-Tabs Switcher & Print Icon Button + Filters Toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: spacingNumeric.sm }}>
              <View style={[styles.subTabPillsRow, { flex: 1, marginBottom: 0, backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                {(['machine', 'clients', 'operator'] as const).map((mode) => {
                  const isSelected = logsViewMode === (mode === 'clients' ? 'client' : mode);
                  const label = mode === 'machine' ? 'Machine' : mode === 'clients' ? 'Clients' : 'Operator';
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => {
                        setLogsViewMode(mode === 'clients' ? 'client' : mode);
                        setLogsPage(1);
                      }}
                      style={[
                        styles.subTabPill,
                        isSelected && [styles.subTabPillActive, { backgroundColor: theme.colors.ink }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.subTabPillText,
                          { color: isSelected ? theme.colors.canvas : theme.colors.mute },
                          isSelected && { fontWeight: '700' },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Top-Right Print Icon Button */}
              <TouchableOpacity
                onPress={() => setShowExportModal(true)}
                activeOpacity={0.7}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radiusNumeric.lg,
                  backgroundColor: '#0284c7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel="Export / Print Report"
              >
                <Printer size={16} color="#ffffff" />
              </TouchableOpacity>

              {/* Expand / Collapse Filters Button */}
              <TouchableOpacity
                onPress={() => toggleWithAnimation(setIsFiltersExpanded)}
                activeOpacity={0.7}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radiusNumeric.lg,
                  backgroundColor: theme.colors.canvas,
                  borderWidth: 1,
                  borderColor: theme.colors.hairline,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel="Toggle Filters"
              >
                {isFiltersExpanded ? <ChevronUp size={16} color={theme.colors.mute} /> : <ChevronDown size={16} color={theme.colors.mute} />}
              </TouchableOpacity>
            </View>

            {/* Search Input Bar */}
            <View style={[styles.searchBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, marginBottom: spacingNumeric.sm }]}>
              {isSearchingLogs ? (
                <ActivityIndicator size="small" color={theme.colors.link} style={{ marginRight: 8 }} />
              ) : (
                <Search size={14} color={theme.colors.mute} style={{ marginRight: 8 }} />
              )}
              <TextInput
                style={[styles.searchInput, { color: theme.colors.ink }]}
                placeholder="Search machine, operator, remarks, location..."
                placeholderTextColor={theme.colors.mute}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                  <X size={14} color={theme.colors.mute} />
                </TouchableOpacity>
              )}
            </View>

            {/* Dropdowns depending on logsViewMode (Collapsible) */}
            {isFiltersExpanded && (
            <View style={styles.dropdownsContainer}>
              {logsViewMode === 'machine' && (
                <>
                  <View style={styles.dropdownField}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Select Machine ({machinesList.length} Total)</Text>
                    <TouchableOpacity
                      onPress={openMachineSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]} numberOfLines={1}>
                        {selectedMachineObj ? `${selectedMachineObj.machine_id} · ${selectedMachineObj.model || ''}` : 'Select Machine...'}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dropdownField}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Select Month</Text>
                    <TouchableOpacity
                      onPress={openMonthSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]}>
                        {MONTH_OPTIONS.find((m) => m.id === selectedMonth)?.label || 'Select Month'}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {logsViewMode === 'client' && (
                <>
                  <View style={styles.dropdownField}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.mute, marginBottom: 0 }]}>Select Client</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: theme.colors.canvas, borderWidth: 1, borderColor: theme.colors.hairline }}>
                        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: theme.colors.mute }}>{clientsList.length} Total</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={openClientSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      {selectedClientObj ? (
                        <Text style={[styles.selectorTriggerText, { color: theme.colors.ink, flex: 1 }]} numberOfLines={1}>
                          <Text style={{ fontWeight: '700' }}>{selectedClientObj.company_name}</Text>
                          {(() => {
                            const parts = [(selectedClientObj as any).street, selectedClientObj.city, (selectedClientObj as any).district, selectedClientObj.state, (selectedClientObj as any).pincode]
                              .filter(Boolean)
                              .map((s) => String(s).trim())
                              .filter(Boolean);
                            const loc = parts.length > 0 ? parts.join(', ') : ((selectedClientObj as any).address ? String((selectedClientObj as any).address).trim() : '');
                            return loc ? (
                              <Text style={{ color: theme.colors.mute, fontWeight: '400', fontSize: 11 }}>
                                {` • ${loc}`}
                              </Text>
                            ) : null;
                          })()}
                        </Text>
                      ) : (
                        <Text style={[styles.selectorTriggerText, { color: theme.colors.mute }]}>
                          Select Client...
                        </Text>
                      )}
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dropdownField}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.mute, marginBottom: 0 }]}>Select Location</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: theme.colors.canvas, borderWidth: 1, borderColor: theme.colors.hairline }}>
                        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: theme.colors.mute }}>{clientLocations.length} Total</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={openLocationSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]} numberOfLines={1}>
                        {effectiveSiteLocation === 'all' ? 'All Sites & Locations' : effectiveSiteLocation}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dropdownField}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.mute, marginBottom: 0 }]}>Select Machine</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: theme.colors.canvas, borderWidth: 1, borderColor: theme.colors.hairline }}>
                        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: theme.colors.mute }}>{clientMachines.length} Total</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={openClientMachineSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]} numberOfLines={1}>
                        {selectedClientMachineId === 'all'
                          ? `All Machines (${clientMachines.length} Total)`
                          : machinesList.find((m) => m.id === selectedClientMachineId)?.machine_id || 'Machine'}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dropdownField}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Select Month</Text>
                    <TouchableOpacity
                      onPress={openMonthSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]}>
                        {MONTH_OPTIONS.find((m) => m.id === selectedMonth)?.label || 'Select Month'}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {logsViewMode === 'operator' && (
                <>
                  <View style={styles.dropdownField}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Select Operator ({activeOperators.length} Total)</Text>
                    <TouchableOpacity
                      onPress={openOperatorSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]} numberOfLines={1}>
                        {selectedOperatorObj?.full_name || 'Select Operator...'}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dropdownField}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Select Month</Text>
                    <TouchableOpacity
                      onPress={openMonthSelector}
                      style={[styles.selectorTrigger, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                    >
                      <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]}>
                        {MONTH_OPTIONS.find((m) => m.id === selectedMonth)?.label || 'Select Month'}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
            )}
          </Card>

          {/* 3. DYNAMIC SUMMARY HEADER CARDS */}
          {/* A. MACHINE VIEW SUMMARY CARD */}
          {logsViewMode === 'machine' && selectedMachineObj && (
            <Card variant="elevated" style={styles.summaryHeaderCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleWithAnimation(setIsMachineSummaryExpanded)}
                style={[
                  styles.summaryHeaderTitleRow,
                  { borderBottomColor: theme.colors.hairline, borderBottomWidth: isMachineSummaryExpanded ? 1 : 0 },
                ]}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.summaryHeaderTitle, { color: theme.colors.ink }]}>
                    {selectedMachineObj.machine_id} {selectedMachineObj.model ? `(${selectedMachineObj.model})` : ''}
                  </Text>
                  <View style={[styles.statusBadgePill, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe' }]}>
                    <Text style={[styles.statusBadgeText, { color: theme.colors.link }]}>
                      {selectedMachineObj.status ? selectedMachineObj.status.toUpperCase() : 'RENTED'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: '800', color: theme.colors.link }}>
                    {Math.round(activeMetrics.runHours * 10) / 10} hrs
                  </Text>
                  {isMachineSummaryExpanded ? (
                    <ChevronUp size={16} color={theme.colors.mute} />
                  ) : (
                    <ChevronDown size={16} color={theme.colors.mute} />
                  )}
                </View>
              </TouchableOpacity>

              {isMachineSummaryExpanded && (
                <View style={[styles.machineSpecsGrid, { marginTop: 8 }]}>
                  <View style={styles.specItem}>
                    <Text style={[styles.specLabel, { color: theme.colors.mute }]}>MANUFACTURER</Text>
                    <Text style={[styles.specValue, { color: theme.colors.ink }]}>{selectedMachineObj.manufacturer || '—'}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={[styles.specLabel, { color: theme.colors.mute }]}>MODEL</Text>
                    <Text style={[styles.specValue, { color: theme.colors.ink }]}>{selectedMachineObj.model || '—'}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={[styles.specLabel, { color: theme.colors.mute }]}>SERIAL NO / CODE</Text>
                    <Text style={[styles.specValueMono, { color: theme.colors.ink }]}>{selectedMachineObj.serial_number || selectedMachineObj.machine_id}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={[styles.specLabel, { color: theme.colors.mute }]}>TOTAL RUN HOURS</Text>
                    <Text style={[styles.specValueMono, { color: theme.colors.link }]}>
                      {Math.round(activeMetrics.runHours * 10) / 10} hrs
                    </Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={[styles.specLabel, { color: theme.colors.mute }]}>BREAKDOWN EVENTS</Text>
                    <Text style={[styles.specValueMono, { color: isDark ? '#fb7185' : '#f43f5e' }]}>
                      {activeMetrics.breakdowns} Events
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          )}

          {/* B. CLIENT VIEW SUMMARY CARD */}
          {logsViewMode === 'client' && selectedClientObj && (
            <Card variant="elevated" style={styles.summaryHeaderCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleWithAnimation(setIsClientSummaryExpanded)}
                style={[
                  styles.summaryHeaderTitleRow,
                  { borderBottomColor: theme.colors.hairline, borderBottomWidth: isClientSummaryExpanded ? 1 : 0 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.summaryHeaderTitle, { color: theme.colors.ink }]}>
                      {selectedClientObj.company_name}
                    </Text>
                    {selectedClientObj.code ? (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: theme.colors.canvas, borderWidth: 1, borderColor: theme.colors.hairline }}>
                        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: theme.colors.mute, fontWeight: '700' }}>
                          {selectedClientObj.code}
                        </Text>
                      </View>
                    ) : null}
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe' }}>
                      <Text style={{ fontSize: 10, fontFamily: 'monospace', color: theme.colors.link, fontWeight: '700' }}>
                        {clientMachines.length} {clientMachines.length === 1 ? 'Machine' : 'Machines'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: '800', color: theme.colors.link }}>
                    {Math.round(activeMetrics.runHours * 10) / 10} hrs
                  </Text>
                  {isClientSummaryExpanded ? (
                    <ChevronUp size={16} color={theme.colors.mute} />
                  ) : (
                    <ChevronDown size={16} color={theme.colors.mute} />
                  )}
                </View>
              </TouchableOpacity>

              {isClientSummaryExpanded && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.mute }} numberOfLines={2}>
                      📍 {[selectedClientObj.street, selectedClientObj.city, selectedClientObj.district, selectedClientObj.state, selectedClientObj.pincode].filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join(', ') || '—'}
                    </Text>
                    {selectedClientObj.phone ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedClientObj.phone}`)}>
                        <Text style={{ fontSize: 11, color: theme.colors.link, fontFamily: 'monospace' }}>
                          📞 {selectedClientObj.phone}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* 4 Summary Metric Cards in Client Detail View */}
                  <View style={styles.metricsGrid4}>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} color={theme.colors.link} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>RUN</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: theme.colors.link }]}>
                        {Math.round(activeMetrics.runHours * 10) / 10} hrs
                      </Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} color={isDark ? '#fbbf24' : '#d97706'} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>OT</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: isDark ? '#fbbf24' : '#d97706' }]}>
                        {Math.round(activeMetrics.otHours * 10) / 10} hrs
                      </Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} color={isDark ? '#fb7185' : '#f43f5e'} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>BREAKDOWN</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: isDark ? '#fb7185' : '#f43f5e' }]}>
                        {activeMetrics.breakdowns} {activeMetrics.breakdowns === 1 ? 'Event' : 'Events'}
                      </Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <FileText size={12} color={theme.colors.mute} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>LOGS</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
                        {activeMetrics.totalLogs} {activeMetrics.totalLogs === 1 ? 'Record' : 'Records'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Card>
          )}

          {/* C. OPERATOR VIEW SUMMARY CARD */}
          {logsViewMode === 'operator' && (
            <Card variant="elevated" style={styles.summaryHeaderCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleWithAnimation(setIsOperatorSummaryExpanded)}
                style={[
                  styles.summaryHeaderTitleRow,
                  { borderBottomColor: theme.colors.hairline, borderBottomWidth: isOperatorSummaryExpanded ? 1 : 0 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.summaryHeaderTitle, { color: theme.colors.ink }]}>
                      {selectedOperatorObj?.full_name || 'Operator'}
                    </Text>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe' }}>
                      <Text style={{ fontSize: 10, fontFamily: 'monospace', color: theme.colors.link, fontWeight: '700' }}>
                        OPERATOR
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: '800', color: theme.colors.link }}>
                    {Math.round(activeMetrics.runHours * 10) / 10} hrs
                  </Text>
                  {isOperatorSummaryExpanded ? (
                    <ChevronUp size={16} color={theme.colors.mute} />
                  ) : (
                    <ChevronDown size={16} color={theme.colors.mute} />
                  )}
                </View>
              </TouchableOpacity>

              {isOperatorSummaryExpanded && (
                <>
                  {(selectedOperatorObj?.phone || selectedOperatorObj?.email) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
                      {selectedOperatorObj?.phone ? (
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedOperatorObj.phone}`)}>
                          <Text style={{ fontSize: 11, color: theme.colors.link, fontFamily: 'monospace' }}>
                            📞 {selectedOperatorObj.phone}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {selectedOperatorObj?.email ? (
                        <Text style={{ fontSize: 11, color: theme.colors.mute }}>
                          ✉️ {selectedOperatorObj.email}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={[styles.metricsGrid4, { marginTop: (selectedOperatorObj?.phone || selectedOperatorObj?.email) ? 0 : 8 }]}>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} color={theme.colors.link} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>RUN</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: theme.colors.link }]}>
                        {Math.round(activeMetrics.runHours * 10) / 10} hrs
                      </Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} color={isDark ? '#fbbf24' : '#d97706'} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>OT</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: isDark ? '#fbbf24' : '#d97706' }]}>
                        {Math.round(activeMetrics.otHours * 10) / 10} hrs
                      </Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} color={isDark ? '#fb7185' : '#f43f5e'} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>BREAKDOWN</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: isDark ? '#fb7185' : '#f43f5e' }]}>
                        {activeMetrics.breakdowns} Events
                      </Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <FileText size={12} color={theme.colors.mute} />
                        <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>LOGS</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
                        {activeMetrics.totalLogs} Records
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Card>
          )}

          {/* 4. DAILY RUNNING LOG CARDS LIST */}
          <View style={styles.logsListContainer}>
            {isLoading || isSearchingLogs ? (
              <OperationLogListSkeleton count={4} />
            ) : filteredLogs.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                <Text style={[styles.emptyCardText, { color: theme.colors.mute }]}>
                  No daily running hour logs found matching active filters.
                </Text>
              </View>
            ) : (
              paginatedLogs.map((log) => {
                const startMtr = log.start_meter ?? 0;
                const endMtr = log.end_meter ?? startMtr;
                const runningHrs = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
                const otHrs = log.overtime_hours ?? 0;
                const mModel = log.machine?.model || log.machine_code || '30D-7SA';
                const mSerial = log.machine?.serial_number || '2103006590';
                const clientName = log.client?.name || log.client?.company_name || 'Unassigned Client';
                const opName = log.operator?.full_name || 'Operator';
                const cleanRemarks = (log.remarks || '—').replace(/\[Breakdown Duration:[^\]]+\]/gi, '').trim();
                const hasConflict = Boolean(log.conflict_flag);
                const isPendingConflict = hasConflict && (!log.conflict_status || log.conflict_status === 'pending');
                const isResolvedConflict = hasConflict && (log.conflict_status === 'resolved' || log.conflict_status === 'acknowledged' || log.conflict_status === 'adjusted');
                const cardConflict = hasConflict
                  ? parseConflictReason(log.conflict_reason, {
                      machineCode: log.machine_code,
                      machineModel: mModel,
                      operatorName: opName,
                      startTime: log.start_time,
                      endTime: log.end_time,
                      runningHours: runningHrs,
                      overtimeHours: otHrs,
                      logDate: log.log_date,
                    })
                  : null;

                return (
                  <Card
                    key={log.id}
                    variant="elevated"
                    style={[
                      styles.logCard,
                      isPendingConflict && { borderLeftWidth: 3, borderLeftColor: '#d97706' },
                      isResolvedConflict && { borderLeftWidth: 3, borderLeftColor: '#059669' },
                    ]}
                  >
                    {/* Log Card Header */}
                    <View style={styles.logCardHeader}>
                      <View style={styles.logCardHeaderLeft}>
                        <View style={styles.dateRow}>
                          <Text style={[styles.logDateText, { color: theme.colors.mute }]}>{formatDate(log.log_date)}</Text>
                          {log.created_at && (
                            <View style={[styles.timestampBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe' }]}>
                              <Clock size={10} color={theme.colors.link} style={{ marginRight: 3 }} />
                              <Text style={[styles.timestampText, { color: theme.colors.link }]}>
                                {formatExactTimestamp(log.created_at, true)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.logMachineModel, { color: theme.colors.ink }]}>{mModel}</Text>
                        <Text style={[styles.logMachineSerial, { color: theme.colors.mute }]}>S/N: {mSerial}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isPendingConflict && (
                          <View
                            style={[
                              styles.conflictBadge,
                              {
                                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
                                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                              },
                            ]}
                          >
                            <ShieldAlert size={11} color={isDark ? '#fbbf24' : '#d97706'} style={{ marginRight: 3 }} />
                            <Text style={[styles.conflictBadgeText, { color: isDark ? '#fbbf24' : '#92400e' }]}>Shift Conflict</Text>
                          </View>
                        )}
                        {isResolvedConflict && (
                          <View
                            style={[
                              styles.conflictResolvedBadge,
                              {
                                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                                borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
                              },
                            ]}
                          >
                            <Check size={11} color={isDark ? '#34d399' : '#059669'} style={{ marginRight: 3 }} />
                            <Text style={[styles.conflictResolvedBadgeText, { color: isDark ? '#34d399' : '#047857' }]}>
                              {log.conflict_status === 'adjusted' ? 'Adjusted' : 'Acknowledged'}
                            </Text>
                          </View>
                        )}

                        {log.is_breakdown ? (
                          <View style={[styles.breakdownBadge, { backgroundColor: isDark ? 'rgba(225, 29, 72, 0.18)' : '#fee2e2', borderWidth: 1, borderColor: isDark ? 'rgba(225, 29, 72, 0.35)' : '#fecaca' }]}>
                            <AlertTriangle size={11} color={isDark ? '#fb7185' : '#e11d48'} style={{ marginRight: 3 }} />
                            <Text style={[styles.breakdownBadgeText, { color: isDark ? '#fb7185' : '#e11d48' }]}>Breakdown</Text>
                          </View>
                        ) : (
                          <View style={[styles.normalBadge, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                            <Text style={[styles.normalBadgeText, { color: theme.colors.mute }]}>0</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Middle Specs Box */}
                    <View style={[styles.logDetailsBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={styles.logDetailRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.logDetailLabel, { color: theme.colors.mute }]}>Client / Location:</Text>
                          <Text style={[styles.logDetailValue, { color: theme.colors.ink }]} numberOfLines={1}>
                            {clientName}
                          </Text>
                          {log.location ? (
                            <Text style={[styles.logDetailSub, { color: theme.colors.mute }]} numberOfLines={1}>
                              {log.location}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={[styles.logDetailLabel, { color: theme.colors.mute }]}>Operator:</Text>
                          <Text style={[styles.logDetailValue, { color: theme.colors.ink }]}>{opName}</Text>
                          {log.operator?.phone ? (
                            <TouchableOpacity
                              onPress={() => Linking.openURL(`tel:${log.operator?.phone}`)}
                              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
                            >
                              <Phone size={10} color={theme.colors.link} style={{ marginRight: 2 }} />
                              <Text style={[styles.logDetailPhone, { color: theme.colors.link }]}>{log.operator.phone}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>

                      {/* Timings & Running Hours Row */}
                      <View style={[styles.logTimingRow, { borderTopColor: theme.colors.hairline }]}>
                        <View>
                          <Text style={[styles.logDetailLabel, { color: theme.colors.mute }]}>Shift Timings:</Text>
                          <Text style={[styles.logDetailValueMono, { color: theme.colors.ink }]}>
                            {formatCompactTiming(log.start_time, log.end_time)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={[styles.logDetailLabel, { color: theme.colors.mute }]}>Meter Reading:</Text>
                          <Text style={[styles.logDetailValueMono, { color: theme.colors.ink }]}>
                            {startMtr} → {endMtr}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.logDetailLabel, { color: theme.colors.mute }]}>Operating Hrs:</Text>
                          <Text style={[styles.logHoursValue, { color: theme.colors.link }]}>
                            {runningHrs} hrs
                          </Text>
                        </View>
                      </View>

                      {/* Overtime & Remarks if present */}
                      {(otHrs > 0 || cleanRemarks !== '—') && (
                        <View style={[styles.logRemarksRow, { borderTopColor: theme.colors.hairline }]}>
                          {otHrs > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={[styles.logDetailLabel, { color: theme.colors.mute }]}>Overtime:</Text>
                              <Text style={[styles.logOtValue, { color: isDark ? '#fbbf24' : '#d97706' }]}>{otHrs} hrs</Text>
                            </View>
                          )}
                          {cleanRemarks !== '—' && (
                            <Text style={[styles.logRemarksText, { color: theme.colors.mute }]} numberOfLines={1}>
                              Note: {cleanRemarks}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Inline Overtime Shift Conflict Detailed Warning Box */}
                    {hasConflict && cardConflict && (
                      <View
                        style={[
                          styles.logConflictAdvisoryWell,
                          {
                            backgroundColor: isPendingConflict
                              ? isDark
                                ? 'rgba(245, 158, 11, 0.08)'
                                : '#fffbeb'
                              : isDark
                              ? 'rgba(16, 185, 129, 0.08)'
                              : '#f0fdf4',
                            borderColor: isPendingConflict
                              ? isDark
                                ? 'rgba(245, 158, 11, 0.3)'
                                : '#fde68a'
                              : isDark
                              ? 'rgba(16, 185, 129, 0.3)'
                              : '#bbf7d0',
                          },
                        ]}
                      >
                        <View style={styles.logConflictHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <ShieldAlert
                              size={15}
                              color={isPendingConflict ? (isDark ? '#fbbf24' : '#d97706') : (isDark ? '#34d399' : '#059669')}
                            />
                            <Text
                              style={[
                                styles.logConflictTitle,
                                { color: isPendingConflict ? (isDark ? '#fbbf24' : '#92400e') : (isDark ? '#34d399' : '#047857') },
                              ]}
                            >
                              {isPendingConflict
                                ? cardConflict.title
                                : `Overtime Conflict Resolved (${log.conflict_status || 'approved'})`}
                            </Text>
                          </View>
                          {isPendingConflict && (
                            <TouchableOpacity
                              onPress={() => handleOpenConflictModal(log)}
                              style={[
                                styles.resolveInlineBtn,
                                {
                                  borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a',
                                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                                },
                              ]}
                            >
                              <ShieldAlert size={12} color={isDark ? '#fbbf24' : '#b45309'} style={{ marginRight: 4 }} />
                              <Text style={[styles.resolveInlineBtnText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                                Resolve Conflict
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Clean summary row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                          {otHrs > 0 ? (
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
                                +{otHrs}h Overtime
                              </Text>
                            </View>
                          ) : null}
                          <Text style={{ fontSize: 11, color: isPendingConflict ? (isDark ? '#fde68a' : '#92400e') : (isDark ? '#a7f3d0' : '#065f46'), fontWeight: '600' }}>
                            {isPendingConflict
                              ? cardConflict.conflictingEntity
                                ? `Collides with active shift on ${cardConflict.conflictingEntity}`
                                : 'Overtime overlaps with subsequent shift'
                              : 'Approved by supervisor'}
                          </Text>
                        </View>

                        {log.conflict_resolution_notes && (
                          <Text style={[styles.logConflictNotes, { color: theme.colors.mute }]}>
                            Resolution Note: {log.conflict_resolution_notes}
                          </Text>
                        )}
                      </View>
                    )}
                  </Card>
                );
              })
            )}

            {/* Pagination Controls */}
            {filteredLogs.length > logsPageSize && (
              <View style={[styles.paginationRow, { borderTopColor: theme.colors.hairline }]}>
                <TouchableOpacity
                  onPress={() => setLogsPage((p) => Math.max(1, p - 1))}
                  disabled={logsPage <= 1}
                  style={[
                    styles.paginationBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                      opacity: logsPage <= 1 ? 0.4 : 1,
                    },
                  ]}
                >
                  <ChevronLeft size={16} color={theme.colors.ink} />
                  <Text style={[styles.paginationBtnText, { color: theme.colors.ink }]}>Previous</Text>
                </TouchableOpacity>

                <Text style={[styles.paginationPageText, { color: theme.colors.mute }]}>
                  Page {logsPage} of {totalPages}
                </Text>

                <TouchableOpacity
                  onPress={() => setLogsPage((p) => Math.min(totalPages, p + 1))}
                  disabled={logsPage >= totalPages}
                  style={[
                    styles.paginationBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                      opacity: logsPage >= totalPages ? 0.4 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.paginationBtnText, { color: theme.colors.ink }]}>Next</Text>
                  <ChevronRight size={16} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* 3. TAB 2: OPERATOR MACHINE ASSIGNMENTS (Matches Screenshot 4) */}
      {activeTab === 'assignments' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        >
          {/* 4 Capacity KPI Metric Cards (Screenshot 4) */}
          <View style={styles.metricsGrid4}>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>TOTAL EQUIPMENT</Text>
              <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>{totalMachinesCount}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>ACTIVE SHIFT OPERATORS</Text>
              <Text style={[styles.kpiValue, { color: theme.colors.link }]}>{activeShiftOperatorsCount}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>FULL CAPACITY (3/3)</Text>
              <Text style={[styles.kpiValue, { color: isDark ? '#34d399' : '#059669' }]}>{fullCapacityCount}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>UNASSIGNED (0/3)</Text>
              <Text style={[styles.kpiValue, { color: isDark ? '#fbbf24' : '#d97706' }]}>{unassignedCount}</Text>
            </View>
          </View>

          {/* Search Bar & Filter Strip */}
          <Card variant="elevated" style={styles.assignmentFilterCard}>
            <View style={[styles.searchBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              {isSearchingAssignments ? (
                <ActivityIndicator size="small" color={theme.colors.link} style={{ marginRight: 8 }} />
              ) : (
                <Search size={14} color={theme.colors.mute} style={{ marginRight: 8 }} />
              )}
              <TextInput
                style={[styles.searchInput, { color: theme.colors.ink }]}
                placeholder="Search machines, models, serial numbers, operators..."
                placeholderTextColor={theme.colors.mute}
                value={assignmentSearch}
                onChangeText={setAssignmentSearch}
                autoCapitalize="none"
              />
              {assignmentSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAssignmentSearch('')} style={{ padding: 4 }}>
                  <X size={14} color={theme.colors.mute} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Pills: All | Assigned | Full | Unassigned */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
              {[
                { id: 'all', label: `All (${totalMachinesCount})` },
                { id: 'assigned', label: `Assigned (${totalMachinesCount - unassignedCount})` },
                { id: 'full', label: `Full (3/3) (${fullCapacityCount})` },
                { id: 'unassigned', label: `Unassigned (${unassignedCount})` },
              ].map((pill) => {
                const isSelected = assignmentFilter === pill.id;
                return (
                  <TouchableOpacity
                    key={pill.id}
                    onPress={() => setAssignmentFilter(pill.id as any)}
                    style={[
                      styles.assignmentFilterPill,
                      {
                        backgroundColor: isSelected ? theme.colors.ink : theme.colors.canvas,
                        borderColor: isSelected ? theme.colors.ink : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.assignmentFilterPillText,
                        { color: isSelected ? theme.colors.canvas : theme.colors.body },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Expand / Collapse All Cards Toggle */}
            <TouchableOpacity
              onPress={() => handleToggleExpandAll(filteredMachinesForAssignments.map((m) => m.id))}
              style={[styles.expandAllBtn, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
            >
              <ChevronDown
                size={14}
                color={theme.colors.ink}
                style={[
                  { marginRight: 6 },
                  expandedMachineIds.size === filteredMachinesForAssignments.length && filteredMachinesForAssignments.length > 0
                    ? { transform: [{ rotate: '180deg' }] }
                    : undefined,
                ]}
              />
              <Text style={[styles.expandAllBtnText, { color: theme.colors.ink }]}>
                {expandedMachineIds.size === filteredMachinesForAssignments.length && filteredMachinesForAssignments.length > 0
                  ? 'Collapse All Cards'
                  : 'Expand All Cards'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Machine Assignment Cards List */}
          <View style={styles.assignmentCardsList}>
            {isLoading || isSearchingAssignments ? (
              <AssignmentListSkeleton count={4} />
            ) : filteredMachinesForAssignments.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                <Text style={[styles.emptyCardText, { color: theme.colors.mute }]}>
                  No equipment matched your search or filter criteria.
                </Text>
              </View>
            ) : (
              filteredMachinesForAssignments.map((m) => {
                const isExpanded = expandedMachineIds.has(m.id);
                const activeAss = m.active_assignments || [];
                const isFull = activeAss.length >= 3;

                return (
                  <Card key={m.id} variant="elevated" style={styles.machCard}>
                    {/* Header Strip — Clickable for accordion */}
                    <TouchableOpacity
                      onPress={() => toggleMachineExpanded(m.id)}
                      activeOpacity={0.7}
                      style={styles.machCardHeader}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={styles.machCardTitleRow}>
                          <Text style={[styles.machCodeText, { color: theme.colors.ink }]}>{m.machine_id}</Text>
                          {m.model && <Text style={[styles.machModelText, { color: theme.colors.mute }]}>· {m.model}</Text>}
                        </View>
                        <Text style={[styles.machSerialText, { color: theme.colors.mute }]}>
                          (S/N: {m.serial_number || '—'})
                        </Text>
                        <View style={styles.machMetaRow}>
                          <Text style={[styles.machMetaLabel, { color: theme.colors.mute }]}>
                            Meter: <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{m.hour_meter || 0} hrs</Text>
                          </Text>
                          <Text style={[styles.machMetaLabel, { color: theme.colors.mute }]}>
                            Status: <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{m.status || 'Available'}</Text>
                          </Text>
                        </View>
                      </View>

                      {/* Right capacity indicator & chevron */}
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View
                          style={[
                            styles.machCapacityBadge,
                            {
                              backgroundColor: isFull
                                ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5'
                                : activeAss.length > 0
                                ? isDark ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe'
                                : theme.colors.canvas,
                              borderColor: isFull
                                ? isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0'
                                : activeAss.length > 0
                                ? isDark ? 'rgba(59, 130, 246, 0.3)' : '#bae6fd'
                                : theme.colors.hairline,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.capacityDot,
                              { backgroundColor: isFull ? (isDark ? '#34d399' : '#059669') : activeAss.length > 0 ? theme.colors.link : (isDark ? '#525252' : '#a3a3a3') },
                            ]}
                          />
                          <Text
                            style={[
                              styles.machCapacityText,
                              { color: isFull ? (isDark ? '#34d399' : '#047857') : activeAss.length > 0 ? theme.colors.link : theme.colors.mute },
                            ]}
                          >
                            {activeAss.length} / 3 Operators
                          </Text>
                        </View>

                        {/* Assign Operator Button */}
                        {!isFull && (
                          <TouchableOpacity
                            onPress={() => handleOpenAssignModal(m.id)}
                            style={[styles.assignQuickBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                          >
                            <Plus size={12} color={theme.colors.link} style={{ marginRight: 2 }} />
                            <Text style={[styles.assignQuickBtnText, { color: theme.colors.link }]}>Assign Operator</Text>
                          </TouchableOpacity>
                        )}

                        <ChevronDown
                          size={16}
                          color={theme.colors.mute}
                          style={isExpanded ? { transform: [{ rotate: '180deg' }] } : undefined}
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Expanded 3 Shift Slots Grid */}
                    {isExpanded && (
                      <View style={[styles.machExpandedSlots, { borderTopColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        {activeAss.map((ass, idx) => {
                          const opObj = activeOperators.find((o) => o.id === ass.operator_id) || (ass.operator as any);
                          const opName = opObj?.full_name || 'Assigned Operator';
                          const opPhone = opObj?.phone;
                          const sDisplay = formatTo12Hour(ass.shift_start_time) || '08:00 AM';
                          const eDisplay = formatTo12Hour(ass.shift_end_time) || '05:00 PM';
                          const isOvernight = ass.crosses_midnight;

                          return (
                            <View
                              key={ass.id || idx}
                              style={[styles.shiftSlotCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                            >
                              <View style={styles.shiftSlotHeader}>
                                <Text style={[styles.shiftSlotNum, { color: theme.colors.mute }]}>SHIFT SLOT #{idx + 1}</Text>
                                <View
                                  style={[
                                    styles.timingPill,
                                    {
                                      backgroundColor: isOvernight
                                        ? isDark
                                          ? 'rgba(99, 102, 241, 0.15)'
                                          : '#eef2ff'
                                        : isDark
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : '#fef3c7',
                                      borderColor: isOvernight
                                        ? isDark
                                          ? 'rgba(99, 102, 241, 0.35)'
                                          : '#c7d2fe'
                                        : isDark
                                        ? 'rgba(245, 158, 11, 0.35)'
                                        : '#fde68a',
                                    },
                                  ]}
                                >
                                  {isOvernight ? (
                                    <Moon size={11} color={isDark ? '#a5b4fc' : '#4f46e5'} />
                                  ) : (
                                    <Sun size={11} color={isDark ? '#fbbf24' : '#d97706'} />
                                  )}
                                  <Text
                                    style={[
                                      styles.timingPillText,
                                      {
                                        color: isOvernight
                                          ? isDark
                                            ? '#c7d2fe'
                                            : '#4338ca'
                                          : isDark
                                          ? '#fbbf24'
                                          : '#92400e',
                                      },
                                    ]}
                                  >
                                    {sDisplay} – {eDisplay}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.shiftSlotBody}>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.slotOpName, { color: theme.colors.ink }]}>{opName}</Text>
                                  {opPhone ? (
                                    <TouchableOpacity
                                      onPress={() => Linking.openURL(`tel:${opPhone}`)}
                                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
                                    >
                                      <Phone size={11} color={theme.colors.link} style={{ marginRight: 3 }} />
                                      <Text style={[styles.slotOpPhone, { color: theme.colors.link }]}>{opPhone}</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <Text style={[styles.slotOpPhone, { color: theme.colors.mute }]}>No contact</Text>
                                  )}
                                </View>

                                <TouchableOpacity
                                  onPress={() => handleOpenAssignModal(m.id)}
                                  style={[styles.changeOpBtn, { borderColor: theme.colors.hairline }]}
                                >
                                  <Text style={[styles.changeOpBtnText, { color: theme.colors.link }]}>Change Operator</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}

                        {/* Open Slots available buttons */}
                        {Array.from({ length: Math.max(0, 3 - activeAss.length) }).map((_, emptyIdx) => {
                          const slotNum = activeAss.length + emptyIdx + 1;
                          return (
                            <TouchableOpacity
                              key={`empty-${emptyIdx}`}
                              onPress={() => handleOpenAssignModal(m.id)}
                              style={[styles.emptySlotBtn, { borderColor: theme.colors.hairline }]}
                            >
                              <Plus size={14} color={theme.colors.link} />
                              <Text style={[styles.emptySlotBtnText, { color: theme.colors.link }]}>
                                + Assign Shift #{slotNum} (Open Slot Available)
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* 4. MODALS & DIALOGS */}
      {/* Assign Operator Modal */}
      <MobileAssignmentModal
        visible={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        machineId={assignModalTargetMachineId}
        allMachines={machinesList}
        activeOperators={activeOperators}
        currentUserId={user?.id || ''}
        onSuccess={fetchOperationsData}
      />

      {/* Review Overtime Conflict Modal */}
      <MobileConflictResolutionModal
        visible={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        log={selectedConflictLog}
        currentUserId={user?.id || ''}
        onSuccess={fetchOperationsData}
      />

      {/* Export / Print Modal */}
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

      {/* Reusable Filter Selector Sheet */}
      <OperationsFilterSelectorModal
        visible={selectorModalConfig.visible}
        onClose={() => setSelectorModalConfig((prev) => ({ ...prev, visible: false }))}
        title={selectorModalConfig.title}
        options={selectorModalConfig.options}
        selectedValue={selectorModalConfig.selectedValue}
        onSelect={selectorModalConfig.onSelect}
      />

      {/* Fast Log Entry Modal for Operators */}
      {targetMachineForLog && (
        <MeterLogModal
          visible={meterModalVisible}
          onClose={() => setMeterModalVisible(false)}
          machineId={targetMachineForLog.id}
          machineCode={targetMachineForLog.machine_id}
          model={targetMachineForLog.model}
          serialNumber={targetMachineForLog.serial_number}
          onSubmit={() => {
            setMeterModalVisible(false);
            fetchOperationsData();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radiusNumeric.md,
    gap: 4,
  },
  headerAssignBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  aboveNavbar: {
    borderBottomWidth: 1,
    paddingVertical: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.md,
  },
  aboveNavbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboveNavbarTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radiusNumeric.lg,
  },
  aboveNavbarTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  aboveNavbarTabInactive: {
    borderWidth: 1,
  },
  aboveNavbarTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  aboveNavbarTabTextActive: {
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacingNumeric.md,
    paddingBottom: spacingNumeric['2xl'],
  },
  conflictBanner: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
    gap: 8,
  },
  conflictBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conflictBannerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conflictBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  conflictActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  conflictActionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  conflictBannerDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  cleanConflictCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacingNumeric.sm + 2,
    gap: 8,
  },
  cleanConflictCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  cleanMachineIconBox: {
    width: 24,
    height: 24,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanConflictMachineCode: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.2,
  },
  cleanConflictMachineModel: {
    fontSize: 11,
    fontWeight: '600',
  },
  cleanSeverityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  cleanSeverityPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cleanReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  cleanReviewBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cleanInfoStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 12,
  },
  cleanInfoItem: {
    gap: 2,
    minWidth: 120,
    flexGrow: 1,
  },
  cleanInfoItemConflict: {
    gap: 2,
    minWidth: 140,
    flexGrow: 1,
  },
  cleanInfoLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cleanConflictTargetLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cleanInfoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cleanInfoValueText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cleanInfoValueMono: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cleanOtPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  cleanOtPillText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cleanConflictEntityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  cleanConflictEntityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  conflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  conflictBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  conflictResolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  conflictResolvedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  logConflictAdvisoryWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginTop: spacingNumeric.xs,
    gap: 4,
  },
  logConflictHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logConflictTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  logConflictDesc: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  logConflictNotes: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },
  resolveInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  resolveInlineBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  filterCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    marginBottom: spacingNumeric.md,
    gap: 10,
  },
  subTabPillsRow: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  subTabPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
  },
  subTabPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  subTabPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 0,
  },
  exportBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radiusNumeric.sm,
    gap: 6,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropdownsContainer: {
    gap: 8,
    paddingTop: 4,
  },
  dropdownField: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  selectorTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  summaryHeaderCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    marginBottom: spacingNumeric.md,
    gap: 10,
  },
  summaryHeaderTitleRow: {
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
    gap: 6,
  },
  summaryHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPrefix: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  machineSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  specItem: {
    minWidth: '45%',
    flex: 1,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  specValueMono: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  clientBadgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  infoPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  infoPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  clientContactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  metricsGrid4: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: spacingNumeric.xs,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 2,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logsListContainer: {
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.xs,
  },
  logCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    gap: 8,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  logCardHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  logDateText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  timestampText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMachineModel: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  logMachineSerial: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  breakdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  breakdownBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  normalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  normalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logDetailsBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 6,
  },
  logDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  logDetailLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  logDetailValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  logDetailSub: {
    fontSize: 10,
  },
  logDetailPhone: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logTimingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logDetailValueMono: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logHoursValue: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logRemarksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  logOtValue: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logRemarksText: {
    fontSize: 10,
    fontStyle: 'italic',
    flex: 1,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.md,
    borderTopWidth: 1,
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 4,
  },
  paginationBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paginationPageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  assignmentFilterCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    marginBottom: spacingNumeric.md,
    gap: 10,
  },
  filterPillsScroll: {
    gap: 8,
  },
  assignmentFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  assignmentFilterPillText: {
    fontSize: 11,
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  expandAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  assignmentCardsList: {
    gap: spacingNumeric.sm,
  },
  machCard: {
    borderRadius: radiusNumeric.lg,
    overflow: 'hidden',
  },
  machCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
  },
  machCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  machCodeText: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  machModelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  machSerialText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  machMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  machMetaLabel: {
    fontSize: 10,
  },
  machCapacityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  capacityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  machCapacityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  assignQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  assignQuickBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  machExpandedSlots: {
    padding: spacingNumeric.md,
    borderTopWidth: 1,
    gap: 8,
  },
  shiftSlotCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 6,
  },
  shiftSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftSlotNum: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  timingPillText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shiftSlotBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotOpName: {
    fontSize: 12,
    fontWeight: '800',
  },
  slotOpPhone: {
    fontSize: 10,
  },
  changeOpBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  changeOpBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptySlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
  },
  emptySlotBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    padding: spacingNumeric.xl,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
