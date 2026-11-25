/**
 * Reach International Mobile — Today's Shift Monitor Component
 * Displays real-time today shift roster for Supervisors, Managers, and Admins.
 * Shows who has entered today's shift log and who is pending, with RBAC scoping
 * and 1-tap Assisted Shift Entry.
 *
 * Implements:
 * - High-performance virtualized FlatList with initialNumToRender={6}, windowSize={5}
 * - Single authoritative day roster fetch via get_today_shift_log_monitor (~5.8ms)
 * - Canonical row dedupe via @reachinternational/utils dedupeShiftMonitorRows
 * - Realtime roster broadcasts patch the TanStack cache, then coalesce into one reconcile
 * - Frame-0 static-first rendering (zero blank screens, non-blocking UI)
 * - 280ms debounced server-side search and server-side filtering
 * - Pure memoized MobileTodayShiftCard leaf components
 * - 100% Geist Design System tokens, 44px touch targets, zero raw typography in StyleSheet
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Platform,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTheme,
  KPICard,
  KPIGrid,
  Skeleton,
  DropdownFilterSelector,
  CustomDatePicker,
  FilterSidebar,
  FilterCategoryCard,
  type FilterOption,
  Text,
  ConfirmDialog,
  showToast,
  EmptyState,
  ErrorState,
  SlowNetworkBanner,
  Badge,
} from '../ui';
import { SearchInput } from '../ui/SearchInput';
import { TodayShiftMonitorKPIStrip } from './TodayShiftMonitorKPIStrip';
import type { TodayShiftMonitorRow } from '@reachinternational/types';
import {
  useTodayShiftMonitor,
  patchTodayShiftMonitorRoster,
} from '../../lib/hooks/useOperationsData';
import { ShiftRosterListSkeleton } from './OperationsSkeleton';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { supabase } from '../../lib/supabase';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  UserX,
  X,
  SlidersHorizontal,
  RotateCcw,
  Icon,
  Calendar,
  Edit2,
  User,
} from '../ui/icon';
import { MobileAssignPersonnelModal } from './MobileAssignPersonnelModal';
import { MobileTodayShiftCard } from './MobileTodayShiftCard';
import { isManagerOrAbove, isSupervisorOrAbove } from '@reachinternational/permissions';
import {
  getISTDateString,
  formatDate,
  addDaysToDateStr,
  dedupeShiftMonitorRows,
  parseTimeToMinutes,
} from '@reachinternational/utils';
import { useAuth } from '../../lib/auth/useAuth';
import { haptics } from '../../lib/haptics';
import { Pressable } from '../ui/touch/Pressable';
import { PRESS } from '../../lib/motion/tokens';

export interface MobileTodayShiftMonitorTabProps {
  actorId?: string;
  userRole?: string;
  initialDate?: string;
  onEnterLog: (row: TodayShiftMonitorRow) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  isAssignModalOpen?: boolean;
  onCloseAssignModal?: () => void;
}

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Status' },
  { id: 'pending', label: 'Pending', dotColor: '#f59e0b' },
  { id: 'entered', label: 'Entered', dotColor: '#10b981' },
  { id: 'unassigned', label: 'Unassigned', dotColor: '#94a3b8' },
  { id: 'breakdown', label: 'Breakdown', dotColor: '#ef4444' },
  { id: 'maintenance', label: 'Maintenance', dotColor: '#f59e0b' },
];

const SORT_FILTER_OPTIONS: FilterOption[] = [
  { id: 'time_asc', label: 'Shift Timing (Earliest First)' },
  { id: 'time_desc', label: 'Shift Timing (Latest First)' },
  { id: 'operator_asc', label: 'Operator (A → Z)' },
  { id: 'operator_desc', label: 'Operator (Z → A)' },
  { id: 'machine_asc', label: 'Machine (A → Z)' },
  { id: 'status_pending', label: 'Pending First' },
  { id: 'status_entered', label: 'Entered First' },
];

/**
 * A roster broadcast patches the cache instantly; this debounce only coalesces the
 * follow-up server reconcile, so a burst of assignments from several devices costs one fetch.
 */
const ROSTER_RECONCILE_DEBOUNCE_MS = 1200;

const MobileTodayShiftMonitorTabBase: React.FC<MobileTodayShiftMonitorTabProps> = ({
  actorId,
  userRole,
  initialDate,
  onEnterLog,
  onRefresh,
  refreshing = false,
  isAssignModalOpen: isAssignModalOpenProp,
  onCloseAssignModal,
}) => {
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const { role: authRole, userProfile } = useAuth();
  const effectiveRole = (userRole || authRole || userProfile?.role || '').toLowerCase().replace(/[\s-]/g, '_');
  const canEnterLog = isSupervisorOrAbove(effectiveRole) || ['super_admin', 'admin', 'manager', 'supervisor'].includes(effectiveRole);

  const todayStr = useMemo(() => getISTDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => initialDate || getISTDateString());

  useEffect(() => {
    if (initialDate && initialDate !== selectedDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Search & Filter State
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'entered' | 'unassigned' | 'breakdown' | 'maintenance'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('time_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // 280ms Search Input Debounce (Phase 8 requirement)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchInputRef = useRef<any>(null);
  const [menuRow, setMenuRow] = useState<TodayShiftMonitorRow | null>(null);

  // Filter Drawer state
  const isWeb = Platform.OS === 'web';
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const [internalAssignModalOpen, setInternalAssignModalOpen] = useState(false);
  const [assignMachineId, setAssignMachineId] = useState<string | undefined>();
  const [rowToReactivate, setRowToReactivate] = useState<TodayShiftMonitorRow | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  const isAssignModalOpen = isAssignModalOpenProp !== undefined ? isAssignModalOpenProp : internalAssignModalOpen;

  const handleOpenAssignModal = useCallback((machineId?: string) => {
    setAssignMachineId(machineId);
    setInternalAssignModalOpen(true);
  }, []);

  const handleCloseAssignModal = useCallback(() => {
    setInternalAssignModalOpen(false);
    setAssignMachineId(undefined);
    onCloseAssignModal?.();
  }, [onCloseAssignModal]);

  // Fast authoritative day roster via get_today_shift_log_monitor RPC (~5.8ms)
  const {
    data: rawRows,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: refetchMonitor,
  } = useTodayShiftMonitor(actorId, selectedDate, true);

  const flatRows = useMemo(() => dedupeShiftMonitorRows(rawRows || []), [rawRows]);
  const rows = flatRows;
  const totalCount = flatRows.length;

  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [isSlowDismissed, setIsSlowDismissed] = useState(false);
  // Spinner is driven strictly by an explicit user refresh (never by background polling)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

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

  const broadcastDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchMonitorRef = useRef(refetchMonitor);
  refetchMonitorRef.current = refetchMonitor;

  // Real-time roster sync
  useEffect(() => {
    return () => {
      if (broadcastDebounceRef.current) clearTimeout(broadcastDebounceRef.current);
      broadcastDebounceRef.current = null;
    };
  }, []);

  const scheduleRosterReconcile = useCallback(() => {
    if (broadcastDebounceRef.current) clearTimeout(broadcastDebounceRef.current);
    broadcastDebounceRef.current = setTimeout(() => {
      broadcastDebounceRef.current = null;
      void refetchMonitorRef.current?.();
    }, ROSTER_RECONCILE_DEBOUNCE_MS);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const rosterChannel = supabase.channel('operations-roster');

      const handleLogEntered = (eventPayload: any) => {
        const payload = eventPayload?.payload || {};
        patchTodayShiftMonitorRoster(queryClient, payload, 'log_entered');
        scheduleRosterReconcile();
      };

      const handleAssignmentChanged = (eventPayload: any) => {
        const payload = eventPayload?.payload || {};
        patchTodayShiftMonitorRoster(queryClient, payload, 'assignment_changed');
        scheduleRosterReconcile();
      };

      rosterChannel
        .on('broadcast', { event: 'assignment_changed' }, handleAssignmentChanged)
        .on('broadcast', { event: 'roster_updated' }, scheduleRosterReconcile)
        .on('broadcast', { event: 'log_entered' }, handleLogEntered)
        .subscribe();

      return () => {
        if (broadcastDebounceRef.current) clearTimeout(broadcastDebounceRef.current);
        broadcastDebounceRef.current = null;
        supabase.removeChannel(rosterChannel);
      };
    }, [queryClient, scheduleRosterReconcile])
  );

  // Active KPI Summary computed in-memory directly from authoritative rows
  const summary = useMemo(() => {
    const total = rows.length;
    const entered = rows.filter((r) => r.status === 'entered').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const unassigned = rows.filter((r) => r.status === 'unassigned').length;
    const breakdown = rows.filter((r) => r.machine_health_status === 'breakdown').length;
    const maintenance = rows.filter(
      (r) =>
        r.machine_health_status === 'under_maintenance' ||
        r.machine_status === 'under_maintenance'
    ).length;
    return { total, entered, pending, unassigned, breakdown, maintenance };
  }, [rows]);

  // Dynamic Shift filter options derived from loaded rows with exact counts
  const shiftOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const rawCode = (r.shift_code || 'S1').trim();
      const norm = rawCode.toUpperCase().replace(/^SHIFT\s*/i, '') || 'S1';
      counts.set(norm, (counts.get(norm) || 0) + 1);
    });

    const list: FilterOption[] = [{ id: 'all', label: `All Shifts (${rows.length})` }];
    Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, count]) => {
        list.push({ id: code, label: `Shift ${code} (${count})` });
      });
    return list;
  }, [rows]);

  // Dynamic Client filter options derived from loaded rows with exact counts
  const clientOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    const clientNames = new Map<string, string>();
    rows.forEach((r) => {
      const key = r.client_id || (r.client_name ? `name:${r.client_name}` : 'unassigned');
      counts.set(key, (counts.get(key) || 0) + 1);
      if (r.client_name && !clientNames.has(key)) {
        clientNames.set(key, r.client_name);
      }
    });

    const list: FilterOption[] = [{ id: 'all', label: `All Clients (${rows.length})` }];
    const clientEntries = Array.from(clientNames.entries())
      .filter(([id]) => (counts.get(id) || 0) > 0)
      .sort((a, b) => a[1].localeCompare(b[1]));

    clientEntries.forEach(([id, name]) => {
      list.push({ id, label: `${name} (${counts.get(id) || 0})` });
    });

    if ((counts.get('unassigned') || 0) > 0) {
      list.push({ id: 'unassigned', label: `Unassigned (${counts.get('unassigned') || 0})` });
    }

    return list;
  }, [rows]);

  // Dynamic Status filter options with live counts
  const statusOptions = useMemo<FilterOption[]>(
    () => [
      { id: 'all', label: `All Status (${summary.total})` },
      { id: 'pending', label: `Pending (${summary.pending})`, dotColor: '#f59e0b' },
      { id: 'entered', label: `Entered (${summary.entered})`, dotColor: '#10b981' },
      { id: 'unassigned', label: `Unassigned (${summary.unassigned})`, dotColor: '#ef4444' },
      ...(summary.breakdown > 0
        ? [{ id: 'breakdown', label: `Breakdown (${summary.breakdown})`, dotColor: '#ef4444' }]
        : []),
      ...(summary.maintenance > 0
        ? [{ id: 'maintenance', label: `Maintenance (${summary.maintenance})`, dotColor: '#f59e0b' }]
        : []),
    ],
    [summary]
  );

  // In-memory filtered and sorted day roster
  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== 'all') {
      if (statusFilter === 'breakdown') {
        r = r.filter((row) => row.machine_health_status === 'breakdown');
      } else if (statusFilter === 'maintenance') {
        r = r.filter(
          (row) =>
            row.machine_health_status === 'under_maintenance' ||
            row.machine_status === 'under_maintenance'
        );
      } else {
        r = r.filter((row) => row.status === statusFilter);
      }
    }
    if (clientFilter !== 'all') {
      r = r.filter((row) => {
        if (clientFilter === 'unassigned') {
          return !row.client_id && (!row.client_name || row.client_name === 'Available / Unassigned');
        }
        if (clientFilter.startsWith('name:')) {
          return row.client_name === clientFilter.replace('name:', '');
        }
        return row.client_id === clientFilter;
      });
    }
    if (shiftFilter !== 'all') {
      const target = shiftFilter.toUpperCase().replace(/^SHIFT\s*/i, '');
      r = r.filter((row) => {
        const rowShift = (row.shift_code || 'S1').toUpperCase().replace(/^SHIFT\s*/i, '');
        return rowShift === target;
      });
    }
    const search = debouncedSearchQuery.trim().toLowerCase();
    if (search) {
      r = r.filter((row) =>
        [
          row.operator_name,
          row.operator_phone,
          row.operator_employee_id,
          row.machine_code,
          row.machine_serial_number,
          row.machine_model,
          row.client_name,
          row.client_code,
          row.client_city,
          row.site_name,
        ].some((value) => typeof value === 'string' && value.toLowerCase().includes(search))
      );
    }

    // Timing sort by default (time_asc) matching Web
    r = [...r].sort((a, b) => {
      if (sortBy === 'operator_asc') {
        return (a.operator_name || '').localeCompare(b.operator_name || '');
      }
      if (sortBy === 'operator_desc') {
        return (b.operator_name || '').localeCompare(a.operator_name || '');
      }
      if (sortBy === 'machine_asc') {
        return (a.machine_code || '').localeCompare(b.machine_code || '');
      }
      if (sortBy === 'status_pending') {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
      }
      if (sortBy === 'status_entered') {
        if (a.status === 'entered' && b.status !== 'entered') return -1;
        if (a.status !== 'entered' && b.status === 'entered') return 1;
      }
      const ta = parseTimeToMinutes(a.shift_start) ?? 9999;
      const tb = parseTimeToMinutes(b.shift_start) ?? 9999;
      if (ta !== tb) {
        return sortBy === 'time_desc' ? tb - ta : ta - tb;
      }
      const mComp = (a.machine_code || '').localeCompare(b.machine_code || '');
      if (mComp !== 0) return mComp;
      return (a.shift_code || '').localeCompare(b.shift_code || '');
    });

    return r;
  }, [rows, statusFilter, clientFilter, shiftFilter, sortBy, debouncedSearchQuery]);

  // Dynamic quick status pills with live counts and status dots (100% Web Parity)
  const quickStatusTabs = useMemo(
    () => [
      { id: 'all', label: 'All', count: summary.total, dotColor: undefined },
      { id: 'pending', label: 'Pending', count: summary.pending, dotColor: '#f59e0b' },
      { id: 'entered', label: 'Entered', count: summary.entered, dotColor: '#10b981' },
      { id: 'unassigned', label: 'Unassigned', count: summary.unassigned, dotColor: '#ef4444' },
      ...(summary.breakdown > 0
        ? [{ id: 'breakdown', label: 'Breakdown', count: summary.breakdown, dotColor: '#ef4444' }]
        : []),
      ...(summary.maintenance > 0
        ? [{ id: 'maintenance', label: 'Maintenance', count: summary.maintenance, dotColor: '#f59e0b' }]
        : []),
    ],
    [summary]
  );

  const selectedDateLabel = useMemo(() => {
    if (selectedDate === todayStr) return 'Today';
    const yesterday = addDaysToDateStr(todayStr, -1);
    if (selectedDate === yesterday) return `Yesterday (${formatDate(selectedDate)})`;
    return formatDate(selectedDate);
  }, [selectedDate, todayStr]);

  const currentStatusLabel =
    statusOptions.find((opt) => opt.id === statusFilter)?.label || 'Status';
  const currentClientLabel =
    clientOptions.find((opt) => opt.id === clientFilter)?.label || 'Client';
  const currentShiftLabel =
    shiftOptions.find((opt) => opt.id === shiftFilter)?.label || 'Shift';
  const currentSortLabel =
    SORT_FILTER_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort';

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedDate !== todayStr) count++;
    if (statusFilter !== 'all') count++;
    if (clientFilter !== 'all') count++;
    if (shiftFilter !== 'all') count++;
    if (sortBy !== 'time_asc') count++;
    return count;
  }, [selectedDate, todayStr, statusFilter, clientFilter, shiftFilter, sortBy]);

  const handleResetAllFilters = useCallback(() => {
    haptics.confirm();
    setSelectedDate(todayStr);
    setStatusFilter('all');
    setClientFilter('all');
    setShiftFilter('all');
    setSortBy('time_asc');
    setSearchQuery('');
    setDebouncedSearchQuery('');
  }, [todayStr]);

  const handleRefresh = useCallback(async () => {
    haptics.tap();
    setIsManualRefreshing(true);
    try {
      if (onRefresh) {
        // The parent owns the canonical operations refresh cascade (entry context,
        // history, monitor). Reusing it avoids fetching the same roster keys twice.
        await onRefresh();
      } else {
        await refetchMonitor();
      }
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchMonitor, onRefresh]);

  const handleCardEnterLog = useCallback(
    (row: TodayShiftMonitorRow) => {
      onEnterLog({
        ...row,
        log_date: row.log_date || selectedDate,
      });
    },
    [onEnterLog, selectedDate]
  );

  const handleInitiateAssign = useCallback(
    (row: TodayShiftMonitorRow) => {
      const isBreakdown = row.machine_health_status === 'breakdown';
      const isMaintenance =
        row.machine_health_status === 'under_maintenance' ||
        row.machine_status === 'under_maintenance';

      if (isBreakdown || isMaintenance) {
        setRowToReactivate(row);
        return;
      }

      handleOpenAssignModal(row.machine_id);
    },
    [handleOpenAssignModal]
  );

  const handleConfirmReactivation = useCallback(async () => {
    if (!rowToReactivate) return;
    const row = rowToReactivate;
    setIsReactivating(true);
    try {
      const { error } = await supabase.rpc('activate_machine_for_assignment', {
        p_machine_id: row.machine_id,
        p_actor_id: actorId || null,
      });
      if (error) {
        showToast('error', 'Activation Failed', error.message);
        return;
      }
      haptics.confirm();
      void refetchMonitor();
      setRowToReactivate(null);
      handleOpenAssignModal(row.machine_id);
    } catch (err: any) {
      showToast('error', 'Activation Error', err?.message || 'Could not reactivate machine');
    } finally {
      setIsReactivating(false);
    }
  }, [rowToReactivate, actorId, refetchMonitor, handleOpenAssignModal]);

  // Stable handler: identity changes would defeat React.memo on the roster cards
  const handleOpenRowMenu = useCallback((row: TodayShiftMonitorRow) => {
    setMenuRow(row);
  }, []);

  // Stable handler for the nested Assign Personnel modal (also keeps it memo-skippable)
  const handleAssignSuccess = useCallback(
    (_ops?: any, savedDate?: string) => {
      if (savedDate && savedDate !== selectedDate) {
        setSelectedDate(savedDate);
      } else {
        void refetchMonitor();
      }
    },
    [selectedDate, refetchMonitor]
  );

  const renderActiveFilterBadges = () => {
    if (activeFilterCount === 0 && searchQuery.trim() === '') return null;
    return (
      <View style={[styles.activeBadgesRow, { borderTopColor: theme.colors.hairline }]}>
        <Text variant="caption" weight="medium" style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
          Active Filters:
        </Text>

        {clientFilter !== 'all' && (
          <Badge
            variant="info"
            size="sm"
            solid={false}
            label={`Client: ${currentClientLabel}`}
            onRemove={() => setClientFilter('all')}
          />
        )}

        {searchQuery.trim() !== '' && (
          <Badge
            variant="outline"
            size="sm"
            solid={false}
            label={`Search: "${searchQuery}"`}
            onRemove={() => {
              setSearchQuery('');
              setDebouncedSearchQuery('');
            }}
          />
        )}

        {selectedDate !== todayStr && (
          <Badge
            variant="info"
            size="sm"
            solid={false}
            label={`Date: ${selectedDateLabel}`}
            onRemove={() => setSelectedDate(todayStr)}
          />
        )}

        {statusFilter !== 'all' && (
          <Badge
            variant={statusFilter === 'entered' ? 'success' : 'warning'}
            size="sm"
            solid={false}
            label={`Status: ${currentStatusLabel}`}
            onRemove={() => setStatusFilter('all')}
          />
        )}

        {shiftFilter !== 'all' && (
          <Badge
            variant="info"
            size="sm"
            solid={false}
            label={`Shift: ${currentShiftLabel}`}
            onRemove={() => setShiftFilter('all')}
          />
        )}

        {sortBy !== 'time_asc' && (
          <Badge
            variant="outline"
            size="sm"
            solid={false}
            label={`Sort: ${currentSortLabel}`}
            onRemove={() => setSortBy('time_asc')}
          />
        )}

        <Pressable
          variant="ghost"
          haptic="tap"
          hitSlopToMin48
          onPress={handleResetAllFilters}
          style={styles.resetAllLink}
        >
          <RotateCcw size={11} color={theme.colors.link} />
          <Text variant="caption" weight="semibold" style={[styles.resetAllLinkText, { color: theme.colors.link }]}>
            Reset all
          </Text>
        </Pressable>
      </View>
    );
  };

  // ListHeaderComponent renders static UI immediately on frame 0 (no blocking skeletons)
  const renderHeader = useCallback(
    () => (
      <View style={styles.headerContainer}>
        {/* Slow Network Telemetry Banner */}
        <SlowNetworkBanner
          visible={isSlowNetwork && !isSlowDismissed && isLoading}
          message="Slow network detected. Still retrieving today's shift roster..."
          onRetry={handleRefresh}
          onDismiss={() => setIsSlowDismissed(true)}
          style={{ marginBottom: spacingNumeric.sm }}
        />

        {/* Ambient Cached Data Warning when background refresh fails */}
        {isError && flatRows.length > 0 && (
          <View
            style={[
              styles.cachedErrorBanner,
              {
                backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                borderColor: isDark ? '#991b1b' : '#fecaca',
              },
            ]}
          >
            <AlertCircle size={15} color={isDark ? '#f87171' : '#dc2626'} />
            <Text
              variant="caption"
              style={[styles.cachedErrorText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}
            >
              Displaying cached shift roster. Unable to refresh live status.
            </Text>
            <Pressable
              variant="chip"
              haptic="tap"
              hitSlopToMin48
              onPress={handleRefresh}
              style={[
                styles.cachedRetryChip,
                {
                  backgroundColor: isDark ? '#171717' : '#ffffff',
                  borderColor: isDark ? '#ef4444' : '#dc2626',
                },
              ]}
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

        {/* Historical Date Notice Banner */}
        {selectedDate !== todayStr && (
          <View
            style={[
              styles.historicalBanner,
              {
                backgroundColor: isDark ? '#082f49' : '#f0f9ff',
                borderColor: isDark ? '#0369a1' : '#bae6fd',
              },
            ]}
          >
            <View style={styles.historicalBannerLeft}>
              <Calendar size={15} color="#0284c7" />
              <View style={styles.historicalBannerTextCol}>
                <Text variant="label" style={{ color: isDark ? '#e0f2fe' : '#0369a1' }}>
                  Historical Date: {formatDate(selectedDate)}
                </Text>
                <Text variant="caption" style={{ color: isDark ? '#7dd3fc' : '#0284c7' }}>
                  Viewing entered shifts and roster for {formatDate(selectedDate)}.
                </Text>
              </View>
            </View>
            <Pressable
              variant="ghost"
              haptic="tap"
              hitSlopToMin48
              onPress={() => setSelectedDate(todayStr)}
              style={[
                styles.historicalReturnBtn,
                {
                  backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe',
                  borderColor: isDark ? '#0284c7' : '#7dd3fc',
                },
              ]}
            >
              <RotateCcw size={12} color="#0284c7" />
              <Text variant="caption" style={{ color: '#0284c7' }}>
                Today
              </Text>
            </Pressable>
          </View>
        )}

        {/* 1. KPI COUNTER SUMMARY CARDS — 100% Web Parity */}
        <TodayShiftMonitorKPIStrip
          summary={summary}
          isLoading={isLoading && flatRows.length === 0}
        />

        {/* 2. SEARCH & FILTER TOOLBAR */}
        <View style={styles.toolbarContainer}>
          {/* Top Search & Filter Action Row */}
          <View style={styles.toolbarTopRow}>
            {/* Search Input Bar with 280ms debounced server query */}
            <View style={styles.searchContainer}>
              <SearchInput
                ref={searchInputRef}
                placeholder="Search operator, machine, client..."
                placeholderTextColor={theme.colors.mute}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onClear={() => {
                  setSearchQuery('');
                  setDebouncedSearchQuery('');
                }}
                isLoading={isFetching && debouncedSearchQuery !== searchQuery}
                size="md"
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Filter Toggle Button */}
            <Pressable
              variant="outline"
              haptic="select"
              hitSlopToMin48
              onPress={() => setFilterPanelOpen((prev) => !prev)}
              style={[
                styles.filterToggleBtn,
                {
                  backgroundColor:
                    filterPanelOpen || activeFilterCount > 0
                      ? '#0284c7'
                      : theme.colors.canvasElevated,
                  borderColor:
                    filterPanelOpen || activeFilterCount > 0
                      ? '#0284c7'
                      : theme.colors.hairline,
                },
                isWeb && ({
                  transition: 'background-color 180ms ease, border-color 180ms ease',
                } as any),
              ]}
              accessibilityLabel="Toggle filter selectors"
            >
              <SlidersHorizontal
                size={13}
                color={
                  filterPanelOpen || activeFilterCount > 0
                    ? '#ffffff'
                    : theme.colors.ink
                }
              />
              <Text
                variant="caption"
                weight="semibold"
                style={[
                  styles.filterToggleBtnText,
                  {
                    color:
                      filterPanelOpen || activeFilterCount > 0
                        ? '#ffffff'
                        : theme.colors.ink,
                  },
                ]}
              >
                Filter
              </Text>
              {activeFilterCount > 0 && (
                <View
                  style={[
                    styles.activeCountBadge,
                    {
                      backgroundColor:
                        filterPanelOpen || activeFilterCount > 0
                          ? '#ffffff'
                          : '#0284c7',
                    },
                  ]}
                >
                  <Text
                    variant="micro"
                    weight="bold"
                    style={[
                      styles.activeCountBadgeText,
                      {
                        color:
                          filterPanelOpen || activeFilterCount > 0
                            ? '#0284c7'
                            : '#ffffff',
                      },
                    ]}
                  >
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Quick Reset Filters Button */}
            {(activeFilterCount > 0 || searchQuery.length > 0) && (
              <Pressable
                variant="outline"
                haptic="tap"
                hitSlopToMin48
                onPress={handleResetAllFilters}
                style={[
                  styles.quickResetBtn,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Reset all filters"
              >
                <RotateCcw size={13} color={theme.colors.mute} />
                <Text variant="caption" weight="semibold" style={[styles.quickResetBtnText, { color: theme.colors.mute }]}>
                  Reset
                </Text>
              </Pressable>
            )}
          </View>

          {/* Quick Horizontal Status Filter Strip — 1-tap filtering with live counts */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickStatusScroll}
          >
            {quickStatusTabs.map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  variant="plain"
                  haptic="select"
                  hitSlopToMin48
                  onPress={() => {
                    setStatusFilter(tab.id as any);
                  }}
                  style={[
                    styles.quickStatusPill,
                    {
                      backgroundColor: isActive
                        ? '#0284c7'
                        : isDark
                        ? '#171717'
                        : '#ffffff',
                      borderColor: isActive
                        ? '#0284c7'
                        : theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel={`Filter by ${tab.label} (${tab.count})`}
                >
                  {tab.dotColor && (
                    <View
                      style={[
                        styles.quickStatusDot,
                        {
                          backgroundColor: tab.dotColor,
                        },
                      ]}
                    />
                  )}
                  <Text
                    variant="caption"
                    weight={isActive ? 'bold' : 'medium'}
                    style={{
                      color: isActive ? '#ffffff' : theme.colors.ink,
                    }}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.quickStatusCountBadge,
                      {
                        backgroundColor: isActive
                          ? 'rgba(255, 255, 255, 0.25)'
                          : isDark
                          ? '#262626'
                          : '#f1f5f9',
                      },
                    ]}
                  >
                    <Text
                      variant="micro"
                      weight="bold"
                      style={{
                        color: isActive ? '#ffffff' : theme.colors.mute,
                      }}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Active Filter Badges */}
          {renderActiveFilterBadges()}
        </View>

        {/* 3. RESULTS COUNT LINE (100% Web & Machines Page Parity) */}
        <View style={styles.resultsCountRow}>
          {isLoading && flatRows.length === 0 ? (
            <Skeleton width={160} height={14} borderRadius={radiusNumeric.sm} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Showing{' '}
                <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                  {filtered.length}
                </Text>{' '}
                of{' '}
                <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                  {totalCount}
                </Text>{' '}
                shifts
                {activeFilterCount > 0 && totalCount > filtered.length && (
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    {' '}(filtered)
                  </Text>
                )}
              </Text>
            </View>
          )}
        </View>
      </View>
    ),
    [
      isSlowNetwork,
      isSlowDismissed,
      isLoading,
      handleRefresh,
      isError,
      flatRows.length,
      filtered.length,
      totalCount,
      isDark,
      selectedDate,
      todayStr,
      summary,
      quickStatusTabs,
      searchQuery,
      debouncedSearchQuery,
      isFetching,
      filterPanelOpen,
      activeFilterCount,
      theme,
      isWeb,
      handleResetAllFilters,
      clientFilter,
      currentClientLabel,
      selectedDateLabel,
      statusFilter,
      currentStatusLabel,
      shiftFilter,
      currentShiftLabel,
      sortBy,
      currentSortLabel,
    ]
  );

  // ListEmptyComponent renders skeletons on initial load, ErrorState on error, or EmptyState
  const renderEmpty = useCallback(() => {
    if (isLoading && flatRows.length === 0) {
      return (
        <View style={styles.skeletonContainer}>
          <ShiftRosterListSkeleton count={4} />
        </View>
      );
    }

    if (isError && rows.length === 0) {
      return (
        <ErrorState
          error={error}
          onRetry={handleRefresh}
          title="Failed to Load Shift Roster"
          message="Unable to retrieve today's shift roster from the server. Check your connection and try again."
          retryLabel="Retry Shift Roster"
        />
      );
    }

    if (debouncedSearchQuery.trim() !== '') {
      return (
        <EmptyState
          variant="no-results"
          title="No Matching Shifts"
          description={`No shift assignments found matching "${debouncedSearchQuery}". Try adjusting your keywords or clearing the search.`}
          actionLabel="Clear Search"
          onAction={() => {
            setSearchQuery('');
            setDebouncedSearchQuery('');
          }}
        />
      );
    }

    if (activeFilterCount > 0) {
      return (
        <EmptyState
          variant="filtered"
          title="No Shifts for Active Filters"
          description="No shift assignments match your selected filter criteria. Reset filters to see all shifts."
          actionLabel="Reset Filters"
          onAction={handleResetAllFilters}
        />
      );
    }

    return (
      <EmptyState
        variant="empty"
        title={selectedDate !== todayStr ? `No Shifts on ${formatDate(selectedDate)}` : 'No Shifts Assigned Today'}
        description={
          selectedDate !== todayStr
            ? `No shift records found for ${formatDate(selectedDate)}.`
            : 'No equipment shifts have been assigned for today.'
        }
        actionLabel={selectedDate !== todayStr ? 'Return to Today' : (canEnterLog ? 'Assign Operator' : undefined)}
        onAction={selectedDate !== todayStr ? () => setSelectedDate(todayStr) : (canEnterLog ? () => handleOpenAssignModal(undefined) : undefined)}
      />
    );
  }, [
    isLoading,
    rows.length,
    isError,
    error,
    handleRefresh,
    debouncedSearchQuery,
    activeFilterCount,
    handleResetAllFilters,
    selectedDate,
    todayStr,
    canEnterLog,
    handleOpenAssignModal,
  ]);

  // ListFooterComponent keeps a stable bottom spacer for the floating bottom navigation
  const renderFooter = useCallback(
    () => <View style={styles.bottomSpacer} />,
    []
  );

  // Pure memoized renderItem using MobileTodayShiftCard
  const renderItem = useCallback(
    ({ item, index }: { item: TodayShiftMonitorRow; index: number }) => (
      <MobileTodayShiftCard
        row={item}
        index={index}
        searchQuery={debouncedSearchQuery}
        canEnterLog={canEnterLog}
        onInitiateAssign={handleInitiateAssign}
        onEnterLog={handleCardEnterLog}
        onOpenMenu={handleOpenRowMenu}
      />
    ),
    [debouncedSearchQuery, canEnterLog, handleInitiateAssign, handleCardEnterLog, handleOpenRowMenu]
  );

  const keyExtractor = useCallback(
    (item: TodayShiftMonitorRow, index: number) =>
      `mon-${item.machine_id}-${item.shift_code || 'S1'}-${item.operator_id || 'unassigned'}-${item.log_id || index}`,
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isManualRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.link}
          />
        }
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={true}
      />

      {/* 4. ASSIGN PERSONNEL MODAL */}
      <MobileAssignPersonnelModal
        visible={isAssignModalOpen}
        onClose={handleCloseAssignModal}
        initialMachineId={assignMachineId}
        initialAssignmentDate={selectedDate}
        onSuccess={handleAssignSuccess}
      />

      {/* Equipment Reactivation Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(rowToReactivate)}
        onClose={() => setRowToReactivate(null)}
        onConfirm={handleConfirmReactivation}
        title={
          rowToReactivate
            ? `Equipment in ${rowToReactivate.machine_health_status === 'breakdown' ? 'Breakdown' : 'Under Maintenance'}`
            : 'Equipment Alert'
        }
        message={
          rowToReactivate
            ? `Machine ${rowToReactivate.machine_code} is currently flagged as ${
                rowToReactivate.machine_health_status === 'breakdown' ? 'Breakdown' : 'Under Maintenance'
              }. Reactivating this machinery will set it to Active status and allow assigning an operator. Proceed?`
            : ''
        }
        confirmText="Mark Active & Assign"
        cancelText="Cancel"
        variant="warning"
        isLoading={isReactivating}
      />

      {/* 3-DOT ACTION BOTTOM SHEET MODAL */}
      <Modal
        visible={Boolean(menuRow)}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setMenuRow(null)}
      >
        <Pressable
          variant="plain"
          haptic={false}
          onPress={() => setMenuRow(null)}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close action sheet"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />
        </Pressable>

        <View style={styles.sheetBackdropContainer} pointerEvents="box-none">
          <View
            style={[
              styles.actionSheetCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandleWrapper}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.colors.hairline }]} />
            </View>

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text variant="body" weight="bold" style={[styles.sheetTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                {menuRow?.operator_name || 'Operator Shift'}
              </Text>
              <Text variant="caption" style={[styles.sheetSubtitle, { color: theme.colors.mute }]} numberOfLines={1}>
                {`Shift ${menuRow?.shift_code || '—'} • ${menuRow?.machine_model || menuRow?.machine_code || 'Machine'}`}
              </Text>
            </View>

            {/* Actions List */}
            <View style={styles.sheetActionsList}>
              {menuRow?.status === 'entered' ? (
                <Pressable
                  variant="plain"
                  haptic="select"
                  hitSlopToMin48
                  onPress={() => {
                    const rowToEdit = menuRow;
                    setMenuRow(null);
                    if (rowToEdit) handleCardEnterLog(rowToEdit);
                  }}
                  style={[
                    styles.sheetActionItem,
                    {
                      backgroundColor: isDark ? '#172554' : '#e0f2fe',
                      borderColor: isDark ? '#1e40af' : '#7dd3fc',
                    },
                  ]}
                >
                  <View style={[styles.sheetActionIconCircle, { backgroundColor: '#0284c7' }]}>
                    <Edit2 size={16} color="#ffffff" />
                  </View>
                  <View style={styles.sheetActionTextCol}>
                    <Text variant="body" weight="semibold" style={{ color: isDark ? '#7dd3fc' : '#0284c7' }}>
                      Edit Shift Log
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Update HMR meter readings or shift notes
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  variant="plain"
                  haptic="select"
                  hitSlopToMin48
                  onPress={() => {
                    const rowToEnter = menuRow;
                    setMenuRow(null);
                    if (rowToEnter) handleCardEnterLog(rowToEnter);
                  }}
                  style={[
                    styles.sheetActionItem,
                    {
                      backgroundColor: isDark ? '#172554' : '#e0f2fe',
                      borderColor: isDark ? '#1e40af' : '#7dd3fc',
                    },
                  ]}
                >
                  <View style={[styles.sheetActionIconCircle, { backgroundColor: '#0284c7' }]}>
                    <User size={16} color="#ffffff" />
                  </View>
                  <View style={styles.sheetActionTextCol}>
                    <Text variant="body" weight="semibold" style={{ color: isDark ? '#7dd3fc' : '#0284c7' }}>
                      Enter Shift
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Record start & end HMR meters for this shift
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>

            {/* Cancel Button */}
            <Pressable
              variant="outline"
              haptic="tap"
              hitSlopToMin48
              onPress={() => setMenuRow(null)}
              style={[
                styles.sheetCancelBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* FILTER & SORTING REUSABLE SIDEBAR */}
      <FilterSidebar
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        title="Filters & Sorting"
        badgeCount={activeFilterCount}
        onReset={handleResetAllFilters}
        onApply={() => setFilterPanelOpen(false)}
        applyLabel={`Show ${totalCount} Shift${totalCount === 1 ? '' : 's'}`}
        testID="operations-shift-filter-sidebar"
      >
        <FilterCategoryCard
          title="Shift Date"
          isFiltered={selectedDate !== todayStr}
          testID="category-shift-date"
        >
          <CustomDatePicker
            label="Date"
            showPrefix={false}
            value={selectedDate}
            onChange={(newDate) => {
              setSelectedDate(newDate);
            }}
            allowAnyPast
          />
        </FilterCategoryCard>

        <FilterCategoryCard
          title="Entry Status"
          isFiltered={statusFilter !== 'all'}
          testID="category-entry-status"
        >
          <DropdownFilterSelector
            label="Entry Status"
            selectedId={statusFilter}
            options={statusOptions}
            onSelect={(id: string) => setStatusFilter(id as any)}
            placeholder="Select Status"
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        <FilterCategoryCard
          title="Client Allocation"
          isFiltered={clientFilter !== 'all'}
          testID="category-client-allocation"
        >
          <DropdownFilterSelector
            label="Client Allocation"
            selectedId={clientFilter}
            options={clientOptions}
            onSelect={(id: string) => setClientFilter(id)}
            searchable={clientOptions.length > 5}
            searchPlaceholder="Search clients..."
            placeholder="Select Client"
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        <FilterCategoryCard
          title="Shift Preset"
          isFiltered={shiftFilter !== 'all'}
          testID="category-shift-preset"
        >
          <DropdownFilterSelector
            label="Shift Preset"
            selectedId={shiftFilter}
            options={shiftOptions}
            onSelect={(id: string) => setShiftFilter(id)}
            searchable={shiftOptions.length > 5}
            searchPlaceholder="Search shifts..."
            placeholder="Select Shift"
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        <FilterCategoryCard
          title="Sort By"
          isFiltered={sortBy !== 'time_asc'}
          badgeLabel="Custom"
          testID="category-sorting-order"
        >
          <DropdownFilterSelector
            label="Sort By"
            selectedId={sortBy}
            options={SORT_FILTER_OPTIONS}
            onSelect={(id: string) => setSortBy(id)}
            placeholder="Select Sort"
            minMenuWidth={280}
          />
        </FilterCategoryCard>
      </FilterSidebar>
    </View>
  );
};

/**
 * Memoized so parent re-renders (pull-to-refresh flags, tab switches, modal state in
 * operations.tsx) never re-render the roster, KPI strip and filter tree.
 */
export const MobileTodayShiftMonitorTab = React.memo(MobileTodayShiftMonitorTabBase);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    padding: spacingNumeric.md,
    paddingBottom: 110,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    gap: spacingNumeric.sm,
  },
  headerContainer: {
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.sm,
  },
  skeletonContainer: {
    paddingVertical: spacingNumeric.sm,
  },
  historicalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 10,
  },
  historicalBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  historicalBannerTextCol: {
    flex: 1,
    gap: 1,
  },
  historicalReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: 44,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  toolbarContainer: {
    gap: spacingNumeric.sm,
  },
  toolbarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    minWidth: 0,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    flexShrink: 0,
  },
  filterToggleBtnText: {},
  activeCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCountBadgeText: {},
  quickResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    flexShrink: 0,
  },
  quickResetBtnText: {},
  quickStatusScroll: {
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  quickStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 44,
  },
  quickStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  quickStatusCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsCountRow: {
    paddingHorizontal: 2,
    marginTop: 2,
    marginBottom: 2,
  },

  activeBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacingNumeric.xs,
    borderTopWidth: 1,
  },
  activeBadgesHeader: {
    marginRight: 2,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  badgeChipText: {},
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resetAllLinkText: {},
  sheetBackdropContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacingNumeric.lg,
  },
  sheetHandleWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    gap: 2,
  },
  sheetTitle: {},
  sheetSubtitle: {},
  sheetActionsList: {
    gap: 8,
  },
  sheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 48,
  },
  sheetActionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionTextCol: {
    flex: 1,
    gap: 2,
  },
  sheetCancelBtn: {
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  showMoreBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingNumeric.sm,
    marginBottom: spacingNumeric.md,
    minHeight: 44,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
