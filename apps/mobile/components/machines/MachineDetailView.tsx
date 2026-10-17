import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  TextInput,
  useWindowDimensions} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppModal } from '../ui/AppModal';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { Badge, useTheme, SharedLinkPreviewCard, AppRefreshControl, SegmentedToggle, MobileHeader, Text, showToast, type HeaderActionItem, KPICard, KPIGrid, Pagination, FilterSidebar, FilterCategoryCard, DropdownFilterSelector } from '../ui';
import { ScissorLiftLogoIcon } from '../branding/ReachInternationalLogo';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import { getWebAppUrl } from '../../lib/env';
import {
  ChevronLeft,
  Edit2,
  Trash2,
  Share2,
  Copy,
  Check,
  Clock,
  Phone,
  Mail,
  Users,
  Shield,
  Wrench,
  Building2,
  MapPin,
  ExternalLink,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  WhatsAppIcon,
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  User,
  UserCheck,
  RefreshCw,
  ArrowRight,
  ArrowRightLeft,
  FileText,
  Info,
} from '../ui/icon';
import { MachineModal } from './MachineModal';
import { DeleteMachineDialog } from './DeleteMachineDialog';
import { MobileAssignPersonnelModal } from '../operations/MobileAssignPersonnelModal';
import { MachineHMRSkeleton } from './MachineHMRSkeleton';
import { MachineAuditSkeleton } from './MachineAuditSkeleton';

export interface MachineDetailViewProps {
  machine: any;
  onBack: () => void;
  onMachineUpdated?: (updatedMachine?: any) => void;
  onMachineDeleted?: () => void;
  userRole?: string | null;
  initialTab?: 'overview' | 'running_hours' | 'audit_trail';
}

const mobileClientProfileCache = new Map<string, any>();

const MONTH_NAMES_MOBILE = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

function formatLogDateHeaderMobile(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown Date';
    const day = d.getDate();
    const month = MONTH_NAMES_MOBILE[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

function formatTimeWithSecondsMobile(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function formatFullDateTimeMobile(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = MONTH_NAMES_MOBILE[d.getMonth()];
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${day} ${month} ${year}, ${time}`;
  } catch {
    return dateStr;
  }
}

function formatShiftTimingWithDateMobile(meta: Record<string, any>): string {
  const startDate = meta.startDate || meta.logDate || meta.start_date || meta.log_date;
  const endDate = meta.endDate || meta.end_date || startDate;
  const startTime = meta.startTime || meta.start_time;
  const endTime = meta.endTime || meta.end_time;

  const formatDateShort = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const day = d.getDate();
      const month = MONTH_NAMES_MOBILE[d.getMonth()];
      return `${day} ${month}`;
    } catch {
      return dStr;
    }
  };

  if (startTime && endTime) {
    if (startDate && endDate && startDate !== endDate) {
      return `${formatDateShort(startDate)}, ${startTime} → ${formatDateShort(endDate)}, ${endTime}`;
    }
    if (startDate) {
      return `${formatDateShort(startDate)} • ${startTime} - ${endTime}`;
    }
    return `${startTime} - ${endTime}`;
  }

  if (startDate) {
    return `${formatDateShort(startDate)} • Shift Logged`;
  }

  return 'Standard Shift';
}

function formatFieldLabelMobile(key: string): string {
  switch (key) {
    case 'hour_meter':
      return 'Hour Meter Reading';
    case 'health_status':
      return 'Health Status';
    case 'status':
      return 'Rental Fleet Status';
    case 'client_id':
      return 'Client Assignment';
    case 'model':
      return 'Machine Model';
    case 'serial_number':
      return 'Serial Number';
    case 'year_of_mfg':
      return 'Year of Mfg';
    case 'manufacturer':
      return 'Manufacturer';
    case 'machine_id':
      return 'Machine Code';
    case 'operator_ids':
    case 'current_operator_id':
      return 'Assigned Operators';
    case 'supervisor_ids':
    case 'current_supervisor_id':
      return 'Assigned Supervisors';
    default:
      return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatDiffValueMobile(val: any): string {
  if (val === null || val === undefined || val === '') return 'None';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'string') {
    if (val === 'active') return 'Active';
    if (val === 'under_maintenance') return 'Under Maintenance';
    if (val === 'breakdown') return 'Breakdown';
    if (val === 'spare') return 'Spare';
    if (val === 'available') return 'Available';
    if (val === 'rented') return 'On Rent';
    return val;
  }
  if (Array.isArray(val)) {
    return val.length === 0 ? 'None' : val.join(', ');
  }
  return JSON.stringify(val);
}

export const MachineDetailView: React.FC<MachineDetailViewProps> = ({
  machine: initialMachine,
  onBack,
  onMachineUpdated,
  onMachineDeleted,
  userRole,
  initialTab,
}) => {
  const { theme, isDark } = useTheme();
  const [machine, setMachine] = useState<any>(initialMachine);

  useEffect(() => {
    setMachine(initialMachine);
  }, [initialMachine]);

  // On-demand full client profile loading with instant cache retrieval
  const [fullClient, setFullClient] = useState<any>(() => {
    if (machine.client_id && mobileClientProfileCache.has(machine.client_id)) {
      return mobileClientProfileCache.get(machine.client_id);
    }
    return machine.client || null;
  });

  useEffect(() => {
    if (!machine.client_id) return;
    if (mobileClientProfileCache.has(machine.client_id)) {
      setFullClient(mobileClientProfileCache.get(machine.client_id));
      return;
    }
    supabase
      .from('clients')
      .select(`
        id,
        code,
        company_name,
        city,
        district,
        state,
        pincode,
        phone,
        contact_person,
        street,
        gstin,
        pan_number,
        is_billing_address_different,
        billing_address,
        billing_city,
        billing_district,
        billing_state,
        billing_pincode,
        status
      `)
      .eq('id', machine.client_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          mobileClientProfileCache.set(machine.client_id, data);
          setFullClient(data);
        }
      });
  }, [machine.client_id]);

  const normalizedRole = (userRole || '').toLowerCase();
  const isAdminOrManager =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'manager';
  const isSupervisor = normalizedRole === 'supervisor';
  const canManage = isAdminOrManager;
  const canAssignOperator = isAdminOrManager || isSupervisor;
  const canEdit = isAdminOrManager;
  const canDelete = isAdminOrManager;

  // Active Tab: 'overview' (Basic Info), 'running_hours' (Running Logs), or 'audit_trail' (Audit Trail)
  const [activeTab, setActiveTab] = useState<'overview' | 'running_hours' | 'audit_trail'>(initialTab || 'overview');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Copy states
  const [copiedId, setCopiedId] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);
  const [copiedSiteAddress, setCopiedSiteAddress] = useState(false);
  const [copiedBillingAddress, setCopiedBillingAddress] = useState(false);

  // Modals
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSection, setEditSection] = useState<'all' | 'info' | 'personnel' | 'client'>('all');
  const [assignPersonnelModalVisible, setAssignPersonnelModalVisible] = useState(false);
  const [heroMenuVisible, setHeroMenuVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Responsive dimensions for 3-tier viewports (Mobile <=640px, Tablet 641-1023px, Desktop >=1024px)
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth <= 640;
  const isTablet = windowWidth > 640 && windowWidth < 1024;
  const numCols = isMobile ? 2 : isTablet ? 3 : 4;

  // Running Logs State (Lazy loaded)
  const [hourLogs, setHourLogs] = useState<any[] | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false);

  // Audit Trail State (Lazy loaded)
  const [auditLogs, setAuditLogs] = useState<any[] | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [hasLoadedAudit, setHasLoadedAudit] = useState(false);
  const [auditCategory, setAuditCategory] = useState<'all' | 'hour_logs' | 'breakdowns' | 'assignments' | 'updates'>('all');
  const [selectedMobileAuditLog, setSelectedMobileAuditLog] = useState<any | null>(null);
  const [copiedLogIdMobile, setCopiedLogIdMobile] = useState(false);

  const handleTabChange = useCallback((val: string) => {
    setActiveTab(val as 'overview' | 'running_hours' | 'audit_trail');
  }, []);

  const segmentedTabItems = useMemo(
    () => [
      { id: 'overview' as const, label: 'Basic Info' },
      {
        id: 'running_hours' as const,
        label: 'HMR',
        count: hasLoadedLogs && hourLogs && hourLogs.length > 0 ? hourLogs.length : undefined,
      },
      ...(normalizedRole !== 'operator'
        ? [
            {
              id: 'audit_trail' as const,
              label: 'Audit',
              count: hasLoadedAudit && auditLogs && auditLogs.length > 0 ? auditLogs.length : undefined,
            },
          ]
        : []),
    ],
    [hasLoadedLogs, hourLogs, normalizedRole, hasLoadedAudit, auditLogs]
  );

  // Logs Filter / Sort State
  const [logSearch, setLogSearch] = useState('');
  const [logDatePreset, setLogDatePreset] = useState<'all' | '7d' | '30d' | 'month'>('all');
  const [logOperatorFilter, setLogOperatorFilter] = useState('all');
  const [logSortBy, setLogSortBy] = useState<'date_desc' | 'date_asc' | 'hours_desc' | 'hours_asc'>('date_desc');
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState<number>(10);

  // Reusable FilterSidebar state for running logs tab
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);

  const activeLogFilterCount = useMemo(() => {
    let count = 0;
    if (logDatePreset !== 'all') count++;
    if (logSortBy !== 'date_desc') count++;
    return count;
  }, [logDatePreset, logSortBy]);

  const handleResetLogFilters = useCallback(() => {
    haptics.confirm();
    setLogSearch('');
    setLogDatePreset('all');
    setLogSortBy('date_desc');
    setLogPage(1);
  }, []);

  // Title formatting: Model - Serial No (Screenshot 2 Match)
  const displayTitle =
    [machine.model, machine.serial_number].filter(Boolean).join(' - ') ||
    machine.machine_id ||
    'Machine Details';

  // Client data extraction
  const client = fullClient || machine.client;
  const clientCompanyName = client?.company_name || machine.customer_name || '';
  const clientCode = client?.code || '';
  const clientContactPerson = client?.contact_person || '';
  const clientPhone = client?.phone || machine.customer_mobile || '';
  const clientEmail = client?.email || machine.customer_email || '';
  const clientGstin = client?.gstin || '';
  const clientPan = client?.pan_number || '';
  const clientAddress = client?.street || client?.address || machine.customer_address || '';
  const clientCity = client?.city || machine.city || '';
  const clientDistrict = client?.district || '';
  const clientState = client?.state || machine.state || '';
  const clientPincode = client?.pincode || '';
  const isBillingAddressDifferent = Boolean(client?.is_billing_address_different);
  const billingAddress = client?.billing_address || '';
  const billingCity = client?.billing_city || '';
  const billingDistrict = client?.billing_district || '';
  const billingState = client?.billing_state || '';
  const billingPincode = client?.billing_pincode || '';

  const locationParts = [clientCity, clientDistrict, clientState].filter(Boolean);
  const clientLocation = locationParts.length > 0 ? Array.from(new Set(locationParts)).join(', ') : '';
  const fullSiteAddress = [clientAddress, clientLocation, clientPincode ? `PIN: ${clientPincode}` : ''].filter(Boolean).join(', ');
  const fullBillingAddress = [billingAddress, [billingCity, billingDistrict, billingState].filter(Boolean).join(', '), billingPincode ? `PIN: ${billingPincode}` : ''].filter(Boolean).join(', ');
  const hasLinkedClient = Boolean(clientCompanyName || fullSiteAddress || clientPhone);

  // Supervisors & Operators
  const supervisors = useMemo(() => {
    if (Array.isArray(machine.supervisors) && machine.supervisors.length > 0) {
      return machine.supervisors.filter((s: any) => Boolean(s?.full_name));
    }
    if (machine.current_supervisor?.full_name) {
      return [machine.current_supervisor];
    }
    return [];
  }, [machine.supervisors, machine.current_supervisor]);

  const operators = useMemo(() => {
    if (Array.isArray(machine.operators) && machine.operators.length > 0) {
      return machine.operators.filter((o: any) => Boolean(o?.full_name));
    }
    if (machine.current_operator?.full_name) {
      return [machine.current_operator];
    }
    return [];
  }, [machine.operators, machine.current_operator]);

  // Copy handlers with clipboard & toast feedback
  const handleCopy = async (text: string, label: string, setter: (v: boolean) => void) => {
    if (!text) return;
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(text);
      }
    } catch {
      // Fallback
    }
    haptics.select();
    setter(true);
    showToast('success', 'Copied to clipboard', `${label} copied.`);
    setTimeout(() => setter(false), 1800);
  };

  // Fetch Running Logs
  const fetchHourLogs = useCallback(async () => {
    if (!machine.id) return;
    setIsLoadingLogs(true);
    setLogsError(null);
    try {
      const { data, error } = await supabase
        .from('machine_hour_logs')
        .select(`
          id,
          machine_id,
          operator_id,
          supervisor_id,
          client_id,
          log_date,
          start_meter,
          end_meter,
          running_hours,
          start_time,
          end_time,
          shift,
          is_breakdown,
          breakdown_hours,
          remarks,
          created_at,
          operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email)
        `)
        .eq('machine_id', machine.id)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(100);

      if (error) throw error;
      setHourLogs(data || []);
      setHasLoadedLogs(true);
    } catch (err: any) {
      setLogsError(err?.message || 'Failed to load hour meter running logs.');
      setHourLogs([]);
      setHasLoadedLogs(true);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [machine.id]);

  useEffect(() => {
    if (activeTab === 'running_hours' && !hasLoadedLogs && !isLoadingLogs) {
      fetchHourLogs();
    }
  }, [activeTab, hasLoadedLogs, isLoadingLogs, fetchHourLogs]);

  // Audit Trail Fetcher & Caching
  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingAudit(true);
    setAuditError(null);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          user_id,
          action,
          entity_type,
          entity_id,
          category,
          severity,
          actor_name,
          actor_role,
          metadata,
          details,
          before_state,
          after_state,
          created_at,
          user:users(id, full_name, role)
        `)
        .eq('entity_id', machine.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAuditLogs(data || []);
      setHasLoadedAudit(true);
    } catch (err: any) {
      setAuditError(err?.message || 'Failed to load audit logs.');
      setAuditLogs([]);
      setHasLoadedAudit(true);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [machine.id]);

  useEffect(() => {
    if (activeTab === 'audit_trail' && !hasLoadedAudit && !isLoadingAudit) {
      fetchAuditLogs();
    }
  }, [activeTab, hasLoadedAudit, isLoadingAudit, fetchAuditLogs]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (onMachineUpdated) {
        await onMachineUpdated();
      }
      if (activeTab === 'running_hours') {
        await fetchHourLogs();
      } else if (activeTab === 'audit_trail') {
        await fetchAuditLogs();
      }
    } catch (e) {
      console.warn('[MachineDetailView] Error refreshing:', e);
    } finally {
      setRefreshing(false);
    }
  }, [onMachineUpdated, activeTab, fetchHourLogs, fetchAuditLogs]);

  // Fast entity name resolver map for mobile audit trail
  const userMapMobile = useMemo(() => {
    const map = new Map<string, string>();
    if (machine?.operators) {
      machine.operators.forEach((op: any) => {
        if (op?.id) map.set(op.id, op.full_name || 'Operator');
      });
    }
    if (machine?.supervisors) {
      machine.supervisors.forEach((sup: any) => {
        if (sup?.id) map.set(sup.id, sup.full_name || 'Supervisor');
      });
    }
    if (machine?.current_operator?.id) {
      map.set(machine.current_operator.id, machine.current_operator.full_name || 'Current Operator');
    }
    if (machine?.current_supervisor?.id) {
      map.set(machine.current_supervisor.id, machine.current_supervisor.full_name || 'Current Supervisor');
    }
    if (auditLogs) {
      auditLogs.forEach((l) => {
        if (l.user) {
          const u = Array.isArray(l.user) ? l.user[0] : l.user;
          if (u?.id && u?.full_name) map.set(u.id, u.full_name);
        }
        if (l.metadata?.operatorId && l.metadata?.operatorName) {
          map.set(l.metadata.operatorId, l.metadata.operatorName);
        }
      });
    }
    return map;
  }, [machine, auditLogs]);

  const resolveUserNameMobile = useCallback((id?: string | null) => {
    if (!id) return 'None';
    return userMapMobile.get(id) || `User (${id.slice(0, 8)})`;
  }, [userMapMobile]);

  const resolveClientNameMobile = useCallback((id?: string | null) => {
    if (!id) return 'None (Available)';
    if (machine?.client_id === id && (client?.company_name || machine?.customer_name)) {
      return client?.company_name || machine?.customer_name;
    }
    return `Client (${id.slice(0, 8)})`;
  }, [machine, client]);

  // Enriched audit trail with previous vs updated details and deletions
  const enrichedAuditLogs = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return [];

    const chron = [...auditLogs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const runningSnapshot: Record<string, any> = {
      model: machine?.model,
      serial_number: machine?.serial_number,
      machine_id: machine?.machine_id,
      year_of_mfg: machine?.year_of_mfg,
      manufacturer: machine?.manufacturer,
      hour_meter: machine?.hour_meter,
      health_status: machine?.health_status,
      status: machine?.status,
      client_id: machine?.client_id,
      operator_ids: machine?.operator_ids || [],
      supervisor_ids: machine?.supervisor_ids || [],
    };

    const enrichedList: any[] = [];

    for (const log of chron) {
      const act = (log.action || '').toLowerCase();
      const isHourLog = act.includes('hour_logged');
      const isBreakdown =
        act.includes('breakdown') ||
        log.metadata?.isBreakdown === true ||
        log.metadata?.is_breakdown === true ||
        (log.metadata?.breakdownDuration && String(log.metadata.breakdownDuration) !== '0' && String(log.metadata.breakdownDuration) !== '0h') ||
        (log.metadata?.breakdownHours && Number(log.metadata.breakdownHours) > 0) ||
        Boolean(log.metadata?.breakdownReason);
      const isOpEnded = act.includes('operator_assignment_ended') || act.includes('assignment_ended');
      const isDeleteEvent = act.includes('delete') || act.includes('deactivated');
      const isOpUpdate = act.includes('operators_updated') || act.includes('operator_assigned');
      const isSupUpdate = act.includes('supervisors_updated') || act.includes('reassigned_supervisor');
      const isClientUpdate = act.includes('client_assignment_updated');
      const isStatusUpdate = act.includes('operational_status') || act.includes('status');
      const isInfoUpdate = act.includes('info_updated') || act.includes('updated');

      const diffs: { field: string; label: string; previous: string; updated: string }[] = [];
      const deletions: { field: string; label: string; deletedValue: string; reason?: string }[] = [];

      // Explicit changes from metadata or before/after state
      if (log.metadata?.changes && typeof log.metadata.changes === 'object') {
        for (const [key, change] of Object.entries(log.metadata.changes as Record<string, any>)) {
          if (!change) continue;
          if (isHourLog && (key === 'hour_meter' || key === 'hourMeter')) continue;

          if (change.deleted) {
            deletions.push({
              field: key,
              label: formatFieldLabelMobile(key),
              deletedValue: formatDiffValueMobile(change.previous),
              reason: 'Removed / cleared during update',
            });
          } else if (JSON.stringify(change.previous) !== JSON.stringify(change.updated)) {
            let prevStr = formatDiffValueMobile(change.previous);
            let updatedStr = formatDiffValueMobile(change.updated);

            if (key === 'operator_ids') {
              const prevList = Array.isArray(change.previous) ? change.previous.map(resolveUserNameMobile).join(', ') : resolveUserNameMobile(change.previous);
              const nextList = Array.isArray(change.updated) ? change.updated.map(resolveUserNameMobile).join(', ') : resolveUserNameMobile(change.updated);
              prevStr = prevList || 'None';
              updatedStr = nextList || 'None';
            } else if (key === 'supervisor_ids' || key === 'current_supervisor_id') {
              const prevList = Array.isArray(change.previous) ? change.previous.map(resolveUserNameMobile).join(', ') : resolveUserNameMobile(change.previous);
              const nextList = Array.isArray(change.updated) ? change.updated.map(resolveUserNameMobile).join(', ') : resolveUserNameMobile(change.updated);
              prevStr = prevList || 'None';
              updatedStr = nextList || 'None';
            } else if (key === 'client_id') {
              prevStr = resolveClientNameMobile(change.previous);
              updatedStr = resolveClientNameMobile(change.updated);
            }

            if (updatedStr !== 'None') {
              diffs.push({
                field: key,
                label: formatFieldLabelMobile(key),
                previous: prevStr,
                updated: updatedStr,
              });
            } else {
              deletions.push({
                field: key,
                label: formatFieldLabelMobile(key),
                deletedValue: prevStr,
                reason: 'Unassigned from machine',
              });
            }
          }
        }
      }

      // Hour Meter Log (Update snapshot; do NOT duplicate in diffs per Item 3)
      if (isHourLog && log.metadata) {
        const end = log.metadata.endMeter ?? log.metadata.end_meter;
        if (end !== undefined) {
          runningSnapshot.hour_meter = end;
        }
      }

      // Operator Assignment Ended
      if (isOpEnded && log.metadata) {
        const opName = log.metadata.operatorName || resolveUserNameMobile(log.metadata.operatorId);
        deletions.push({
          field: 'operator',
          label: 'Removed Operator Assignment',
          deletedValue: opName,
          reason: log.metadata.endReason ? `Assignment ended (${log.metadata.endReason})` : 'Operator unassigned from machine',
        });
      }

      // Machine Record Deletion
      if (isDeleteEvent) {
        const delMeta = log.metadata?.deleted_record || log.metadata || runningSnapshot;
        deletions.push({
          field: 'machine',
          label: 'Deleted Machine Asset Record',
          deletedValue: `${delMeta.model || machine.model || 'Machine'} • Serial: ${delMeta.serial_number || machine.serial_number || '—'} (${delMeta.machine_id || machine.machine_id || ''})`,
          reason: 'Machine permanently deleted from inventory',
        });
      }

      // Historical Sequential Diff fallback
      if (diffs.length === 0 && deletions.length === 0) {
        if (isOpUpdate && log.metadata) {
          const rawOps = log.metadata.operator_ids || (log.metadata.current_operator_id ? [log.metadata.current_operator_id] : []);
          const prevOps: string[] = runningSnapshot.operator_ids || [];
          const removed = prevOps.filter((id) => !rawOps.includes(id));
          removed.forEach((id) => {
            deletions.push({
              field: 'operator',
              label: 'Removed Operator',
              deletedValue: resolveUserNameMobile(id),
              reason: 'Unassigned from machine roster',
            });
          });
          const prevStr = prevOps.map(resolveUserNameMobile).join(', ') || 'None';
          const nextStr = rawOps.map(resolveUserNameMobile).join(', ') || 'None';
          if (nextStr !== 'None' && prevStr !== nextStr) {
            diffs.push({
              field: 'operator_ids',
              label: 'Assigned Operators',
              previous: prevStr,
              updated: nextStr,
            });
          }
          runningSnapshot.operator_ids = rawOps;
        } else if (isSupUpdate && log.metadata) {
          const rawSups = log.metadata.supervisor_ids || (log.metadata.current_supervisor_id ? [log.metadata.current_supervisor_id] : []);
          const prevSups: string[] = runningSnapshot.supervisor_ids || [];
          const removed = prevSups.filter((id) => !rawSups.includes(id));
          removed.forEach((id) => {
            deletions.push({
              field: 'supervisor',
              label: 'Removed Supervisor',
              deletedValue: resolveUserNameMobile(id),
              reason: 'Unassigned from machine roster',
            });
          });
          const prevStr = prevSups.map(resolveUserNameMobile).join(', ') || 'None';
          const nextStr = rawSups.map(resolveUserNameMobile).join(', ') || 'None';
          if (nextStr !== 'None' && prevStr !== nextStr) {
            diffs.push({
              field: 'supervisor_ids',
              label: 'Assigned Supervisors',
              previous: prevStr,
              updated: nextStr,
            });
          }
          runningSnapshot.supervisor_ids = rawSups;
        } else if (isClientUpdate && log.metadata) {
          const newClient = log.metadata.client_id;
          const prevClient = runningSnapshot.client_id;
          if (prevClient && !newClient) {
            deletions.push({
              field: 'client_id',
              label: 'De-allocated Client',
              deletedValue: resolveClientNameMobile(prevClient),
              reason: 'Machine lease ended; returned to available fleet',
            });
          } else if (newClient && newClient !== prevClient) {
            diffs.push({
              field: 'client_id',
              label: 'Client Assignment',
              previous: resolveClientNameMobile(prevClient),
              updated: resolveClientNameMobile(newClient),
            });
          }
          runningSnapshot.client_id = newClient;
        } else if (isStatusUpdate && log.metadata) {
          if (log.metadata.health_status && log.metadata.health_status !== runningSnapshot.health_status) {
            diffs.push({
              field: 'health_status',
              label: 'Health Status',
              previous: formatDiffValueMobile(runningSnapshot.health_status || 'active'),
              updated: formatDiffValueMobile(log.metadata.health_status),
            });
            runningSnapshot.health_status = log.metadata.health_status;
          }
          if (log.metadata.status && log.metadata.status !== runningSnapshot.status) {
            diffs.push({
              field: 'status',
              label: 'Rental Fleet Status',
              previous: formatDiffValueMobile(runningSnapshot.status || 'available'),
              updated: formatDiffValueMobile(log.metadata.status),
            });
            runningSnapshot.status = log.metadata.status;
          }
        } else if (isInfoUpdate && log.metadata) {
          for (const key of ['model', 'serial_number', 'year_of_mfg', 'manufacturer', 'machine_id', 'hour_meter', 'health_status']) {
            if (log.metadata[key] !== undefined) {
              const oldVal = runningSnapshot[key];
              const newVal = log.metadata[key];
              if (oldVal !== undefined && String(oldVal) !== String(newVal)) {
                diffs.push({
                  field: key,
                  label: formatFieldLabelMobile(key),
                  previous: formatDiffValueMobile(oldVal),
                  updated: formatDiffValueMobile(newVal),
                });
              }
              runningSnapshot[key] = newVal;
            }
          }
        }
      }

      // Deduplicate: If an entity was removed and already captured in deletions, don't show duplicate "Updated: None" diff
      const cleanDiffs = diffs.filter((d) => {
        if (d.updated === 'None' && deletions.length > 0) {
          const isCovered = deletions.some(
            (del) =>
              (d.field.includes('operator') && del.field.includes('operator')) ||
              (d.field.includes('supervisor') && del.field.includes('supervisor')) ||
              (d.field.includes('client') && del.field.includes('client'))
          );
          if (isCovered) return false;
        }
        return true;
      });

      enrichedList.push({
        ...log,
        diffs: cleanDiffs,
        deletions,
        isDeletionEvent: isDeleteEvent || isOpEnded || deletions.length > 0,
        isBreakdown,
      });
    }

    return enrichedList.reverse();
  }, [auditLogs, machine, resolveUserNameMobile, resolveClientNameMobile]);

  const auditCategoryCounts = useMemo(() => {
    if (!enrichedAuditLogs) return { all: 0, hour_logs: 0, breakdowns: 0, assignments: 0, updates: 0 };
    return {
      all: enrichedAuditLogs.length,
      hour_logs: enrichedAuditLogs.filter((l: any) => {
        const act = (l.action || '').toLowerCase();
        return act.includes('hour_logged') || act.includes('hmr') || act.includes('meter');
      }).length,
      breakdowns: enrichedAuditLogs.filter((l: any) => l.isBreakdown).length,
      assignments: enrichedAuditLogs.filter((l: any) => {
        const act = (l.action || '').toLowerCase();
        return act.includes('assign') || act.includes('operator') || act.includes('supervisor');
      }).length,
      updates: enrichedAuditLogs.filter((l: any) => {
        const act = (l.action || '').toLowerCase();
        return (
          !act.includes('hour_logged') &&
          !act.includes('hmr') &&
          !act.includes('meter') &&
          !act.includes('assign') &&
          !act.includes('operator') &&
          !act.includes('supervisor')
        );
      }).length,
    };
  }, [enrichedAuditLogs]);

  const filteredAuditLogs = useMemo(() => {
    if (!enrichedAuditLogs) return [];
    if (auditCategory === 'all') return enrichedAuditLogs;
    if (auditCategory === 'breakdowns') return enrichedAuditLogs.filter((l: any) => l.isBreakdown);
    if (auditCategory === 'hour_logs') {
      return enrichedAuditLogs.filter((l: any) => {
        const act = (l.action || '').toLowerCase();
        return act.includes('hour_logged') || act.includes('hmr') || act.includes('meter');
      });
    }
    if (auditCategory === 'assignments') {
      return enrichedAuditLogs.filter((l: any) => {
        const act = (l.action || '').toLowerCase();
        return act.includes('assign') || act.includes('operator') || act.includes('supervisor');
      });
    }
    return enrichedAuditLogs.filter((l: any) => {
      const act = (l.action || '').toLowerCase();
      return (
        !act.includes('hour_logged') &&
        !act.includes('hmr') &&
        !act.includes('meter') &&
        !act.includes('assign') &&
        !act.includes('operator') &&
        !act.includes('supervisor')
      );
    });
  }, [enrichedAuditLogs, auditCategory]);

  const groupedAuditLogs = useMemo(() => {
    if (!filteredAuditLogs.length) return [];
    const groups: { dateKey: string; dateLabel: string; logs: any[] }[] = [];
    const map = new Map<string, any[]>();

    for (const log of filteredAuditLogs) {
      const label = formatLogDateHeaderMobile(log.created_at);
      if (!map.has(label)) {
        map.set(label, []);
        groups.push({ dateKey: label, dateLabel: label, logs: map.get(label)! });
      }
      map.get(label)!.push(log);
    }

    return groups;
  }, [filteredAuditLogs]);

  // Log calculation & filtering
  const totalHoursRun = useMemo(() => {
    if (machine.hour_meter !== null && machine.hour_meter !== undefined && Number(machine.hour_meter) > 0) {
      return Number(machine.hour_meter);
    }
    if (!hourLogs || hourLogs.length === 0) return 0;
    return hourLogs.reduce((acc, log) => acc + (Number(log.running_hours) || 0), 0);
  }, [machine.hour_meter, hourLogs]);

  const filteredLogs = useMemo(() => {
    if (!hourLogs) return [];
    let list = [...hourLogs];
    const q = logSearch.toLowerCase().trim();

    if (q) {
      list = list.filter((l) => {
        return (
          l.operator?.full_name?.toLowerCase().includes(q) ||
          l.remarks?.toLowerCase().includes(q) ||
          l.log_date?.includes(q) ||
          String(l.start_meter).includes(q) ||
          String(l.end_meter).includes(q)
        );
      });
    }

    if (logOperatorFilter !== 'all') {
      list = list.filter((l) => l.operator_id === logOperatorFilter || l.operator?.id === logOperatorFilter);
    }

    // Date preset filter
    if (logDatePreset !== 'all') {
      const now = new Date();
      if (logDatePreset === '7d') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        list = list.filter((l) => new Date(l.log_date) >= d7);
      } else if (logDatePreset === '30d') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        list = list.filter((l) => new Date(l.log_date) >= d30);
      } else if (logDatePreset === 'month') {
        const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        list = list.filter((l) => l.log_date?.startsWith(curMonth));
      }
    }

    // Sorting
    list.sort((a, b) => {
      if (logSortBy === 'date_desc') return new Date(b.log_date).getTime() - new Date(a.log_date).getTime();
      if (logSortBy === 'date_asc') return new Date(a.log_date).getTime() - new Date(b.log_date).getTime();
      if (logSortBy === 'hours_desc') return (Number(b.running_hours) || 0) - (Number(a.running_hours) || 0);
      if (logSortBy === 'hours_asc') return (Number(a.running_hours) || 0) - (Number(b.running_hours) || 0);
      return 0;
    });

    return list;
  }, [hourLogs, logSearch, logOperatorFilter, logDatePreset, logSortBy]);

  const totalLogPages = Math.ceil(filteredLogs.length / logPageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logPageSize;
    return filteredLogs.slice(start, start + logPageSize);
  }, [filteredLogs, logPage, logPageSize]);

  // Delete Action
  const handleDeleteMachine = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('machines').delete().eq('id', machine.id);
      if (error) throw error;
      setDeleteDialogVisible(false);
      if (onMachineDeleted) onMachineDeleted();
      onBack();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete machine');
    } finally {
      setIsDeleting(false);
    }
  };

  // Dial / WhatsApp / Maps handlers
  const handleCall = (phoneNum?: string) => {
    if (!phoneNum) return;
    const clean = phoneNum.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`);
  };

  const handleEmail = (emailAddr?: string) => {
    if (!emailAddr) return;
    Linking.openURL(`mailto:${emailAddr}`);
  };

  const handleWhatsApp = (phoneNum?: string) => {
    if (!phoneNum) return;
    const clean = phoneNum.replace(/[^0-9]/g, '');
    const msg = `Hello, regarding machine ${displayTitle} (${machine.machine_id}).`;
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
  };

  const handleOpenMap = () => {
    if (!fullSiteAddress) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(fullSiteAddress)}`,
      android: `geo:0,0?q=${encodeURIComponent(fullSiteAddress)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullSiteAddress)}`,
    });
    if (url) Linking.openURL(url);
  };

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    if (canManage) {
      list.push({
        id: 'edit-info',
        label: 'Edit Machine Info',
        icon: <Wrench size={16} color={theme.colors.ink} />,
        onPress: () => {
          setEditSection('info');
          setEditModalVisible(true);
        },
      });
      list.push({
        id: 'edit-personnel',
        label: 'Manage Shift Personnel',
        icon: <Shield size={16} color={theme.colors.ink} />,
        onPress: () => {
          setAssignPersonnelModalVisible(true);
        },
      });
      list.push({
        id: 'edit-client',
        label: 'Edit Client Assignment',
        icon: <Building2 size={16} color={theme.colors.ink} />,
        onPress: () => {
          setEditSection('client');
          setEditModalVisible(true);
        },
      });
    } else if (isSupervisor) {
      list.push({
        id: 'assign-personnel',
        label: 'Assign Operators',
        icon: <UserCheck size={16} color={theme.colors.ink} />,
        onPress: () => {
          setAssignPersonnelModalVisible(true);
        },
      });
    }

    list.push({
      id: 'share-machine',
      label: 'Share Machine Profile',
      icon: <Share2 size={16} color={theme.colors.ink} />,
      onPress: () => setShareModalVisible(true),
    });

    list.push({
      id: 'refresh-machine',
      label: 'Refresh Machine Details',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => handleRefresh(),
    });

    if (canDelete) {
      list.push({
        id: 'delete-machine',
        label: 'Delete Machine',
        icon: <Trash2 size={16} color="#ef4444" />,
        destructive: true,
        onPress: () => setDeleteDialogVisible(true),
      });
    }

    return list;
  }, [canManage, isSupervisor, canDelete, theme.colors.ink, handleRefresh]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Standardized Mobile Header */}
      <MobileHeader
        title="Machine Details"
        subtitle={machine.machine_id ? `${machine.machine_id} • ${machine.model || 'Equipment'}` : undefined}
        showBack={true}
        onPressBack={onBack}
        actions={headerActions}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* STATIC HEADER & NAVIGATION ZONE */}
        <View style={[styles.stickyHeaderZone, { backgroundColor: theme.colors.canvas }]}>
          {/* HERO BANNER CARD */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Row 1: Left squircle + Title & Subtitle + Right Actions */}
            <View style={styles.heroMainRow}>
              {/* Scissor Lift Logo Icon in Pitch Dark Squircle Container matching Screenshot 3 */}
              <View
                style={[
                  styles.scissorSquircle,
                  {
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                  },
                ]}
              >
                <ScissorLiftLogoIcon size={22} variant="light" color="#38bdf8" />
              </View>

              {/* Title & Subtitle */}
              <View style={styles.heroTitleWrap}>
                <Text style={[styles.heroTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                  {displayTitle}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text variant="caption" style={[styles.specBoxValueMono, { color: theme.colors.mute }]}>
                    {machine.machine_id}
                  </Text>
                  {Boolean(machine.manufacturer) && (
                    <>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>•</Text>
                      <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                        {machine.manufacturer}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {/* Right Action Buttons: Edit & Delete */}
              <View style={styles.heroActionBtns}>
                {canManage ? (
                  <Pressable variant="outline" haptic="tap"
                    onPress={() => setHeroMenuVisible(true)}
                    style={[
                      styles.heroEditBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                    accessibilityLabel="Edit Machine Options"
                  >
                    <Edit2 size={13} color={theme.colors.ink} />
                    <Text style={[styles.heroEditBtnText, { color: theme.colors.ink }]}>Edit</Text>
                    <ChevronDown size={11} color={theme.colors.mute} />
                  </Pressable>
                ) : isSupervisor ? (
                  <Pressable variant="outline" haptic="tap"
                    onPress={() => {
                      setAssignPersonnelModalVisible(true);
                    }}
                    style={[
                      styles.heroEditBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                    accessibilityLabel="Assign Operator"
                  >
                    <UserCheck size={13} color="#0d9488" />
                    <Text style={[styles.heroEditBtnText, { color: theme.colors.ink }]}>Assign</Text>
                  </Pressable>
                ) : null}

                {canDelete && (
                  <Pressable variant="outline" haptic="tap"
                    onPress={() => setDeleteDialogVisible(true)}
                    style={styles.circleDeleteBtn}
                    accessibilityLabel="Delete Machine"
                  >
                    <Trash2 size={14} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Row 2: Status Badges Row (full width, side-by-side, clean padding, formatted) */}
            <View
              style={[
                styles.heroBadgeRow,
                {
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.hairline,
                  paddingTop: 10,
                  marginTop: 10,
                },
              ]}
            >
              {machine.health_status === 'breakdown' && (
                <Badge status="breakdown" dot customLabel="Breakdown" />
              )}
              {machine.health_status === 'under_maintenance' && (
                <Badge status="under_maintenance" dot customLabel="Under Maintenance" />
              )}
              {machine.health_status === 'spare' && (
                <Badge status="spare" dot customLabel="Spare" />
              )}
              {(!machine.health_status || machine.health_status === 'active') && (
                <Badge status="active" dot customLabel="Active" />
              )}

              <Badge
                status={machine.status === 'rented' ? 'in_transit' : machine.status === 'under_maintenance' ? 'under_maintenance' : 'available'}
                customLabel={machine.status === 'rented' ? 'On Rent' : machine.status === 'under_maintenance' ? 'Under Maintenance' : 'Available'}
              />
            </View>
          </View>

          {/* TAB NAVIGATION TOGGLE / NAVBAR */}
          <SegmentedToggle
            items={segmentedTabItems}
            value={activeTab}
            onChange={handleTabChange}
            size="sm"
          />
        </View>

        {/* TAB 1: BASIC INFO, PERSONNEL & CLIENT DETAILS */}
        {activeTab === 'overview' && (
          <View style={styles.tabContentArea}>
            {/* 1. Basic Info Specs Grid Card */}
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.cardHeaderLeft}>
                  <Info size={16} color="#0284c7" />
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                    Basic Info
                  </Text>
                </View>
                {canManage && (
                  <Pressable variant="outline" haptic="tap"
                    onPress={() => {
                      setEditSection('info');
                      setEditModalVisible(true);
                    }}
                    style={[
                      styles.headerActionBtnSm,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                    accessibilityLabel="Edit Basic Info"
                  >
                    <Edit2 size={12} color={theme.colors.ink} />
                    <Text style={[styles.headerActionBtnSmText, { color: theme.colors.ink }]}>Edit</Text>
                  </Pressable>
                )}
              </View>

              <View
                style={[
                  styles.specsGrid,
                  Platform.OS === 'web' && ({
                    display: 'grid',
                    gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                    gap: 10,
                  } as any),
                ]}
              >
                {/* 1. Machine ID */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                      MACHINE ID
                    </Text>
                    <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(machine.machine_id, `Machine ID "${machine.machine_id}"`, setCopiedId)} accessibilityLabel="Copy Machine Code">
                      {copiedId ? (
                        <Check size={11} color={theme.colors.success} strokeWidth={2.5} />
                      ) : (
                        <Copy size={11} color={theme.colors.mute} />
                      )}
                    </Pressable>
                  </View>
                  <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                    {machine.machine_id}
                  </Text>
                </View>

                {/* 2. Model */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>MODEL</Text>
                    {Boolean(machine.model) && (
                      <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(machine.model, `Model "${machine.model}"`, setCopiedModel)} accessibilityLabel="Copy Model Name">
                        {copiedModel ? (
                          <Check size={11} color={theme.colors.success} strokeWidth={2.5} />
                        ) : (
                          <Copy size={11} color={theme.colors.mute} />
                        )}
                      </Pressable>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.model || '—'}
                  </Text>
                </View>

                {/* 3. Serial No */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SERIAL NO</Text>
                    {Boolean(machine.serial_number) && (
                      <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(machine.serial_number, `Serial Number "${machine.serial_number}"`, setCopiedSerial)} accessibilityLabel="Copy Serial Number">
                        {copiedSerial ? (
                          <Check size={11} color={theme.colors.success} strokeWidth={2.5} />
                        ) : (
                          <Copy size={11} color={theme.colors.mute} />
                        )}
                      </Pressable>
                    )}
                  </View>
                  <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                    {machine.serial_number || '—'}
                  </Text>
                </View>

                {/* 4. Year of Mfg */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    YEAR OF MFG (YUM)
                  </Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                    {machine.year_of_mfg || '—'}
                  </Text>
                </View>

                {/* 5. Manufacturer */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    MANUFACTURER
                  </Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.manufacturer || '—'}
                  </Text>
                </View>

                {/* 6. Hour Meter (HMR) */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    HOUR METER (HMR)
                  </Text>
                  <Text style={[styles.specBoxValueHmr, { color: theme.colors.link }]}>
                    {machine.hour_meter ?? 0} hrs
                  </Text>
                </View>

                {/* 7. Supervisors */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SUPERVISORS</Text>
                    {supervisors.length > 0 && (
                      <View style={[styles.tabCountPill, { backgroundColor: '#0284c718' }]}>
                        <Text style={[styles.tabCountText, { color: '#0284c7' }]}>{supervisors.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {supervisors.length > 0 ? supervisors.map((s: any) => s.full_name).join(', ') : '—'}
                  </Text>
                </View>

                {/* 8. Operators */}
                <View
                  style={[
                    styles.specBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: Platform.OS === 'web' ? '100%' : `${(100 - (numCols - 1) * 2.5) / numCols}%`,
                    },
                  ]}
                >
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>OPERATORS</Text>
                    {operators.length > 0 && (
                      <View style={[styles.tabCountPill, { backgroundColor: '#d9770618' }]}>
                        <Text style={[styles.tabCountText, { color: '#d97706' }]}>{operators.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {operators.length > 0 ? operators.map((o: any) => o.full_name).join(', ') : '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. Assigned Shift Personnel (24h Fleet Coverage) */}
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.cardHeaderLeft}>
                  <Users size={16} color="#0284c7" />
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                    Assigned Shift Personnel
                  </Text>
                </View>

                {canAssignOperator && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable variant="outline" haptic="tap"
                      onPress={() => {
                        setAssignPersonnelModalVisible(true);
                      }}
                      style={[
                        styles.headerActionBtnSm,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                      accessibilityLabel="Manage Staff"
                    >
                      <Edit2 size={12} color={theme.colors.ink} />
                      <Text style={[styles.headerActionBtnSmText, { color: theme.colors.ink }]}>
                        {isSupervisor ? 'Assign' : 'Edit'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={[styles.personnelSectionBody, { flexDirection: isMobile ? 'column' : 'row', gap: 12 }]}>
                {/* Supervisors Panel */}
                <View style={[styles.personnelSubBox, { flex: 1, backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={[styles.personnelSubHeader, { borderBottomColor: theme.colors.hairline }]}>
                    <View style={styles.personnelSubHeaderLeft}>
                      <Shield size={14} color="#0d9488" />
                      <Text style={[styles.personnelSubTitle, { color: theme.colors.ink }]}>
                        Supervisors ({supervisors.length})
                      </Text>
                    </View>
                  </View>

                  {supervisors.length === 0 ? (
                    <Text style={[styles.noStaffText, { color: theme.colors.mute }]}>
                      No supervisors assigned to this machine.
                    </Text>
                  ) : (
                    supervisors.map((s: any, idx: number) => (
                      <View
                        key={s.id || idx}
                        style={[
                          styles.personnelRowCard,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.personnelRowLeft}>
                          <View style={styles.personnelNameShiftRow}>
                            <Text style={[styles.staffName, { color: theme.colors.ink }]}>
                              {s.full_name}
                            </Text>
                            <Text style={[styles.staffShiftTag, { color: theme.colors.mute }]}>
                              Shift {idx + 1}
                            </Text>
                          </View>

                          <View style={styles.clockRow}>
                            <Clock size={11} color="#0d9488" />
                            <Text style={[styles.clockTimeText, { color: '#0d9488' }]}>
                              {s.shift_time || '09:30 AM - 06:30 PM'}
                            </Text>
                          </View>
                        </View>

                        {(s.phone || s.email) ? (
                          <View style={[styles.personnelActionGroup, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                            {s.phone ? (
                              <Pressable variant="outline" haptic="tap"
                                onPress={() => handleCall(s.phone)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Phone size={12} color={theme.colors.mute} />
                              </Pressable>
                            ) : null}
                            {s.phone && s.email ? (
                              <View style={[styles.personnelActionDivider, { backgroundColor: theme.colors.hairline }]} />
                            ) : null}
                            {s.email ? (
                              <Pressable variant="outline" haptic="tap"
                                onPress={() => handleEmail(s.email)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Mail size={12} color={theme.colors.mute} />
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>

                {/* Operators Panel */}
                <View style={[styles.personnelSubBox, { flex: 1, backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={[styles.personnelSubHeader, { borderBottomColor: theme.colors.hairline }]}>
                    <View style={styles.personnelSubHeaderLeft}>
                      <Wrench size={14} color="#d97706" />
                      <Text style={[styles.personnelSubTitle, { color: theme.colors.ink }]}>
                        Operators ({operators.length})
                      </Text>
                    </View>
                  </View>

                  {operators.length === 0 ? (
                    <Text style={[styles.noStaffText, { color: theme.colors.mute }]}>
                      No operators assigned. Assign operators to enable 24h shift logging.
                    </Text>
                  ) : (
                    operators.map((o: any, idx: number) => (
                      <View
                        key={o.id || idx}
                        style={[
                          styles.personnelRowCard,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.personnelRowLeft}>
                          <View style={styles.personnelNameShiftRow}>
                            <Text style={[styles.staffName, { color: theme.colors.ink }]}>
                              {o.full_name}
                            </Text>
                            <Text style={[styles.staffShiftTag, { color: '#d97706' }]}>
                              {o.shift_code ? `Shift ${o.shift_code}` : `Shift ${idx + 1}`}
                            </Text>
                          </View>

                          <View style={styles.clockRow}>
                            <Clock size={11} color="#d97706" />
                            <Text style={[styles.clockTimeText, { color: '#d97706' }]}>
                              {o.shift_time || '24h Rotating Shift'}
                            </Text>
                          </View>
                        </View>

                        {(o.phone || o.email) ? (
                          <View style={[styles.personnelActionGroup, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                            {o.phone ? (
                              <Pressable variant="outline" haptic="tap"
                                onPress={() => handleCall(o.phone)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Phone size={12} color={theme.colors.mute} />
                              </Pressable>
                            ) : null}
                            {o.phone && o.email ? (
                              <View style={[styles.personnelActionDivider, { backgroundColor: theme.colors.hairline }]} />
                            ) : null}
                            {o.email ? (
                              <Pressable variant="outline" haptic="tap"
                                onPress={() => handleEmail(o.email)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Mail size={12} color={theme.colors.mute} />
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>

            {/* 3. Assigned Client Details Card */}
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.cardHeaderLeft}>
                  <Building2 size={16} color="#0284c7" />
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                    Client Details
                  </Text>
                  {clientCode ? (
                    <View style={styles.clientCodePill}>
                      <Text style={styles.clientCodePillText}>{clientCode}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {fullSiteAddress ? (
                    <Pressable variant="outline" haptic="tap"
                      onPress={handleOpenMap}
                      style={[
                        styles.headerActionBtnSm,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                      accessibilityLabel="Open Map Location"
                    >
                      <MapPin size={12} color="#0284c7" />
                      <Text style={[styles.headerActionBtnSmText, { color: '#0284c7' }]}>Map</Text>
                    </Pressable>
                  ) : null}
                  {canManage && (
                    <Pressable variant="outline" haptic="tap"
                      onPress={() => {
                        setEditSection('client');
                        setEditModalVisible(true);
                      }}
                      style={[
                        styles.headerActionBtnSm,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                      accessibilityLabel="Edit Client Details"
                    >
                      <Edit2 size={12} color={theme.colors.ink} />
                      <Text style={[styles.headerActionBtnSmText, { color: theme.colors.ink }]}>Edit</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {hasLinkedClient ? (
                <View style={styles.clientDetailsBody}>
                  <View
                    style={[
                      styles.clientGrid,
                      Platform.OS === 'web' && ({
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(1, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
                        gap: 10,
                      } as any),
                    ]}
                  >
                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, width: Platform.OS === 'web' ? '100%' : isMobile ? '100%' : '48%' }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CLIENT NAME</Text>
                      <Text style={[styles.clientNameValue, { color: theme.colors.ink }]}>
                        {clientCompanyName}
                      </Text>
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, width: Platform.OS === 'web' ? '100%' : isMobile ? '100%' : '48%' }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CONTACT PERSON</Text>
                      <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                        {clientContactPerson || '—'}
                      </Text>
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, width: Platform.OS === 'web' ? '100%' : isMobile ? '100%' : '48%' }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CONTACT MOBILE</Text>
                      {clientPhone ? (
                        <Pressable variant="ghost" haptic="tap" hitSlopToMin48 onPress={() => handleCall(clientPhone)}>
                          <Text style={[styles.clickableLinkText, { color: theme.colors.link }]}>
                            {clientPhone}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={[styles.specBoxValue, { color: theme.colors.mute }]}>—</Text>
                      )}
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, width: Platform.OS === 'web' ? '100%' : isMobile ? '100%' : '48%' }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CITY & STATE</Text>
                      <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                        {clientLocation || '—'}
                      </Text>
                    </View>

                    {clientGstin ? (
                      <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, width: Platform.OS === 'web' ? '100%' : isMobile ? '100%' : '48%' }]}>
                        <View style={styles.specBoxHeader}>
                          <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>GSTIN</Text>
                          <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(clientGstin, `GSTIN "${clientGstin}"`, setCopiedGstin)} accessibilityLabel="Copy GSTIN">
                            {copiedGstin ? <Check size={11} color={theme.colors.success} strokeWidth={2.5} /> : <Copy size={11} color={theme.colors.mute} />}
                          </Pressable>
                        </View>
                        <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                          {clientGstin}
                        </Text>
                      </View>
                    ) : null}

                    {clientPan ? (
                      <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, width: Platform.OS === 'web' ? '100%' : isMobile ? '100%' : '48%' }]}>
                        <View style={styles.specBoxHeader}>
                          <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>PAN NUMBER</Text>
                          <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(clientPan, `PAN "${clientPan}"`, setCopiedPan)} accessibilityLabel="Copy PAN">
                            {copiedPan ? <Check size={11} color={theme.colors.success} strokeWidth={2.5} /> : <Copy size={11} color={theme.colors.mute} />}
                          </Pressable>
                        </View>
                        <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                          {clientPan}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Site Location Box */}
                  {fullSiteAddress ? (
                    <View style={[styles.addressBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={styles.specBoxHeader}>
                        <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SITE LOCATION</Text>
                        <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(fullSiteAddress, 'Site Location', setCopiedSiteAddress)} accessibilityLabel="Copy Site Address">
                          {copiedSiteAddress ? <Check size={11} color={theme.colors.success} strokeWidth={2.5} /> : <Copy size={11} color={theme.colors.mute} />}
                        </Pressable>
                      </View>
                      <Text style={[styles.addressText, { color: theme.colors.ink }]}>
                        {fullSiteAddress}
                      </Text>
                    </View>
                  ) : null}

                  {/* Billing Address (if separate) */}
                  {isBillingAddressDifferent && fullBillingAddress ? (
                    <View style={[styles.addressBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={styles.specBoxHeader}>
                        <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>BILLING ADDRESS</Text>
                        <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(fullBillingAddress, 'Billing Address', setCopiedBillingAddress)} accessibilityLabel="Copy Billing Address">
                          {copiedBillingAddress ? <Check size={11} color={theme.colors.success} strokeWidth={2.5} /> : <Copy size={11} color={theme.colors.mute} />}
                        </Pressable>
                      </View>
                      <Text style={[styles.addressText, { color: theme.colors.ink }]}>
                        {fullBillingAddress}
                      </Text>
                    </View>
                  ) : null}

                  {/* Quick Action Touch Buttons (Call, WhatsApp) */}
                  <View style={styles.quickTouchRow}>
                    {clientPhone ? (
                      <Pressable variant="outline" haptic="tap"
                        onPress={() => handleCall(clientPhone)}
                        style={[styles.touchActionBtn, { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}
                        accessibilityLabel="Call"
                      >
                        <Phone size={14} color="#ffffff" />
                        <Text variant="label" style={[styles.touchActionText, { color: '#ffffff' }]}>Call</Text>
                      </Pressable>
                    ) : null}

                    {clientPhone ? (
                      <Pressable variant="outline" haptic="tap"
                        onPress={() => handleWhatsApp(clientPhone)}
                        style={[styles.touchActionBtn, { backgroundColor: '#25D366', borderColor: '#25D366' }]}
                        accessibilityLabel="WhatsApp"
                      >
                        <WhatsAppIcon size={14} color="#ffffff" />
                        <Text variant="label" style={[styles.touchActionText, { color: '#ffffff' }]}>WhatsApp</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.noClientBox}>
                  <Building2 size={28} color={theme.colors.mute} />
                  <Text style={[styles.noClientTitle, { color: theme.colors.ink, marginTop: 4 }]}>No Client Assigned</Text>
                  <Text style={[styles.noClientSub, { color: theme.colors.mute }]}>
                    This machine is currently available in the fleet inventory and has not been leased to a client account.
                  </Text>
                  {canManage && (
                    <Pressable variant="outline" haptic="tap"
                      onPress={() => {
                        setEditSection('client');
                        setEditModalVisible(true);
                      }}
                      style={[styles.headerActionBtnSm, { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink, marginTop: 8, height: 34, paddingHorizontal: 12 }]}
                    >
                      <Text style={[styles.headerActionBtnSmText, { color: theme.colors.canvas }]}>Assign Client</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB 2: RUNNING LOGS (Hours Meter Logs) */}
        {activeTab === 'running_hours' && (
          <View style={styles.tabContentArea}>
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Header with Title and Total Hours Run Badge */}
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                  Hours Meter Logs
                </Text>
                {hasLoadedLogs && hourLogs && hourLogs.length > 0 && (
                  <View style={[styles.totalHoursBadge, { backgroundColor: theme.colors.link + '18', borderColor: theme.colors.link + '35' }]}>
                    <Text style={[styles.totalHoursText, { color: theme.colors.link }]}>
                      +{totalHoursRun} hrs Run
                    </Text>
                  </View>
                )}
              </View>

              {/* Loading State — Smooth Reusable Pulse Skeleton Shell */}
              {isLoadingLogs && <MachineHMRSkeleton />}

              {/* Error State */}
              {!isLoadingLogs && logsError && (
                <View style={[styles.logsErrorBox, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
                  <AlertCircle size={15} color="#ef4444" />
                  <Text style={styles.logsErrorText}>{logsError}</Text>
                  <Pressable variant="ghost" haptic="tap" hitSlopToMin48 onPress={fetchHourLogs} style={styles.retryBtn}>
                    <Text style={[styles.retryBtnText, { color: theme.colors.link }]}>Retry</Text>
                  </Pressable>
                </View>
              )}

              {/* Empty State (No logs ever recorded) */}
              {!isLoadingLogs && !logsError && hasLoadedLogs && (!hourLogs || hourLogs.length === 0) && (
                <View style={styles.emptyLogsWrap}>
                  <Clock size={28} color={theme.colors.mute} />
                  <Text style={[styles.emptyLogsTitle, { color: theme.colors.ink }]}>
                    No Running Meter Logs Logged
                  </Text>
                  <Text style={[styles.emptyLogsSub, { color: theme.colors.mute }]}>
                    Daily hour meter logbook entries recorded by machine operators will appear here.
                  </Text>
                </View>
              )}

              {/* Filter & Data Feed */}
              {!isLoadingLogs && !logsError && hourLogs && hourLogs.length > 0 && (
                <View style={styles.logsBody}>
                  {/* Executive Metric Cards Strip */}
                  <KPIGrid columns={2} style={{ marginBottom: 12 }}>
                    <KPICard
                      label="HOURS RUN"
                      value={`${totalHoursRun} hrs`}
                      variant="success"
                    />
                    <KPICard
                      label="RECORDED SHIFTS"
                      value={hourLogs.length}
                      variant="info"
                    />
                  </KPIGrid>

                  {/* Search Bar & Filter Toggle */}
                  <View style={[styles.logSearchRow, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <Search size={14} color={theme.colors.mute} />
                    <TextInput
                      style={[styles.logSearchInput, { color: theme.colors.ink }]}
                      placeholder="Search logs by operator, date, meter..."
                      placeholderTextColor={theme.colors.mute}
                      value={logSearch}
                      onChangeText={(t) => {
                        setLogSearch(t);
                        setLogPage(1);
                      }}
                    />
                    {logSearch.length > 0 && (
                      <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => setLogSearch('')}>
                        <X size={14} color={theme.colors.mute} />
                      </Pressable>
                    )}

                    <Pressable variant="outline" haptic="tap"
                      onPress={() => setIsFilterSidebarOpen(true)}
                      style={[
                        styles.filterToggleBtn,
                        (activeLogFilterCount > 0 || isFilterSidebarOpen) && {
                          backgroundColor: isDark ? 'rgba(2, 132, 199, 0.22)' : '#e0f2fe',
                          borderColor: '#0284c7',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Open filter sidebar"
                    >
                      <SlidersHorizontal
                        size={14}
                        color={activeLogFilterCount > 0 || isFilterSidebarOpen ? '#0284c7' : theme.colors.mute}
                      />
                    </Pressable>
                  </View>

                  {/* Active Filter / Sort Chips Bar */}
                  {(activeLogFilterCount > 0 || logSearch) && (
                    <View style={[styles.expandableFilters, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      {/* Date Preset Selector Chip */}
                      {logDatePreset !== 'all' && (
                        <Pressable variant="outline" haptic="tap"
                          onPress={() => setIsFilterSidebarOpen(true)}
                          style={[styles.filterTriggerChip, { borderColor: theme.colors.hairline }]}
                          accessibilityRole="button"
                          accessibilityLabel="Modify date filter"
                        >
                          <Text style={[styles.filterChipText, { color: theme.colors.ink }]}>
                            Date: {logDatePreset === '7d' ? '7 Days' : logDatePreset === '30d' ? '30 Days' : 'This Month'}
                          </Text>
                          <ChevronDown size={12} color={theme.colors.mute} />
                        </Pressable>
                      )}

                      {/* Sort Selector Chip */}
                      {logSortBy !== 'date_desc' && (
                        <Pressable variant="outline" haptic="tap"
                          onPress={() => setIsFilterSidebarOpen(true)}
                          style={[styles.filterTriggerChip, { borderColor: theme.colors.hairline }]}
                          accessibilityRole="button"
                          accessibilityLabel="Modify sorting order"
                        >
                          <Text style={[styles.filterChipText, { color: theme.colors.ink }]}>
                            Sort: {logSortBy === 'date_asc' ? 'Oldest' : logSortBy === 'hours_desc' ? 'High Hours' : 'Low Hours'}
                          </Text>
                          <ChevronDown size={12} color={theme.colors.mute} />
                        </Pressable>
                      )}

                      {/* Clear Filters */}
                      <Pressable variant="outline" haptic="tap"
                        onPress={handleResetLogFilters}
                        accessibilityRole="button"
                        accessibilityLabel="Reset all filters"
                      >
                        <Text style={[styles.resetFilterText, { color: theme.colors.error }]}>Reset</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Log Cards List */}
                  {paginatedLogs.length === 0 ? (
                    <View style={styles.emptyLogsWrap}>
                      <Text style={[styles.emptyLogsTitle, { color: theme.colors.ink }]}>
                        No logs match your filter criteria
                      </Text>
                    </View>
                  ) : (
                    paginatedLogs.map((log: any) => (
                      <View
                        key={log.id}
                        style={[
                          styles.logCard,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.logCardTopRow}>
                          <Text style={[styles.logDateText, { color: theme.colors.ink }]}>
                            {formatDate(log.log_date)}
                          </Text>
                          <View style={[styles.logOperatorBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                            <Text style={[styles.logOperatorName, { color: theme.colors.ink }]}>
                              {log.operator?.full_name || 'Operator'}
                            </Text>
                          </View>
                        </View>

                        {/* Meter Box */}
                        <View style={[styles.logMeterBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                          <View>
                            <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>HOUR METER READINGS</Text>
                            <Text style={[styles.logMeterNumbers, { color: theme.colors.ink }]}>
                              {log.start_meter || 0} → {log.end_meter || 0}
                            </Text>
                          </View>
                          <View style={styles.runningHoursBadge}>
                            <Text style={styles.runningHoursBadgeText}>
                              +{log.running_hours || 0} hrs
                            </Text>
                          </View>
                        </View>

                        {/* Operating Hours & Breakdown Details */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: theme.colors.hairline, borderBottomWidth: log.remarks ? 1 : 0, borderBottomColor: theme.colors.hairline }}>
                          <Text variant="mono" style={{ color: theme.colors.ink }}>
                            Worked: <Text>{log.running_hours || 0} hrs</Text>
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text variant="caption" style={{ color: theme.colors.mute }}>Breakdown:</Text>
                            {Boolean(log.is_breakdown || (Number(log.breakdown_hours) > 0)) ? (
                              <Text variant="mono" style={{ color: '#e11d48' }}>
                                {Number(log.breakdown_hours) > 0 ? `${log.breakdown_hours} hrs` : 'Breakdown'}
                              </Text>
                            ) : (
                              <Text variant="mono" style={{ color: '#059669' }}>
                                0
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Remarks */}
                        {log.remarks ? (
                          <Text style={[styles.logRemarksText, { color: theme.colors.mute, marginTop: 2 }]} numberOfLines={2}>
                            &ldquo;{log.remarks}&rdquo;
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}

                  {/* Clean touch-friendly Pagination */}
                  {totalLogPages > 1 && (
                    <View style={{ marginTop: 12, marginBottom: 8 }}>
                      <Pagination
                        page={logPage}
                        totalPages={totalLogPages}
                        totalItems={filteredLogs.length}
                        pageSize={logPageSize}
                        pageSizeOptions={[10, 25, 50]}
                        onPageChange={setLogPage}
                        onPageSizeChange={(newSize) => {
                          setLogPageSize(newSize);
                          setLogPage(1);
                        }}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB 3: AUDIT TRAIL */}
        {activeTab === 'audit_trail' && normalizedRole !== 'operator' && (
          <View style={styles.tabContentArea}>
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Header with Title and Total Records Badge */}
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                  Machine Audit Trail
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {hasLoadedAudit && auditLogs && auditLogs.length > 0 && (
                    <View
                      style={[
                        styles.totalHoursBadge,
                        {
                          backgroundColor: theme.colors.link + '18',
                          borderColor: theme.colors.link + '35',
                        },
                      ]}
                    >
                      <Text style={[styles.totalHoursText, { color: theme.colors.link }]}>
                        {auditLogs.length} Records
                      </Text>
                    </View>
                  )}
                  <Pressable variant="outline" haptic="tap"
                    onPress={fetchAuditLogs}
                    disabled={isLoadingAudit}
                    style={[styles.circleEditBtn, { borderColor: theme.colors.hairline, width: 28, height: 28, borderRadius: 14 }]}
                  >
                    <RefreshCw size={13} color={theme.colors.ink} />
                  </Pressable>
                </View>
              </View>

              {/* Filter Controls (Search box removed) */}
              <View style={[styles.auditControlsCard, { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline }]}>
                {/* Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.auditFilterStrip}>
                  <Pressable variant="outline" haptic="tap"
                    onPress={() => setAuditCategory('all')}
                    style={[
                      styles.auditFilterChip,
                      {
                        backgroundColor: auditCategory === 'all' ? theme.colors.ink : theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.auditFilterChipText,
                        { color: auditCategory === 'all' ? theme.colors.canvas : theme.colors.mute },
                      ]}
                    >
                      All ({auditCategoryCounts.all})
                    </Text>
                  </Pressable>

                  <Pressable variant="outline" haptic="tap"
                    onPress={() => setAuditCategory('hour_logs')}
                    style={[
                      styles.auditFilterChip,
                      {
                        backgroundColor: auditCategory === 'hour_logs' ? '#059669' : theme.colors.canvas,
                        borderColor: auditCategory === 'hour_logs' ? '#059669' : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.auditFilterChipText,
                        { color: auditCategory === 'hour_logs' ? '#ffffff' : theme.colors.mute },
                      ]}
                    >
                      HMR Logs ({auditCategoryCounts.hour_logs})
                    </Text>
                  </Pressable>

                  <Pressable variant="outline" haptic="tap"
                    onPress={() => setAuditCategory('breakdowns')}
                    style={[
                      styles.auditFilterChip,
                      {
                        backgroundColor: auditCategory === 'breakdowns' ? '#e11d48' : theme.colors.canvas,
                        borderColor: auditCategory === 'breakdowns' ? '#e11d48' : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.auditFilterChipText,
                        { color: auditCategory === 'breakdowns' ? '#ffffff' : theme.colors.mute },
                      ]}
                    >
                      Breakdowns ({auditCategoryCounts.breakdowns})
                    </Text>
                  </Pressable>

                  <Pressable variant="outline" haptic="tap"
                    onPress={() => setAuditCategory('assignments')}
                    style={[
                      styles.auditFilterChip,
                      {
                        backgroundColor: auditCategory === 'assignments' ? '#0284c7' : theme.colors.canvas,
                        borderColor: auditCategory === 'assignments' ? '#0284c7' : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.auditFilterChipText,
                        { color: auditCategory === 'assignments' ? '#ffffff' : theme.colors.mute },
                      ]}
                    >
                      Assignments ({auditCategoryCounts.assignments})
                    </Text>
                  </Pressable>

                  <Pressable variant="outline" haptic="tap"
                    onPress={() => setAuditCategory('updates')}
                    style={[
                      styles.auditFilterChip,
                      {
                        backgroundColor: auditCategory === 'updates' ? '#d97706' : theme.colors.canvas,
                        borderColor: auditCategory === 'updates' ? '#d97706' : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.auditFilterChipText,
                        { color: auditCategory === 'updates' ? '#ffffff' : theme.colors.mute },
                      ]}
                    >
                      Updates ({auditCategoryCounts.updates})
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>

              {/* Loading State — Smooth Reusable Pulse Skeleton Shell */}
              {isLoadingAudit && <MachineAuditSkeleton />}

              {/* Error State */}
              {!isLoadingAudit && auditError && (
                <View style={styles.emptyLogsWrap}>
                  <AlertCircle size={28} color="#e11d48" />
                  <Text style={[styles.emptyLogsTitle, { color: theme.colors.ink, marginTop: 6 }]}>
                    Failed to load audit trail
                  </Text>
                  <Text style={[styles.emptyLogsSub, { color: theme.colors.mute }]}>
                    {auditError}
                  </Text>
                  <Pressable variant="outline" haptic="tap"
                    onPress={fetchAuditLogs}
                    style={[styles.pageBtn, { borderColor: theme.colors.hairline, marginTop: 8 }]}
                  >
                    <Text style={[styles.pageBtnText, { color: theme.colors.link }]}>Retry</Text>
                  </Pressable>
                </View>
              )}

              {/* Empty State */}
              {!isLoadingAudit && !auditError && hasLoadedAudit && filteredAuditLogs.length === 0 && (
                <View style={styles.emptyLogsWrap}>
                  <Clock size={32} color={theme.colors.mute} />
                  <Text style={[styles.emptyLogsTitle, { color: theme.colors.ink }]}>
                    {auditCategory !== 'all' ? 'No Matching Records' : 'No Audit History'}
                  </Text>
                  <Text style={[styles.emptyLogsSub, { color: theme.colors.mute }]}>
                    {auditCategory !== 'all'
                      ? 'No audit logs matched your selected category filter.'
                      : 'No audit records have been recorded for this machine.'}
                  </Text>
                </View>
              )}

              {/* Structured Audit Cards List Grouped by Date */}
              {!isLoadingAudit && !auditError && groupedAuditLogs.length > 0 && (
                <View style={{ gap: 12, paddingVertical: spacingNumeric.sm }}>
                  {groupedAuditLogs.map((group) => (
                    <View key={group.dateKey} style={styles.auditDateGroup}>
                      {/* Date Divider */}
                      <View style={styles.auditDateDividerRow}>
                        <View style={[styles.auditDateDividerLine, { backgroundColor: theme.colors.hairline }]} />
                        <View
                          style={[
                            styles.auditDateBadge,
                            { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                          ]}
                        >
                          <Text style={[styles.auditDateBadgeText, { color: theme.colors.ink }]}>
                            {group.dateLabel}
                          </Text>
                        </View>
                        <View style={[styles.auditDateDividerLine, { backgroundColor: theme.colors.hairline }]} />
                      </View>

                      {/* Cards in group */}
                      <View style={styles.auditListWrap}>
                        {group.logs.map((log) => {
                          const isHourLog = (log.action || '').toLowerCase().includes('hour_logged');
                          const isAssignLog =
                            (log.action || '').toLowerCase().includes('operator_assigned') ||
                            (log.action || '').toLowerCase().includes('operators_updated') ||
                            (log.action || '').toLowerCase().includes('reassigned_supervisor') ||
                            (log.action || '').toLowerCase().includes('supervisors_updated') ||
                            (log.action || '').toLowerCase().includes('assign');
                          const isStatusLog =
                            (log.action || '').toLowerCase().includes('operational_status') ||
                            (log.action || '').toLowerCase().includes('status');

                          const actorName = log.actor_name || log.user?.full_name || 'System Operator';
                          const actorRole = log.actor_role || log.user?.role || 'Staff';

                          const hasDeletions = log.deletions && log.deletions.length > 0;
                          const hasDiffs = log.diffs && log.diffs.length > 0;
                          const isPureRemoval = hasDeletions && (!hasDiffs || log.diffs.every((d: any) => d.updated === 'None'));

                          return (
                            <View
                              key={log.id}
                              style={[
                                styles.auditCard,
                                {
                                  backgroundColor: log.isDeletionEvent ? '#e11d4808' : theme.colors.canvas,
                                  borderColor: log.isDeletionEvent ? '#e11d4830' : theme.colors.hairline,
                                },
                              ]}
                            >
                              {/* Header: Action Badge, Actor Name, Actor Role */}
                              <View style={styles.auditCardTopRow}>
                                <View style={styles.auditCardActorRow}>
                                  <View
                                    style={[
                                      styles.runningHoursBadge,
                                      {
                                        backgroundColor: isHourLog
                                          ? '#05966918'
                                          : isPureRemoval
                                          ? '#e11d4818'
                                          : isAssignLog
                                          ? '#0284c718'
                                          : isStatusLog
                                          ? '#d9770618'
                                          : theme.colors.hairline,
                                        borderColor: isHourLog
                                          ? '#05966935'
                                          : isPureRemoval
                                          ? '#e11d4835'
                                          : isAssignLog
                                          ? '#0284c735'
                                          : isStatusLog
                                          ? '#d9770635'
                                          : theme.colors.hairline,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.runningHoursBadgeText,
                                        {
                                          color: isHourLog
                                            ? '#059669'
                                            : isPureRemoval
                                            ? '#e11d48'
                                            : isAssignLog
                                            ? '#0284c7'
                                            : isStatusLog
                                            ? '#d97706'
                                            : theme.colors.ink,
                                        },
                                      ]}
                                    >
                                      {isHourLog
                                        ? 'Hour Meter'
                                        : isPureRemoval
                                        ? 'Removed'
                                        : isAssignLog
                                        ? 'Assignment'
                                        : isStatusLog
                                        ? 'Status'
                                        : 'Update'}
                                    </Text>
                                  </View>

                                  <Text style={[styles.auditCardActorName, { color: theme.colors.ink }]} numberOfLines={1}>
                                    {actorName}
                                  </Text>

                                  <Text
                                    style={[
                                      styles.auditCardActorRole,
                                      {
                                        color: theme.colors.mute,
                                        borderColor: theme.colors.hairline,
                                        backgroundColor: theme.colors.canvasElevated,
                                      },
                                    ]}
                                  >
                                    {actorRole.replace(/_/g, ' ')}
                                  </Text>
                                </View>
                              </View>

                              {/* ── DELETIONS (If anything was deleted/removed) ── */}
                              {hasDeletions && (
                                <View style={[styles.auditDeletionBox, { backgroundColor: '#e11d480e', borderColor: '#e11d4825' }]}>
                                  <View style={styles.auditDeletionHeader}>
                                    <Trash2 size={12} color="#e11d48" />
                                    <Text style={styles.auditDeletionTitle}>Deleted / Removed Details</Text>
                                  </View>
                                  <View style={{ gap: 4 }}>
                                    {log.deletions.map((del: any, dIdx: number) => (
                                      <View key={dIdx} style={[styles.auditDeletionItem, { backgroundColor: theme.colors.canvasElevated, borderColor: '#e11d4820' }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <Text variant="caption" style={{ color: '#e11d48', textTransform: 'uppercase' }}>
                                            {del.label}:
                                          </Text>
                                          <Text variant="caption" style={{ color: theme.colors.ink, textDecorationLine: 'line-through' }}>
                                            {del.deletedValue}
                                          </Text>
                                        </View>
                                        {del.reason ? (
                                          <Text variant="caption" style={{ color: theme.colors.mute }}>
                                            {del.reason}
                                          </Text>
                                        ) : null}
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}

                              {/* ── UPDATES (Previous vs Updated Details - Only if not pure removal) ── */}
                              {hasDiffs && (
                                <View style={[styles.auditDiffBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                                  <View style={styles.auditDiffHeader}>
                                    <ArrowRight size={11} color={theme.colors.link} />
                                    <Text style={[styles.auditDiffTitle, { color: theme.colors.mute }]}>Previous vs Updated Details</Text>
                                  </View>
                                  <View style={{ gap: 4 }}>
                                    {log.diffs.map((diff: any, dfIdx: number) => (
                                      <View key={dfIdx} style={[styles.auditDiffRow, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                                        <Text style={[styles.auditDiffLabel, { color: theme.colors.ink }]}>{diff.label}:</Text>
                                        <View style={styles.auditDiffValuesRow}>
                                          <Text style={[styles.auditDiffPrevText, { color: theme.colors.mute }]}>
                                            Prev: {diff.previous}
                                          </Text>
                                          <ArrowRight size={10} color="#059669" />
                                          <Text style={styles.auditDiffUpdatedText}>
                                            Updated: {diff.updated}
                                          </Text>
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}

                              {/* Meaningful Operational Content: Single Layout for Hour Log */}
                              {isHourLog && log.metadata && (
                                <View style={{ gap: 6 }}>
                                  {/* Single unified metrics strip (Worked : 4 hrs, Meter, Shift, Breakdown: 0 in green / time in red) */}
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      flexWrap: 'wrap',
                                      alignItems: 'center',
                                      padding: 8,
                                      borderRadius: radiusNumeric.sm,
                                      borderWidth: 1,
                                      borderColor: theme.colors.hairline,
                                      backgroundColor: theme.colors.canvas,
                                      gap: 8 }}
                                  >
                                    {/* 1. Worked */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Text variant="caption" style={{ color: theme.colors.mute }}>Worked :</Text>
                                      <Text variant="mono" style={{ color: theme.colors.ink }}>
                                        {Number(log.metadata.runningHours || log.metadata.running_hours || 0).toFixed(1).replace(/\.0$/, '')} hrs
                                      </Text>
                                    </View>

                                    <Text variant="caption" style={{ color: theme.colors.hairline }}>•</Text>

                                    {/* 2. Meter Range */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Text variant="caption" style={{ color: theme.colors.mute }}>Meter:</Text>
                                      <Text variant="mono" style={{ color: theme.colors.ink }}>
                                        {log.metadata.startMeter ?? log.metadata.start_meter ?? '—'} →{' '}
                                        <Text style={{ color: '#059669' }}>
                                          {log.metadata.endMeter ?? log.metadata.end_meter ?? '—'}
                                        </Text>
                                      </Text>
                                    </View>

                                    <Text variant="caption" style={{ color: theme.colors.hairline }}>•</Text>

                                    {/* 3. Shift Time */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
                                      <Text variant="caption" style={{ color: theme.colors.mute }}>Shift:</Text>
                                      <Text variant="caption" style={{ color: theme.colors.ink }} numberOfLines={1}>
                                        {formatShiftTimingWithDateMobile(log.metadata)}
                                      </Text>
                                    </View>

                                    <Text variant="caption" style={{ color: theme.colors.hairline }}>•</Text>

                                    {/* 4. Breakdown */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Text variant="caption" style={{ color: theme.colors.mute }}>Breakdown:</Text>
                                      {log.metadata.isBreakdown ? (
                                        <Text variant="mono" style={{ color: '#e11d48' }}>
                                          {log.metadata.breakdownDuration || (log.metadata.breakdownHours ? `${log.metadata.breakdownHours}h` : 'Breakdown')}
                                        </Text>
                                      ) : (
                                        <Text variant="mono" style={{ color: '#059669' }}>
                                          0
                                        </Text>
                                      )}
                                    </View>
                                  </View>

                                  {/* Breakdown reason single note */}
                                  {log.metadata.isBreakdown && log.metadata.breakdownReason && (
                                    <View
                                      style={[
                                        styles.auditBreakdownBanner,
                                        { backgroundColor: '#e11d4812', borderColor: '#e11d4835' },
                                      ]}
                                    >
                                      <AlertCircle size={12} color="#e11d48" />
                                      <Text style={[styles.auditBreakdownText, { color: '#e11d48' }]}>
                                        Reason: {log.metadata.breakdownReason}
                                      </Text>
                                    </View>
                                  )}

                                  {/* Location */}
                                  {log.metadata.location && (
                                    <View style={styles.auditLocationRow}>
                                      <MapPin size={11} color={theme.colors.link} />
                                      <Text
                                        style={[styles.auditLocationText, { color: theme.colors.mute }]}
                                        numberOfLines={1}
                                      >
                                        {log.metadata.location}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              {/* Target Machine & Timestamps Footer on all cards */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.hairline + '50' }}>
                                <Text variant="caption" style={{ color: theme.colors.mute }}>
                                  Target: {machine.model || 'Machine'}
                                  {machine.serial_number ? ` • ${machine.serial_number}` : ''}
                                  {machine.machine_id ? ` (${machine.machine_id})` : ''}
                                </Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Clock size={10} color={theme.colors.mute} />
                                  <Text style={[styles.auditCardTimeText, { color: theme.colors.mute }]}>
                                    {formatTimeWithSecondsMobile(log.created_at)}
                                  </Text>
                                </View>
                              </View>

                              {/* Mobile View Details Trigger Button (Min 44px hit target) */}
                              <Pressable variant="outline" haptic="tap"
                                onPress={() => setSelectedMobileAuditLog(log)}
                                style={[
                                  styles.viewDetailsBtnMobile,
                                  {
                                    backgroundColor: theme.colors.link,
                                    borderColor: 'transparent',
                                  },
                                ]}
                              >
                                <Text style={[styles.viewDetailsBtnTextMobile, { color: '#FFFFFF' }]}>
                                  View Details
                                </Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Complete Audit Log Details Modal (Mobile Bottom-Sheet / Dialog) */}
      <AppModal
        visible={Boolean(selectedMobileAuditLog)}
        onClose={() => setSelectedMobileAuditLog(null)}
        variant="bottom"
      >
        <View style={[styles.auditModalCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            {/* Modal Header */}
            <View style={[styles.auditModalHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={[
                      styles.runningHoursBadge,
                      {
                        backgroundColor: selectedMobileAuditLog?.isBreakdown
                          ? '#e11d4818'
                          : (selectedMobileAuditLog?.action || '').toLowerCase().includes('hour_logged')
                          ? '#05966918'
                          : theme.colors.hairline,
                        borderColor: selectedMobileAuditLog?.isBreakdown
                          ? '#e11d4835'
                          : (selectedMobileAuditLog?.action || '').toLowerCase().includes('hour_logged')
                          ? '#05966935'
                          : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.runningHoursBadgeText,
                        {
                          color: selectedMobileAuditLog?.isBreakdown
                            ? '#e11d48'
                            : (selectedMobileAuditLog?.action || '').toLowerCase().includes('hour_logged')
                            ? '#059669'
                            : theme.colors.ink,
                        },
                      ]}
                    >
                      {selectedMobileAuditLog?.isBreakdown
                        ? 'Breakdown'
                        : (selectedMobileAuditLog?.action || '').toLowerCase().includes('hour_logged')
                        ? 'Hour Meter'
                        : 'Audit Record'}
                    </Text>
                  </View>
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                    Audit Details
                  </Text>
                </View>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  {selectedMobileAuditLog ? formatFullDateTimeMobile(selectedMobileAuditLog.created_at) : ''}
                </Text>
              </View>
              <Pressable variant="outline" haptic="tap"
                onPress={() => setSelectedMobileAuditLog(null)}
                style={[styles.circleEditBtn, { borderColor: theme.colors.hairline, width: 28, height: 28, borderRadius: 14 }]}
              >
                <X size={14} color={theme.colors.ink} />
              </Pressable>
            </View>

            {/* Scrollable Audit Details Body */}
            {selectedMobileAuditLog && (
              <ScrollView style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ gap: 12, paddingBottom: 24 }}>
                  {/* Level 1: Actor & Authorization */}
                  <View style={[styles.auditModalSection, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <Text style={[styles.auditModalSectionTitle, { color: theme.colors.mute }]}>
                      ACTOR & AUTHORIZATION
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: theme.colors.ink }}>
                        {selectedMobileAuditLog.actor_name || selectedMobileAuditLog.user?.full_name || 'System Operator'}
                      </Text>
                      <Text variant="caption" style={{ color: theme.colors.mute, textTransform: 'capitalize' }}>
                        {(selectedMobileAuditLog.actor_role || selectedMobileAuditLog.user?.role || 'Staff').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  {/* Level 2: Target Machine Info */}
                  <View style={[styles.auditModalSection, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <Text style={[styles.auditModalSectionTitle, { color: theme.colors.mute }]}>
                      TARGET MACHINE CONTEXT
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <View>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>Model</Text>
                        <Text variant="caption" style={{ color: theme.colors.ink }}>
                          {selectedMobileAuditLog.metadata?.model || machine.model || '50B-9'}
                        </Text>
                      </View>
                      <View>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>Machine ID</Text>
                        <Text variant="caption" style={{ color: theme.colors.link }}>
                          {selectedMobileAuditLog.metadata?.machineCode || machine.machine_id || '—'}
                        </Text>
                      </View>
                      <View>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>Serial</Text>
                        <Text variant="mono" style={{ color: theme.colors.ink }}>
                          {selectedMobileAuditLog.metadata?.serial_number || machine.serial_number || '—'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Level 3: Breakdown or Operational Shift & Meter */}
                  {selectedMobileAuditLog.isBreakdown && (
                    <View style={[styles.auditModalSection, { backgroundColor: '#e11d4812', borderColor: '#e11d4835' }]}>
                      <Text style={[styles.auditModalSectionTitle, { color: '#e11d48' }]}>
                        BREAKDOWN INFORMATION
                      </Text>
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>Duration:</Text>
                          <Text variant="caption" style={{ color: '#e11d48' }}>
                            {selectedMobileAuditLog.metadata?.breakdownDuration || (selectedMobileAuditLog.metadata?.breakdownHours ? `${selectedMobileAuditLog.metadata.breakdownHours}h` : 'Breakdown')}
                          </Text>
                        </View>
                        {selectedMobileAuditLog.metadata?.breakdownReason && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text variant="caption" style={{ color: theme.colors.mute }}>Reason:</Text>
                            <Text variant="caption" style={{ color: theme.colors.ink }}>
                              {selectedMobileAuditLog.metadata.breakdownReason}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {(selectedMobileAuditLog.action || '').toLowerCase().includes('hour_logged') && selectedMobileAuditLog.metadata && (
                    <View style={[styles.auditModalSection, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.auditModalSectionTitle, { color: theme.colors.mute }]}>
                        OPERATIONAL METRICS
                      </Text>
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>Worked Hours:</Text>
                          <Text variant="caption" style={{ color: theme.colors.ink }}>
                            {Number(selectedMobileAuditLog.metadata.runningHours || selectedMobileAuditLog.metadata.running_hours || 0).toFixed(1)} hrs
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>Meter Range:</Text>
                          <Text variant="mono" style={{ color: theme.colors.ink }}>
                            {selectedMobileAuditLog.metadata.startMeter ?? selectedMobileAuditLog.metadata.start_meter ?? '—'} →{' '}
                            <Text style={{ color: '#059669' }}>
                              {selectedMobileAuditLog.metadata.endMeter ?? selectedMobileAuditLog.metadata.end_meter ?? '—'}
                            </Text>
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>Breakdown Condition:</Text>
                          <Text variant="caption" style={{ color: selectedMobileAuditLog.isBreakdown ? '#e11d48' : '#059669' }}>
                            {selectedMobileAuditLog.isBreakdown ? selectedMobileAuditLog.metadata?.breakdownDuration || 'Active' : '0 (Normal)'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>Shift Timing:</Text>
                          <Text variant="caption" style={{ color: theme.colors.ink }}>
                            {formatShiftTimingWithDateMobile(selectedMobileAuditLog.metadata)}
                          </Text>
                        </View>
                        {selectedMobileAuditLog.metadata.location && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text variant="caption" style={{ color: theme.colors.mute }}>Location:</Text>
                            <Text variant="caption" style={{ color: theme.colors.ink, maxWidth: '65%' }} numberOfLines={1}>
                              {selectedMobileAuditLog.metadata.location}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Level 4: Diffs & Deletions */}
                  {selectedMobileAuditLog.diffs && selectedMobileAuditLog.diffs.length > 0 && (
                    <View style={[styles.auditModalSection, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.auditModalSectionTitle, { color: theme.colors.mute }]}>
                        CHANGED FIELDS COMPARISON
                      </Text>
                      <View style={{ gap: 6 }}>
                        {selectedMobileAuditLog.diffs.map((diff: any, dIdx: number) => (
                          <View key={dIdx} style={{ gap: 2 }}>
                            <Text variant="caption" style={{ color: theme.colors.ink }}>
                              {diff.label}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>
                                {diff.previous}
                              </Text>
                              <ArrowRight size={10} color="#059669" />
                              <Text variant="caption" style={{ color: '#059669' }}>
                                {diff.updated}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {selectedMobileAuditLog.deletions && selectedMobileAuditLog.deletions.length > 0 && (
                    <View style={[styles.auditModalSection, { backgroundColor: '#e11d4810', borderColor: '#e11d4825' }]}>
                      <Text style={[styles.auditModalSectionTitle, { color: '#e11d48' }]}>
                        DELETED / REMOVED DETAILS
                      </Text>
                      <View style={{ gap: 6 }}>
                        {selectedMobileAuditLog.deletions.map((del: any, dIdx: number) => (
                          <View key={dIdx} style={{ gap: 2 }}>
                            <Text variant="caption" style={{ color: '#e11d48' }}>
                              {del.label}
                            </Text>
                            <Text variant="caption" style={{ color: theme.colors.ink, textDecorationLine: 'line-through' }}>
                              {del.deletedValue}
                            </Text>
                            {del.reason ? (
                              <Text variant="caption" style={{ color: theme.colors.mute }}>
                                {del.reason}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Level 5: Audit ID & System Info */}
                  <View style={[styles.auditModalSection, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <Text style={[styles.auditModalSectionTitle, { color: theme.colors.mute }]}>
                      AUDIT METADATA
                    </Text>
                    <View style={{ gap: 4 }}>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
                        Action: <Text style={{ color: theme.colors.ink }}>{selectedMobileAuditLog.action}</Text>
                      </Text>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
                        Log ID: <Text variant="mono" style={{ color: theme.colors.ink }}>{selectedMobileAuditLog.id}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Modal Footer Button */}
            <View style={{ paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.hairline }}>
              <Pressable variant="outline" haptic="tap"
                onPress={() => setSelectedMobileAuditLog(null)}
                style={[styles.pageBtn, { borderColor: theme.colors.hairline, width: '100%', minHeight: 44 }]}
              >
                <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
      </AppModal>

      {/* Edit Machine Modal */}
      <MachineModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        machineToEdit={machine}
        onSuccess={(savedMachine?: any) => {
          if (savedMachine) {
            setMachine((prev: any) => ({ ...prev, ...savedMachine }));
          }
          if (onMachineUpdated) onMachineUpdated(savedMachine);
        }}
        userRole={userRole}
        initialSection={editSection}
      />

      {/* Delete Machine Dialog */}
      <DeleteMachineDialog
        visible={deleteDialogVisible}
        onClose={() => setDeleteDialogVisible(false)}
        onConfirm={handleDeleteMachine}
        machineId={machine.machine_id}
        model={machine.model}
        isLoading={isDeleting}
      />

      {/* Reusable FilterSidebar for Running Logs */}
      <FilterSidebar
        isOpen={isFilterSidebarOpen}
        onClose={() => setIsFilterSidebarOpen(false)}
        title="Filters & Sorting"
        badgeCount={activeLogFilterCount}
        onReset={handleResetLogFilters}
        onApply={() => setIsFilterSidebarOpen(false)}
        applyLabel={`Show ${filteredLogs.length} Log${filteredLogs.length === 1 ? '' : 's'}`}
        testID="machine-detail-logs-filter-sidebar"
      >
        <FilterCategoryCard
          title="Date Range"
          isFiltered={logDatePreset !== 'all'}
          testID="category-date-range"
        >
          <DropdownFilterSelector
            label="Date Range"
            selectedId={logDatePreset}
            options={[
              { id: 'all', label: 'All Dates' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' },
            ]}
            onSelect={(val) => {
              setLogDatePreset(val as any);
              setLogPage(1);
            }}
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        <FilterCategoryCard
          title="Sort By"
          isFiltered={logSortBy !== 'date_desc'}
          badgeLabel="Custom"
          testID="category-sorting-order"
        >
          <DropdownFilterSelector
            label="Sort By"
            selectedId={logSortBy}
            options={[
              { id: 'date_desc', label: 'Date: Newest First' },
              { id: 'date_asc', label: 'Date: Oldest First' },
              { id: 'hours_desc', label: 'Hours: High to Low' },
              { id: 'hours_asc', label: 'Hours: Low to High' },
            ]}
            onSelect={(val) => {
              setLogSortBy(val as any);
              setLogPage(1);
            }}
            minMenuWidth={280}
          />
        </FilterCategoryCard>
      </FilterSidebar>

      {/* Hero Edit Options Modal Popup */}
      <AppModal
        visible={heroMenuVisible}
        onClose={() => setHeroMenuVisible(false)}
        variant="bottom"
      >
        <View
          style={[
            styles.heroMenuPopup,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.hairline }}>
              <Text style={[styles.heroMenuHeaderTitle, { color: theme.colors.mute }]}>
                EDIT MACHINE OPTIONS
              </Text>
              <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => setHeroMenuVisible(false)} accessibilityLabel="Close menu">
                <X size={15} color={theme.colors.mute} />
              </Pressable>
            </View>

            <Pressable variant="outline" haptic="tap"
              style={styles.heroMenuItem}
              onPress={() => {
                setHeroMenuVisible(false);
                setEditSection('info');
                setEditModalVisible(true);
              }}
            >
              <View style={[styles.heroMenuIconBox, { backgroundColor: '#f59e0b18' }]}>
                <Wrench size={16} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroMenuItemTitle, { color: theme.colors.ink }]}>
                  Edit Machine Info
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Specs, HMR & Health Status
                </Text>
              </View>
            </Pressable>

            <Pressable variant="outline" haptic="tap"
              style={styles.heroMenuItem}
              onPress={() => {
                setHeroMenuVisible(false);
                setAssignPersonnelModalVisible(true);
              }}
            >
              <View style={[styles.heroMenuIconBox, { backgroundColor: '#0d948818' }]}>
                <Shield size={16} color="#0d9488" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroMenuItemTitle, { color: theme.colors.ink }]}>
                  Edit Personnel
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Supervisors & Operators
                </Text>
              </View>
            </Pressable>

            <Pressable variant="outline" haptic="tap"
              style={styles.heroMenuItem}
              onPress={() => {
                setHeroMenuVisible(false);
                setEditSection('client');
                setEditModalVisible(true);
              }}
            >
              <View style={[styles.heroMenuIconBox, { backgroundColor: '#0284c718' }]}>
                <Building2 size={16} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroMenuItemTitle, { color: theme.colors.ink }]}>
                  Edit Client Assignment
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Client & Rental Fleet Status
                </Text>
              </View>
            </Pressable>
          </View>
      </AppModal>

      {/* Shared Link Preview Modal */}
      <SharedLinkPreviewCard
        asModal={true}
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        url={`${getWebAppUrl()}/machines?id=${machine.id}`}
        title={`${machine.machine_id} — ${machine.model || 'Equipment'}`}
        description={`Serial No: ${machine.serial_number || 'N/A'} • Status: ${machine.health_status || 'Active'} • Operational Fleet Asset`}
      />

      {/* Assign Personnel Modal */}
      <MobileAssignPersonnelModal
        visible={assignPersonnelModalVisible}
        onClose={() => setAssignPersonnelModalVisible(false)}
        initialMachineId={machine.id}
        userRole={userRole || undefined}
        onSuccess={() => {
          handleRefresh();
          if (onMachineUpdated) onMachineUpdated(machine);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 40,
  },
  stickyHeaderZone: {
    gap: spacingNumeric.sm,
    paddingTop: 2,
    paddingBottom: spacingNumeric.xs,
  },
  heroCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  scissorSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  heroActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
  },
  heroEditBtnText: {
  },
  headerActionBtnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
  },
  headerActionBtnSmText: {
  },
  heroMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  heroMenuPopup: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
      },
    }),
  },
  heroMenuHeaderTitle: {
    textTransform: 'uppercase',
  },
  heroMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radiusNumeric.md,
  },
  heroMenuIconBox: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMenuItemTitle: {
  },
  circleEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarWrap: {
    flexDirection: 'row',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 3,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radiusNumeric.lg,
  },
  tabPillActive: {
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  tabPillText: {
  },
  tabCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountText: {
  },
  tabContentArea: {
    gap: spacingNumeric.md,
  },
  contentCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: spacingNumeric.xs,
  },
  cardHeaderTitle: {
  },
  clientCodePill: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e935',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radiusNumeric.pill,
  },
  clientCodePillText: {
    color: '#0ea5e9',
  },
  manageStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageStaffText: {
  },
  specsGrid: {
    padding: spacingNumeric.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  specBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 10,
    minHeight: 64,
    justifyContent: 'space-between',
  },
  specBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  specBoxLabel: {
    textTransform: 'uppercase',
  },
  specCountBadge: {
    color: '#10b981',
  },
  specBoxValue: {
  },
  specBoxValueMono: {
  },
  specBoxValueHmr: {
  },
  specBoxValueRental: {
  },
  personnelSectionBody: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  personnelSubBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: spacingNumeric.xs,
  },
  personnelSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  personnelSubHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personnelSubTitle: {
  },
  oversightBadge: {
    backgroundColor: '#10b98115',
    borderColor: '#10b98135',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  oversightBadgeText: {
    color: '#10b981',
  },
  noStaffText: {
    paddingVertical: 8,
    textAlign: 'center',
  },
  personnelRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  personnelRowLeft: {
    flex: 1,
    gap: 2,
  },
  personnelNameShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
  },
  staffShiftTag: {
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  clockTimeText: {
    color: '#10b981',
  },
  personnelActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personnelActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  personnelActionGroupBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personnelActionDivider: {
    width: 1,
    height: 12,
    marginHorizontal: 1,
  },
  staffContactBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientDetailsBody: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  clientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  clientFieldBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    minHeight: 60,
    justifyContent: 'space-between',
  },
  clientNameValue: {
  },
  clickableLinkText: {
    textDecorationLine: 'underline',
  },
  addressBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 2,
  },
  addressText: {
  },
  quickTouchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    marginTop: 4,
  },
  touchActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    minHeight: 44,
  },
  touchActionText: {
  },
  noClientBox: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 6,
  },
  noClientTitle: {
  },
  noClientSub: {
    textAlign: 'center',
  },
  totalHoursBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  totalHoursText: {
  },
  loadingLogsWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 8,
  },
  loadingLogsText: {
  },
  logsErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacingNumeric.md,
    margin: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  logsErrorText: {
    color: '#ef4444',
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryBtnText: {
  },
  emptyLogsWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyLogsTitle: {
    textAlign: 'center',
  },
  emptyLogsSub: {
    textAlign: 'center',
  },
  logsBody: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  logSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    height: 40,
    gap: spacingNumeric.xs,
  },
  logSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  filterToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  expandableFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    flexWrap: 'wrap',
  },
  filterTriggerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
  },
  filterChipText: {
  },
  resetFilterText: {
    marginLeft: 4,
  },
  logCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 6,
  },
  logCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logDateText: {
  },
  logOperatorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
  },
  logOperatorName: {
  },
  logMeterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  logMeterNumbers: {
    marginTop: 1,
  },
  runningHoursBadge: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e935',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  runningHoursBadgeText: {
    color: '#0ea5e9',
  },
  logRemarksText: {
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  pageBtnText: {
  },
  pageIndicatorText: {
  },
  auditControlsCard: {
    padding: spacingNumeric.sm,
    gap: spacingNumeric.sm,
  },
  auditSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
  },
  auditSearchInput: {
    flex: 1,
    paddingVertical: 0,
  },
  auditFilterStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  auditFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  auditFilterChipText: {
  },
  auditListWrap: {
    padding: spacingNumeric.sm,
    gap: spacingNumeric.sm,
  },
  auditCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 8,
  },
  auditCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  auditCardActorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  auditCardActorName: {
  },
  auditCardActorRole: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    textTransform: 'capitalize',
  },
  auditCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  auditCardTimeText: {
  },
  auditMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  auditMiniCell: {
    flex: 1,
    minWidth: '45%',
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 2,
  },
  auditMiniLabel: {
    textTransform: 'uppercase',
  },
  auditMiniValue: {
  },
  auditBreakdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  auditBreakdownText: {
    flex: 1,
  },
  auditLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  auditLocationText: {
    flex: 1,
  },
  auditAssignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  auditAssignText: {
  },
  auditGenericText: {
  },
  auditTechToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    alignSelf: 'flex-start',
  },
  auditTechToggleText: {
  },
  auditJsonBox: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  auditJsonText: {
  },
  auditDeletionBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 4,
  },
  auditDeletionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditDeletionTitle: {
    color: '#e11d48',
  },
  auditDeletionItem: {
    padding: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 2,
  },
  auditDiffBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 4,
  },
  auditDiffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditDiffTitle: {
    textTransform: 'uppercase',
  },
  auditDiffRow: {
    padding: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 4,
  },
  auditDiffLabel: {
  },
  auditDiffValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  auditDiffPrevText: {
    textDecorationLine: 'line-through',
  },
  auditDiffUpdatedText: {
    color: '#059669',
  },
  auditDateGroup: {
    gap: 4,
    marginBottom: 4,
  },
  auditDateDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacingNumeric.sm,
    marginVertical: 4,
  },
  auditDateDividerLine: {
    flex: 1,
    height: 1,
  },
  auditDateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  auditDateBadgeText: {
  },
  auditCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  viewDetailsBtnMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    minHeight: 44,
    marginTop: 6,
  },
  viewDetailsBtnTextMobile: {
  },
  auditModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  auditModalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  auditModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  auditModalSection: {
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 4,
  },
  auditModalSectionTitle: {
  },
});
