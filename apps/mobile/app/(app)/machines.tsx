import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  BackHandler,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Redirect, useLocalSearchParams } from 'expo-router';
import {
  useTheme,
  MobileHeader,
  Skeleton,
  HeaderActionItem,
  Text,
  useToast,
  EmptyState,
  ErrorState,
  SlowNetworkBanner,
} from '../../components/ui';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { MobileMachineCard } from '../../components/machines/MobileMachineCard';
import { Pressable } from '../../components/ui/touch/Pressable';
import { MachineDetailView } from '../../components/machines/MachineDetailView';
import {
  MachineImportModal,
  MachineExportModal,
  DeleteMachineDialog,
  MachineCategoryModal,
  MobileMachineListSkeleton,
  MachineKPIStrip,
  MachineFilterPanel,
  MachineFilterSidebar,
  type FilterOption,
} from '../../components/machines';
import { MachineModal } from '../../components/machines/MachineModal';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { useScreenSync } from '../../lib/offline';
import { haptics } from '../../lib/haptics';
import { sanitizeDatabaseError } from '@reachinternational/utils';
import {
  MACHINE_CAPABILITIES,
  canAccessMachinesRoute,
  getMachineScope,
  getMobileRoleHomeRoute,
  hasMachineCapability,
  isOperatorMachineView,
} from '@reachinternational/permissions';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Plus,
  RotateCcw,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  FolderTree,
} from '../../components/ui/icon';
import {
  useMachinesData,
  MACHINE_SELECT_COLUMNS,
  type RentalFilterType,
  type HealthFilterType,
  type SortOptionType,
} from '../../lib/hooks/useMachinesData';

const RENTAL_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Rental Status' },
  { id: 'available', label: 'Available', dotColor: '#10b981' },
  { id: 'rented', label: 'Rented', dotColor: '#0ea5e9' },
];

const HEALTH_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Health Status' },
  { id: 'active', label: 'Active', dotColor: '#10b981' },
  { id: 'spare', label: 'Spare', dotColor: '#06b6d4' },
  { id: 'under_maintenance', label: 'Under Maintenance', dotColor: '#f59e0b' },
  { id: 'breakdown', label: 'Breakdown', dotColor: '#ef4444' },
];

const SORT_OPTIONS: FilterOption[] = [
  { id: 'machine_id_asc', label: 'Machine ID (A → Z)' },
  { id: 'machine_id_desc', label: 'Machine ID (Z → A)' },
  { id: 'model_asc', label: 'Model (A → Z)' },
  { id: 'newest_yum', label: 'Newest Mfg Year' },
  { id: 'oldest_yum', label: 'Oldest Mfg Year' },
  { id: 'highest_hmr', label: 'Highest HMR' },
  { id: 'lowest_hmr', label: 'Lowest HMR' },
];

const DEFAULT_MACHINE_FILTERS = {
  rentalFilter: 'all' as RentalFilterType,
  healthFilter: 'all' as HealthFilterType,
  supervisorFilter: 'all',
  clientFilter: 'all',
  sortBy: 'machine_id_asc' as SortOptionType,
};

export default function MachinesScreen() {
  const { theme, isDark } = useTheme();
  const { role, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; machineId?: string }>();
  const { toast } = useToast();

  // ── Single source of truth: @reachinternational/permissions machine capabilities ──
  const operatorView = isOperatorMachineView(role);
  const canAccessRoute = canAccessMachinesRoute(role);
  const machineScope = getMachineScope(role);
  const canViewFleet = hasMachineCapability(role, MACHINE_CAPABILITIES.FLEET_VIEW);
  const canCreate = hasMachineCapability(role, MACHINE_CAPABILITIES.CREATE);
  const canEditSpecs = hasMachineCapability(role, MACHINE_CAPABILITIES.EDIT_SPECS);
  const canUpdateStatus = hasMachineCapability(role, MACHINE_CAPABILITIES.STATUS_UPDATE);
  const canImport = hasMachineCapability(role, MACHINE_CAPABILITIES.IMPORT);
  const canExport = hasMachineCapability(role, MACHINE_CAPABILITIES.EXPORT);
  const canDelete = hasMachineCapability(role, MACHINE_CAPABILITIES.DELETE);
  const canAssignOperator = hasMachineCapability(role, MACHINE_CAPABILITIES.ASSIGN_OPERATOR);
  const canAssignClient = hasMachineCapability(role, MACHINE_CAPABILITIES.ASSIGN_CLIENT);
  const canOpenMachineEditor = canCreate || canEditSpecs || canUpdateStatus || canAssignClient;
  const canManagePersonnel = canAssignOperator || hasMachineCapability(role, MACHINE_CAPABILITIES.ASSIGN_SUPERVISOR);
  // Operator view CTAs: Log Entry + History. Editors get the Assign-Operator CTA instead.
  const canLogEntry = operatorView;

  // Filter & Search states backed by persistent AsyncStorage
  const {
    search: debouncedSearch,
    inputValue: search,
    setSearch,
    filters,
    setFilter,
    resetFilters: resetListFilters,
    isDebouncing: isSearching,
    isHydrated: areFiltersHydrated,
  } = usePersistentListState<{
    rentalFilter: RentalFilterType;
    healthFilter: HealthFilterType;
    supervisorFilter: string;
    clientFilter: string;
    sortBy: SortOptionType;
  }>({
    storageKey: 'reach_filters_machines',
    defaultSearch: '',
    defaultFilters: DEFAULT_MACHINE_FILTERS,
    debounceMs: 280,
  });

  const rentalFilter = filters.rentalFilter;
  const healthFilter = filters.healthFilter;
  const supervisorFilter = filters.supervisorFilter;
  const clientFilter = filters.clientFilter || 'all';
  const sortBy = filters.sortBy;

  const setRentalFilter = useCallback(
    (val: RentalFilterType | ((prev: RentalFilterType) => RentalFilterType)) =>
      setFilter('rentalFilter', val),
    [setFilter]
  );
  const setHealthFilter = useCallback(
    (val: HealthFilterType | ((prev: HealthFilterType) => HealthFilterType)) =>
      setFilter('healthFilter', val),
    [setFilter]
  );
  const setSupervisorFilter = useCallback(
    (val: string | ((prev: string) => string)) => setFilter('supervisorFilter', val),
    [setFilter]
  );
  const setClientFilter = useCallback(
    (val: string | ((prev: string) => string)) => setFilter('clientFilter', val),
    [setFilter]
  );
  const setSortBy = useCallback(
    (val: SortOptionType | ((prev: SortOptionType) => SortOptionType)) =>
      setFilter('sortBy', val),
    [setFilter]
  );

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // Filter drawer + modals mount on first authorised open (never in the initial tree).
  const [filterDrawerMounted, setFilterDrawerMounted] = useState(false);

  const handleSearchSubmit = useCallback(() => {
    setSearch(search, true);
  }, [setSearch, search]);

  const handleClearSearch = useCallback(() => {
    setSearch('', true);
  }, [setSearch]);

  const handleOpenFilterPanel = useCallback(
    (open: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof open === 'function' ? open(filterPanelOpen) : open;
      if (next) setFilterDrawerMounted(true);
      setFilterPanelOpen(next);
    },
    [filterPanelOpen]
  );

  // Telemetry & Mutex Refs
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDeletingRef = useRef(false);
  const detailNavigationLockRef = useRef(0);

  // Production Server-State Data Hook (role-capability scoped: fleet tier, supervised tier or operator RPC)
  const {
    machines,
    totalCount,
    kpis,
    isKPIsLoading,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: fetchError,
    refetch: fetchMachines,
    supervisorsList,
    clientsList,
    isLoadingOptions,
    deleteMachine,
    patchMachine,
    removeMachineFromCache,
    invalidateMachineKPIs,
    resyncMachines,
  } = useMachinesData({
    userRole: role,
    userId: user?.id,
    searchQuery: canViewFleet ? debouncedSearch : '',
    rentalFilter: canViewFleet ? rentalFilter : 'all',
    healthFilter: canViewFleet ? healthFilter : 'all',
    supervisorFilter: canViewFleet ? supervisorFilter : 'all',
    clientFilter: canViewFleet ? clientFilter : 'all',
    sortBy: canViewFleet ? sortBy : 'machine_id_asc',
    // Wait for the persisted filter restore so the first request is the final one.
    enabled: Boolean(user?.id) && canAccessRoute && (operatorView || areFiltersHydrated),
  });

  // Slow network detection timer
  useEffect(() => {
    if (isLoading || isFetching) {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      slowTimerRef.current = setTimeout(() => {
        setIsSlowNetwork(true);
      }, 7500);
    } else {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setIsSlowNetwork(false);
    }
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, [isLoading, isFetching]);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMachines();
    } finally {
      setRefreshing(false);
    }
  }, [fetchMachines]);

  useScreenSync({
    screen: 'machines',
    onRefresh: fetchMachines,
  });

  // Selection & Details view
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<'overview' | 'running_hours' | 'audit_trail'>('overview');

  // Action Modals — each one mounts lazily on first authorised use.
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [machineModalMounted, setMachineModalMounted] = useState(false);
  const [machineToEdit, setMachineToEdit] = useState<any | null>(null);
  const [editSection, setEditSection] = useState<'all' | 'info' | 'personnel' | 'client'>('all');
  const [deleteMachineTarget, setDeleteMachineTarget] = useState<any | null>(null);
  const [deleteDialogMounted, setDeleteDialogMounted] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importModalMounted, setImportModalMounted] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalMounted, setExportModalMounted] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMounted, setCategoryModalMounted] = useState(false);
  const [meterMachine, setMeterMachine] = useState<any | null>(null);

  const anyOverlayOpen =
    filterPanelOpen ||
    machineModalOpen ||
    Boolean(deleteMachineTarget) ||
    importModalOpen ||
    exportModalOpen ||
    categoryModalOpen ||
    Boolean(meterMachine);

  // Dynamic Supervisor Options for Filter Sidebar
  const supervisorFilterOptions = useMemo<FilterOption[]>(() => {
    const map = new Map<string, string>();
    supervisorsList.forEach((s: any) => {
      if (s.id && s.full_name) map.set(s.id, s.full_name);
    });
    machines.forEach((m: any) => {
      if (m.current_supervisor?.id && m.current_supervisor?.full_name) {
        map.set(m.current_supervisor.id, m.current_supervisor.full_name);
      }
    });
    const items: FilterOption[] = Array.from(map.entries()).map(([id, name]) => ({
      id,
      label: name,
    }));
    // Supervisors are pinned to their supervised scope server-side, so a supervisor
    // picker would be a no-op control. Only the full-fleet tier gets the filter.
    if (machineScope !== 'all') return [{ id: 'all', label: 'All Supervisors' }];
    return [{ id: 'all', label: 'All Supervisors' }, ...items];
  }, [supervisorsList, machines, machineScope]);

  // Dynamic Client Options for Filter Sidebar
  const clientFilterOptions = useMemo<FilterOption[]>(() => {
    const map = new Map<string, string>();
    clientsList.forEach((c: any) => {
      const name = c.company_name || c.code;
      if (c.id && name) map.set(c.id, name);
    });
    machines.forEach((m: any) => {
      if (m.client_id && m.client?.company_name) {
        map.set(m.client_id, m.client.company_name);
      }
    });
    const items: FilterOption[] = Array.from(map.entries()).map(([id, name]) => ({
      id,
      label: name,
    }));
    items.sort((a, b) => a.label.localeCompare(b.label));
    return [{ id: 'all', label: 'All Clients' }, ...items];
  }, [clientsList, machines]);

  // Active filter count (fleet-tier roles only)
  const activeFilterCount = useMemo(() => {
    if (!canViewFleet) return 0;
    let count = 0;
    if (rentalFilter !== 'all') count++;
    if (healthFilter !== 'all') count++;
    if (clientFilter !== 'all') count++;
    if (supervisorFilter !== 'all') count++;
    if (debouncedSearch.trim() !== '') count++;
    if (sortBy !== 'machine_id_asc') count++;
    return count;
  }, [canViewFleet, rentalFilter, healthFilter, clientFilter, supervisorFilter, debouncedSearch, sortBy]);

  const handleResetAllFilters = useCallback(() => {
    resetListFilters();
  }, [resetListFilters]);

  // Hardware Back Button handling on Android (yields to any open overlay)
  useEffect(() => {
    if (Platform.OS !== 'android' || !selectedMachine) return;
    const onBackPress = () => {
      // Overlays own the back gesture while open (drawer, modals, sheets, dialogs)
      if (anyOverlayOpen) return false;
      setSelectedMachine(null);
      setDetailInitialTab('overview');
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [selectedMachine, anyOverlayOpen]);

  // Deep Link Parameter resolution with role-scoped lookups
  const handledDeepLinkRef = useRef<string | null>(null);

  useEffect(() => {
    const targetId = params.id || params.machineId;
    if (!targetId || handledDeepLinkRef.current === targetId) return;
    if (isLoading) return;

    // 1. Already-loaded list (operator list is complete; fleet list is authoritative for loaded pages)
    const found = machines.find((m: any) => m.id === targetId || m.machine_id === targetId);
    if (found) {
      handledDeepLinkRef.current = targetId;
      setSelectedMachine(found);
      return;
    }

    // 2. Operator: the assigned-machine RPC result is complete, so a miss is an access denial
    if (operatorView) {
      handledDeepLinkRef.current = targetId;
      toast('warning', 'Access Restricted', 'This machine is not assigned to your account.');
      return;
    }

    if (!canAccessRoute || machineScope === 'none') return;

    let isCancelled = false;
    (async () => {
      try {
        let query = supabase
          .from('machines')
          .select(MACHINE_SELECT_COLUMNS)
          .or(`id.eq.${targetId},machine_id.eq.${targetId}`);

        // Supervised tier: RLS is authoritative; this keeps the plan narrow and the
        // deep link denied even if a policy regresses.
        if (machineScope === 'supervised' && user?.id) {
          const { data: clientSupervisors } = await supabase
            .from('client_supervisors')
            .select('client_id')
            .eq('supervisor_id', user.id);

          const supervisedClientIds = (clientSupervisors || [])
            .map((cs: any) => cs.client_id)
            .filter(Boolean);

          if (supervisedClientIds.length > 0) {
            query = query.or(
              `current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}},client_id.in.(${supervisedClientIds.join(',')})`
            );
          } else {
            query = query.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
          }
        }

        const { data, error } = await query.maybeSingle();

        if (isCancelled) return;
        if (data) {
          handledDeepLinkRef.current = targetId;
          setSelectedMachine({
            ...data,
            supervisors: data.current_supervisor ? [data.current_supervisor] : [],
            operators: data.current_operator ? [data.current_operator] : [],
          });
        } else if (!error) {
          handledDeepLinkRef.current = targetId;
          toast('warning', 'Access Restricted', 'Machine is not within your authorized scope or does not exist.');
        }
      } catch {
        // non-blocking
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [params.id, params.machineId, machines, isLoading, operatorView, canAccessRoute, machineScope, user?.id, toast]);

  // Header Actions — every entry is capability-gated (not mounted when unauthorized)
  const headerActions = useMemo((): HeaderActionItem[] => {
    const list: HeaderActionItem[] = [];

    if (canCreate) {
      list.push({
        id: 'add-machine',
        label: 'Add New Machine',
        icon: <Plus size={16} color={theme.colors.ink} />,
        onPress: () => {
          setMachineToEdit(null);
          setEditSection('all');
          setMachineModalMounted(true);
          setMachineModalOpen(true);
        },
      });
    }

    if (canEditSpecs) {
      list.push({
        id: 'manage-categories',
        label: 'Manage Categories',
        icon: <FolderTree size={16} color={theme.colors.ink} />,
        onPress: () => {
          setCategoryModalMounted(true);
          setCategoryModalOpen(true);
        },
      });
    }

    list.push({
      id: 'refresh-fleet',
      label: operatorView ? 'Refresh Machine' : 'Refresh Fleet',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => fetchMachines(),
    });

    if (canExport) {
      list.push({
        id: 'export-fleet',
        label: 'Export Fleet Directory',
        icon: <Printer size={16} color={theme.colors.ink} />,
        onPress: () => {
          setExportModalMounted(true);
          setExportModalOpen(true);
        },
      });
    }

    if (canImport) {
      list.push({
        id: 'import-excel',
        label: 'Bulk Excel Import Guide',
        icon: <FileSpreadsheet size={16} color={theme.colors.ink} />,
        onPress: () => {
          setImportModalMounted(true);
          setImportModalOpen(true);
        },
      });
    }

    if (canViewFleet) {
      list.push({
        id: 'reset-filters',
        label: 'Reset Active Filters',
        icon: <RotateCcw size={16} color={theme.colors.ink} />,
        onPress: () => handleResetAllFilters(),
      });
    }

    return list;
  }, [
    canCreate,
    canEditSpecs,
    canExport,
    canImport,
    canViewFleet,
    operatorView,
    theme.colors.ink,
    handleResetAllFilters,
    fetchMachines,
  ]);

  // Infinite Scroll Trigger (fleet/supervised tiers only)
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const openDetail = useCallback((m: any, tab: 'overview' | 'running_hours' = 'overview') => {
    // Debounce duplicate taps / double navigation
    const now = Date.now();
    if (now - detailNavigationLockRef.current < 350) return;
    detailNavigationLockRef.current = now;
    haptics.select();
    setSelectedMachine(m);
    setDetailInitialTab(tab);
  }, []);

  // Memoized Machine Action Handlers to prevent card re-renders
  const handleViewDetails = useCallback((m: any) => openDetail(m, 'overview'), [openDetail]);
  const handleViewHistory = useCallback((m: any) => openDetail(m, 'running_hours'), [openDetail]);

  const handleEdit = useCallback(
    (m: any) => {
      if (!canOpenMachineEditor) return;
      setMachineToEdit(m);
      setEditSection('all');
      setMachineModalMounted(true);
      setMachineModalOpen(true);
    },
    [canOpenMachineEditor]
  );

  const handleDelete = useCallback(
    (m: any) => {
      if (!canDelete) return;
      setDeleteDialogMounted(true);
      setDeleteMachineTarget(m);
    },
    [canDelete]
  );

  const handleLogMeter = useCallback(
    (m: any) => {
      if (!canLogEntry) return;
      setMeterMachine(m);
    },
    [canLogEntry]
  );

  const handleAssignOperator = useCallback(
    (m: any) => {
      if (!canAssignOperator && !canManagePersonnel) return;
      setMachineToEdit(m);
      setEditSection('personnel');
      setMachineModalMounted(true);
      setMachineModalOpen(true);
    },
    [canAssignOperator, canManagePersonnel]
  );

  // Render machine card in virtualized list
  const renderMachineItem = useCallback(
    ({ item }: { item: any }) => (
      <View style={styles.cardItemWrapper}>
        <MobileMachineCard
          machine={item}
          operatorView={operatorView}
          canAssignOperator={operatorView ? false : (canAssignOperator || canManagePersonnel)}
          canLogEntry={canLogEntry}
          searchTerm={canViewFleet ? debouncedSearch : undefined}
          onViewDetails={handleViewDetails}
          onViewHistory={handleViewHistory}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onLogMeter={handleLogMeter}
          onAssignOperator={canManagePersonnel ? handleAssignOperator : undefined}
        />
      </View>
    ),
    [
      operatorView,
      canAssignOperator,
      canManagePersonnel,
      canLogEntry,
      canViewFleet,
      debouncedSearch,
      handleViewDetails,
      handleViewHistory,
      handleEdit,
      handleDelete,
      handleLogMeter,
      handleAssignOperator,
    ]
  );

  // Static FlatList Header: KPI strip + filter panel render only for fleet-capable roles
  const renderListHeader = useCallback(() => {
    return (
      <View style={styles.listHeaderContainer}>
        {/* Slow Network Feedback Banner */}
        <SlowNetworkBanner
          visible={isSlowNetwork && (isLoading || refreshing)}
          message="Slow network detected. Still communicating with server..."
          onRetry={() => {
            fetchMachines();
          }}
          onDismiss={() => setIsSlowNetwork(false)}
        />

        {/* Ambient Cached Data Warning when background refresh fails */}
        {Boolean(fetchError) && machines.length > 0 && (
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
              style={[styles.cachedErrorBannerText, { color: isDark ? '#f87171' : '#dc2626' }]}
              numberOfLines={2}
            >
              {operatorView
                ? 'Unable to refresh your assigned machine. Showing cached equipment.'
                : `Unable to refresh fleet (${fetchError}). Showing cached equipment.`}
            </Text>
            <Pressable
              variant="chip"
              haptic="select"
              hitSlopToMin48
              onPress={() => fetchMachines()}
              style={[
                styles.cachedErrorRetryBtn,
                {
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                },
              ]}
              accessibilityLabel="Retry refreshing fleet"
            >
              <RotateCcw size={10} color={isDark ? '#f87171' : '#dc2626'} style={{ marginRight: 3 }} />
              <Text variant="micro" style={{ color: isDark ? '#f87171' : '#dc2626' }}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {/* 4-Card KPI Metric Grid: fleet aggregate counts are never fetched/rendered for operators */}
        {canViewFleet && kpis && <MachineKPIStrip stats={kpis} isLoading={isKPIsLoading} />}

        {/* Modular Filter & Search Panel (FLEET_VIEW capability only) */}
        {canViewFleet && (
          <MachineFilterPanel
            search={search}
            setSearch={setSearch}
            debouncedSearch={debouncedSearch}
            handleClearSearch={handleClearSearch}
            handleSearchSubmit={handleSearchSubmit}
            isSearching={isSearching}
            filterPanelOpen={filterPanelOpen}
            setFilterPanelOpen={handleOpenFilterPanel}
            activeFilterCount={activeFilterCount}
            handleResetAllFilters={handleResetAllFilters}
            rentalFilter={rentalFilter}
            setRentalFilter={setRentalFilter}
            healthFilter={healthFilter}
            setHealthFilter={setHealthFilter}
            supervisorFilter={supervisorFilter}
            setSupervisorFilter={setSupervisorFilter}
            clientFilter={clientFilter}
            setClientFilter={setClientFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            rentalFilterOptions={RENTAL_FILTER_OPTIONS}
            healthFilterOptions={HEALTH_FILTER_OPTIONS}
            supervisorFilterOptions={supervisorFilterOptions}
            clientFilterOptions={clientFilterOptions}
            sortOptions={SORT_OPTIONS}
          />
        )}

        {/* Results Count Line */}
        <View style={styles.resultsCountRow}>
          {isLoading && machines.length === 0 ? (
            <Skeleton width={160} height={14} borderRadius={radiusNumeric.sm} style={{ marginVertical: 0 }} />
          ) : operatorView ? (
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              {machines.length === 1 ? '1 machine assigned to you' : `${machines.length} machines assigned to you`}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Showing{' '}
                <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                  {machines.length}
                </Text>{' '}
                of{' '}
                <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                  {totalCount}
                </Text>{' '}
                machines
                {activeFilterCount > 0 && totalCount > machines.length && (
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    {' '}(filtered)
                  </Text>
                )}
              </Text>
              {(isSearching || (isFetching && !isFetchingNextPage && machines.length > 0)) && (
                <ActivityIndicator size="small" color="#0284c7" style={{ transform: [{ scale: 0.65 }] }} />
              )}
            </View>
          )}
        </View>
      </View>
    );
  }, [
    isSlowNetwork,
    isLoading,
    refreshing,
    fetchMachines,
    fetchError,
    machines.length,
    isDark,
    canViewFleet,
    kpis,
    isKPIsLoading,
    rentalFilter,
    healthFilter,
    setRentalFilter,
    setHealthFilter,
    search,
    setSearch,
    debouncedSearch,
    handleClearSearch,
    handleSearchSubmit,
    isSearching,
    filterPanelOpen,
    handleOpenFilterPanel,
    activeFilterCount,
    handleResetAllFilters,
    supervisorFilter,
    setSupervisorFilter,
    clientFilter,
    setClientFilter,
    sortBy,
    setSortBy,
    supervisorFilterOptions,
    clientFilterOptions,
    theme.colors.mute,
    theme.colors.ink,
    totalCount,
    operatorView,
  ]);

  // List Empty / Initial Loading Component
  const renderListEmpty = useCallback(() => {
    // When the filter sidebar is open, do not flash EmptyState behind the active drawer
    if (filterPanelOpen) {
      return null;
    }

    if ((isLoading || isSearching) && machines.length === 0) {
      return (
        <View style={styles.skeletonContainer}>
          <MobileMachineListSkeleton count={4} />
        </View>
      );
    }

    if (fetchError && machines.length === 0) {
      return (
        <ErrorState
          error={fetchError}
          onRetry={() => {
            fetchMachines();
          }}
          retryLabel="Retry Fetch"
          secondaryActionLabel={activeFilterCount > 0 ? 'Reset All Filters' : undefined}
          onSecondaryAction={activeFilterCount > 0 ? handleResetAllFilters : undefined}
        />
      );
    }

    if (canViewFleet && debouncedSearch.trim()) {
      return (
        <EmptyState
          variant="no-results"
          title={`No machines matching "${debouncedSearch.trim()}"`}
          description=""
          actionLabel="Clear Search"
          onAction={handleClearSearch}
        />
      );
    }

    if (canViewFleet && activeFilterCount > 0) {
      return (
        <EmptyState
          variant="filtered"
          title="No Machines for Selected Filters"
          description=""
          actionLabel="Reset All Filters"
          onAction={handleResetAllFilters}
        />
      );
    }

    if (operatorView) {
      return (
        <EmptyState
          variant="empty"
          title="No Assigned Machinery"
          description="Your supervisor has not assigned a machine to your shift yet."
        />
      );
    }

    if (machineScope === 'supervised') {
      return (
        <EmptyState
          variant="empty"
          title="No Supervised Machinery"
          description=""
        />
      );
    }

    if (canCreate) {
      return (
        <EmptyState
          variant="empty"
          title="Fleet Directory Empty"
          description=""
          actionLabel="+ Add New Machine"
          onAction={() => {
            setMachineToEdit(null);
            setEditSection('all');
            setMachineModalMounted(true);
            setMachineModalOpen(true);
          }}
        />
      );
    }

    return <EmptyState variant="empty" title="Fleet Directory Empty" description="" />;
  }, [
    filterPanelOpen,
    isLoading,
    isSearching,
    fetchError,
    machines.length,
    debouncedSearch,
    activeFilterCount,
    canViewFleet,
    operatorView,
    machineScope,
    canCreate,
    fetchMachines,
    handleResetAllFilters,
    handleClearSearch,
  ]);

  // List Footer: chunk loading spinner or end-of-list row
  const renderListFooter = useCallback(() => {
    if (operatorView || isLoading || machines.length === 0) return null;

    return (
      <View style={styles.scrollFooterContainer}>
        {isFetchingNextPage ? (
          <View style={styles.loadingMoreRow}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text variant="caption" style={{ color: theme.colors.mute, marginLeft: 8 }}>
              Loading more machines ({machines.length} of {totalCount})...
            </Text>
          </View>
        ) : hasNextPage ? (
          <View style={styles.loadingMoreRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Scroll to load more machines
            </Text>
          </View>
        ) : (
          <View style={styles.endOfListRow}>
            <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              All {totalCount} machines loaded
            </Text>
            <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
          </View>
        )}
      </View>
    );
  }, [
    operatorView,
    isLoading,
    machines.length,
    isFetchingNextPage,
    hasNextPage,
    totalCount,
    theme.colors.mute,
    theme.colors.hairline,
  ]);

  // Route guard: unauthorized roles are redirected (deep links + stale navigation state included)
  if (role && !canAccessRoute) {
    return <Redirect href={getMobileRoleHomeRoute(role) as any} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>

      {selectedMachine ? (
        <Animated.View
          style={styles.detailViewWrapper}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
        >
          <MachineDetailView
            machine={selectedMachine}
            initialTab={detailInitialTab}
            onBack={() => {
              setSelectedMachine(null);
              setDetailInitialTab('overview');
            }}
            onMachineUpdated={(updatedMachine?: any) => {
              if (updatedMachine?.id) {
                setSelectedMachine((prev: any) => ({ ...prev, ...updatedMachine }));
                patchMachine(updatedMachine);
                invalidateMachineKPIs();
              } else {
                resyncMachines();
              }
            }}
            onMachineDeleted={(deletedId?: string) => {
              const idToRemove = deletedId || selectedMachine?.id;
              setSelectedMachine(null);
              setDetailInitialTab('overview');
              if (idToRemove) {
                removeMachineFromCache(idToRemove);
                invalidateMachineKPIs();
              } else {
                resyncMachines();
              }
            }}
            userRole={role}
          />
        </Animated.View>
      ) : (
        <>
          {/* Top Standardized Mobile Header */}
          <MobileHeader
            title="Machines"
            showBack={true}
            backRoute="/dashboard"
            actions={headerActions}
          />

          {/* Virtualized FlatList: 10-row progressive chunks with a static header */}
          <FlatList
            data={isLoading && machines.length === 0 ? [] : machines}
            renderItem={renderMachineItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderListEmpty}
            ListFooterComponent={renderListFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            indicatorStyle={isDark ? 'white' : 'black'}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.link}
              />
            }
          />
        </>
      )}

      {/* Add / Edit / Status Machine Modal — mounted on first authorised open only */}
      {machineModalMounted && canOpenMachineEditor && (
        <MachineModal
          visible={machineModalOpen}
          onClose={() => setMachineModalOpen(false)}
          initialSection={editSection}
          onSuccess={(savedMachine?: any) => {
            setMachineModalOpen(false);
            if (savedMachine) {
              const isEdit = Boolean(machineToEdit);
              toast(
                'success',
                isEdit ? 'Machine Updated' : 'Machine Added',
                `Asset ${savedMachine.model || 'record'} (${savedMachine.serial_number || savedMachine.machine_id || ''}) saved successfully.`
              );
              if (isEdit && savedMachine.id) {
                patchMachine(savedMachine);
                if (selectedMachine?.id === savedMachine.id) {
                  setSelectedMachine((prev: any) => ({ ...prev, ...savedMachine }));
                }
                invalidateMachineKPIs();
              } else {
                resyncMachines();
              }
            }
          }}
          machineToEdit={machineToEdit}
          userRole={role}
        />
      )}

      {/* Delete Machine Dialog with optimistic removal + authoritative rollback */}
      {deleteDialogMounted && canDelete && (
        <DeleteMachineDialog
          visible={Boolean(deleteMachineTarget)}
          machine={deleteMachineTarget}
          onClose={() => setDeleteMachineTarget(null)}
          onConfirm={async () => {
            const target = deleteMachineTarget;
            if (!target?.id || isDeletingRef.current) return;
            isDeletingRef.current = true;
            setDeleteMachineTarget(null);

            try {
              await deleteMachine(target);
              haptics.confirm();
              toast('success', 'Machine Deleted', `Machine asset ${target.machine_id || 'record'} removed from active fleet.`);
            } catch (err: any) {
              haptics.reject();
              toast('error', 'Delete Failed', sanitizeDatabaseError(err, 'Failed to delete machine.').message);
            } finally {
              isDeletingRef.current = false;
            }
          }}
        />
      )}

      {/* Machine Categories Management Modal (EDIT_SPECS capability) */}
      {categoryModalMounted && canEditSpecs && (
        <MachineCategoryModal
          visible={categoryModalOpen}
          onClose={() => setCategoryModalOpen(false)}
        />
      )}

      {/* Bulk Excel Import Info Modal (IMPORT capability) */}
      {importModalMounted && canImport && (
        <MachineImportModal
          visible={importModalOpen}
          onClose={() => setImportModalOpen(false)}
        />
      )}

      {/* Export Fleet Directory Modal (EXPORT capability, native export libs loaded on demand) */}
      {exportModalMounted && canExport && (
        <MachineExportModal
          visible={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          machines={machines}
        />
      )}

      {/* Log Meter Modal (operator shift entry / authorised editors) */}
      {meterMachine && canLogEntry && (
        <MeterLogModal
          visible={Boolean(meterMachine)}
          onClose={() => setMeterMachine(null)}
          machineId={meterMachine.id}
          machineCode={meterMachine.machine_id}
          model={meterMachine.model}
          serialNumber={meterMachine.serial_number}
          onSubmit={() => {
            setMeterMachine(null);
            resyncMachines();
          }}
        />
      )}

      {/* Category-Wise Filter Sidebar Drawer (FLEET_VIEW capability, mounted on first open) */}
      {filterDrawerMounted && canViewFleet && (
        <MachineFilterSidebar
          visible={filterPanelOpen}
          onClose={() => setFilterPanelOpen(false)}
          activeFilterCount={activeFilterCount}
          totalFilteredCount={totalCount}
          totalFleetCount={totalCount}
          rentalFilter={rentalFilter}
          setRentalFilter={setRentalFilter}
          healthFilter={healthFilter}
          setHealthFilter={setHealthFilter}
          supervisorFilter={supervisorFilter}
          setSupervisorFilter={setSupervisorFilter}
          clientFilter={clientFilter}
          setClientFilter={setClientFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          rentalFilterOptions={RENTAL_FILTER_OPTIONS}
          healthFilterOptions={HEALTH_FILTER_OPTIONS}
          supervisorFilterOptions={supervisorFilterOptions}
          clientFilterOptions={clientFilterOptions}
          sortOptions={SORT_OPTIONS}
          isLoadingOptions={isLoadingOptions}
          onResetAllFilters={handleResetAllFilters}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    paddingBottom: 120,
  },
  listHeaderContainer: {
    gap: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
  },
  cachedErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 8,
    marginTop: -4,
  },
  cachedErrorBannerText: {
    flex: 1,
  },
  cachedErrorRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  resultsCountRow: {
    paddingHorizontal: 2,
    marginTop: -4,
  },
  cardItemWrapper: {
    marginBottom: spacingNumeric.md,
  },
  skeletonContainer: {
    width: '100%',
  },
  scrollFooterContainer: {
    marginTop: 12,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  endOfListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 8,
  },
  endOfListLine: {
    flex: 1,
    height: 1,
  },
  detailViewWrapper: {
    flex: 1,
  },
});
