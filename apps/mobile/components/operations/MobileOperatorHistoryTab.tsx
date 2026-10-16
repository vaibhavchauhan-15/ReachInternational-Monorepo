/**
 * Reach International Mobile — Operator History Tab Component
 * 100% Visual and Behavioral Parity with Web OperatorHistoryTab (Screenshot 4).
 * Features:
 * - Top Header: "Historical Machine Logs", total count, Export to Excel (CSV) and Print/PDF buttons
 * - Filter Toolbar: Intelligent date search, filter toggle with Date presets, Condition and Sort options
 * - Active filter badges with one-tap clear buttons
 * - Mobile Touch Cards: Exact timestamp date & time, Operating Hours pill badge (+6.5 hrs),
 *   Machine model & serial number, Client & City, HMR progression, Shift Date, Shift Time,
 *   Breakdown summary, and 7-day inline Edit pencil button
 * - Native Excel & PDF export integration via expo-file-system and expo-print / expo-sharing
 * - 44px minimum touch targets and native tactile haptics
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Drawer } from '../ui/overlay/Drawer';
import { haptics } from '../../lib/haptics';
import { Pressable } from '../ui/touch/Pressable';
import { SearchInput } from '../ui/SearchInput';
import { showToast, EmptyState, ErrorState, SlowNetworkBanner } from '../ui';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { OperationLogListSkeleton } from './OperationsSkeleton';
import { SyncStatusBadge } from '../offline/SyncStatusBadge';
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue';
import {
  FileSpreadsheet,
  Printer,
  X,
  SlidersHorizontal,
  Calendar,
  Pencil,
  Lock,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Check,
  ChevronDown,
  Truck,
  Building2,
  ArrowRight,
} from '../ui/icon';
import {
  formatDate,
  formatTo12Hour,
  formatExactTimestamp,
  parseBreakdownDetails,
  addDaysToDateStr,
  getISTDateString,
} from '@reachinternational/utils';
import { Text } from '../ui/Text';
import { useOperatorHistoryLogs, useOperatorHistoryInfiniteQuery, type HourLogRecord } from '../../lib/hooks/useOperationsData';
import { fetchOperationsExportLogs } from '../../lib/queries/operationsExport';
import { OperationsExportModal } from './OperationsExportModal';
import { downloadFileOnWeb } from '../../lib/utils/fileExport';
import { OperationsConflictBanner } from './OperationsConflictBanner';

export interface MobileOperatorHistoryTabProps {
  user: any;
  assignedMachine?: any;
  onEditLog?: (log: HourLogRecord) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  pendingConflicts?: HourLogRecord[];
  showAllConflicts?: boolean;
  setShowAllConflicts?: (show: boolean | ((prev: boolean) => boolean)) => void;
  onOpenConflictModal?: (log: HourLogRecord) => void;
}

export type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'week' | 'month';
export type ConditionFilterPreset = 'all' | 'normal' | 'breakdown';
export type SortPreset =
  | 'date_desc'
  | 'date_asc'
  | 'hours_desc'
  | 'hours_asc'
  | 'meter_desc'
  | 'meter_asc';

const DATE_FILTER_OPTIONS: { value: DateFilterPreset; label: string }[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Past 7 Days' },
  { value: 'month', label: 'This Month' },
];

const CONDITION_FILTER_OPTIONS: { value: ConditionFilterPreset; label: string }[] = [
  { value: 'all', label: 'All Logs' },
  { value: 'normal', label: 'Normal (No Faults)' },
  { value: 'breakdown', label: 'Breakdown Logged' },
];

const SORT_OPTIONS: { value: SortPreset; label: string }[] = [
  { value: 'date_desc', label: 'Date: Newest First' },
  { value: 'date_asc', label: 'Date: Oldest First' },
  { value: 'hours_desc', label: 'Hours: High to Low' },
  { value: 'hours_asc', label: 'Hours: Low to High' },
  { value: 'meter_desc', label: 'End Meter: High to Low' },
  { value: 'meter_asc', label: 'End Meter: Low to High' },
];

/**
 * Intelligent date search matcher matching web OperatorHistoryTab exactly
 */
function matchesDateSearch(log: HourLogRecord, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (!log.log_date) return false;

  const rawDateStr = log.log_date.split('T')[0].trim();
  const [yearStr, monthStr, dayStr] = rawDateStr.split('-');
  if (!yearStr || !monthStr || !dayStr) {
    return rawDateStr.toLowerCase().includes(q);
  }

  const dayNum = parseInt(dayStr, 10);
  const monthNum = parseInt(monthStr, 10);

  const MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const MONTH_SHORT = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];

  const fullMonth = MONTH_NAMES[monthNum - 1] || '';
  const shortMonth = MONTH_SHORT[monthNum - 1] || '';

  if (q === 'today') {
    return rawDateStr === getISTDateString();
  }
  if (q === 'yesterday') {
    return rawDateStr === addDaysToDateStr(getISTDateString(), -1);
  }

  if (q.includes(dayStr) || q.includes(String(dayNum))) {
    if (shortMonth && q.includes(shortMonth)) return true;
    if (fullMonth && q.includes(fullMonth)) return true;
  }
  if (shortMonth && q.includes(shortMonth)) return true;
  if (fullMonth && q.includes(fullMonth)) return true;

  const ddmmyyyy = `${dayStr}-${monthStr}-${yearStr}`;
  if (ddmmyyyy.toLowerCase().includes(q)) return true;

  return rawDateStr.toLowerCase().includes(q);
}

/**
 * Checks if log was submitted within the last 7 calendar days
 */
function isLogWithin7Days(logDate?: string | null): boolean {
  if (!logDate) return false;
  const logDateStr = logDate.split('T')[0];
  const parts = logDateStr.split('-').map(Number);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const logDateMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    const diffDays = Math.floor((todayMidnight - logDateMidnight) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  }
  return false;
}

/**
 * Memoized Individual History Log Card Component
 * Isolates rendering per log item for maximum scroll performance & zero unnecessary re-renders.
 */
interface HistoryLogCardProps {
  log: HourLogRecord;
  theme: any;
  isDark: boolean;
  onEditLog?: (log: HourLogRecord) => void;
}

const HistoryLogCard = React.memo<HistoryLogCardProps>(
  function HistoryLogCard({ log, theme, isDark, onEditLog }) {
    const startM = Number(log.start_meter) || 0;
    const endM = Number(log.end_meter) || startM;
    const rt = log.running_hours ?? Math.max(0, Math.round((endM - startM) * 10) / 10);

    // Shift display name (e.g. "Shift A", "Shift B")
    const shiftName = useMemo(() => {
      const raw = (log.shift_code || log.shift || '').trim();
      if (!raw) return 'Shift A';
      if (/^shift/i.test(raw)) {
        return raw.replace(/^shift\s*/i, 'Shift ');
      }
      return `Shift ${raw}`;
    }, [log.shift_code, log.shift]);

    const model = log.machine?.model || 'Equipment';
    const serial = log.machine?.serial_number || '';
    const machineIdCode = log.machine?.machine_id || log.machine_code || '';
    const clientName = log.client?.company_name || 'Base Yard';
    const clientCode = (log.client as any)?.code || '';
    const clientCity = log.client?.city || (log.location && log.location.includes(',') ? log.location.split(',')[1]?.trim() : '');

    const timestampStr = log.created_at
      ? formatExactTimestamp(log.created_at, false)
      : formatDate(log.log_date);

    const breakdownInfo = log.is_breakdown ? parseBreakdownDetails(log) : null;
    const canEdit = isLogWithin7Days(log.log_date);
    const breakdownNote = (log.remarks || '').trim();

    return (
      <View
        style={[
          styles.historyCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Row 1: Top Header — Exact timestamp date & time (left) + Sync Status Pill + Operating Hours badge & Edit/Lock Action (right) */}
        <View style={[styles.cardHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8, flexWrap: 'wrap' }}>
            <Text variant="mono" style={[styles.timestampText, { color: theme.colors.mute }]}>
              {timestampStr}
            </Text>
            {log.sync_status && log.sync_status !== 'synced' && (
              <SyncStatusBadge status={log.sync_status} />
            )}
          </View>
          <View style={styles.headerRightActions}>
            <View
              style={[
                styles.hoursBadge,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.20)',
                },
              ]}
            >
              <Text
                variant="micro"
                style={[
                  styles.hoursBadgeText,
                  { color: isDark ? '#4ade80' : '#15803d' },
                ]}
              >
                +{rt.toFixed(1)} hrs
              </Text>
            </View>

            {canEdit && (!log.sync_status || log.sync_status === 'synced') ? (
              <Pressable
                variant="iconButton"
                haptic="tap"
                hitSlopToMin48
                onPress={() => onEditLog?.(log)}
                style={styles.headerEditBtn}
                accessibilityLabel="Edit machine log within 7 days"
              >
                <Pencil size={13} color={theme.colors.link} />
              </Pressable>
            ) : (
              <View style={styles.headerLockBtn} accessibilityLabel="Locked (archived)">
                <Lock size={12} color={theme.colors.mute} />
              </View>
            )}
          </View>
        </View>

        {/* Row 2: Equipment Model + Machine ID Pill + Serial Number Pill */}
        <View style={styles.cardMachineRow}>
          <Truck size={14} color="#0284c7" style={{ marginRight: 4 }} />
          <Text variant="subheading" style={[styles.machineTitle, { color: theme.colors.ink }]}>
            {model}
          </Text>
          {machineIdCode ? (
            <View
              style={[
                styles.codePillSmall,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.07)',
                },
              ]}
            >
              <Text variant="micro" style={[styles.codePillSmallText, { color: isDark ? 'rgba(226, 232, 240, 0.75)' : 'rgba(71, 85, 105, 0.75)' }]}>
                {machineIdCode}
              </Text>
            </View>
          ) : null}
          {serial ? (
            <View
              style={[
                styles.serialPill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <Text variant="micro" style={[styles.machineSerial, { color: theme.colors.mute }]}>
                S/N: {serial}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Row 3: Client & Location */}
        <View style={styles.cardClientRow}>
          <Building2 size={13} color="#10b981" style={{ marginRight: 4 }} />
          <Text variant="body" style={[styles.clientName, { color: theme.colors.ink }]} numberOfLines={1}>
            {clientName}
          </Text>
          {clientCode ? (
            <View
              style={[
                styles.codePillSmall,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.07)',
                },
              ]}
            >
              <Text variant="micro" style={[styles.codePillSmallText, { color: isDark ? 'rgba(226, 232, 240, 0.75)' : 'rgba(71, 85, 105, 0.75)' }]}>
                {clientCode}
              </Text>
            </View>
          ) : null}
          {clientCity ? (
            <Text variant="caption" style={[styles.clientCity, { color: theme.colors.mute }]}>
              {' '}({clientCity})
            </Text>
          ) : null}
        </View>

        {/* Row 4: Metrics Box (Clean Formatted Grid) */}
        <View
          style={[
            styles.metricsBox,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Shift Date & Shift Badge */}
          <View style={styles.metricItemRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
              <Calendar size={13} color="#0284c7" />
              <Text variant="mono" style={[styles.dateValueBold, { color: theme.colors.ink }]}>
                {formatDate(log.log_date)}
              </Text>

              {/* Shift Badge with ONLY shift name (e.g. Shift A, Shift B) */}
              <View
                style={[
                  styles.shiftBadge,
                  {
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.10)' : 'rgba(2, 132, 199, 0.07)',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.18)',
                  },
                ]}
              >
                <Text
                  variant="micro"
                  style={[
                    styles.shiftBadgeText,
                    { color: isDark ? '#38bdf8' : '#0284c7' },
                  ]}
                >
                  {shiftName}
                </Text>
              </View>
            </View>

            {log.overtime_hours ? (
              <View
                style={[
                  styles.otPill,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.18)',
                  },
                ]}
              >
                <Text variant="micro" style={[styles.otPillText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                  +{log.overtime_hours}h OT
                </Text>
              </View>
            ) : null}
          </View>

          {/* HMR Progression (Tight inline row with ArrowRight icon) */}
          <View style={styles.hmrInlineRow}>
            <Text variant="mono" style={[styles.metaLabel, { color: theme.colors.mute }]}>
              HMR:
            </Text>
            <Text variant="mono" style={[styles.hmrValue, { color: theme.colors.ink }]}>
              {Number.isInteger(startM) ? startM.toFixed(0) : startM.toFixed(1)}
            </Text>
            <ArrowRight size={12} color={theme.colors.mute} style={{ marginHorizontal: 4 }} />
            <Text variant="mono" style={[styles.hmrValueBold, { color: theme.colors.ink }]}>
              {Number.isInteger(endM) ? endM.toFixed(0) : endM.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Row 5: Breakdown Details & Notes */}
        {log.is_breakdown ? (
          <View style={styles.breakdownSection}>
            <View style={styles.breakdownBadgeRow}>
              <AlertTriangle size={13} color="#e11d48" style={{ marginRight: 4 }} />
              <Text variant="mono" style={{ color: '#e11d48' }}>
                Breakdown:
              </Text>
              <Text
                variant="caption"
                style={{ color: '#e11d48', flex: 1, marginLeft: 4 }}
                numberOfLines={1}
              >
                {breakdownInfo?.displayText || (log as any).breakdown_duration || 'Reported'}
              </Text>
            </View>

            {/* Breakdown Notes (Only rendered if breakdown note is non-empty/non-null) */}
            {breakdownNote ? (
              <View
                style={[
                  styles.breakdownNoteBox,
                  {
                    backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : '#fff1f2',
                    borderColor: isDark ? 'rgba(244, 63, 94, 0.25)' : '#fecdd3',
                  },
                ]}
              >
                <AlertCircle size={13} color="#e11d48" style={{ marginTop: 2, marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" style={{ color: isDark ? '#fb7185' : '#be123c' }}>
                    Breakdown Notes:
                  </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink, marginTop: 1 }}>
                    {breakdownNote}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.normalBadgeRow}>
            <Text variant="micro" style={[styles.metaLabel, { color: theme.colors.mute }]}>
              Breakdown: 0 (Normal)
            </Text>
          </View>
        )}
      </View>
    );
  },
  (prev, next) =>
    prev.log.id === next.log.id &&
    prev.log.sync_status === next.log.sync_status &&
    prev.log.end_meter === next.log.end_meter &&
    prev.log.running_hours === next.log.running_hours &&
    prev.log.shift === next.log.shift &&
    prev.log.shift_code === next.log.shift_code &&
    prev.isDark === next.isDark
);

export const MobileOperatorHistoryTab: React.FC<MobileOperatorHistoryTabProps> = React.memo(
  function MobileOperatorHistoryTab({
    user,
    assignedMachine,
    onEditLog,
    refreshing = false,
    onRefresh,
    pendingConflicts,
    showAllConflicts,
    setShowAllConflicts,
    onOpenConflictModal,
  }) {
    const { theme, isDark } = useTheme();
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
    const [conditionFilter, setConditionFilter] = useState<ConditionFilterPreset>('all');
    const [sortBy, setSortBy] = useState<SortPreset>('date_desc');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Debounced search input (280ms) to eliminate per-keystroke querying and UI thread hitching
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(search);
      }, 280);
      return () => clearTimeout(timer);
    }, [search]);

    // Server-side virtualized infinite query (12 items/chunk)
    const {
      data: infiniteData,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isLoading,
      isError,
      error,
      refetch,
    } = useOperatorHistoryInfiniteQuery({
      operatorId: user?.id,
      fallbackMachine: assignedMachine,
      searchQuery: debouncedSearch,
      dateFilter,
      conditionFilter,
      sortBy,
      pageSize: 12,
    });

    const [isSlowNetwork, setIsSlowNetwork] = useState(false);
    const [isSlowDismissed, setIsSlowDismissed] = useState(false);

    useEffect(() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      if (isLoading) {
        timer = setTimeout(() => {
          setIsSlowNetwork(true);
        }, 7000);
      } else {
        setIsSlowNetwork(false);
        setIsSlowDismissed(false);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [isLoading]);

    const { queue } = useOfflineQueue();

    const queuedShiftLogs = useMemo(() => {
      return queue
        .filter((m) => m.mutation_type === 'SUBMIT_HOUR_LOG')
        .filter((m) => {
          const payload = (m.payload || {}) as Record<string, any>;
          if (user?.id && payload.operator_id && payload.operator_id !== user.id) return false;
          if (assignedMachine?.id && payload.machine_id && payload.machine_id !== assignedMachine.id) return false;
          return true;
        })
        .map((m): HourLogRecord => {
          const payload = (m.payload || {}) as Record<string, any>;
          const startM = Number(payload.start_meter) || 0;
          const endM = Number(payload.end_meter) || startM;
          const runningHrs = payload.running_hours ?? Math.max(0, Math.round((endM - startM) * 10) / 10);
          return {
            id: m.id,
            machine_id: payload.machine_id || assignedMachine?.id || '',
            machine_code: payload.machine_code || assignedMachine?.machine_id || 'Equipment',
            operator_id: payload.operator_id || user?.id || '',
            log_date: payload.log_date || new Date().toISOString().split('T')[0],
            start_time: payload.start_time || '',
            end_time: payload.end_time || '',
            start_meter: startM,
            end_meter: endM,
            running_hours: runningHrs,
            overtime_hours: Number(payload.overtime_hours) || 0,
            client_id: payload.client_id || null,
            location: payload.location || null,
            remarks: payload.remarks || null,
            is_breakdown: Boolean(payload.is_breakdown),
            breakdown_reason: payload.breakdown_reason || null,
            shift_code: payload.shift_code || null,
            machine: assignedMachine || {
              id: payload.machine_id || '',
              machine_id: payload.machine_code || 'Equipment',
              model: assignedMachine?.model || 'Equipment',
              serial_number: assignedMachine?.serial_number || '',
              status: 'active',
            },
            client: payload.client_id
              ? {
                  id: payload.client_id,
                  company_name: payload.client_name || 'Client Site',
                  city: '',
                }
              : null,
            sync_status: m.status,
            created_at: new Date(m.created_at).toISOString(),
          } as HourLogRecord;
        });
    }, [queue, user?.id, assignedMachine]);

    // Flatten pages into linear array
    const serverLogs = useMemo(() => {
      if (!infiniteData?.pages) return [];
      return infiniteData.pages.flatMap((page) => page.logs);
    }, [infiniteData?.pages]);

    // Prepend queued offline shift logs seamlessly
    const combinedLogs = useMemo(() => {
      if (!queuedShiftLogs.length) return serverLogs;
      const existingKeys = new Set(
        serverLogs.map((l) => `${l.machine_id}_${l.log_date}_${(l.shift_code || '').toLowerCase()}`)
      );
      const pendingNonDuplicates = queuedShiftLogs.filter(
        (q) => !existingKeys.has(`${q.machine_id}_${q.log_date}_${(q.shift_code || '').toLowerCase()}`)
      );
      return [...pendingNonDuplicates, ...serverLogs];
    }, [queuedShiftLogs, serverLogs]);

    const filteredLogs = combinedLogs;
    const totalCount = (infiniteData?.pages[0]?.totalCount ?? 0) + queuedShiftLogs.length;

    // Calculate active filter count
    const activeFilterCount = useMemo(() => {
      let count = 0;
      if (search.trim() !== '') count++;
      if (dateFilter !== 'all') count++;
      if (conditionFilter !== 'all') count++;
      if (sortBy !== 'date_desc') count++;
      return count;
    }, [search, dateFilter, conditionFilter, sortBy]);

    const handleResetFilters = useCallback(() => {
      haptics.success();
      setSearch('');
      setDateFilter('all');
      setConditionFilter('all');
      setSortBy('date_desc');
    }, []);

    // Summary metrics for export modal and reporting
    const summaryMetrics = useMemo(() => {
      let totalRunningHours = 0;
      let totalOtHours = 0;
      let totalBreakdowns = 0;

      filteredLogs.forEach((log) => {
        totalRunningHours += Number(log.running_hours) || 0;
        totalOtHours += Number(log.overtime_hours) || 0;
        if (log.is_breakdown) totalBreakdowns += 1;
      });

      return {
        totalRunningHours: Math.round(totalRunningHours * 10) / 10,
        totalOtHours: Math.round(totalOtHours * 10) / 10,
        totalBreakdowns,
      };
    }, [filteredLogs]);

    const handleEndReached = useCallback(() => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Handler: Export filtered logs to CSV / Excel directly with on-demand server fetch
    const handleExportExcel = useCallback(async () => {
      try {
        setIsExportingExcel(true);
        haptics.select();

        // 1. Fetch entire matching dataset from server without loading it into UI list memory
        const exportResult = await fetchOperationsExportLogs({
          viewMode: 'operator',
          operatorId: user?.id,
          search: debouncedSearch.trim() || undefined,
          month: dateFilter,
          condition: conditionFilter,
          sort: sortBy.startsWith('date_asc') ? 'date-asc' : 'date-desc',
        });

        const logsToExport = exportResult.success && exportResult.logs.length > 0
          ? exportResult.logs
          : filteredLogs;

        if (!logsToExport || logsToExport.length === 0) {
          showToast('info', 'No Logs', 'No machine logs found to export for the selected filters.');
          return;
        }

        const headers = [
          'Shift Date',
          'Machine Code',
          'Machine Model',
          'Serial Number',
          'Client',
          'Site Location',
          'Shift',
          'Start Meter',
          'End Meter',
          'Running Hours',
          'Start Time',
          'End Time',
          'Overtime (h)',
          'Breakdown',
          'Breakdown Duration',
          'Remarks',
          'Logged At',
        ];

        const rows = logsToExport.map((log) => [
          `"${formatDate(log.log_date)}"`,
          `"${log.machine_code || log.machine?.machine_id || ''}"`,
          `"${log.machine?.model || ''}"`,
          `"${log.machine?.serial_number || ''}"`,
          `"${log.client?.company_name || 'Base Yard'}"`,
          `"${log.location || log.client?.city || ''}"`,
          `"${log.shift_code || log.shift || ''}"`,
          Number(log.start_meter || 0).toFixed(1),
          Number(log.end_meter || 0).toFixed(1),
          Number(log.running_hours || 0).toFixed(1),
          `"${formatTo12Hour(log.start_time) || ''}"`,
          `"${formatTo12Hour(log.end_time) || ''}"`,
          log.overtime_hours ? String(log.overtime_hours) : '0',
          log.is_breakdown ? 'YES' : 'NO',
          `"${(log as any).breakdown_duration || ''}"`,
          `"${(log.remarks || '').replace(/"/g, '""')}"`,
          `"${log.created_at ? formatExactTimestamp(log.created_at, false) : ''}"`,
        ].join(','));

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const filename = `Machine_Logs_${getISTDateString()}.csv`;

        if (Platform.OS === 'web') {
          downloadFileOnWeb(csvContent, filename, 'text/csv;charset=utf-8;');
        } else {
          const fileUri = `${FileSystem.documentDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: 'Export Machine Logs (CSV/Excel)',
              UTI: 'public.comma-separated-values-text',
            });
          } else {
            showToast('success', 'Export Complete', `Saved to ${fileUri}`);
          }
        }
        haptics.success();
      } catch (err: any) {
        console.error('[MobileOperatorHistoryTab] Export Excel error:', err);
        showToast('error', 'Export Error', err?.message || 'Failed to export logs.');
      } finally {
        setIsExportingExcel(false);
      }
    }, [user?.id, debouncedSearch, dateFilter, conditionFilter, sortBy, filteredLogs]);

    const keyExtractor = useCallback((item: HourLogRecord) => item.id, []);

    const renderLogItem = useCallback(
      ({ item }: { item: HourLogRecord }) => (
        <HistoryLogCard
          log={item}
          theme={theme}
          isDark={isDark}
          onEditLog={onEditLog}
        />
      ),
      [theme, isDark, onEditLog]
    );

    const listHeaderElement = useMemo(() => {
      return (
        <View style={styles.headerContainer}>
          {/* Overtime Conflict Alert Banner */}
          {pendingConflicts && pendingConflicts.length > 0 && setShowAllConflicts && onOpenConflictModal && (
            <OperationsConflictBanner
              pendingConflicts={pendingConflicts}
              showAllConflicts={Boolean(showAllConflicts)}
              setShowAllConflicts={setShowAllConflicts}
              onOpenConflictModal={onOpenConflictModal}
            />
          )}

          {/* Slow Network Feedback Banner */}
          <SlowNetworkBanner
            visible={isSlowNetwork && !isSlowDismissed && isLoading}
            message="Slow network detected. Still loading historical shift logs..."
            onRetry={() => {
              void refetch();
            }}
            onDismiss={() => setIsSlowDismissed(true)}
            style={{ marginBottom: spacingNumeric.sm }}
          />

          {/* Ambient Cached Data Warning when background refresh fails */}
          {isError && filteredLogs.length > 0 && (
            <View
              style={[
                styles.cachedErrorBanner,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                },
              ]}
            >
              <AlertCircle size={15} color={isDark ? '#f87171' : '#dc2626'} />
              <Text
                variant="caption"
                style={[styles.cachedErrorText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}
              >
                Displaying cached shift logs. Unable to refresh records.
              </Text>
              <Pressable
                variant="chip"
                haptic="tap"
                hitSlopToMin48
                onPress={() => {
                  void refetch();
                }}
                style={styles.cachedRetryChip}
              >
                <RotateCcw size={12} color={isDark ? '#f87171' : '#dc2626'} />
                <Text
                  variant="caption"
                  style={{ color: isDark ? '#f87171' : '#dc2626' }}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          )}

          {/* 1. Header Card Container (Screenshot 4) */}
          <View
            style={[
              styles.headerCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.headerTopRow}>
              <View style={styles.headerTitleWrap}>
                <Text variant="heading" style={[styles.headerTitle, { color: theme.colors.ink }]}>
                  Historical Machine Logs
                </Text>
                <Text variant="caption" style={[styles.headerSubtitle, { color: theme.colors.mute }]}>
                  {filteredLogs.length >= totalCount
                    ? `Showing ${totalCount} total logged shifts`
                    : `Showing ${filteredLogs.length} of ${totalCount} logged shifts`}
                </Text>
              </View>

              {/* Action CTAs: Export to Excel and Print/PDF Buttons (Screenshot 4) */}
              <View style={styles.headerActionsWrap}>
                <Pressable
                  variant="iconButton"
                  haptic="tap"
                  hitSlopToMin48
                  onPress={handleExportExcel}
                  disabled={isExportingExcel}
                  style={[
                    styles.iconCtaBtn,
                    {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                    },
                  ]}
                  accessibilityLabel="Export Shift Logs to Excel"
                >
                  {isExportingExcel ? (
                    <ActivityIndicator size="small" color={isDark ? '#34d399' : '#059669'} />
                  ) : (
                    <FileSpreadsheet size={16} color={isDark ? '#34d399' : '#059669'} />
                  )}
                </Pressable>

                <Pressable
                  variant="iconButton"
                  haptic="tap"
                  hitSlopToMin48
                  onPress={() => setShowExportModal(true)}
                  style={[
                    styles.iconCtaBtn,
                    {
                      backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe',
                      borderColor: isDark ? 'rgba(2, 132, 199, 0.3)' : '#bae6fd',
                    },
                  ]}
                  accessibilityLabel="Print or Export Shift Logs to PDF"
                >
                  <Printer size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
                </Pressable>
              </View>
            </View>

            {/* 2. Search & Filter Bar (Screenshot 4) */}
            <View style={styles.searchFilterRow}>
              <SearchInput
                value={search}
                onChangeText={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search date (e.g. 19 Sep, 2026-09-19)..."
                containerStyle={{ flex: 1 }}
              />

              {/* Filter Dropdown Toggle Button */}
              <Pressable
                variant="outline"
                haptic="select"
                hitSlopToMin48
                onPress={() => setIsFilterModalOpen(true)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor:
                      activeFilterCount > 0
                        ? isDark ? 'rgba(2, 132, 199, 0.15)' : '#eff6ff'
                        : isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    borderColor:
                      activeFilterCount > 0
                        ? isDark ? 'rgba(2, 132, 199, 0.4)' : '#0284c7'
                        : theme.colors.hairline,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Filter shift logs"
              >
                <SlidersHorizontal
                  size={13}
                  color={activeFilterCount > 0 ? '#0284c7' : theme.colors.mute}
                />
                <Text
                  variant="label"
                  style={[
                    styles.filterBtnText,
                    { color: activeFilterCount > 0 ? '#0284c7' : theme.colors.ink },
                  ]}
                >
                  Filter
                </Text>
                {activeFilterCount > 0 && (
                  <View
                    style={{
                      backgroundColor: '#0284c7',
                      borderRadius: 9,
                      minWidth: 18,
                      height: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text variant="caption" style={{ color: '#ffffff' }}>
                      {activeFilterCount}
                    </Text>
                  </View>
                )}
                <ChevronDown
                  size={13}
                  color={activeFilterCount > 0 ? '#0284c7' : theme.colors.mute}
                />
              </Pressable>
            </View>

            {/* 3. Active Filter Chips Row (Screenshot 4) */}
            {activeFilterCount > 0 && (
              <View style={[styles.activeFilterChipsRow, { borderTopColor: theme.colors.hairline }]}>
                <Text variant="mono" style={[styles.activeFilterLabel, { color: theme.colors.mute }]}>
                  ACTIVE ({activeFilterCount}):
                </Text>

                {/* Date Search Chip */}
                {search.trim() !== '' && (
                  <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                    <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                      Date: "{search}"
                    </Text>
                    <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => setSearch('')}>
                      <X size={11} color={theme.colors.mute} />
                    </Pressable>
                  </View>
                )}

                {/* Date Preset Chip */}
                {dateFilter !== 'all' && (
                  <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                    <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                      {DATE_FILTER_OPTIONS.find((o) => o.value === dateFilter)?.label}
                    </Text>
                    <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => setDateFilter('all')}>
                      <X size={11} color={theme.colors.mute} />
                    </Pressable>
                  </View>
                )}

                {/* Condition Chip */}
                {conditionFilter !== 'all' && (
                  <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                    <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                      {CONDITION_FILTER_OPTIONS.find((o) => o.value === conditionFilter)?.label}
                    </Text>
                    <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => setConditionFilter('all')}>
                      <X size={11} color={theme.colors.mute} />
                    </Pressable>
                  </View>
                )}

                {/* Sort Chip */}
                {sortBy !== 'date_desc' && (
                  <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                    <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                      Sort: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                    </Text>
                    <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => setSortBy('date_desc')}>
                      <X size={11} color={theme.colors.mute} />
                    </Pressable>
                  </View>
                )}

                {/* Reset All */}
                <Pressable variant="chip" haptic="tap" hitSlopToMin48 onPress={handleResetFilters} style={styles.resetAllBtn} accessibilityRole="button">
                  <RotateCcw size={11} color={theme.colors.link} />
                  <Text variant="caption" style={{ color: theme.colors.link }}>
                    Reset
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      );
    }, [
      pendingConflicts,
      showAllConflicts,
      setShowAllConflicts,
      onOpenConflictModal,
      isSlowNetwork,
      isSlowDismissed,
      isLoading,
      refetch,
      isError,
      filteredLogs.length,
      totalCount,
      isDark,
      theme.colors.canvasElevated,
      theme.colors.hairline,
      theme.colors.ink,
      theme.colors.mute,
      theme.colors.link,
      theme.colors.canvas,
      handleExportExcel,
      isExportingExcel,
      search,
      activeFilterCount,
      dateFilter,
      conditionFilter,
      sortBy,
      handleResetFilters,
    ]);

    const listEmptyElement = useMemo(() => {
      if (isLoading) {
        return <OperationLogListSkeleton count={4} />;
      }

      if (isError && filteredLogs.length === 0) {
        return (
          <ErrorState
            error={error}
            onRetry={() => {
              void refetch();
            }}
            title="Failed to Load Shift History"
            message="Unable to retrieve historical shift logs from the server. Check your connection and try again."
            retryLabel="Retry Shift Logs"
          />
        );
      }

      if (filteredLogs.length === 0) {
        if (search.trim() !== '') {
          return (
            <EmptyState
              variant="no-results"
              title="No Matching Shift Logs"
              description={`No shift logs match "${search}". Try clearing or modifying your search query.`}
              actionLabel="Clear Search"
              onAction={() => setSearch('')}
            />
          );
        }
        if (activeFilterCount > 0) {
          return (
            <EmptyState
              variant="filtered"
              title="No Logs for Active Filters"
              description="No shift logs match your active filter criteria. Reset filters to see all recorded logs."
              actionLabel="Reset Filters"
              onAction={handleResetFilters}
            />
          );
        }
        return (
          <EmptyState
            variant="empty"
            title="No Shift Logs Recorded"
            description="No shift logs have been recorded for this equipment yet."
          />
        );
      }

      return null;
    }, [
      isLoading,
      isError,
      filteredLogs.length,
      search,
      activeFilterCount,
      error,
      refetch,
      handleResetFilters,
    ]);

    const listFooterElement = useMemo(() => {
      if (filteredLogs.length === 0 || isLoading) return null;

      if (isFetchingNextPage) {
        return (
          <View style={styles.listFooter}>
            <ActivityIndicator size="small" color={theme.colors.link} />
            <Text variant="caption" style={[styles.listFooterText, { color: theme.colors.mute }]}>
              Loading more logs... ({filteredLogs.length} of {totalCount})
            </Text>
          </View>
        );
      }

      if (!hasNextPage && filteredLogs.length > 0) {
        return (
          <View style={styles.listEndDivider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.hairline }]} />
            <Text variant="caption" style={[styles.endOfListText, { color: theme.colors.mute }]}>
              All {totalCount} logs loaded
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.hairline }]} />
          </View>
        );
      }

      return null;
    }, [
      filteredLogs.length,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      totalCount,
      theme.colors.link,
      theme.colors.mute,
      theme.colors.hairline,
    ]);

    return (
      <View style={{ flex: 1 }}>
        <FlatList<HourLogRecord>
          data={filteredLogs}
          renderItem={renderLogItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeaderElement}
          ListEmptyComponent={listEmptyElement}
          ListFooterComponent={listFooterElement}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={true}
          indicatorStyle={isDark ? 'white' : 'black'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh || (() => void refetch())}
              tintColor={theme.colors.link}
            />
          }
        />

      {/* 5. Filter Drawer (Lazy mounted only when opened, zero background footprint) */}
      {isFilterModalOpen && (
        <Drawer
          visible={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          maxPixelWidth={380}
          widthRatio={0.88}
        >
        <View style={styles.drawerContainer}>
          {/* Drawer Header */}
          <View style={[styles.drawerHeader, { borderBottomColor: theme.colors.hairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.drawerIconBox, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe' }]}>
                <SlidersHorizontal size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="heading" style={{ color: theme.colors.ink }}>
                  Filter Shift Logs
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Refine records by date & status
                </Text>
              </View>
            </View>
            <Pressable
              variant="iconButton"
              haptic="tap"
              hitSlopToMin48
              onPress={() => setIsFilterModalOpen(false)}
              accessibilityLabel="Close filter drawer"
            >
              <X size={20} color={theme.colors.mute} />
            </Pressable>
          </View>

          {/* Drawer Scrollable Content */}
          <ScrollView
            style={styles.drawerScroll}
            contentContainerStyle={styles.drawerScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* 1. Date Filter Section */}
            <View style={styles.filterSection}>
              <Text variant="mono" style={[styles.filterSectionTitle, { color: theme.colors.mute }]}>
                DATE RANGE
              </Text>
              <View style={styles.filterOptionsGrid}>
                {DATE_FILTER_OPTIONS.map((opt) => {
                  const isSelected = dateFilter === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      variant="chip"
                      haptic="select"
                      hitSlopToMin48
                      onPress={() => setDateFilter(opt.value)}
                      style={[
                        styles.filterOptionPill,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(2, 132, 199, 0.18)' : '#e0f2fe')
                            : (isDark ? 'rgba(255, 255, 255, 0.04)' : theme.colors.canvas),
                          borderColor: isSelected
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : theme.colors.hairline,
                        },
                      ]}
                    >
                      {isSelected && <Check size={12} color={isDark ? '#38bdf8' : '#0284c7'} />}
                      <Text
                        variant={isSelected ? 'label' : 'caption'}
                        style={{
                          color: isSelected
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : theme.colors.ink,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Condition Section */}
            <View style={styles.filterSection}>
              <Text variant="mono" style={[styles.filterSectionTitle, { color: theme.colors.mute }]}>
                STATUS & CONDITION
              </Text>
              <View style={styles.filterOptionsGrid}>
                {CONDITION_FILTER_OPTIONS.map((opt) => {
                  const isSelected = conditionFilter === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      variant="chip"
                      haptic="select"
                      hitSlopToMin48
                      onPress={() => setConditionFilter(opt.value)}
                      style={[
                        styles.filterOptionPill,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(2, 132, 199, 0.18)' : '#e0f2fe')
                            : (isDark ? 'rgba(255, 255, 255, 0.04)' : theme.colors.canvas),
                          borderColor: isSelected
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : theme.colors.hairline,
                        },
                      ]}
                    >
                      {isSelected && <Check size={12} color={isDark ? '#38bdf8' : '#0284c7'} />}
                      <Text
                        variant={isSelected ? 'label' : 'caption'}
                        style={{
                          color: isSelected
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : theme.colors.ink,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3. Sort Order Section */}
            <View style={styles.filterSection}>
              <Text variant="mono" style={[styles.filterSectionTitle, { color: theme.colors.mute }]}>
                SORT ORDER
              </Text>
              <View style={styles.filterOptionsGrid}>
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      variant="chip"
                      haptic="select"
                      hitSlopToMin48
                      onPress={() => setSortBy(opt.value)}
                      style={[
                        styles.filterOptionPill,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(2, 132, 199, 0.18)' : '#e0f2fe')
                            : (isDark ? 'rgba(255, 255, 255, 0.04)' : theme.colors.canvas),
                          borderColor: isSelected
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : theme.colors.hairline,
                        },
                      ]}
                    >
                      {isSelected && <Check size={12} color={isDark ? '#38bdf8' : '#0284c7'} />}
                      <Text
                        variant={isSelected ? 'label' : 'caption'}
                        style={{
                          color: isSelected
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : theme.colors.ink,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Drawer Footer Actions */}
          <View style={[styles.drawerFooter, { borderTopColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated }]}>
            <Pressable
              variant="outline"
              haptic="tap"
              hitSlopToMin48
              onPress={handleResetFilters}
              style={[styles.modalSecondaryBtn, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
            >
              <Text variant="label" style={{ color: theme.colors.ink }}>
                Reset Filters
              </Text>
            </Pressable>
            <Pressable
              variant="primary"
              haptic="tap"
              hitSlopToMin48
              onPress={() => setIsFilterModalOpen(false)}
              style={[styles.modalPrimaryBtn, { backgroundColor: '#0284c7' }]}
            >
              <Text variant="label" style={{ color: '#ffffff' }}>
                Apply Filters
              </Text>
            </Pressable>
          </View>
        </View>
      </Drawer>
      )}

      {/* 4. Full-Featured Export & Print Modal (Web & Native Resilient) */}
      {showExportModal && (
        <OperationsExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          viewMode="operator"
          selectedEntityName={user?.full_name || 'Operator'}
          selectedMonthLabel={
            dateFilter === 'today'
              ? 'Today'
              : dateFilter === 'yesterday'
              ? 'Yesterday'
              : dateFilter === 'week'
              ? 'Past 7 Days'
              : dateFilter === 'month'
              ? 'This Month'
              : 'All Dates'
          }
          selectedMachineLabel={
            assignedMachine?.model
              ? `${assignedMachine.model}${assignedMachine.serial_number ? ` (SN: ${assignedMachine.serial_number})` : ''}`
              : undefined
          }
          totalRunningHours={summaryMetrics.totalRunningHours}
          totalOtHours={summaryMetrics.totalOtHours}
          totalBreakdowns={summaryMetrics.totalBreakdowns}
          supervisorName={user?.full_name || 'Operator'}
          logs={filteredLogs}
          fetchParams={{
            viewMode: 'operator',
            operatorId: user?.id,
            search,
            month:
              dateFilter === 'today'
                ? 'today'
                : dateFilter === 'yesterday'
                ? 'yesterday'
                : dateFilter === 'week'
                ? 'week'
                : dateFilter === 'month'
                ? 'month'
                : 'all',
            condition: conditionFilter,
            sort: sortBy === 'date_asc' ? 'date-asc' : 'date-desc',
          }}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: 110,
  },
  headerContainer: {
    marginBottom: 4,
  },
  listFooter: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listFooterText: {
    marginTop: 6,
  },
  listEndDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  endOfListText: {},
  headerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
  },
  headerSubtitle: {
    marginTop: 2,
  },
  headerActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCtaBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtn: {
    height: 38,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterBtnText: {
  },
  activeFilterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
  },
  activeFilterLabel: {
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  filterChipText: {
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 10,
  },
  emptySubtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  logsList: {
    gap: 10,
  },
  historyCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  timestampText: {},
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerEditBtn: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLockBtn: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  hoursBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  hoursBadgeText: {},
  cardMachineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  machineTitle: {},
  machineSerial: {},
  codePillSmall: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
  },
  codePillSmallText: {},
  cardClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  metaLabel: {},
  clientName: {},
  clientCity: {},
  cardHmrRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  hmrValue: {},
  hmrValueBold: {},
  dateValueBold: {},
  shiftBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
  },
  shiftBadgeText: {},
  otPill: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
  },
  otPillText: {},
  serialPill: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
  },
  metricsBox: {
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginVertical: 4,
  },
  metricItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hmrInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  breakdownSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  normalBadgeRow: {
    paddingVertical: 4,
  },
  breakdownNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  breakdownBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  drawerIconBox: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    padding: 16,
    gap: 16,
  },
  drawerFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  filterSection: {
    marginBottom: 14,
  },
  filterSectionTitle: {
    marginBottom: 8,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cachedErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  cachedErrorText: {
    flex: 1,
  },
  cachedRetryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.xs,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
});
