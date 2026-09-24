import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { Badge, useTheme, SharedLinkPreviewCard, AppRefreshControl } from '../ui';
import { ScissorLiftLogoIcon } from '../branding/ReachInternationalLogo';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
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
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  User,
  UserCheck,
  RefreshCw,
  ArrowRight,
  ArrowRightLeft,
  FileText,
} from 'lucide-react-native';
import { MachineModal } from './MachineModal';
import { DeleteMachineDialog } from './DeleteMachineDialog';
import { CustomFilterSelectorModal } from './CustomFilterSelectorModal';

export interface MachineDetailViewProps {
  machine: any;
  onBack: () => void;
  onMachineUpdated?: () => void;
  onMachineDeleted?: () => void;
  userRole?: string | null;
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
  machine,
  onBack,
  onMachineUpdated,
  onMachineDeleted,
  userRole,
}) => {
  const { theme, isDark } = useTheme();

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
      .select('*')
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
  const [activeTab, setActiveTab] = useState<'overview' | 'running_hours' | 'audit_trail'>('overview');

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
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Logs Filter / Sort State
  const [logSearch, setLogSearch] = useState('');
  const [logDatePreset, setLogDatePreset] = useState<'all' | '7d' | '30d' | 'month'>('all');
  const [logOperatorFilter, setLogOperatorFilter] = useState('all');
  const [logSortBy, setLogSortBy] = useState<'date_desc' | 'date_asc' | 'hours_desc' | 'hours_asc'>('date_desc');
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const logPageSize = 10;

  // Modals for filter selectors in logs tab
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);

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
  const supervisors = Array.isArray(machine.supervisors)
    ? machine.supervisors.filter((s: any) => Boolean(s?.full_name))
    : Array.isArray(machine.supervisor_ids)
    ? []
    : machine.current_supervisor?.full_name
    ? [machine.current_supervisor]
    : [];

  const operators = Array.isArray(machine.operators)
    ? machine.operators.filter((o: any) => Boolean(o?.full_name))
    : Array.isArray(machine.operator_ids)
    ? []
    : machine.current_operator?.full_name
    ? [machine.current_operator]
    : [];

  // Copy handlers
  const handleCopy = (setter: (v: boolean) => void) => {
    setter(true);
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
        .order('log_date', { ascending: false });

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
    if (!hourLogs) return 0;
    return hourLogs.reduce((acc, log) => acc + (Number(log.running_hours) || 0), 0);
  }, [hourLogs]);

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
  }, [filteredLogs, logPage]);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Back Navigation Bar (Screenshot 2 Match) */}
      <View style={[styles.navBar, { borderBottomColor: theme.colors.hairline }]}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <ChevronLeft size={16} color={theme.colors.mute} />
          <Text style={[styles.backBtnText, { color: theme.colors.mute }]}>
            Back to Machines
          </Text>
        </TouchableOpacity>
      </View>

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
          {/* HERO BANNER CARD (Screenshot 2 Match) */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
          <View style={styles.heroMainRow}>
            {/* Scissor Lift Logo Icon in Theme-Adaptive Squircle */}
            <View
              style={[
                styles.scissorSquircle,
                {
                  backgroundColor: isDark ? '#18181b' : '#f1f5f9',
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <ScissorLiftLogoIcon size={24} />
            </View>

            {/* Title & Status Badges */}
            <View style={styles.heroTitleWrap}>
              <Text style={[styles.heroTitle, { color: theme.colors.ink }]} numberOfLines={2}>
                {displayTitle}
              </Text>

              <View style={styles.heroBadgeRow}>
                {machine.health_status === 'breakdown' && (
                  <Badge status="breakdown" customLabel="Breakdown" />
                )}
                {machine.health_status === 'under_maintenance' && (
                  <Badge status="under_maintenance" customLabel="Maintenance" />
                )}
                {machine.health_status === 'spare' && (
                  <Badge status="spare" customLabel="Spare" />
                )}
                {(!machine.health_status || machine.health_status === 'active') && (
                  <Badge status="active" customLabel="Active" />
                )}

                <Badge
                  status={machine.status === 'rented' ? 'in_transit' : 'available'}
                  customLabel={machine.status === 'rented' ? 'On Rent' : 'Available'}
                />
              </View>
            </View>

            {/* Action Buttons: Share, Edit & Red Delete */}
            <View style={styles.heroActionBtns}>
              <TouchableOpacity
                onPress={() => setShareModalVisible(true)}
                style={[
                  styles.circleEditBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                activeOpacity={0.7}
                accessibilityLabel="Share Machine Link"
              >
                <Share2 size={15} color={theme.colors.ink} />
              </TouchableOpacity>
              {(canManage || isSupervisor) && (
                <TouchableOpacity
                  onPress={() => {
                    setEditSection(isSupervisor ? 'personnel' : 'all');
                    setEditModalVisible(true);
                  }}
                  style={[
                    styles.circleEditBtn,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityLabel={isSupervisor ? 'Assign Operator' : 'Edit Machine'}
                >
                  <Edit2 size={15} color={theme.colors.ink} />
                </TouchableOpacity>
              )}

              {canDelete && (
                <TouchableOpacity
                  onPress={() => setDeleteDialogVisible(true)}
                  style={styles.circleDeleteBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* SEGMENTED TAB TOGGLE (Screenshot 2 Match) */}
        <View style={[styles.tabBarWrap, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.7}
            style={[
              styles.tabPill,
              activeTab === 'overview' && [
                styles.tabPillActive,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabPillText,
                {
                  color: activeTab === 'overview' ? theme.colors.link : theme.colors.mute,
                  fontWeight: activeTab === 'overview' ? '700' : '500',
                },
              ]}
            >
              Basic Info
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('running_hours')}
            activeOpacity={0.7}
            style={[
              styles.tabPill,
              activeTab === 'running_hours' && [
                styles.tabPillActive,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabPillText,
                {
                  color: activeTab === 'running_hours' ? theme.colors.link : theme.colors.mute,
                  fontWeight: activeTab === 'running_hours' ? '700' : '500',
                },
              ]}
            >
              HMR
            </Text>
            {hasLoadedLogs && hourLogs && hourLogs.length > 0 && (
              <View style={[styles.tabCountPill, { backgroundColor: theme.colors.link + '18' }]}>
                <Text style={[styles.tabCountText, { color: theme.colors.link }]}>
                  {hourLogs.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {normalizedRole !== 'operator' && (
            <TouchableOpacity
              onPress={() => setActiveTab('audit_trail')}
              activeOpacity={0.7}
              style={[
                styles.tabPill,
                activeTab === 'audit_trail' && [
                  styles.tabPillActive,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ],
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  {
                    color: activeTab === 'audit_trail' ? theme.colors.link : theme.colors.mute,
                    fontWeight: activeTab === 'audit_trail' ? '700' : '500',
                  },
                ]}
              >
                Audit
              </Text>
              {hasLoadedAudit && auditLogs && auditLogs.length > 0 && (
                <View style={[styles.tabCountPill, { backgroundColor: theme.colors.link + '18' }]}>
                  <Text style={[styles.tabCountText, { color: theme.colors.link }]}>
                    {auditLogs.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
        </View>

        {/* TAB 1: BASIC INFO & CLIENT DETAILS (Screenshot 2 Match) */}
        {activeTab === 'overview' && (
          <View style={styles.tabContentArea}>
            {/* 1. Basic Info Specs Grid Card (Screenshot 2 Match) */}
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
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                  Basic Info
                </Text>
                {canManage && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditSection('info');
                      setEditModalVisible(true);
                    }}
                    style={[
                      styles.circleEditBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                        width: 32,
                        height: 32,
                      },
                    ]}
                    activeOpacity={0.7}
                    accessibilityLabel="Edit Basic Info"
                  >
                    <Edit2 size={13} color={theme.colors.ink} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.specsGrid}>
                {/* Machine ID */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                      MACHINE ID
                    </Text>
                    <TouchableOpacity onPress={() => handleCopy(setCopiedId)}>
                      {copiedId ? (
                        <Check size={11} color={theme.colors.success} strokeWidth={2.5} />
                      ) : (
                        <Copy size={11} color={theme.colors.mute} />
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                    {machine.machine_id}
                  </Text>
                </View>

                {/* Model */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>MODEL</Text>
                    {Boolean(machine.model) && (
                      <TouchableOpacity onPress={() => handleCopy(setCopiedModel)}>
                        {copiedModel ? (
                          <Check size={11} color={theme.colors.success} strokeWidth={2.5} />
                        ) : (
                          <Copy size={11} color={theme.colors.mute} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.model || '—'}
                  </Text>
                </View>

                {/* Serial No */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SERIAL NO</Text>
                    {Boolean(machine.serial_number) && (
                      <TouchableOpacity onPress={() => handleCopy(setCopiedSerial)}>
                        {copiedSerial ? (
                          <Check size={11} color={theme.colors.success} strokeWidth={2.5} />
                        ) : (
                          <Copy size={11} color={theme.colors.mute} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.serial_number || '—'}
                  </Text>
                </View>

                {/* Year of Mfg */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    YEAR OF MFG (YUM)
                  </Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                    {machine.year_of_mfg || '—'}
                  </Text>
                </View>

                {/* Manufacturer */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    MANUFACTURER
                  </Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.manufacturer || '—'}
                  </Text>
                </View>

                {/* Hour Meter (HMR) in bold blue */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    HOUR METER (HMR)
                  </Text>
                  <Text style={[styles.specBoxValueHmr, { color: theme.colors.link }]}>
                    {machine.hour_meter ?? 0} hrs
                  </Text>
                </View>

                {/* Supervisors */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SUPERVISORS</Text>
                    {supervisors.length > 0 && (
                      <Text style={styles.specCountBadge}>{supervisors.length}</Text>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {supervisors.length > 0 ? supervisors.map((s: any) => s.full_name).join(', ') : '—'}
                  </Text>
                </View>

                {/* Operators */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>OPERATORS</Text>
                    {operators.length > 0 && (
                      <Text style={[styles.specCountBadge, { color: '#f59e0b' }]}>
                        {operators.length}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {operators.length > 0 ? operators.map((o: any) => o.full_name).join(', ') : '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. Assigned Shift Personnel (24h Fleet Coverage) (Screenshot 2 Match) */}
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
                  <Users size={16} color={theme.colors.link} />
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                    Assigned Shift Personnel
                  </Text>
                </View>

                {canAssignOperator && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditSection('personnel');
                      setEditModalVisible(true);
                    }}
                    style={styles.manageStaffBtn}
                  >
                    <Edit2 size={12} color={theme.colors.link} />
                    <Text style={[styles.manageStaffText, { color: theme.colors.link }]}>
                      {isSupervisor ? 'Assign Operator' : 'Manage Staff'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.personnelSectionBody}>
                {/* Supervisors Panel */}
                <View style={[styles.personnelSubBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={[styles.personnelSubHeader, { borderBottomColor: theme.colors.hairline }]}>
                    <View style={styles.personnelSubHeaderLeft}>
                      <Shield size={14} color="#10b981" />
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
                            <Clock size={11} color="#10b981" />
                            <Text style={styles.clockTimeText}>
                              {s.shift_time || '09:30:00 - 06:30 PM'}
                            </Text>
                          </View>
                        </View>

                        {(s.phone || s.email) ? (
                          <View style={[styles.personnelActionGroup, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                            {s.phone ? (
                              <TouchableOpacity
                                onPress={() => handleCall(s.phone)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Phone size={12} color={theme.colors.mute} />
                              </TouchableOpacity>
                            ) : null}
                            {s.phone && s.email ? (
                              <View style={[styles.personnelActionDivider, { backgroundColor: theme.colors.hairline }]} />
                            ) : null}
                            {s.email ? (
                              <TouchableOpacity
                                onPress={() => handleEmail(s.email)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Mail size={12} color={theme.colors.mute} />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>

                {/* Operators Panel */}
                <View style={[styles.personnelSubBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={[styles.personnelSubHeader, { borderBottomColor: theme.colors.hairline }]}>
                    <View style={styles.personnelSubHeaderLeft}>
                      <Wrench size={14} color="#f59e0b" />
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
                            <Text style={[styles.staffShiftTag, { color: '#f59e0b' }]}>
                              Shift {idx + 1}
                            </Text>
                          </View>

                          <View style={styles.clockRow}>
                            <Clock size={11} color="#10b981" />
                            <Text style={styles.clockTimeText}>
                              {o.shift_time || '24h Rotating Shift'}
                            </Text>
                          </View>
                        </View>

                        {(o.phone || o.email) ? (
                          <View style={[styles.personnelActionGroup, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                            {o.phone ? (
                              <TouchableOpacity
                                onPress={() => handleCall(o.phone)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Phone size={12} color={theme.colors.mute} />
                              </TouchableOpacity>
                            ) : null}
                            {o.phone && o.email ? (
                              <View style={[styles.personnelActionDivider, { backgroundColor: theme.colors.hairline }]} />
                            ) : null}
                            {o.email ? (
                              <TouchableOpacity
                                onPress={() => handleEmail(o.email)}
                                style={styles.personnelActionGroupBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Mail size={12} color={theme.colors.mute} />
                              </TouchableOpacity>
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
                  <Building2 size={16} color={theme.colors.link} />
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
                    <TouchableOpacity
                      onPress={handleOpenMap}
                      style={[
                        styles.circleEditBtn,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                          width: 32,
                          height: 32,
                        },
                      ]}
                      activeOpacity={0.7}
                      accessibilityLabel="Open Map Location"
                    >
                      <MapPin size={13} color="#0ea5e9" />
                    </TouchableOpacity>
                  ) : null}
                  {canManage && (
                    <TouchableOpacity
                      onPress={() => {
                        setEditSection('client');
                        setEditModalVisible(true);
                      }}
                      style={[
                        styles.circleEditBtn,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                          width: 32,
                          height: 32,
                        },
                      ]}
                      activeOpacity={0.7}
                      accessibilityLabel="Edit Client Details"
                    >
                      <Edit2 size={13} color={theme.colors.ink} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {hasLinkedClient ? (
                <View style={styles.clientDetailsBody}>
                  <View style={styles.clientGrid}>
                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CLIENT NAME</Text>
                      <Text style={[styles.clientNameValue, { color: theme.colors.ink }]}>
                        {clientCompanyName}
                      </Text>
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CONTACT PERSON</Text>
                      <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                        {clientContactPerson || '—'}
                      </Text>
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CONTACT MOBILE</Text>
                      {clientPhone ? (
                        <TouchableOpacity onPress={() => handleCall(clientPhone)}>
                          <Text style={[styles.clickableLinkText, { color: theme.colors.link }]}>
                            {clientPhone}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.specBoxValue, { color: theme.colors.mute }]}>—</Text>
                      )}
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CITY & STATE</Text>
                      <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                        {clientLocation || '—'}
                      </Text>
                    </View>

                    {clientGstin ? (
                      <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                        <View style={styles.specBoxHeader}>
                          <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>GSTIN</Text>
                          <TouchableOpacity onPress={() => handleCopy(setCopiedGstin)}>
                            {copiedGstin ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                          {clientGstin}
                        </Text>
                      </View>
                    ) : null}

                    {clientPan ? (
                      <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                        <View style={styles.specBoxHeader}>
                          <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>PAN NUMBER</Text>
                          <TouchableOpacity onPress={() => handleCopy(setCopiedPan)}>
                            {copiedPan ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                          </TouchableOpacity>
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
                        <TouchableOpacity onPress={() => handleCopy(setCopiedSiteAddress)}>
                          {copiedSiteAddress ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                        </TouchableOpacity>
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
                        <TouchableOpacity onPress={() => handleCopy(setCopiedBillingAddress)}>
                          {copiedBillingAddress ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.addressText, { color: theme.colors.ink }]}>
                        {fullBillingAddress}
                      </Text>
                    </View>
                  ) : null}

                  {/* Quick Action Touch Buttons (Call, WhatsApp) */}
                  <View style={styles.quickTouchRow}>
                    {clientPhone ? (
                      <TouchableOpacity
                        onPress={() => handleCall(clientPhone)}
                        style={[styles.touchActionBtn, { backgroundColor: '#10b98118', borderColor: '#10b98135' }]}
                        activeOpacity={0.7}
                      >
                        <Phone size={14} color="#10b981" />
                        <Text style={[styles.touchActionText, { color: '#10b981' }]}>Call</Text>
                      </TouchableOpacity>
                    ) : null}

                    {clientPhone ? (
                      <TouchableOpacity
                        onPress={() => handleWhatsApp(clientPhone)}
                        style={[styles.touchActionBtn, { backgroundColor: '#22c55e18', borderColor: '#22c55e35' }]}
                        activeOpacity={0.7}
                      >
                        <MessageSquare size={14} color="#22c55e" />
                        <Text style={[styles.touchActionText, { color: '#22c55e' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.noClientBox}>
                  <Building2 size={24} color={theme.colors.mute} />
                  <Text style={[styles.noClientTitle, { color: theme.colors.ink }]}>No Client Assigned</Text>
                  <Text style={[styles.noClientSub, { color: theme.colors.mute }]}>
                    This machine is currently available in the fleet inventory and has not been leased to a client account.
                  </Text>
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

              {/* Loading State */}
              {isLoadingLogs && (
                <View style={styles.loadingLogsWrap}>
                  <ActivityIndicator size="small" color={theme.colors.link} />
                  <Text style={[styles.loadingLogsText, { color: theme.colors.mute }]}>
                    Loading running meter history...
                  </Text>
                </View>
              )}

              {/* Error State */}
              {!isLoadingLogs && logsError && (
                <View style={[styles.logsErrorBox, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
                  <AlertCircle size={15} color="#ef4444" />
                  <Text style={styles.logsErrorText}>{logsError}</Text>
                  <TouchableOpacity onPress={fetchHourLogs} style={styles.retryBtn}>
                    <Text style={[styles.retryBtnText, { color: theme.colors.link }]}>Retry</Text>
                  </TouchableOpacity>
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
                      <TouchableOpacity onPress={() => setLogSearch('')}>
                        <X size={14} color={theme.colors.mute} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setShowFilterSort((prev) => !prev)}
                      style={[
                        styles.filterToggleBtn,
                        showFilterSort && { backgroundColor: theme.colors.link + '18' },
                      ]}
                    >
                      <SlidersHorizontal size={14} color={showFilterSort ? theme.colors.link : theme.colors.mute} />
                    </TouchableOpacity>
                  </View>

                  {/* Expandable Filter / Sort Bar */}
                  {showFilterSort && (
                    <View style={[styles.expandableFilters, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      {/* Date Preset Selector */}
                      <TouchableOpacity
                        onPress={() => setDateModalOpen(true)}
                        style={[styles.filterTriggerChip, { borderColor: theme.colors.hairline }]}
                      >
                        <Text style={[styles.filterChipText, { color: theme.colors.ink }]}>
                          Date: {logDatePreset === 'all' ? 'All' : logDatePreset === '7d' ? '7 Days' : logDatePreset === '30d' ? '30 Days' : 'This Month'}
                        </Text>
                        <ChevronDown size={12} color={theme.colors.mute} />
                      </TouchableOpacity>

                      {/* Sort Selector */}
                      <TouchableOpacity
                        onPress={() => setSortModalOpen(true)}
                        style={[styles.filterTriggerChip, { borderColor: theme.colors.hairline }]}
                      >
                        <Text style={[styles.filterChipText, { color: theme.colors.ink }]}>
                          Sort: {logSortBy === 'date_desc' ? 'Newest' : logSortBy === 'date_asc' ? 'Oldest' : logSortBy === 'hours_desc' ? 'High Hours' : 'Low Hours'}
                        </Text>
                        <ChevronDown size={12} color={theme.colors.mute} />
                      </TouchableOpacity>

                      {/* Clear Filters */}
                      {(logSearch || logDatePreset !== 'all' || logSortBy !== 'date_desc') && (
                        <TouchableOpacity
                          onPress={() => {
                            setLogSearch('');
                            setLogDatePreset('all');
                            setLogSortBy('date_desc');
                            setLogPage(1);
                          }}
                        >
                          <Text style={[styles.resetFilterText, { color: theme.colors.error }]}>Reset</Text>
                        </TouchableOpacity>
                      )}
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
                          <Text style={{ fontSize: 11, color: theme.colors.ink, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>
                            Worked: <Text style={{ fontWeight: '700' }}>{log.running_hours || 0} hrs</Text>
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 11, color: theme.colors.mute }}>Breakdown:</Text>
                            {Boolean(log.is_breakdown || (Number(log.breakdown_hours) > 0)) ? (
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#e11d48', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>
                                {Number(log.breakdown_hours) > 0 ? `${log.breakdown_hours} hrs` : 'Breakdown'}
                              </Text>
                            ) : (
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>
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

                  {/* Pagination Controls */}
                  {totalLogPages > 1 && (
                    <View style={[styles.paginationRow, { borderTopColor: theme.colors.hairline }]}>
                      <TouchableOpacity
                        onPress={() => setLogPage((p) => Math.max(1, p - 1))}
                        disabled={logPage === 1}
                        style={[styles.pageBtn, { borderColor: theme.colors.hairline }, logPage === 1 && { opacity: 0.4 }]}
                      >
                        <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Prev</Text>
                      </TouchableOpacity>

                      <Text style={[styles.pageIndicatorText, { color: theme.colors.mute }]}>
                        Page {logPage} of {totalLogPages}
                      </Text>

                      <TouchableOpacity
                        onPress={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                        disabled={logPage === totalLogPages}
                        style={[styles.pageBtn, { borderColor: theme.colors.hairline }, logPage === totalLogPages && { opacity: 0.4 }]}
                      >
                        <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Next</Text>
                      </TouchableOpacity>
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
                  <TouchableOpacity
                    onPress={fetchAuditLogs}
                    disabled={isLoadingAudit}
                    activeOpacity={0.7}
                    style={[styles.circleEditBtn, { borderColor: theme.colors.hairline, width: 28, height: 28, borderRadius: 14 }]}
                  >
                    <RefreshCw size={13} color={theme.colors.ink} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filter Controls (Search box removed) */}
              <View style={[styles.auditControlsCard, { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline }]}>
                {/* Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.auditFilterStrip}>
                  <TouchableOpacity
                    onPress={() => setAuditCategory('all')}
                    activeOpacity={0.7}
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
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setAuditCategory('hour_logs')}
                    activeOpacity={0.7}
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
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setAuditCategory('breakdowns')}
                    activeOpacity={0.7}
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
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setAuditCategory('assignments')}
                    activeOpacity={0.7}
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
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setAuditCategory('updates')}
                    activeOpacity={0.7}
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
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Loading State */}
              {isLoadingAudit && (
                <View style={styles.loadingLogsWrap}>
                  <ActivityIndicator size="small" color={theme.colors.link} />
                  <Text style={[styles.loadingLogsText, { color: theme.colors.mute }]}>
                    Loading audit trail history...
                  </Text>
                </View>
              )}

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
                  <TouchableOpacity
                    onPress={fetchAuditLogs}
                    activeOpacity={0.7}
                    style={[styles.pageBtn, { borderColor: theme.colors.hairline, marginTop: 8 }]}
                  >
                    <Text style={[styles.pageBtnText, { color: theme.colors.link }]}>Retry</Text>
                  </TouchableOpacity>
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
                                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#e11d48', textTransform: 'uppercase' }}>
                                            {del.label}:
                                          </Text>
                                          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.ink, textDecorationLine: 'line-through' }}>
                                            {del.deletedValue}
                                          </Text>
                                        </View>
                                        {del.reason ? (
                                          <Text style={{ fontSize: 10, color: theme.colors.mute, fontStyle: 'italic' }}>
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
                                      gap: 8,
                                    }}
                                  >
                                    {/* 1. Worked */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Text style={{ fontSize: 11, color: theme.colors.mute, fontWeight: '600' }}>Worked :</Text>
                                      <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                        {Number(log.metadata.runningHours || log.metadata.running_hours || 0).toFixed(1).replace(/\.0$/, '')} hrs
                                      </Text>
                                    </View>

                                    <Text style={{ fontSize: 10, color: theme.colors.hairline }}>•</Text>

                                    {/* 2. Meter Range */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Text style={{ fontSize: 11, color: theme.colors.mute, fontWeight: '600' }}>Meter:</Text>
                                      <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                        {log.metadata.startMeter ?? log.metadata.start_meter ?? '—'} →{' '}
                                        <Text style={{ color: '#059669' }}>
                                          {log.metadata.endMeter ?? log.metadata.end_meter ?? '—'}
                                        </Text>
                                      </Text>
                                    </View>

                                    <Text style={{ fontSize: 10, color: theme.colors.hairline }}>•</Text>

                                    {/* 3. Shift Time */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
                                      <Text style={{ fontSize: 11, color: theme.colors.mute, fontWeight: '600' }}>Shift:</Text>
                                      <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '600' }} numberOfLines={1}>
                                        {formatShiftTimingWithDateMobile(log.metadata)}
                                      </Text>
                                    </View>

                                    <Text style={{ fontSize: 10, color: theme.colors.hairline }}>•</Text>

                                    {/* 4. Breakdown */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Text style={{ fontSize: 11, color: theme.colors.mute, fontWeight: '600' }}>Breakdown:</Text>
                                      {log.metadata.isBreakdown ? (
                                        <Text style={{ fontSize: 11, color: '#e11d48', fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                          {log.metadata.breakdownDuration || (log.metadata.breakdownHours ? `${log.metadata.breakdownHours}h` : 'Breakdown')}
                                        </Text>
                                      ) : (
                                        <Text style={{ fontSize: 11, color: '#059669', fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
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
                                <Text style={{ fontSize: 10, color: theme.colors.mute }}>
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
                              <TouchableOpacity
                                onPress={() => setSelectedMobileAuditLog(log)}
                                activeOpacity={0.7}
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
                              </TouchableOpacity>
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
      <Modal
        visible={Boolean(selectedMobileAuditLog)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedMobileAuditLog(null)}
      >
        <View style={styles.auditModalOverlay}>
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
                <Text style={{ fontSize: 10, color: theme.colors.mute }}>
                  {selectedMobileAuditLog ? formatFullDateTimeMobile(selectedMobileAuditLog.created_at) : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedMobileAuditLog(null)}
                style={[styles.circleEditBtn, { borderColor: theme.colors.hairline, width: 28, height: 28, borderRadius: 14 }]}
              >
                <X size={14} color={theme.colors.ink} />
              </TouchableOpacity>
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
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.ink }}>
                        {selectedMobileAuditLog.actor_name || selectedMobileAuditLog.user?.full_name || 'System Operator'}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.mute, textTransform: 'capitalize' }}>
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
                        <Text style={{ fontSize: 10, color: theme.colors.mute }}>Model</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.ink }}>
                          {selectedMobileAuditLog.metadata?.model || machine.model || '50B-9'}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 10, color: theme.colors.mute }}>Machine ID</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.link }}>
                          {selectedMobileAuditLog.metadata?.machineCode || machine.machine_id || '—'}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 10, color: theme.colors.mute }}>Serial</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.ink, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
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
                          <Text style={{ fontSize: 11, color: theme.colors.mute }}>Duration:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#e11d48' }}>
                            {selectedMobileAuditLog.metadata?.breakdownDuration || (selectedMobileAuditLog.metadata?.breakdownHours ? `${selectedMobileAuditLog.metadata.breakdownHours}h` : 'Breakdown')}
                          </Text>
                        </View>
                        {selectedMobileAuditLog.metadata?.breakdownReason && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: theme.colors.mute }}>Reason:</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.ink }}>
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
                          <Text style={{ fontSize: 11, color: theme.colors.mute }}>Worked Hours:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.ink }}>
                            {Number(selectedMobileAuditLog.metadata.runningHours || selectedMobileAuditLog.metadata.running_hours || 0).toFixed(1)} hrs
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: theme.colors.mute }}>Meter Range:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.ink, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                            {selectedMobileAuditLog.metadata.startMeter ?? selectedMobileAuditLog.metadata.start_meter ?? '—'} →{' '}
                            <Text style={{ color: '#059669' }}>
                              {selectedMobileAuditLog.metadata.endMeter ?? selectedMobileAuditLog.metadata.end_meter ?? '—'}
                            </Text>
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: theme.colors.mute }}>Breakdown Condition:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: selectedMobileAuditLog.isBreakdown ? '#e11d48' : '#059669' }}>
                            {selectedMobileAuditLog.isBreakdown ? selectedMobileAuditLog.metadata?.breakdownDuration || 'Active' : '0 (Normal)'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: theme.colors.mute }}>Shift Timing:</Text>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.ink }}>
                            {formatShiftTimingWithDateMobile(selectedMobileAuditLog.metadata)}
                          </Text>
                        </View>
                        {selectedMobileAuditLog.metadata.location && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, color: theme.colors.mute }}>Location:</Text>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.ink, maxWidth: '65%' }} numberOfLines={1}>
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
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.ink }}>
                              {diff.label}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 11, color: theme.colors.mute, textDecorationLine: 'line-through' }}>
                                {diff.previous}
                              </Text>
                              <ArrowRight size={10} color="#059669" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>
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
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#e11d48' }}>
                              {del.label}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.colors.ink, textDecorationLine: 'line-through' }}>
                              {del.deletedValue}
                            </Text>
                            {del.reason ? (
                              <Text style={{ fontSize: 10, color: theme.colors.mute, fontStyle: 'italic' }}>
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
                      <Text style={{ fontSize: 10, color: theme.colors.mute }}>
                        Action: <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{selectedMobileAuditLog.action}</Text>
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.colors.mute }}>
                        Log ID: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: theme.colors.ink }}>{selectedMobileAuditLog.id}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Modal Footer Button */}
            <View style={{ paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.hairline }}>
              <TouchableOpacity
                onPress={() => setSelectedMobileAuditLog(null)}
                style={[styles.pageBtn, { borderColor: theme.colors.hairline, width: '100%', minHeight: 44 }]}
              >
                <Text style={[styles.pageBtnText, { color: theme.colors.ink, fontWeight: '700' }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Machine Modal */}
      <MachineModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        machineToEdit={machine}
        onSuccess={() => {
          if (onMachineUpdated) onMachineUpdated();
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

      {/* Filter Modals for Running Logs */}
      <CustomFilterSelectorModal
        visible={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        title="Filter by Date Range"
        options={[
          { id: 'all', label: 'All Dates' },
          { id: '7d', label: 'Last 7 Days' },
          { id: '30d', label: 'Last 30 Days' },
          { id: 'month', label: 'This Month' },
        ]}
        selectedValue={logDatePreset}
        onSelect={(val) => {
          setLogDatePreset(val as any);
          setLogPage(1);
        }}
      />

      <CustomFilterSelectorModal
        visible={sortModalOpen}
        onClose={() => setSortModalOpen(false)}
        title="Sort Logs By"
        options={[
          { id: 'date_desc', label: 'Date: Newest First' },
          { id: 'date_asc', label: 'Date: Oldest First' },
          { id: 'hours_desc', label: 'Hours: High to Low' },
          { id: 'hours_asc', label: 'Hours: Low to High' },
        ]}
        selectedValue={logSortBy}
        onSelect={(val) => {
          setLogSortBy(val as any);
          setLogPage(1);
        }}
      />

      {/* Shared Link Preview Modal */}
      <SharedLinkPreviewCard
        asModal={true}
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        url={`https://www.reachinternational.co.in/machines?id=${machine.id}`}
        title={`${machine.machine_id} — ${machine.model || 'Equipment'}`}
        description={`Serial No: ${machine.serial_number || 'N/A'} • Status: ${machine.health_status || 'Active'} • Operational Fleet Asset`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    minHeight: 36,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabPillText: {
    fontSize: 13,
  },
  tabCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '700',
  },
  clientCodePill: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e935',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  clientCodePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0ea5e9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  manageStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageStaffText: {
    fontSize: 12,
    fontWeight: '600',
  },
  specsGrid: {
    padding: spacingNumeric.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  specBox: {
    width: '48%',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  specBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  specBoxLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  specCountBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
  },
  specBoxValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  specBoxValueMono: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  specBoxValueHmr: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  specBoxValueRental: {
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 9,
    fontWeight: '700',
    color: '#10b981',
  },
  noStaffText: {
    fontSize: 11,
    fontStyle: 'italic',
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
    fontSize: 12,
    fontWeight: '700',
  },
  staffShiftTag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  clockTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    width: '48%',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  clientNameValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  clickableLinkText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  addressBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 2,
  },
  addressText: {
    fontSize: 12,
    lineHeight: 16,
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
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    minHeight: 44,
  },
  touchActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noClientBox: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 6,
  },
  noClientTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  noClientSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  totalHoursBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  totalHoursText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loadingLogsWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 8,
  },
  loadingLogsText: {
    fontSize: 12,
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
    fontSize: 12,
    color: '#ef4444',
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyLogsWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyLogsTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyLogsSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
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
    fontSize: 12,
    paddingVertical: 0,
  },
  filterToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resetFilterText: {
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logOperatorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  logOperatorName: {
    fontSize: 10,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    fontSize: 11,
    fontWeight: '800',
    color: '#0ea5e9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logRemarksText: {
    fontSize: 11,
    fontStyle: 'italic',
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
    fontSize: 11,
    fontWeight: '600',
  },
  pageIndicatorText: {
    fontSize: 11,
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
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '700',
  },
  auditCardActorRole: {
    fontSize: 10,
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
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  auditMiniValue: {
    fontSize: 12,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  auditLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  auditLocationText: {
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: '600',
  },
  auditGenericText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  auditTechToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    alignSelf: 'flex-start',
  },
  auditTechToggleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  auditJsonBox: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  auditJsonText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  auditDiffRow: {
    padding: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 4,
  },
  auditDiffLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  auditDiffValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  auditDiffPrevText: {
    fontSize: 10,
    textDecorationLine: 'line-through',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  auditDiffUpdatedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
