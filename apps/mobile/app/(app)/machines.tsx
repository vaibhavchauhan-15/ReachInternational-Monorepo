import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  BackHandler,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTheme,
  MobileHeader,
  Skeleton,
  HeaderActionItem,
  Text,
  useToast,
  EmptyState,
  ErrorState,
  PermissionDeniedView,
  SlowNetworkBanner,
} from '../../components/ui';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { MobileMachineCard } from '../../components/machines/MobileMachineCard';
import { Pressable } from '../../components/ui/touch/Pressable';
import { MachineModal } from '../../components/machines/MachineModal';
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

import { MeterLogModal } from '../../components/work/MeterLogModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useScreenSync } from '../../lib/offline';
import { haptics } from '../../lib/haptics';
import { notifyMachineDeleted } from '../../lib/notifications';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { sanitizeDatabaseError } from '@reachinternational/utils';
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const { role, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; machineId?: string }>();
  const { toast } = useToast();

  const isHr = (role || '').toLowerCase() === 'hr';

  // Role permissions
  const normalizedRole = (role || '').toLowerCase();
  const isAdminOrManager =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'manager';
  const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor';
  const canCreate = isAdminOrManager;

  // Filter & Search states backed by persistent AsyncStorage
  const {
    search: debouncedSearch,
    inputValue: search,
    setSearch,
    filters,
    setFilter,
    resetFilters: resetListFilters,
    isDebouncing: isSearching,
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

  const handleSearchSubmit = () => {
    setSearch(search, true);
  };

  const handleClearSearch = () => {
    setSearch('', true);
  };

  // Telemetry & Mutex Refs
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDeletingRef = useRef(false);

  // Production Server-State Data Hook (TanStack Query v5 Infinite Scroll + Fast KPI RPC)
  const {
    machines: queryMachines,
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
  } = useMachinesData({
    userRole: role,
    userId: user?.id,
    searchQuery: debouncedSearch,
    rentalFilter,
    healthFilter,
    supervisorFilter,
    clientFilter,
    sortBy,
    enabled: Boolean(user?.id) && !isHr,
  });

  // Local optimistic machine state for zero-latency deletion and instant updates
  const [localMachines, setLocalMachines] = useState<any[]>([]);

  // Synchronize local machines with query results
  useEffect(() => {
    setLocalMachines(queryMachines);
  }, [queryMachines]);

  // Use localMachines as the active machine array
  const machines = localMachines;
  const setMachines = setLocalMachines;

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

  // Action Modals
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [machineToEdit, setMachineToEdit] = useState<any | null>(null);
  const [deleteMachine, setDeleteMachine] = useState<any | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [meterMachine, setMeterMachine] = useState<any | null>(null);

  // Dynamic Supervisor Options for Filter Sidebar
  const supervisorFilterOptions = useMemo<FilterOption[]>(() => {
    const map = new Map<string, string>();
    supervisorsList.forEach((s) => {
      if (s.id && s.full_name) map.set(s.id, s.full_name);
    });
    machines.forEach((m) => {
      if (m.current_supervisor?.id && m.current_supervisor?.full_name) {
        map.set(m.current_supervisor.id, m.current_supervisor.full_name);
      }
    });
    const items: FilterOption[] = Array.from(map.entries()).map(([id, name]) => ({
      id,
      label: name,
    }));
    return [{ id: 'all', label: 'All Supervisors' }, ...items];
  }, [supervisorsList, machines]);

  // Dynamic Client Options for Filter Sidebar
  const clientFilterOptions = useMemo<FilterOption[]>(() => {
    const map = new Map<string, string>();
    clientsList.forEach((c) => {
      const name = c.company_name || c.code;
      if (c.id && name) map.set(c.id, name);
    });
    machines.forEach((m) => {
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

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (rentalFilter !== 'all') count++;
    if (healthFilter !== 'all') count++;
    if (clientFilter !== 'all') count++;
    if (supervisorFilter !== 'all') count++;
    if (debouncedSearch.trim() !== '') count++;
    if (sortBy !== 'machine_id_asc') count++;
    return count;
  }, [rentalFilter, healthFilter, clientFilter, supervisorFilter, debouncedSearch, sortBy]);

  const handleResetAllFilters = useCallback(() => {
    resetListFilters();
  }, [resetListFilters]);

  // Hardware Back Button handling on Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (selectedMachine) {
        setSelectedMachine(null);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [selectedMachine]);

  // Deep Link Parameter resolution with Role-Based Scoping
  const handledDeepLinkRef = useRef<string | null>(null);

  useEffect(() => {
    const targetId = params.id || params.machineId;
    if (!targetId || handledDeepLinkRef.current === targetId) return;

    const found = machines.find((m) => m.id === targetId || m.machine_id === targetId);
    if (found) {
      handledDeepLinkRef.current = targetId;
      setSelectedMachine(found);
      return;
    }

    let isCancelled = false;
    (async () => {
      try {
        let query = supabase
          .from('machines')
          .select(MACHINE_SELECT_COLUMNS)
          .or(`id.eq.${targetId},machine_id.eq.${targetId}`);

        if (normalizedRole === 'operator' && user?.id) {
          const { data: omaList } = await supabase
            .from('operator_machine_assignments')
            .select('machine_id')
            .eq('operator_id', user.id)
            .eq('is_active', true);

          const assignedMachineIds = (omaList || []).map((r: any) => r.machine_id).filter(Boolean);
          if (assignedMachineIds.length > 0) {
            query = query.or(
              `current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}},id.in.(${assignedMachineIds.join(',')})`
            );
          } else {
            query = query.or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
          }
        } else if ((normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor') && user?.id) {
          query = query.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
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
        } else if (!error && user?.id) {
          toast('warning', 'Access Restricted', 'Machine is not assigned to your account or does not exist.');
        }
      } catch {
        // non-blocking
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [params.id, params.machineId, machines, normalizedRole, user?.id, toast]);

  // Header Actions
  const headerActions = useMemo((): HeaderActionItem[] => {
    if (normalizedRole === 'operator') {
      return [
        {
          id: 'refresh-assigned',
          label: 'Refresh Machine',
          icon: <RefreshCw size={16} color={theme.colors.ink} />,
          onPress: () => fetchMachines(),
        },
      ];
    }

    const list: HeaderActionItem[] = [];

    if (canCreate) {
      list.push({
        id: 'add-machine',
        label: 'Add New Machine',
        icon: <Plus size={16} color={theme.colors.ink} />,
        onPress: () => {
          setMachineToEdit(null);
          setMachineModalOpen(true);
        },
      });

      list.push({
        id: 'manage-categories',
        label: 'Manage Categories',
        icon: <FolderTree size={16} color={theme.colors.ink} />,
        onPress: () => setCategoryModalOpen(true),
      });
    }

    list.push({
      id: 'refresh-fleet',
      label: 'Refresh Fleet',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => fetchMachines(),
    });

    list.push({
      id: 'export-fleet',
      label: 'Export Fleet Directory',
      icon: <Printer size={16} color={theme.colors.ink} />,
      onPress: () => setExportModalOpen(true),
    });

    list.push({
      id: 'import-excel',
      label: 'Bulk Excel Import Guide',
      icon: <FileSpreadsheet size={16} color={theme.colors.ink} />,
      onPress: () => setImportModalOpen(true),
    });

    list.push({
      id: 'reset-filters',
      label: 'Reset Active Filters',
      icon: <RotateCcw size={16} color={theme.colors.ink} />,
      onPress: () => handleResetAllFilters(),
    });

    return list;
  }, [canCreate, theme.colors.ink, handleResetAllFilters, fetchMachines, normalizedRole]);

  // Infinite Scroll Trigger
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Memoized Machine Action Handlers to prevent card re-renders
  const handleViewDetails = useCallback((m: any) => {
    setSelectedMachine(m);
    setDetailInitialTab('overview');
  }, []);

  const handleViewHistory = useCallback((m: any) => {
    setSelectedMachine(m);
    setDetailInitialTab('running_hours');
  }, []);

  const handleEdit = useCallback((m: any) => {
    setMachineToEdit(m);
    setMachineModalOpen(true);
  }, []);

  const handleDelete = useCallback((m: any) => {
    setDeleteMachine(m);
  }, []);

  const handleLogMeter = useCallback((m: any) => {
    setMeterMachine(m);
  }, []);

  // Render machine card in virtualized list
  const renderMachineItem = useCallback(
    ({ item }: { item: any }) => (
      <View style={styles.cardItemWrapper}>
        <MobileMachineCard
          machine={item}
          isAdmin={isAdminOrManager}
          isSupervisor={isSupervisor}
          searchTerm={debouncedSearch}
          onViewDetails={handleViewDetails}
          onViewHistory={handleViewHistory}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onLogMeter={handleLogMeter}
        />
      </View>
    ),
    [isAdminOrManager, isSupervisor, debouncedSearch, handleViewDetails, handleViewHistory, handleEdit, handleDelete, handleLogMeter]
  );

  // Static FlatList Header: Renders at 0ms with instantaneous KPI strip & filter panel
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
              Unable to refresh fleet ({fetchError}). Showing cached equipment.
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

        {/* 4-Card KPI Metric Grid: Renders instantly at 0ms with progressive value skeletons */}
        <MachineKPIStrip stats={kpis} isLoading={isKPIsLoading} />

        {/* Modular Filter & Search Panel */}
        <MachineFilterPanel
          search={search}
          setSearch={setSearch}
          debouncedSearch={debouncedSearch}
          handleClearSearch={handleClearSearch}
          handleSearchSubmit={handleSearchSubmit}
          isSearching={isSearching}
          filterPanelOpen={filterPanelOpen}
          setFilterPanelOpen={setFilterPanelOpen}
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

        {/* Results Count Line */}
        <View style={styles.resultsCountRow}>
          {isLoading && machines.length === 0 ? (
            <Skeleton width={160} height={14} borderRadius={radiusNumeric.sm} style={{ marginVertical: 0 }} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.resultsCountText, { color: theme.colors.mute }]}>
                Showing{' '}
                <Text variant="label" style={{ color: theme.colors.ink }}>
                  {machines.length}
                </Text>{' '}
                of {totalCount} machine assets
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
    kpis,
    isKPIsLoading,
    search,
    setSearch,
    debouncedSearch,
    handleClearSearch,
    isSearching,
    filterPanelOpen,
    activeFilterCount,
    handleResetAllFilters,
    rentalFilter,
    setRentalFilter,
    healthFilter,
    setHealthFilter,
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
  ]);

  // List Empty / Initial Loading Component
  const renderListEmpty = useCallback(() => {
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

    if (debouncedSearch.trim()) {
      return (
        <EmptyState
          variant="no-results"
          title={`No machines matching "${debouncedSearch.trim()}"`}
          description="No equipment matches your search query across Machine ID, Model, or Serial Number."
          actionLabel="Clear Search"
          onAction={handleClearSearch}
        />
      );
    }

    if (activeFilterCount > 0) {
      return (
        <EmptyState
          variant="filtered"
          title="No Machines for Selected Filters"
          description="No fleet equipment assets match your active filter criteria."
          actionLabel="Reset All Filters"
          onAction={handleResetAllFilters}
        />
      );
    }

    if (normalizedRole === 'operator') {
      return (
        <EmptyState
          variant="empty"
          title="No Assigned Machinery"
          description="You currently have no equipment assigned to your operator account. Contact your site supervisor."
        />
      );
    }

    if (isSupervisor) {
      return (
        <EmptyState
          variant="empty"
          title="No Supervised Machinery"
          description="No equipment assets are currently assigned to your supervisor account."
        />
      );
    }

    return (
      <EmptyState
        variant="empty"
        title="Fleet Directory Empty"
        description="Your equipment fleet is currently empty. Add your first boom lift, scissor lift, or telehandler to begin tracking operations."
        actionLabel="+ Add New Machine"
        onAction={() => {
          setMachineToEdit(null);
          setMachineModalOpen(true);
        }}
      />
    );
  }, [
    isLoading,
    isSearching,
    fetchError,
    machines.length,
    debouncedSearch,
    activeFilterCount,
    normalizedRole,
    isSupervisor,
    fetchMachines,
    handleResetAllFilters,
    handleClearSearch,
  ]);

  // List Footer: Chunk loading spinner or end-of-list row
  const renderListFooter = useCallback(() => {
    if (isLoading || machines.length === 0) return null;

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
            <Text variant="caption" style={[styles.endOfListText, { color: theme.colors.mute }]}>
              All {totalCount} machines loaded
            </Text>
            <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
          </View>
        )}
      </View>
    );
  }, [
    isLoading,
    machines.length,
    isFetchingNextPage,
    hasNextPage,
    totalCount,
    theme.colors.mute,
    theme.colors.hairline,
  ]);

  if (role && isHr) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader title="Fleet Machines" showBack={false} />
        <PermissionDeniedView
          featureName="Fleet Management"
          currentRole={role}
          requiredRoles={['super_admin', 'admin', 'manager', 'supervisor', 'operator']}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {selectedMachine ? (
        <MachineDetailView
          machine={selectedMachine}
          initialTab={detailInitialTab}
          onBack={() => {
            setSelectedMachine(null);
            setDetailInitialTab('overview');
          }}
          onMachineUpdated={(updatedMachine?: any) => {
            if (updatedMachine) {
              setSelectedMachine((prev: any) => ({ ...prev, ...updatedMachine }));
            }
            fetchMachines();
          }}
          onMachineDeleted={() => {
            setSelectedMachine(null);
            setDetailInitialTab('overview');
            fetchMachines();
          }}
          userRole={role}
        />
      ) : (
        <>
          {/* Top Standardized Mobile Header */}
          <MobileHeader
            title="Machines"
            showBack={true}
            onPressBack={() => router.back()}
            actions={headerActions}
          />

          {/* Virtualized Production FlatList with 0ms Static Header & Infinite Scroll */}
          <FlatList
            data={isLoading && machines.length === 0 ? [] : machines}
            renderItem={renderMachineItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderListEmpty}
            ListFooterComponent={renderListFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
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

      {/* Add / Edit Machine Modal */}
      <MachineModal
        visible={machineModalOpen}
        onClose={() => setMachineModalOpen(false)}
        onSuccess={(savedMachine?: any) => {
          setMachineModalOpen(false);
          if (savedMachine) {
            const isEdit = Boolean(machineToEdit);
            toast(
              'success',
              isEdit ? 'Machine Updated' : 'Machine Added',
              `Asset ${savedMachine.model || 'record'} (${savedMachine.serial_number || savedMachine.machine_id || ''}) saved successfully.`
            );
            fetchMachines();
          }
        }}
        machineToEdit={machineToEdit}
        userRole={role}
      />

      {/* Delete Machine Dialog with Optimistic UI & Mutex Lock */}
      <DeleteMachineDialog
        visible={Boolean(deleteMachine)}
        machine={deleteMachine}
        onClose={() => setDeleteMachine(null)}
        onConfirm={async () => {
          if (!deleteMachine?.id || isDeletingRef.current) return;
          isDeletingRef.current = true;
          const target = deleteMachine;
          const prevMachines = machines;

          // Optimistically remove immediately from local state and query cache
          setMachines((prev) => prev.filter((m) => m.id !== target.id));
          queryClient.setQueriesData({ queryKey: ['machines'] }, (old: any) => {
            if (old && Array.isArray(old.pages)) {
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  machines: page.machines.filter((m: any) => m.id !== target.id),
                  totalCount: Math.max(0, page.totalCount - 1),
                })),
              };
            }
            return prevMachines.filter((m: any) => m.id !== target.id);
          });
          setDeleteMachine(null);

          try {
            const { error } = await supabase.from('machines').delete().eq('id', target.id);
            if (error) {
              // Rollback
              setMachines(prevMachines);
              queryClient.setQueriesData({ queryKey: ['machines'] }, (old: any) => {
                if (old && Array.isArray(old.pages)) {
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      machines: prevMachines,
                      totalCount: prevMachines.length,
                    })),
                  };
                }
                return prevMachines;
              });
              haptics.reject();
              toast('error', 'Delete Failed', sanitizeDatabaseError(error, 'Failed to delete machine.').message);
              return;
            }
            haptics.confirm();
            toast('success', 'Machine Deleted', `Machine asset ${target.machine_id || 'record'} removed from active fleet.`);
            notifyMachineDeleted(target.machine_id || 'Machine');
            fetchMachines();
          } catch (err: any) {
            setMachines(prevMachines);
            queryClient.setQueriesData({ queryKey: ['machines'] }, (old: any) => {
              if (old && Array.isArray(old.pages)) {
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    machines: prevMachines,
                    totalCount: prevMachines.length,
                  })),
                };
              }
              return prevMachines;
            });
            haptics.reject();
            toast('error', 'Delete Failed', sanitizeDatabaseError(err, 'Failed to delete machine.').message);
          } finally {
            isDeletingRef.current = false;
          }
        }}
      />

      {/* Machine Categories Management Modal */}
      <MachineCategoryModal
        visible={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />

      {/* Bulk Excel Import Info Modal */}
      <MachineImportModal
        visible={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      {/* Export Fleet Directory Modal (PDF & CSV) */}
      <MachineExportModal
        visible={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        machines={machines}
      />

      {/* Log Meter Modal */}
      {meterMachine && (
        <MeterLogModal
          visible={Boolean(meterMachine)}
          onClose={() => setMeterMachine(null)}
          machineId={meterMachine.id}
          machineCode={meterMachine.machine_id}
          model={meterMachine.model}
          serialNumber={meterMachine.serial_number}
          onSubmit={() => {
            setMeterMachine(null);
            fetchMachines();
            queryClient.invalidateQueries({ queryKey: ['machines'] });
          }}
        />
      )}

      {/* Category-Wise Filter Sidebar Drawer */}
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
    paddingBottom: 90,
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
  resultsCountText: {
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
  endOfListText: {
  },
});
