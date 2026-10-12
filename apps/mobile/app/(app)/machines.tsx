import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  type TextInput,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme, MobileHeader, Skeleton, HeaderActionItem, KPICard, KPIGrid, Text, SearchInput, useToast, Badge } from '../../components/ui';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { MobileMachineCard } from '../../components/machines/MobileMachineCard';
import { Pressable } from '../../components/ui/touch/Pressable';
import { MachineModal } from '../../components/machines/MachineModal';
import { MachineDetailView } from '../../components/machines/MachineDetailView';
import {
  DropdownFilterSelector,
  MachineImportModal,
  MachineExportModal,
  DeleteMachineDialog,
  MobileMachineListSkeleton,
  MachineListSkeleton,
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
import {
  Search,
  Plus,
  X,
  ChevronDown,
  FileSpreadsheet,
  Wrench,
  RotateCcw,
  Printer,
  SlidersHorizontal,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Building2,
  AlertTriangle,
} from '../../components/ui/icon';

export type RentalFilterType = 'all' | 'available' | 'rented';
export type HealthFilterType = 'all' | 'active' | 'spare' | 'under_maintenance' | 'breakdown';
export type SortOptionType =
  | 'machine_id_asc'
  | 'machine_id_desc'
  | 'model_asc'
  | 'newest_yum'
  | 'oldest_yum'
  | 'highest_hmr'
  | 'lowest_hmr';

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

const MACHINE_SELECT_COLUMNS = `
  id,
  machine_id,
  model,
  serial_number,
  year_of_mfg,
  manufacturer,
  status,
  health_status,
  hour_meter,
  client_id,
  current_supervisor_id,
  supervisor_ids,
  current_operator_id,
  operator_ids,
  created_at,
  updated_at,
  client:clients!machines_client_id_fkey(
    id,
    code,
    company_name,
    city,
    state
  ),
  current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time, role),
  current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time, role)
`;

export default function MachinesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const { role, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; machineId?: string }>();
  const { toast } = useToast();

  const isHr = (role || '').toLowerCase() === 'hr';

  useEffect(() => {
    if (role && isHr) {
      router.replace('/dashboard');
    }
  }, [role, isHr, router]);

  if (role && isHr) {
    return null;
  }

  // Data states
  const [machines, setMachines] = useState<any[]>([]);
  const [supervisorsList, setSupervisorsList] = useState<Array<{ id: string; full_name: string }>>([]);
  const [clientsList, setClientsList] = useState<Array<{ id: string; company_name: string; code?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter & Search states backed by persistent AsyncStorage (auto-resets pagination to page 1)
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

  const setRentalFilter = useCallback((val: RentalFilterType | ((prev: RentalFilterType) => RentalFilterType)) => setFilter('rentalFilter', val), [setFilter]);
  const setHealthFilter = useCallback((val: HealthFilterType | ((prev: HealthFilterType) => HealthFilterType)) => setFilter('healthFilter', val), [setFilter]);
  const setSupervisorFilter = useCallback((val: string | ((prev: string) => string)) => setFilter('supervisorFilter', val), [setFilter]);
  const setClientFilter = useCallback((val: string | ((prev: string) => string)) => setFilter('clientFilter', val), [setFilter]);
  const setSortBy = useCallback((val: SortOptionType | ((prev: SortOptionType) => SortOptionType)) => setFilter('sortBy', val), [setFilter]);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [panelContentHeight, setPanelContentHeight] = useState(0);
  const isWeb = Platform.OS === 'web';

  const handleSearchSubmit = () => {
    setSearch(search, true);
  };

  const handleClearSearch = () => {
    setSearch('', true);
    searchInputRef.current?.focus();
  };


  // Smooth filter open & close animation for native platforms (web uses GPU-accelerated CSS Grid)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.timing(filterAnim, {
      toValue: filterPanelOpen ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [filterPanelOpen, filterAnim]);


  // Selection & Details view
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<'overview' | 'running_hours' | 'audit_trail'>('overview');

  // Action Modals
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [machineToEdit, setMachineToEdit] = useState<any | null>(null);
  const [deleteMachine, setDeleteMachine] = useState<any | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [meterMachine, setMeterMachine] = useState<any | null>(null);

  // Role permissions
  const normalizedRole = (role || '').toLowerCase();
  const isAdminOrManager =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'manager';
  const isSupervisor = normalizedRole === 'supervisor';
  const canCreate = isAdminOrManager;

  // Fetch machines with full hydration, role scoping, whole-DB trigram search, and resilient fallback
  const fetchMachines = useCallback(async (searchQuery?: string) => {
    try {
      setFetchError(null);

      let query = supabase
        .from('machines')
        .select(MACHINE_SELECT_COLUMNS);

      // Role scoping matching web DAL
      let opAssignedMachineId: string | null = null;
      if (normalizedRole === 'operator' && user?.id) {
        try {
          const { data: omaData } = await supabase
            .from('operator_machine_assignments')
            .select('machine_id')
            .eq('operator_id', user.id)
            .eq('is_active', true)
            .order('assigned_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (omaData?.machine_id) {
            opAssignedMachineId = omaData.machine_id;
          }
        } catch (omaErr) {
          console.warn('[MachinesScreen] Error checking active operator assignment:', omaErr);
        }

        if (opAssignedMachineId) {
          query = query.or(`id.eq.${opAssignedMachineId},current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
        } else {
          query = query.or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
        }
      } else if ((normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor') && user?.id) {
        query = query.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
      }

      // Search scope strictly machine_id, model, serial_number searching whole machine data
      const activeSearch = typeof searchQuery === 'string' ? searchQuery : debouncedSearch;
      const trimmed = activeSearch.trim();
      if (trimmed) {
        const sanitized = trimmed.replace(/[%_,()]/g, '');
        if (sanitized) {
          query = query.or(`machine_id.ilike.%${sanitized}%,model.ilike.%${sanitized}%,serial_number.ilike.%${sanitized}%`);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(100);

      let machinesData: any[] | null = data;

      // Resilient fallback if primary relational join query fails
      if (error) {
        console.warn('Primary machines relational query encountered error, falling back to base machines fetch:', error);
        let fallbackQuery = supabase
          .from('machines')
          .select(`
            id,
            machine_id,
            model,
            serial_number,
            year_of_mfg,
            manufacturer,
            status,
            health_status,
            hour_meter,
            client_id,
            current_supervisor_id,
            supervisor_ids,
            current_operator_id,
            operator_ids,
            created_at,
            updated_at
          `);

        if (normalizedRole === 'operator' && user?.id) {
          if (opAssignedMachineId) {
            fallbackQuery = fallbackQuery.or(`id.eq.${opAssignedMachineId},current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
          } else {
            fallbackQuery = fallbackQuery.or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
          }
        } else if ((normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor') && user?.id) {
          fallbackQuery = fallbackQuery.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
        }

        if (trimmed) {
          const sanitized = trimmed.replace(/[%_,()]/g, '');
          if (sanitized) {
            fallbackQuery = fallbackQuery.or(`machine_id.ilike.%${sanitized}%,model.ilike.%${sanitized}%,serial_number.ilike.%${sanitized}%`);
          }
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('created_at', { ascending: false }).limit(100);

        if (fallbackError) {
          console.error('Fallback machines query failed:', fallbackError);
          setFetchError(fallbackError.message || error.message || 'Failed to fetch machines from server.');
          return;
        }
        machinesData = fallbackData;
      }

      if (machinesData) {
        // Collect all distinct user IDs and client IDs
        const allUserIds = new Set<string>();
        const allClientIds = new Set<string>();
        const machineIds = machinesData.map((m: any) => m.id).filter(Boolean);

        machinesData.forEach((m: any) => {
          if (Array.isArray(m.supervisor_ids)) {
            m.supervisor_ids.forEach((id: string) => id && allUserIds.add(id));
          }
          if (m.current_supervisor_id) allUserIds.add(m.current_supervisor_id);
          if (Array.isArray(m.operator_ids)) {
            m.operator_ids.forEach((id: string) => id && allUserIds.add(id));
          }
          if (m.current_operator_id) allUserIds.add(m.current_operator_id);
          if (m.client_id && !m.client) allClientIds.add(m.client_id);
        });

        // Hydrate users
        let usersMap = new Map<string, any>();
        if (allUserIds.size > 0) {
          try {
            const { data: usersData } = await supabase
              .from('users')
              .select('id, full_name, phone, email, shift_start_time, shift_end_time, role')
              .in('id', Array.from(allUserIds));

            (usersData || []).forEach((u: any) => {
              const sStart = u.shift_start_time ? String(u.shift_start_time).slice(0, 5) : '';
              const sEnd = u.shift_end_time ? String(u.shift_end_time).slice(0, 5) : '';
              usersMap.set(u.id, {
                ...u,
                shift_time: (sStart && sEnd) ? `${sStart} - ${sEnd}` : null,
              });
            });
          } catch (uErr) {
            console.warn('Failed to hydrate machine personnel users:', uErr);
          }
        }

        // Hydrate clients fallback
        let clientsMap = new Map<string, any>();
        if (allClientIds.size > 0) {
          try {
            const { data: clientsData } = await supabase
              .from('clients')
              .select(`
                id,
                code,
                company_name,
                contact_person,
                phone,
                street,
                city,
                district,
                state,
                pincode,
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
              .in('id', Array.from(allClientIds));

            (clientsData || []).forEach((c: any) => {
              clientsMap.set(c.id, c);
            });
          } catch (cErr) {
            console.warn('Failed to hydrate fallback machine clients:', cErr);
          }
        }

        // Hydrate active assignments from operator_machine_assignments
        const assignmentsByMachine = new Map<string, any[]>();
        if (machineIds.length > 0) {
          try {
            const { data: assignmentsData } = await supabase
              .from('operator_machine_assignments')
              .select(`
                id,
                machine_id,
                operator_id,
                shift_start_time,
                shift_end_time,
                crosses_midnight,
                is_active,
                assigned_by,
                assigned_at,
                ended_at,
                ended_by,
                end_reason,
                created_at,
                updated_at
              `)
              .in('machine_id', machineIds)
              .eq('is_active', true)
              .order('shift_start_time', { ascending: true });

            if (assignmentsData && assignmentsData.length > 0) {
              assignmentsData.forEach((a: any) => {
                const list = assignmentsByMachine.get(a.machine_id) || [];
                list.push({
                  ...a,
                  operator: usersMap.get(a.operator_id) || null,
                });
                assignmentsByMachine.set(a.machine_id, list);
              });
            }
          } catch (assignErr) {
            console.warn('Could not hydrate operator assignments:', assignErr);
          }
        }

        const hydrated = machinesData.map((m: any) => {
          const activeAssignments = assignmentsByMachine.get(m.id) || [];

          const supIds =
            Array.isArray(m.supervisor_ids)
              ? m.supervisor_ids
              : m.current_supervisor_id
              ? [m.current_supervisor_id]
              : [];

          const opIds =
            Array.isArray(m.operator_ids)
              ? m.operator_ids
              : activeAssignments.length > 0
              ? activeAssignments.map((a: any) => a.operator_id)
              : m.current_operator_id
              ? [m.current_operator_id]
              : [];

          const formatUserShift = (u: any) => {
            if (!u) return null;
            if (u.shift_time) return u;
            const startStr = u.shift_start_time ? String(u.shift_start_time).slice(0, 5) : '';
            const endStr = u.shift_end_time ? String(u.shift_end_time).slice(0, 5) : '';
            return {
              ...u,
              shift_time: (startStr && endStr) ? `${startStr} - ${endStr}` : null,
            };
          };

          const rawSup = m.current_supervisor?.id ? formatUserShift(m.current_supervisor) : null;
          const rawOp = m.current_operator?.id ? formatUserShift(m.current_operator) : null;

          const sups = supIds
            .map((id: string) => usersMap.get(id) || (rawSup?.id === id ? rawSup : null))
            .filter(Boolean);

          const ops = opIds
            .map((id: string) => usersMap.get(id) || (rawOp?.id === id ? rawOp : null))
            .filter(Boolean);

          const clientObj = m.client || (m.client_id ? clientsMap.get(m.client_id) : null) || null;

          return {
            ...m,
            client: clientObj,
            supervisors: sups,
            operators: ops,
            active_assignments: activeAssignments,
            current_supervisor: sups[0] || rawSup || null,
            current_operator: ops[0] || rawOp || null,
          };
        });

        setMachines(hydrated);
        setFetchError(null);

        // Keep selectedMachine updated if it's currently selected
        setSelectedMachine((prev: any) => {
          if (!prev) return null;
          return hydrated.find((item: any) => item.id === prev.id) || prev;
        });
      }
    } catch (err: any) {
      console.error('Error fetching live machines:', err);
      setFetchError(err?.message || 'Network error occurred while fetching fleet machines.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [normalizedRole, user?.id, debouncedSearch]);

  // Fetch active supervisors for filter dropdown
  useEffect(() => {
    async function loadSupervisors() {
      try {
        const { data } = await supabase
          .from('users')
          .select('id, full_name')
          .in('role', ['supervisor', 'site_supervisor'])
          .order('full_name');
        if (data) {
          setSupervisorsList(data);
        }
      } catch (err) {
        console.warn('Error loading supervisors:', err);
      }
    }
    loadSupervisors();
  }, []);

  // Fetch active clients for filter dropdown
  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await supabase
          .from('clients')
          .select('id, company_name, code')
          .is('deleted_at', null)
          .order('company_name');
        if (data) {
          setClientsList(data);
        }
      } catch (err) {
        console.warn('Error loading clients:', err);
      }
    }
    loadClients();
  }, []);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

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

  // Deep Link Parameter resolution
  useEffect(() => {
    const targetId = params.id || params.machineId;
    if (targetId && machines.length > 0) {
      const found = machines.find((m) => m.id === targetId || m.machine_id === targetId);
      if (found) {
        setSelectedMachine(found);
      }
    }
  }, [params.id, params.machineId, machines]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMachines();
  }, [fetchMachines]);

  useScreenSync({
    screen: 'machines',
    onRefresh: fetchMachines,
  });

  // Dynamic Supervisor Options for DropdownFilterSelector
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

  // Dynamic Client Options for DropdownFilterSelector
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

  // Interactive KPI Metrics Summary
  const statsSummary = useMemo(() => {
    let availableCount = 0;
    let rentedCount = 0;
    let breakdownCount = 0;
    let maintenanceCount = 0;
    let spareCount = 0;

    machines.forEach((m) => {
      if (m.status === 'rented') rentedCount++;
      else availableCount++;

      if (m.health_status === 'breakdown') breakdownCount++;
      if (m.health_status === 'under_maintenance') maintenanceCount++;
      if (m.health_status === 'spare') spareCount++;
    });

    return {
      totalCount: machines.length,
      availableCount,
      rentedCount,
      breakdownCount,
      maintenanceCount,
      spareCount,
    };
  }, [machines]);

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

  // Client-side search, filtering and sorting
  const filteredAndSortedMachines = useMemo(() => {
    let list = [...machines];

    // Search query strictly scoped to machine_id, model, serial_number only
    const q = debouncedSearch.toLowerCase().trim();
    if (q) {
      list = list.filter((m) => {
        return (
          m.machine_id?.toLowerCase().includes(q) ||
          m.model?.toLowerCase().includes(q) ||
          m.serial_number?.toLowerCase().includes(q)
        );
      });
    }

    // Rental status filter
    if (rentalFilter !== 'all') {
      list = list.filter((m) => m.status === rentalFilter);
    }

    // Health status filter
    if (healthFilter !== 'all') {
      list = list.filter((m) => m.health_status === healthFilter);
    }

    // Client filter
    if (clientFilter !== 'all') {
      list = list.filter((m) => m.client_id === clientFilter);
    }

    // Supervisor filter
    if (supervisorFilter !== 'all') {
      list = list.filter((m) => {
        if (m.current_supervisor_id === supervisorFilter) return true;
        if (Array.isArray(m.supervisor_ids) && m.supervisor_ids.includes(supervisorFilter)) {
          return true;
        }
        return false;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'machine_id_asc') return (a.machine_id || '').localeCompare(b.machine_id || '');
      if (sortBy === 'machine_id_desc') return (b.machine_id || '').localeCompare(a.machine_id || '');
      if (sortBy === 'model_asc') return (a.model || '').localeCompare(b.model || '');
      if (sortBy === 'newest_yum') return (Number(b.year_of_mfg) || 0) - (Number(a.year_of_mfg) || 0);
      if (sortBy === 'oldest_yum') return (Number(a.year_of_mfg) || 0) - (Number(b.year_of_mfg) || 0);
      if (sortBy === 'highest_hmr') return (Number(b.hour_meter) || 0) - (Number(a.hour_meter) || 0);
      if (sortBy === 'lowest_hmr') return (Number(a.hour_meter) || 0) - (Number(b.hour_meter) || 0);
      return 0;
    });

    return list;
  }, [machines, debouncedSearch, rentalFilter, healthFilter, clientFilter, supervisorFilter, sortBy]);


  // Get current filter label helpers
  const currentRentalLabel =
    RENTAL_FILTER_OPTIONS.find((opt) => opt.id === rentalFilter)?.label || 'Rental Status';
  const currentHealthLabel =
    HEALTH_FILTER_OPTIONS.find((opt) => opt.id === healthFilter)?.label || 'Health Status';
  const currentClientLabel =
    clientFilterOptions.find((opt) => opt.id === clientFilter)?.label || 'Client';
  const currentSupervisorLabel =
    supervisorFilterOptions.find((opt) => opt.id === supervisorFilter)?.label || 'Supervisor';
  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort';

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

  const renderActiveFilterChips = () => {
    if (activeFilterCount === 0) return null;

    const healthVariant =
      healthFilter === 'spare'
        ? 'info'
        : healthFilter === 'breakdown'
        ? 'error'
        : healthFilter === 'under_maintenance'
        ? 'warning'
        : 'success';

    return (
      <View style={[styles.activeBadgesRow, { borderTopColor: theme.colors.hairline }]}>
        <Text variant="caption" style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
          Active Filters:
        </Text>

        {debouncedSearch.trim() !== '' && (
          <Pressable
            variant="plain"
            haptic="select"
            hitSlopToMin48
            onPress={handleClearSearch}
            accessibilityRole="button"
            accessibilityLabel={`Remove search query ${debouncedSearch}`}
          >
            <Badge variant="outline" size="md" style={styles.filterBadge}>
              <View style={styles.filterBadgeContent}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>
                  Search: "{debouncedSearch}"
                </Text>
                <X size={12} color={theme.colors.mute} />
              </View>
            </Badge>
          </Pressable>
        )}

        {rentalFilter !== 'all' && (
          <Pressable
            variant="plain"
            haptic="select"
            hitSlopToMin48
            onPress={() => setRentalFilter('all')}
            accessibilityRole="button"
            accessibilityLabel={`Remove rental filter ${currentRentalLabel}`}
          >
            <Badge variant="info" size="md" style={styles.filterBadge}>
              <View style={styles.filterBadgeContent}>
                <Text variant="caption" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                  Rental: {currentRentalLabel}
                </Text>
                <X size={12} color={isDark ? '#38bdf8' : '#0284c7'} />
              </View>
            </Badge>
          </Pressable>
        )}

        {healthFilter !== 'all' && (
          <Pressable
            variant="plain"
            haptic="select"
            hitSlopToMin48
            onPress={() => setHealthFilter('all')}
            accessibilityRole="button"
            accessibilityLabel={`Remove health filter ${currentHealthLabel}`}
          >
            <Badge variant={healthVariant} size="md" style={styles.filterBadge}>
              <View style={styles.filterBadgeContent}>
                <Text
                  variant="caption"
                  style={{
                    color:
                      healthFilter === 'spare'
                        ? isDark ? '#38bdf8' : '#0284c7'
                        : healthFilter === 'breakdown'
                        ? isDark ? '#f87171' : '#dc2626'
                        : isDark ? '#fbbf24' : '#d97706',
                  }}
                >
                  Health: {currentHealthLabel}
                </Text>
                <X
                  size={12}
                  color={
                    healthFilter === 'spare'
                      ? isDark ? '#38bdf8' : '#0284c7'
                      : healthFilter === 'breakdown'
                      ? isDark ? '#f87171' : '#dc2626'
                      : isDark ? '#fbbf24' : '#d97706'
                  }
                />
              </View>
            </Badge>
          </Pressable>
        )}

        {supervisorFilter !== 'all' && (
          <Pressable
            variant="plain"
            haptic="select"
            hitSlopToMin48
            onPress={() => setSupervisorFilter('all')}
            accessibilityRole="button"
            accessibilityLabel={`Remove supervisor filter ${currentSupervisorLabel}`}
          >
            <Badge variant="outline" size="md" style={styles.filterBadge}>
              <View style={styles.filterBadgeContent}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>
                  Supervisor: {currentSupervisorLabel}
                </Text>
                <X size={12} color={theme.colors.mute} />
              </View>
            </Badge>
          </Pressable>
        )}

        {clientFilter !== 'all' && (
          <Pressable
            variant="plain"
            haptic="select"
            hitSlopToMin48
            onPress={() => setClientFilter('all')}
            accessibilityRole="button"
            accessibilityLabel={`Remove client filter ${currentClientLabel}`}
          >
            <Badge variant="outline" size="md" style={styles.filterBadge}>
              <View style={styles.filterBadgeContent}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>
                  Client: {currentClientLabel}
                </Text>
                <X size={12} color={theme.colors.mute} />
              </View>
            </Badge>
          </Pressable>
        )}

        {sortBy !== 'machine_id_asc' && (
          <Pressable
            variant="plain"
            haptic="select"
            hitSlopToMin48
            onPress={() => setSortBy('machine_id_asc')}
            accessibilityRole="button"
            accessibilityLabel={`Reset sort filter ${currentSortLabel}`}
          >
            <Badge variant="neutral" size="md" style={styles.filterBadge}>
              <View style={styles.filterBadgeContent}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>
                  Sort: {currentSortLabel}
                </Text>
                <X size={12} color={theme.colors.mute} />
              </View>
            </Badge>
          </Pressable>
        )}

        <Pressable
          variant="buttonGhost"
          hitSlopToMin48
          onPress={handleResetAllFilters}
          style={styles.resetAllLink}
          accessibilityRole="button"
          accessibilityLabel="Reset all active filters"
        >
          <RotateCcw size={11} color={theme.colors.link} />
          <Text variant="caption" style={[styles.resetAllLinkText, { color: theme.colors.link }]}>
            Reset all
          </Text>
        </Pressable>
      </View>
    );
  };

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
          {/* Top Standardized Mobile Header matching Screenshot 1 */}
          <MobileHeader
            title="Machines"
            showBack={true}
            onPressBack={() => router.back()}
            actions={headerActions}
          />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle={isDark ? 'white' : 'black'}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.link}
          />
        }
      >
        {isLoading ? (
          <MachineListSkeleton count={3} />
        ) : (
          <>
        {/* 4-Card KPI Metric Grid (Static Clean Presentation) */}
        <KPIGrid columns={2}>
          <KPICard
            label="ASSIGNED FLEET"
            value={statsSummary.totalCount}
            variant="default"
          />

          <KPICard
            label="AVAILABLE"
            value={statsSummary.availableCount}
            variant="success"
          />

          <KPICard
            label="ON RENT"
            value={statsSummary.rentedCount}
            variant="info"
          />

          <KPICard
            label="BREAKDOWN EVENTS"
            value={statsSummary.breakdownCount}
            variant={statsSummary.breakdownCount > 0 ? 'error' : 'default'}
          />
        </KPIGrid>

        {/* FilterToolbar Container */}
        <View style={styles.filterToolbar}>
          {/* Top Search & Filter Action Row */}
          <View style={styles.toolbarTopRow}>
            {/* Search Input Bar */}
            <View style={{ flex: 1, marginRight: 8 }}>
              <SearchInput
                ref={searchInputRef}
                placeholder="Search Machine ID, Model, Serial Number..."
                placeholderTextColor={theme.colors.mute}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={handleSearchSubmit}
                onClear={handleClearSearch}
                isLoading={isSearching}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>


            {/* Filter Toggle Button */}
            <Pressable
              variant="buttonSecondary"
              onPress={() => setFilterPanelOpen((prev) => !prev)}
              style={[
                styles.filterToggleBtn,
                {
                  backgroundColor:
                    filterPanelOpen || activeFilterCount > 0
                      ? '#0284c7'
                      : theme.colors.canvas,
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
              {isWeb ? (
                <View
                  style={{
                    transform: [{ rotate: filterPanelOpen ? '180deg' : '0deg' }],
                    transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  } as any}
                >
                  <ChevronDown
                    size={13}
                    color={
                      filterPanelOpen || activeFilterCount > 0
                        ? '#ffffff'
                        : theme.colors.mute
                    }
                  />
                </View>
              ) : (
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: filterAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <ChevronDown
                    size={13}
                    color={
                      filterPanelOpen || activeFilterCount > 0
                        ? '#ffffff'
                        : theme.colors.mute
                    }
                  />
                </Animated.View>
              )}
            </Pressable>

            {/* Quick Reset Filters Button */}
            {activeFilterCount > 0 && (
              <Pressable
                variant="buttonSecondary"
                hitSlopToMin48
                onPress={handleResetAllFilters}
                style={[
                  styles.quickResetBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Reset all filters"
              >
                <RotateCcw size={13} color={theme.colors.mute} />
                <Text style={[styles.quickResetBtnText, { color: theme.colors.mute }]}>
                  Reset
                </Text>
              </Pressable>
            )}
          </View>

          {/* Instant & Smooth Animated Expandable Filter & Sort Selectors Section */}
          {isWeb ? (
            <View
              style={[
                styles.filterPanelWebContainer,
                {
                  display: 'grid',
                  gridTemplateRows: filterPanelOpen ? '1fr' : '0fr',
                  opacity: filterPanelOpen ? 1 : 0,
                  transition:
                    'grid-template-rows 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                  pointerEvents: filterPanelOpen ? 'auto' : 'none',
                } as any,
              ]}
            >
              <View style={{ minHeight: 0, overflow: 'hidden' } as any}>
                <View
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0 && Math.abs(h - panelContentHeight) > 2) {
                      setPanelContentHeight(h);
                    }
                  }}
                  style={[styles.filterPanelContent, { borderTopColor: theme.colors.hairline }]}
                >
                  {/* 5 Dimension Filter Selector Dropdowns */}
                  <View style={styles.filterSelectorsGrid}>
                    {/* 1. Rental Status Dropdown */}
                    <DropdownFilterSelector
                      label="Rental"
                      value={rentalFilter}
                      options={RENTAL_FILTER_OPTIONS}
                      onChange={(val) => setRentalFilter(val as RentalFilterType)}
                    />

                    {/* 2. Health Status Dropdown */}
                    <DropdownFilterSelector
                      label="Health"
                      value={healthFilter}
                      options={HEALTH_FILTER_OPTIONS}
                      onChange={(val) => setHealthFilter(val as HealthFilterType)}
                    />

                    {/* 3. Client Dropdown */}
                    <DropdownFilterSelector
                      label="Client"
                      value={clientFilter}
                      options={clientFilterOptions}
                      onChange={(val) => setClientFilter(val)}
                      showSearch
                    />

                    {/* 4. Supervisor Dropdown */}
                    <DropdownFilterSelector
                      label="Supervisor"
                      value={supervisorFilter}
                      options={supervisorFilterOptions}
                      onChange={(val) => setSupervisorFilter(val)}
                      showSearch
                    />

                    {/* 5. Sort By Dropdown (search bar explicitly removed) */}
                    <DropdownFilterSelector
                      label="Sort"
                      value={sortBy}
                      options={SORT_OPTIONS}
                      onChange={(val) => setSortBy(val as SortOptionType)}
                      align="right"
                      showSearch={false}
                    />
                  </View>

                  {/* Active Filter Chips Strip */}
                  {renderActiveFilterChips()}
                </View>
              </View>
            </View>
          ) : (
            <Animated.View
              style={[
                styles.filterPanelAnimatedContainer,
                {
                  maxHeight: filterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, panelContentHeight > 0 ? panelContentHeight : 140],
                  }),
                  opacity: filterAnim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0, 0.4, 1],
                  }),
                },
              ]}
            >
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0 && Math.abs(h - panelContentHeight) > 2) {
                    setPanelContentHeight(h);
                  }
                }}
                style={[styles.filterPanelContent, { borderTopColor: theme.colors.hairline }]}
              >
                {/* 5 Dimension Filter Selector Dropdowns */}
                <View style={styles.filterSelectorsGrid}>
                  {/* 1. Rental Status Dropdown */}
                  <DropdownFilterSelector
                    label="Rental"
                    value={rentalFilter}
                    options={RENTAL_FILTER_OPTIONS}
                    onChange={(val) => setRentalFilter(val as RentalFilterType)}
                  />

                  {/* 2. Health Status Dropdown */}
                  <DropdownFilterSelector
                    label="Health"
                    value={healthFilter}
                    options={HEALTH_FILTER_OPTIONS}
                    onChange={(val) => setHealthFilter(val as HealthFilterType)}
                  />

                  {/* 3. Client Dropdown */}
                  <DropdownFilterSelector
                    label="Client"
                    value={clientFilter}
                    options={clientFilterOptions}
                    onChange={(val) => setClientFilter(val)}
                    showSearch
                  />

                  {/* 4. Supervisor Dropdown */}
                  <DropdownFilterSelector
                    label="Supervisor"
                    value={supervisorFilter}
                    options={supervisorFilterOptions}
                    onChange={(val) => setSupervisorFilter(val)}
                    showSearch
                  />

                  {/* 5. Sort By Dropdown (search bar explicitly removed) */}
                  <DropdownFilterSelector
                    label="Sort"
                    value={sortBy}
                    options={SORT_OPTIONS}
                    onChange={(val) => setSortBy(val as SortOptionType)}
                    align="right"
                    showSearch={false}
                  />
                </View>

                {/* Active Filter Chips Strip */}
                {renderActiveFilterChips()}
              </View>
            </Animated.View>
          )}
        </View>

        {/* Results Count Line */}
        <View style={styles.resultsCountRow}>
          {isLoading || isSearching ? (
            <Skeleton width={160} height={14} borderRadius={radiusNumeric.sm} style={{ marginVertical: 0 }} />
          ) : (
            <Text style={[styles.resultsCountText, { color: theme.colors.mute }]}>
              Showing{' '}
              <Text variant="label" style={{ color: theme.colors.ink }}>
                {filteredAndSortedMachines.length}
              </Text>{' '}
              of {machines.length} machine assets
            </Text>
          )}
        </View>

        {/* Machine Cards List */}
        {isLoading ? (
          <MobileMachineListSkeleton count={4} />
        ) : isSearching ? (
          <MobileMachineListSkeleton count={3} />
        ) : fetchError ? (

          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <AlertCircle size={36} color={theme.colors.error} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
              Unable to load fleet machines
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
              {fetchError}
            </Text>
            <Pressable
              variant="buttonPrimary"
              onPress={() => {
                setIsLoading(true);
                fetchMachines();
              }}
              style={[styles.emptyResetBtn, { backgroundColor: theme.colors.ink }]}
            >
              <Text style={[styles.emptyResetBtnText, { color: theme.colors.canvas }]}>
                Retry Fetch
              </Text>
            </Pressable>
          </View>
        ) : filteredAndSortedMachines.length === 0 ? (
          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Search size={36} color={theme.colors.mute} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
              {debouncedSearch.trim() ? `No machines matching "${debouncedSearch.trim()}"` : 'No machines found'}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
              {debouncedSearch.trim()
                ? 'No machine matches your search across Machine ID, Model, or Serial Number.'
                : 'Try adjusting your search query or clear your active filter selections.'}
            </Text>
            {debouncedSearch.trim() ? (
              <Pressable
                variant="buttonPrimary"
                onPress={handleClearSearch}
                style={[styles.emptyResetBtn, { backgroundColor: theme.colors.ink }]}
              >
                <Text style={[styles.emptyResetBtnText, { color: theme.colors.canvas }]}>
                  Clear Search
                </Text>
              </Pressable>
            ) : activeFilterCount > 0 ? (
              <Pressable
                variant="buttonPrimary"
                onPress={handleResetAllFilters}
                style={[styles.emptyResetBtn, { backgroundColor: theme.colors.ink }]}
              >
                <Text style={[styles.emptyResetBtnText, { color: theme.colors.canvas }]}>
                  Reset All Filters
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {filteredAndSortedMachines.map((machine) => (
              <MobileMachineCard
                key={machine.id}
                machine={machine}
                isAdmin={isAdminOrManager}
                isSupervisor={isSupervisor}
                searchTerm={debouncedSearch}
                onViewDetails={(m) => {
                  setSelectedMachine(m);
                  setDetailInitialTab('overview');
                }}
                onViewHistory={(m) => {
                  setSelectedMachine(m);
                  setDetailInitialTab('running_hours');
                }}
                onEdit={(m) => {
                  setMachineToEdit(m);
                  setMachineModalOpen(true);
                }}
                onDelete={(m) => setDeleteMachine(m)}
                onLogMeter={(m) => setMeterMachine(m)}
              />
            ))}
          </View>
        )}

        {/* Bottom "All machines have been displayed" divider matching Screenshot 1 */}
        {filteredAndSortedMachines.length > 0 && (
          <View style={styles.endOfListRow}>
            <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
            <Text variant="caption" style={[styles.endOfListText, { color: theme.colors.mute }]}>
              All machines have been displayed
            </Text>
            <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
          </View>
        )}
          </>
        )}
      </ScrollView>
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
            toast('success', isEdit ? 'Machine Updated' : 'Machine Added', `Asset ${savedMachine.model || 'record'} (${savedMachine.serial_number || savedMachine.machine_id || ''}) saved successfully.`);
            setMachines((prev) => {
              const existingIdx = prev.findIndex((m) => m.id === savedMachine.id);
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = { ...next[existingIdx], ...savedMachine };
                return next;
              }
              return [savedMachine, ...prev];
            });
            queryClient.setQueriesData<any[]>({ queryKey: ['machines'] }, (old) => {
              if (!old) return [savedMachine];
              const existingIdx = old.findIndex((m) => m.id === savedMachine.id);
              if (existingIdx >= 0) {
                const next = [...old];
                next[existingIdx] = { ...next[existingIdx], ...savedMachine };
                return next;
              }
              return [savedMachine, ...old];
            });
          }
          fetchMachines();
        }}
        machineToEdit={machineToEdit}
        userRole={role}
      />

      {/* Delete Machine Dialog */}
      <DeleteMachineDialog
        visible={Boolean(deleteMachine)}
        machine={deleteMachine}
        onClose={() => setDeleteMachine(null)}
        onConfirm={async () => {
          if (!deleteMachine?.id) return;
          const target = deleteMachine;
          const prevMachines = machines;
          // Optimistically remove immediately from local state and query cache
          setMachines((prev) => prev.filter((m) => m.id !== target.id));
          queryClient.setQueriesData<any[]>({ queryKey: ['machines'] }, (old) => {
            if (!old) return old;
            return old.filter((m) => m.id !== target.id);
          });
          setDeleteMachine(null);
          try {
            const { error } = await supabase.from('machines').delete().eq('id', target.id);
            if (error) {
              // Rollback
              setMachines(prevMachines);
              queryClient.setQueriesData({ queryKey: ['machines'] }, prevMachines);
              haptics.reject();
              toast('error', 'Delete Failed', error.message || 'Failed to delete machine.');
              return;
            }
            haptics.confirm();
            toast('success', 'Machine Deleted', `Machine asset ${target.machine_id || 'record'} removed from active fleet.`);
            notifyMachineDeleted(target.machine_id || 'Machine');
            fetchMachines();
          } catch (err: any) {
            setMachines(prevMachines);
            queryClient.setQueriesData({ queryKey: ['machines'] }, prevMachines);
            haptics.reject();
            toast('error', 'Delete Failed', err?.message || 'Failed to delete machine.');
          }
        }}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radiusNumeric.md,
  },
  addBtnText: {
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    paddingBottom: 90,
    gap: spacingNumeric.md,
  },
  filterToolbar: {
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.xs,
  },
  toolbarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputText: {
    flex: 1,
    paddingVertical: 0,
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  searchClearBtn: {
    padding: 3,
    marginLeft: 4,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterToggleBtnText: {
  },
  activeCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCountBadgeText: {
  },
  quickResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 11,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  quickResetBtnText: {
  },
  filterPanelWebContainer: {
    overflow: 'hidden',
  },
  filterPanelAnimatedContainer: {
    overflow: 'hidden',
  },
  filterPanelContent: {
    paddingTop: 10,
    borderTopWidth: 1,
    gap: spacingNumeric.sm,
  },
  filterSelectorsGrid: {
    flexDirection: 'column',
    gap: 8,
    width: '100%',
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
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  filterBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resetAllLinkText: {
  },
  resultsCountRow: {
    paddingHorizontal: 2,
    marginTop: -4,
  },
  resultsCountText: {
  },
  cardsContainer: {
    gap: spacingNumeric.md,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
  },
  emptyContainer: {
    padding: 32,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  emptyTitle: {
  },
  emptySubtext: {
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radiusNumeric.md,
  },
  emptyResetBtnText: {
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
