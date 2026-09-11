import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme, MobileHeader, Skeleton, HeaderActionItem } from '../../components/ui';
import { MobileMachineCard } from '../../components/machines/MobileMachineCard';
import { MachineModal } from '../../components/machines/MachineModal';
import { MachineDetailView } from '../../components/machines/MachineDetailView';
import {
  DropdownFilterSelector,
  MachineImportModal,
  MachineExportModal,
  DeleteMachineDialog,
  MobileMachineListSkeleton,
  type FilterOption,
} from '../../components/machines';

import { MeterLogModal } from '../../components/work/MeterLogModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
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
} from 'lucide-react-native';

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
    contact_person,
    phone,
    address,
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
  ),
  current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email, shift_time, role),
  current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email, shift_time, role)
`;

export default function MachinesScreen() {
  const { theme, isDark } = useTheme();
  const { role, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; machineId?: string }>();

  // Data states
  const [machines, setMachines] = useState<any[]>([]);
  const [supervisorsList, setSupervisorsList] = useState<Array<{ id: string; full_name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [rentalFilter, setRentalFilter] = useState<RentalFilterType>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilterType>('all');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOptionType>('machine_id_asc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [panelContentHeight, setPanelContentHeight] = useState(0);
  const isWeb = Platform.OS === 'web';

  // Snappy 280ms search debounce for fluid typing and instant skeleton loading
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === debouncedSearch.trim()) {
      setIsSearching(false);
      return;
    }

    if (trimmed === '') {
      setDebouncedSearch('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed);
      setIsSearching(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const handleSearchSubmit = () => {
    const trimmed = search.trim();
    setDebouncedSearch(trimmed);
    setIsSearching(false);
  };

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    setIsSearching(false);
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
    normalizedRole === 'manager' ||
    normalizedRole === 'service_manager';
  const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor';
  const canCreate = isAdminOrManager;

  // Fetch machines with full hydration, role scoping and resilient fallback
  const fetchMachines = useCallback(async () => {
    try {
      setFetchError(null);

      let query = supabase
        .from('machines')
        .select(MACHINE_SELECT_COLUMNS);

      // Role scoping matching web DAL
      if (normalizedRole === 'operator' && user?.id) {
        query = query.or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
      } else if ((normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor') && user?.id) {
        query = query.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

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
          fallbackQuery = fallbackQuery.or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
        } else if ((normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor') && user?.id) {
          fallbackQuery = fallbackQuery.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('created_at', { ascending: false });

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
              .select('id, full_name, phone, email, shift_time, role')
              .in('id', Array.from(allUserIds));

            (usersData || []).forEach((u: any) => {
              usersMap.set(u.id, u);
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
                address,
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
            Array.isArray(m.supervisor_ids) && m.supervisor_ids.length > 0
              ? m.supervisor_ids
              : m.current_supervisor_id
              ? [m.current_supervisor_id]
              : [];

          const opIds =
            activeAssignments.length > 0
              ? activeAssignments.map((a: any) => a.operator_id)
              : Array.isArray(m.operator_ids) && m.operator_ids.length > 0
              ? m.operator_ids
              : m.current_operator_id
              ? [m.current_operator_id]
              : [];

          const sups = supIds
            .map((id: string) => usersMap.get(id) || (m.current_supervisor?.id === id ? m.current_supervisor : null))
            .filter(Boolean);

          const ops = opIds
            .map((id: string) => usersMap.get(id) || (m.current_operator?.id === id ? m.current_operator : null))
            .filter(Boolean);

          const clientObj = m.client || (m.client_id ? clientsMap.get(m.client_id) : null) || null;

          return {
            ...m,
            client: clientObj,
            supervisors: sups,
            operators: ops,
            active_assignments: activeAssignments,
            current_supervisor: sups[0] || m.current_supervisor || null,
            current_operator: ops[0] || m.current_operator || null,
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
  }, [normalizedRole, user?.id]);

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
    if (supervisorFilter !== 'all') count++;
    if (debouncedSearch.trim() !== '') count++;
    if (sortBy !== 'machine_id_asc') count++;
    return count;
  }, [rentalFilter, healthFilter, supervisorFilter, debouncedSearch, sortBy]);

  const handleResetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setIsSearching(false);
    setRentalFilter('all');
    setHealthFilter('all');
    setSupervisorFilter('all');
    setSortBy('machine_id_asc');
  };

  // Client-side search, filtering and sorting
  const filteredAndSortedMachines = useMemo(() => {
    let list = [...machines];

    // Search query matching web logic using debouncedSearch
    const q = debouncedSearch.toLowerCase().trim();
    if (q) {
      list = list.filter((m) => {
        return (
          m.machine_id?.toLowerCase().includes(q) ||
          m.model?.toLowerCase().includes(q) ||
          m.serial_number?.toLowerCase().includes(q) ||
          m.manufacturer?.toLowerCase().includes(q) ||
          m.year_of_mfg?.toLowerCase().includes(q) ||
          m.client?.company_name?.toLowerCase().includes(q) ||
          m.client?.code?.toLowerCase().includes(q) ||
          m.client?.city?.toLowerCase().includes(q) ||
          m.client?.state?.toLowerCase().includes(q) ||
          (Array.isArray(m.supervisors) &&
            m.supervisors.some((s: any) => s.full_name?.toLowerCase().includes(q))) ||
          (Array.isArray(m.operators) &&
            m.operators.some((o: any) => o.full_name?.toLowerCase().includes(q)))
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
      if (sortBy === 'newest_yum') return (b.year_of_mfg || '').localeCompare(a.year_of_mfg || '');
      if (sortBy === 'oldest_yum') return (a.year_of_mfg || '').localeCompare(b.year_of_mfg || '');
      if (sortBy === 'highest_hmr') return (Number(b.hour_meter) || 0) - (Number(a.hour_meter) || 0);
      if (sortBy === 'lowest_hmr') return (Number(a.hour_meter) || 0) - (Number(b.hour_meter) || 0);
      return 0;
    });

    return list;
  }, [machines, debouncedSearch, rentalFilter, healthFilter, supervisorFilter, sortBy]);


  // Get current filter label helpers
  const currentRentalLabel =
    RENTAL_FILTER_OPTIONS.find((opt) => opt.id === rentalFilter)?.label || 'Rental Status';
  const currentHealthLabel =
    HEALTH_FILTER_OPTIONS.find((opt) => opt.id === healthFilter)?.label || 'Health Status';
  const currentSupervisorLabel =
    supervisorFilterOptions.find((opt) => opt.id === supervisorFilter)?.label || 'Supervisor';
  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort';

  const headerActions = useMemo<HeaderActionItem[]>(() => {
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

    list.push({
      id: 'refresh-fleet',
      label: 'Refresh Fleet Machinery',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => fetchMachines(),
    });

    return list;
  }, [canCreate, theme.colors.ink, handleResetAllFilters, fetchMachines]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {selectedMachine ? (
        <MachineDetailView
          machine={selectedMachine}
          onBack={() => setSelectedMachine(null)}
          onMachineUpdated={() => {
            fetchMachines();
          }}
          onMachineDeleted={() => {
            setSelectedMachine(null);
            fetchMachines();
          }}
          userRole={role}
        />
      ) : (
        <>
          {/* Top Standardized Mobile Header: [Logo] + [Page Title] + [Quick Access] + [3-Dot Actions] */}
          <MobileHeader
            title="Machine Directory"
            actions={headerActions}
          />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.link}
          />
        }
      >
        {/* Interactive 4-Card KPI Metric Grid */}
        <View style={styles.kpiGrid}>
          {/* Total Machines Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setRentalFilter('all');
              setHealthFilter('all');
            }}
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor:
                  rentalFilter === 'all' && healthFilter === 'all'
                    ? theme.colors.ink
                    : theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>TOTAL MACHINES</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>{statsSummary.totalCount}</Text>
          </TouchableOpacity>

          {/* Available Fleet Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setRentalFilter((prev) => (prev === 'available' ? 'all' : 'available'));
            }}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  rentalFilter === 'available'
                    ? isDark ? '#064e3b26' : '#ecfdf5'
                    : theme.colors.canvasElevated,
                borderColor: rentalFilter === 'available' ? '#10b981' : theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#10b981' }]}>AVAILABLE FLEET</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{statsSummary.availableCount}</Text>
          </TouchableOpacity>

          {/* On Rent Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setRentalFilter((prev) => (prev === 'rented' ? 'all' : 'rented'));
            }}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  rentalFilter === 'rented'
                    ? isDark ? '#0c4a6e26' : '#f0f9ff'
                    : theme.colors.canvasElevated,
                borderColor: rentalFilter === 'rented' ? '#0ea5e9' : theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#0ea5e9' }]}>ON RENT</Text>
            <Text style={[styles.kpiValue, { color: '#0284c7' }]}>{statsSummary.rentedCount}</Text>
          </TouchableOpacity>

          {/* Breakdown Events Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setHealthFilter((prev) => (prev === 'breakdown' ? 'all' : 'breakdown'));
            }}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  healthFilter === 'breakdown'
                    ? isDark ? '#7f1d1d26' : '#fff1f2'
                    : theme.colors.canvasElevated,
                borderColor: healthFilter === 'breakdown' ? '#ef4444' : theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#ef4444' }]}>BREAKDOWN EVENTS</Text>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{statsSummary.breakdownCount}</Text>
          </TouchableOpacity>
        </View>

        {/* FilterToolbar Card Wrapper */}
        <View
          style={[
            styles.filterToolbar,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Top Search & Filter Action Row */}
          <View style={styles.toolbarTopRow}>
            {/* Search Input Bar (Capsule Pill with Web outline suppression & Focus Ring) */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => searchInputRef.current?.focus()}
              style={[
                styles.searchBarBox,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: isSearchFocused ? theme.colors.ink : theme.colors.hairline,
                },
                isSearchFocused && Platform.OS === 'web' && ({
                  boxShadow: isDark
                    ? '0 0 0 1px rgba(255, 255, 255, 0.35)'
                    : '0 0 0 1px rgba(0, 0, 0, 0.22)',
                } as any),
              ]}
            >
              {isSearching ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.mute}
                  style={styles.searchIcon}
                />
              ) : (
                <Search
                  size={15}
                  color={isSearchFocused ? theme.colors.ink : theme.colors.mute}
                  style={styles.searchIcon}
                />
              )}
              <TextInput
                ref={searchInputRef}
                placeholder="Search Machine ID, Model, Serial Number..."
                placeholderTextColor={theme.colors.mute}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={handleSearchSubmit}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                style={[
                  styles.searchInputText,
                  { color: theme.colors.ink },
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={styles.searchClearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Clear search"
                >
                  <X size={14} color={theme.colors.mute} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>


            {/* Filter Toggle Button */}
            <TouchableOpacity
              onPress={() => setFilterPanelOpen((prev) => !prev)}
              activeOpacity={0.8}
              style={[
                styles.filterToggleBtn,
                {
                  backgroundColor:
                    filterPanelOpen || activeFilterCount > 0
                      ? theme.colors.ink
                      : theme.colors.canvas,
                  borderColor:
                    filterPanelOpen || activeFilterCount > 0
                      ? theme.colors.ink
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
                    ? theme.colors.canvas
                    : theme.colors.ink
                }
              />
              <Text
                style={[
                  styles.filterToggleBtnText,
                  {
                    color:
                      filterPanelOpen || activeFilterCount > 0
                        ? theme.colors.canvas
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
                          ? theme.colors.canvas
                          : theme.colors.ink,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.activeCountBadgeText,
                      {
                        color:
                          filterPanelOpen || activeFilterCount > 0
                            ? theme.colors.ink
                            : theme.colors.canvas,
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
                        ? theme.colors.canvas
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
                        ? theme.colors.canvas
                        : theme.colors.mute
                    }
                  />
                </Animated.View>
              )}
            </TouchableOpacity>

            {/* Quick Reset Filters Button */}
            {activeFilterCount > 0 && (
              <TouchableOpacity
                onPress={handleResetAllFilters}
                activeOpacity={0.8}
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
              </TouchableOpacity>
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
                  {/* 4 Dimension Filter Selector Dropdowns */}
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

                    {/* 3. Supervisor Dropdown */}
                    <DropdownFilterSelector
                      label="Supervisor"
                      value={supervisorFilter}
                      options={supervisorFilterOptions}
                      onChange={(val) => setSupervisorFilter(val)}
                      showSearch
                    />

                    {/* 4. Sort By Dropdown (search bar explicitly removed) */}
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
                  {activeFilterCount > 0 && (
                    <View style={[styles.activeBadgesRow, { borderTopColor: theme.colors.hairline }]}>
                      <Text style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
                        Active Filters:
                      </Text>
                      {debouncedSearch.trim() !== '' && (
                        <TouchableOpacity
                          onPress={handleClearSearch}
                          style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                        >
                          <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                            Search: "{debouncedSearch}"
                          </Text>
                          <X size={12} color={theme.colors.mute} />
                        </TouchableOpacity>
                      )}


                      {rentalFilter !== 'all' && (
                        <TouchableOpacity
                          onPress={() => setRentalFilter('all')}
                          style={[
                            styles.badgeChip,
                            {
                              backgroundColor: isDark ? '#0c4a6e26' : '#f0f9ff',
                              borderColor: '#0ea5e933',
                            },
                          ]}
                        >
                          <Text style={[styles.badgeChipText, { color: '#0284c7' }]}>
                            Rental: {currentRentalLabel}
                          </Text>
                          <X size={12} color="#0284c7" />
                        </TouchableOpacity>
                      )}

                      {healthFilter !== 'all' && (
                        <TouchableOpacity
                          onPress={() => setHealthFilter('all')}
                          style={[
                            styles.badgeChip,
                            {
                              backgroundColor:
                                healthFilter === 'spare'
                                  ? isDark ? '#164e6326' : '#ecfeff'
                                  : healthFilter === 'breakdown'
                                  ? isDark ? '#7f1d1d26' : '#fff1f2'
                                  : isDark ? '#78350f26' : '#fffbeb',
                              borderColor:
                                healthFilter === 'spare'
                                  ? '#06b6d433'
                                  : healthFilter === 'breakdown'
                                  ? '#ef444433'
                                  : '#f59e0b33',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeChipText,
                              {
                                color:
                                  healthFilter === 'spare'
                                    ? '#0891b2'
                                    : healthFilter === 'breakdown'
                                    ? '#dc2626'
                                    : '#d97706',
                              },
                            ]}
                          >
                            Health: {currentHealthLabel}
                          </Text>
                          <X
                            size={12}
                            color={
                              healthFilter === 'spare'
                                ? '#0891b2'
                                : healthFilter === 'breakdown'
                                ? '#dc2626'
                                : '#d97706'
                            }
                          />
                        </TouchableOpacity>
                      )}

                      {supervisorFilter !== 'all' && (
                        <TouchableOpacity
                          onPress={() => setSupervisorFilter('all')}
                          style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                        >
                          <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                            Supervisor: {currentSupervisorLabel}
                          </Text>
                          <X size={12} color={theme.colors.mute} />
                        </TouchableOpacity>
                      )}

                      {sortBy !== 'machine_id_asc' && (
                        <TouchableOpacity
                          onPress={() => setSortBy('machine_id_asc')}
                          style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                        >
                          <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                            Sort: {currentSortLabel}
                          </Text>
                          <X size={12} color={theme.colors.mute} />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={handleResetAllFilters}
                        style={styles.resetAllLink}
                      >
                        <RotateCcw size={11} color={theme.colors.link} />
                        <Text style={[styles.resetAllLinkText, { color: theme.colors.link }]}>
                          Reset all
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
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
                {/* 4 Dimension Filter Selector Dropdowns */}
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

                  {/* 3. Supervisor Dropdown */}
                  <DropdownFilterSelector
                    label="Supervisor"
                    value={supervisorFilter}
                    options={supervisorFilterOptions}
                    onChange={(val) => setSupervisorFilter(val)}
                    showSearch
                  />

                  {/* 4. Sort By Dropdown (search bar explicitly removed) */}
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
                {activeFilterCount > 0 && (
                  <View style={[styles.activeBadgesRow, { borderTopColor: theme.colors.hairline }]}>
                    <Text style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
                      Active Filters:
                    </Text>
                    {debouncedSearch.trim() !== '' && (
                      <TouchableOpacity
                        onPress={handleClearSearch}
                        style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                      >
                        <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                          Search: "{debouncedSearch}"
                        </Text>
                        <X size={12} color={theme.colors.mute} />
                      </TouchableOpacity>
                    )}


                    {rentalFilter !== 'all' && (
                      <TouchableOpacity
                        onPress={() => setRentalFilter('all')}
                        style={[
                          styles.badgeChip,
                          {
                            backgroundColor: isDark ? '#0c4a6e26' : '#f0f9ff',
                            borderColor: '#0ea5e933',
                          },
                        ]}
                      >
                        <Text style={[styles.badgeChipText, { color: '#0284c7' }]}>
                          Rental: {currentRentalLabel}
                        </Text>
                        <X size={12} color="#0284c7" />
                      </TouchableOpacity>
                    )}

                    {healthFilter !== 'all' && (
                      <TouchableOpacity
                        onPress={() => setHealthFilter('all')}
                        style={[
                          styles.badgeChip,
                          {
                            backgroundColor:
                              healthFilter === 'spare'
                                ? isDark ? '#164e6326' : '#ecfeff'
                                : healthFilter === 'breakdown'
                                ? isDark ? '#7f1d1d26' : '#fff1f2'
                                : isDark ? '#78350f26' : '#fffbeb',
                            borderColor:
                              healthFilter === 'spare'
                                ? '#06b6d433'
                                : healthFilter === 'breakdown'
                                ? '#ef444433'
                                : '#f59e0b33',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeChipText,
                            {
                              color:
                                healthFilter === 'spare'
                                  ? '#0891b2'
                                  : healthFilter === 'breakdown'
                                  ? '#dc2626'
                                  : '#d97706',
                            },
                          ]}
                        >
                          Health: {currentHealthLabel}
                        </Text>
                        <X
                          size={12}
                          color={
                            healthFilter === 'spare'
                              ? '#0891b2'
                              : healthFilter === 'breakdown'
                              ? '#dc2626'
                              : '#d97706'
                          }
                        />
                      </TouchableOpacity>
                    )}

                    {supervisorFilter !== 'all' && (
                      <TouchableOpacity
                        onPress={() => setSupervisorFilter('all')}
                        style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                      >
                        <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                          Supervisor: {currentSupervisorLabel}
                        </Text>
                        <X size={12} color={theme.colors.mute} />
                      </TouchableOpacity>
                    )}

                    {sortBy !== 'machine_id_asc' && (
                      <TouchableOpacity
                        onPress={() => setSortBy('machine_id_asc')}
                        style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                      >
                        <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                          Sort: {currentSortLabel}
                        </Text>
                        <X size={12} color={theme.colors.mute} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={handleResetAllFilters}
                      style={styles.resetAllLink}
                    >
                      <RotateCcw size={11} color={theme.colors.link} />
                      <Text style={[styles.resetAllLinkText, { color: theme.colors.link }]}>
                        Reset all
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
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
              <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
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
            <TouchableOpacity
              onPress={() => {
                setIsLoading(true);
                fetchMachines();
              }}
              style={[styles.emptyResetBtn, { backgroundColor: theme.colors.ink }]}
            >
              <Text style={[styles.emptyResetBtnText, { color: theme.colors.canvas }]}>
                Retry Fetch
              </Text>
            </TouchableOpacity>
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
            <Wrench size={36} color={theme.colors.mute} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
              No machines found
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
              Try adjusting your search query or clear your active filter selections.
            </Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity
                onPress={handleResetAllFilters}
                style={[styles.emptyResetBtn, { backgroundColor: theme.colors.ink }]}
              >
                <Text style={[styles.emptyResetBtnText, { color: theme.colors.canvas }]}>
                  Reset All Filters
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {filteredAndSortedMachines.map((machine) => (
              <MobileMachineCard
                key={machine.id}
                machine={machine}
                isAdmin={isAdminOrManager}
                isSupervisor={isSupervisor}
                onViewDetails={(m) => setSelectedMachine(m)}
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
      </ScrollView>
        </>
      )}


      {/* Add / Edit Machine Modal */}
      <MachineModal
        visible={machineModalOpen}
        onClose={() => setMachineModalOpen(false)}
        onSuccess={() => {
          setMachineModalOpen(false);
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
        onDeleted={() => {
          setDeleteMachine(null);
          fetchMachines();
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
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    paddingBottom: 90,
    gap: spacingNumeric.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  filterToolbar: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: spacingNumeric.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
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
    fontSize: 13,
    paddingVertical: 0,
    height: '100%',
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
    fontSize: 12,
    fontWeight: '700',
  },
  activeCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
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
    fontSize: 12,
    fontWeight: '600',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  badgeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resetAllLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resultsCountRow: {
    paddingHorizontal: 2,
    marginTop: -4,
  },
  resultsCountText: {
    fontSize: 12,
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
    fontSize: 13,
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
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radiusNumeric.md,
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
