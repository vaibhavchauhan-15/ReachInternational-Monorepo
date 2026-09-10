import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Input, useTheme, MobileHeader } from '../../components/ui';
import { MobileMachineCard } from '../../components/machines/MobileMachineCard';
import { MachineModal } from '../../components/machines/MachineModal';
import { MachineDetailView } from '../../components/machines/MachineDetailView';
import { DeleteMachineDialog } from '../../components/machines/DeleteMachineDialog';
import { MachineImportModal } from '../../components/machines/MachineImportModal';
import { CustomFilterSelectorModal, type FilterOption } from '../../components/machines/CustomFilterSelectorModal';
import { MachineExportModal } from '../../components/machines/MachineExportModal';
import { MachineCategoryModal } from '../../components/machines/MachineCategoryModal';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Search,
  Plus,
  X,
  ChevronDown,
  RefreshCw,
  FileSpreadsheet,
  Wrench,
  RotateCcw,
  Printer,
  FolderTree,
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

export default function MachinesScreen() {
  const { theme, isDark } = useTheme();
  const { role } = useAuth();
  const params = useLocalSearchParams<{ id?: string; machineId?: string }>();

  // Data states
  const [machines, setMachines] = useState<any[]>([]);
  const [supervisorsList, setSupervisorsList] = useState<Array<{ id: string; full_name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [rentalFilter, setRentalFilter] = useState<RentalFilterType>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilterType>('all');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOptionType>('machine_id_asc');

  // Filter Selector Modal states
  const [activePickerModal, setActivePickerModal] = useState<
    'rental' | 'health' | 'supervisor' | 'sort' | null
  >(null);

  // Selection & Details view
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);

  // Action Modals
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [machineToEdit, setMachineToEdit] = useState<any | null>(null);
  const [deleteMachine, setDeleteMachine] = useState<any | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
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

  // Fetch machines with full hydration
  const fetchMachines = useCallback(async () => {
    try {
      const { data, error } = await supabase
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
          customer_name,
          client_id,
          current_supervisor_id,
          supervisor_ids,
          current_operator_id,
          operator_ids,
          client:clients!machines_client_id_fkey(
            id,
            code,
            company_name,
            contact_person,
            phone,
            email,
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
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching machines:', error);
      } else if (data) {
        // Collect all distinct user IDs for supervisors and operators
        const allUserIds = new Set<string>();
        data.forEach((m: any) => {
          if (Array.isArray(m.supervisor_ids)) {
            m.supervisor_ids.forEach((id: string) => id && allUserIds.add(id));
          }
          if (m.current_supervisor_id) allUserIds.add(m.current_supervisor_id);
          if (Array.isArray(m.operator_ids)) {
            m.operator_ids.forEach((id: string) => id && allUserIds.add(id));
          }
          if (m.current_operator_id) allUserIds.add(m.current_operator_id);
        });

        let usersMap = new Map<string, any>();
        if (allUserIds.size > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, full_name, phone, email, shift_time, role')
            .in('id', Array.from(allUserIds));

          (usersData || []).forEach((u: any) => {
            usersMap.set(u.id, u);
          });
        }

        const hydrated = data.map((m: any) => {
          const sups =
            Array.isArray(m.supervisor_ids) && m.supervisor_ids.length > 0
              ? m.supervisor_ids
                  .map((id: string) => usersMap.get(id) || (m.current_supervisor?.id === id ? m.current_supervisor : null))
                  .filter(Boolean)
              : m.current_supervisor
              ? [m.current_supervisor]
              : [];

          const ops =
            Array.isArray(m.operator_ids) && m.operator_ids.length > 0
              ? m.operator_ids
                  .map((id: string) => usersMap.get(id) || (m.current_operator?.id === id ? m.current_operator : null))
                  .filter(Boolean)
              : m.current_operator
              ? [m.current_operator]
              : [];

          return {
            ...m,
            supervisors: sups,
            operators: ops,
          };
        });

        setMachines(hydrated);

        // Keep selectedMachine updated if it's currently selected
        if (selectedMachine) {
          const refreshedMatch = hydrated.find((item: any) => item.id === selectedMachine.id);
          if (refreshedMatch) {
            setSelectedMachine(refreshedMatch);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live machines:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [selectedMachine]);

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
  }, []);

  // Hardware Back Button handling on Android
  useEffect(() => {
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

  // Statistics calculation
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
      total: machines.length,
      availableCount,
      rentedCount,
      breakdownCount,
      maintenanceCount,
      spareCount,
    };
  }, [machines]);

  // Dynamic Supervisor Options for CustomFilterSelectorModal
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

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (rentalFilter !== 'all') count++;
    if (healthFilter !== 'all') count++;
    if (supervisorFilter !== 'all') count++;
    if (search.trim() !== '') count++;
    if (sortBy !== 'machine_id_asc') count++;
    return count;
  }, [rentalFilter, healthFilter, supervisorFilter, search, sortBy]);

  const handleResetAllFilters = () => {
    setSearch('');
    setRentalFilter('all');
    setHealthFilter('all');
    setSupervisorFilter('all');
    setSortBy('machine_id_asc');
  };

  // Client-side search, filtering and sorting
  const filteredAndSortedMachines = useMemo(() => {
    let list = [...machines];

    // Search query
    const q = search.toLowerCase().trim();
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
          m.customer_name?.toLowerCase().includes(q) ||
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
  }, [machines, search, rentalFilter, healthFilter, supervisorFilter, sortBy]);

  // If a machine is selected, render the full-featured MachineDetailView directly
  if (selectedMachine) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
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
      </View>
    );
  }

  // Get current filter label helpers
  const currentRentalLabel =
    RENTAL_FILTER_OPTIONS.find((opt) => opt.id === rentalFilter)?.label || 'Rental Status';
  const currentHealthLabel =
    HEALTH_FILTER_OPTIONS.find((opt) => opt.id === healthFilter)?.label || 'Health Status';
  const currentSupervisorLabel =
    supervisorFilterOptions.find((opt) => opt.id === supervisorFilter)?.label || 'Supervisor';
  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Mobile Header */}
      <MobileHeader
        eyebrow="FLEET ASSETS"
        title="Machine Directory"
        subtitle="Industrial machinery assets, HMR meter readings & personnel assignments"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setExportModalOpen(true)}
              style={[
                styles.headerIconBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvasElevated,
                },
              ]}
              accessibilityLabel="Export Fleet Directory"
            >
              <Printer size={15} color={theme.colors.mute} />
            </TouchableOpacity>

            {isAdminOrManager && (
              <TouchableOpacity
                onPress={() => setCategoryModalOpen(true)}
                style={[
                  styles.headerIconBtn,
                  {
                    borderColor: theme.colors.hairline,
                    backgroundColor: theme.colors.canvasElevated,
                  },
                ]}
                accessibilityLabel="Manage Categories"
              >
                <FolderTree size={15} color={theme.colors.mute} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setImportModalOpen(true)}
              style={[
                styles.headerIconBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvasElevated,
                },
              ]}
              accessibilityLabel="Bulk Excel Import Guide"
            >
              <FileSpreadsheet size={16} color={theme.colors.mute} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onRefresh}
              style={[
                styles.headerIconBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvasElevated,
                },
              ]}
              accessibilityLabel="Refresh Fleet Data"
            >
              <RefreshCw size={15} color={theme.colors.mute} />
            </TouchableOpacity>

            {canCreate && (
              <TouchableOpacity
                onPress={() => {
                  setMachineToEdit(null);
                  setMachineModalOpen(true);
                }}
                style={[styles.addBtn, { backgroundColor: theme.colors.ink }]}
                activeOpacity={0.8}
                accessibilityLabel="Add Machine"
              >
                <Plus size={14} color={theme.colors.canvas} />
                <Text style={[styles.addBtnText, { color: theme.colors.canvas }]}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        }
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
        {/* Interactive KPI Statistic Cards Grid (2x2 matching Web & Tokens) */}
        <View style={styles.kpiGrid}>
          {/* 1. Total Machines Card */}
          <TouchableOpacity
            onPress={() => setRentalFilter('all')}
            activeOpacity={0.7}
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor:
                  rentalFilter === 'all' ? theme.colors.ink : theme.colors.hairline,
                borderWidth: rentalFilter === 'all' ? 1.5 : 1,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>
              TOTAL MACHINES
            </Text>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
              {statsSummary.total}
            </Text>
          </TouchableOpacity>

          {/* 2. Available Fleet Card */}
          <TouchableOpacity
            onPress={() => setRentalFilter(rentalFilter === 'available' ? 'all' : 'available')}
            activeOpacity={0.7}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  rentalFilter === 'available'
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.12)'
                      : '#ecfdf5'
                    : theme.colors.canvasElevated,
                borderColor:
                  rentalFilter === 'available' ? '#10b981' : theme.colors.hairline,
                borderWidth: rentalFilter === 'available' ? 1.5 : 1,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#10b981' }]}>
              AVAILABLE FLEET
            </Text>
            <Text style={[styles.kpiValue, { color: isDark ? '#34d399' : '#059669' }]}>
              {statsSummary.availableCount}
            </Text>
          </TouchableOpacity>

          {/* 3. On Rent Card */}
          <TouchableOpacity
            onPress={() => setRentalFilter(rentalFilter === 'rented' ? 'all' : 'rented')}
            activeOpacity={0.7}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  rentalFilter === 'rented'
                    ? isDark
                      ? 'rgba(14, 165, 233, 0.12)'
                      : '#f0f9ff'
                    : theme.colors.canvasElevated,
                borderColor:
                  rentalFilter === 'rented' ? '#0ea5e9' : theme.colors.hairline,
                borderWidth: rentalFilter === 'rented' ? 1.5 : 1,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#0ea5e9' }]}>
              ON RENT
            </Text>
            <Text style={[styles.kpiValue, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
              {statsSummary.rentedCount}
            </Text>
          </TouchableOpacity>

          {/* 4. Breakdown Events Card */}
          <TouchableOpacity
            onPress={() => setHealthFilter(healthFilter === 'breakdown' ? 'all' : 'breakdown')}
            activeOpacity={0.7}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  healthFilter === 'breakdown'
                    ? isDark
                      ? 'rgba(239, 68, 68, 0.12)'
                      : '#fef2f2'
                    : theme.colors.canvasElevated,
                borderColor:
                  healthFilter === 'breakdown' ? '#ef4444' : theme.colors.hairline,
                borderWidth: healthFilter === 'breakdown' ? 1.5 : 1,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#ef4444' }]}>
              BREAKDOWN EVENTS
            </Text>
            <Text style={[styles.kpiValue, { color: isDark ? '#f87171' : '#dc2626' }]}>
              {statsSummary.breakdownCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchSection}>
          <Input
            placeholder="Search Machine ID, Model, Serial Number..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Search size={16} color={theme.colors.mute} />}
            rightIcon={
              search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              ) : undefined
            }
            containerStyle={styles.searchInput}
          />

          {/* Filter Trigger Chips Strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterStrip}
          >
            {/* Rental Trigger */}
            <TouchableOpacity
              onPress={() => setActivePickerModal('rental')}
              style={[
                styles.filterDropdownBtn,
                {
                  backgroundColor:
                    rentalFilter !== 'all'
                      ? theme.colors.ink
                      : theme.colors.canvasElevated,
                  borderColor:
                    rentalFilter !== 'all'
                      ? theme.colors.ink
                      : theme.colors.hairline,
                },
              ]}
            >
              {rentalFilter === 'available' && <View style={[styles.dot, { backgroundColor: '#10b981' }]} />}
              {rentalFilter === 'rented' && <View style={[styles.dot, { backgroundColor: '#0ea5e9' }]} />}
              <Text
                style={[
                  styles.filterDropdownText,
                  {
                    color:
                      rentalFilter !== 'all'
                        ? theme.colors.canvas
                        : theme.colors.ink,
                  },
                ]}
                numberOfLines={1}
              >
                {rentalFilter === 'all' ? 'Rental' : currentRentalLabel}
              </Text>
              <ChevronDown
                size={13}
                color={rentalFilter !== 'all' ? theme.colors.canvas : theme.colors.mute}
              />
            </TouchableOpacity>

            {/* Health Trigger */}
            <TouchableOpacity
              onPress={() => setActivePickerModal('health')}
              style={[
                styles.filterDropdownBtn,
                {
                  backgroundColor:
                    healthFilter !== 'all'
                      ? theme.colors.ink
                      : theme.colors.canvasElevated,
                  borderColor:
                    healthFilter !== 'all'
                      ? theme.colors.ink
                      : theme.colors.hairline,
                },
              ]}
            >
              {healthFilter === 'active' && <View style={[styles.dot, { backgroundColor: '#10b981' }]} />}
              {healthFilter === 'spare' && <View style={[styles.dot, { backgroundColor: '#06b6d4' }]} />}
              {healthFilter === 'under_maintenance' && <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />}
              {healthFilter === 'breakdown' && <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />}
              <Text
                style={[
                  styles.filterDropdownText,
                  {
                    color:
                      healthFilter !== 'all'
                        ? theme.colors.canvas
                        : theme.colors.ink,
                  },
                ]}
                numberOfLines={1}
              >
                {healthFilter === 'all' ? 'Health' : currentHealthLabel}
              </Text>
              <ChevronDown
                size={13}
                color={healthFilter !== 'all' ? theme.colors.canvas : theme.colors.mute}
              />
            </TouchableOpacity>

            {/* Supervisor Trigger */}
            <TouchableOpacity
              onPress={() => setActivePickerModal('supervisor')}
              style={[
                styles.filterDropdownBtn,
                {
                  backgroundColor:
                    supervisorFilter !== 'all'
                      ? theme.colors.ink
                      : theme.colors.canvasElevated,
                  borderColor:
                    supervisorFilter !== 'all'
                      ? theme.colors.ink
                      : theme.colors.hairline,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterDropdownText,
                  {
                    color:
                      supervisorFilter !== 'all'
                        ? theme.colors.canvas
                        : theme.colors.ink,
                  },
                ]}
                numberOfLines={1}
              >
                {supervisorFilter === 'all' ? 'Supervisor' : currentSupervisorLabel}
              </Text>
              <ChevronDown
                size={13}
                color={supervisorFilter !== 'all' ? theme.colors.canvas : theme.colors.mute}
              />
            </TouchableOpacity>

            {/* Sort Trigger */}
            <TouchableOpacity
              onPress={() => setActivePickerModal('sort')}
              style={[
                styles.filterDropdownBtn,
                {
                  backgroundColor:
                    sortBy !== 'machine_id_asc'
                      ? theme.colors.ink
                      : theme.colors.canvasElevated,
                  borderColor:
                    sortBy !== 'machine_id_asc'
                      ? theme.colors.ink
                      : theme.colors.hairline,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterDropdownText,
                  {
                    color:
                      sortBy !== 'machine_id_asc'
                        ? theme.colors.canvas
                        : theme.colors.ink,
                  },
                ]}
                numberOfLines={1}
              >
                {sortBy === 'machine_id_asc' ? 'Sort' : currentSortLabel}
              </Text>
              <ChevronDown
                size={13}
                color={sortBy !== 'machine_id_asc' ? theme.colors.canvas : theme.colors.mute}
              />
            </TouchableOpacity>
          </ScrollView>

          {/* Active Filter Badges Strip */}
          {activeFilterCount > 0 && (
            <View style={styles.activeFiltersRow}>
              {search.trim() !== '' && (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  style={[styles.activeBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.activeBadgeText, { color: theme.colors.ink }]}>
                    Search: "{search}"
                  </Text>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              )}

              {rentalFilter !== 'all' && (
                <TouchableOpacity
                  onPress={() => setRentalFilter('all')}
                  style={[styles.activeBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.activeBadgeText, { color: theme.colors.ink }]}>
                    Rental: {currentRentalLabel}
                  </Text>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              )}

              {healthFilter !== 'all' && (
                <TouchableOpacity
                  onPress={() => setHealthFilter('all')}
                  style={[styles.activeBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.activeBadgeText, { color: theme.colors.ink }]}>
                    Health: {currentHealthLabel}
                  </Text>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              )}

              {supervisorFilter !== 'all' && (
                <TouchableOpacity
                  onPress={() => setSupervisorFilter('all')}
                  style={[styles.activeBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.activeBadgeText, { color: theme.colors.ink }]}>
                    Supervisor: {currentSupervisorLabel}
                  </Text>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              )}

              {sortBy !== 'machine_id_asc' && (
                <TouchableOpacity
                  onPress={() => setSortBy('machine_id_asc')}
                  style={[styles.activeBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.activeBadgeText, { color: theme.colors.ink }]}>
                    Sort: {currentSortLabel}
                  </Text>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleResetAllFilters}
                style={[styles.resetAllBtn, { borderColor: theme.colors.hairline }]}
              >
                <RotateCcw size={11} color={theme.colors.link} />
                <Text style={[styles.resetAllText, { color: theme.colors.link }]}>
                  Reset all
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results Count Line */}
          <View style={styles.resultsCountRow}>
            <Text style={[styles.resultsCountText, { color: theme.colors.mute }]}>
              Showing{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                {filteredAndSortedMachines.length}
              </Text>{' '}
              of {machines.length} machine assets
            </Text>
          </View>
        </View>

        {/* Machine Cards List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.link} />
            <Text style={[styles.loadingText, { color: theme.colors.mute }]}>
              Loading fleet machinery...
            </Text>
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

      {/* Filter Selector Modals */}
      <CustomFilterSelectorModal
        visible={activePickerModal === 'rental'}
        onClose={() => setActivePickerModal(null)}
        title="Filter by Rental Status"
        options={RENTAL_FILTER_OPTIONS}
        selectedValue={rentalFilter}
        onSelect={(val) => {
          setRentalFilter(val as RentalFilterType);
          setActivePickerModal(null);
        }}
      />

      <CustomFilterSelectorModal
        visible={activePickerModal === 'health'}
        onClose={() => setActivePickerModal(null)}
        title="Filter by Health Status"
        options={HEALTH_FILTER_OPTIONS}
        selectedValue={healthFilter}
        onSelect={(val) => {
          setHealthFilter(val as HealthFilterType);
          setActivePickerModal(null);
        }}
      />

      <CustomFilterSelectorModal
        visible={activePickerModal === 'supervisor'}
        onClose={() => setActivePickerModal(null)}
        title="Filter by Supervisor"
        options={supervisorFilterOptions}
        selectedValue={supervisorFilter}
        onSelect={(val) => {
          setSupervisorFilter(val);
          setActivePickerModal(null);
        }}
      />

      <CustomFilterSelectorModal
        visible={activePickerModal === 'sort'}
        onClose={() => setActivePickerModal(null)}
        title="Sort Machines"
        options={SORT_OPTIONS}
        selectedValue={sortBy}
        onSelect={(val) => {
          setSortBy(val as SortOptionType);
          setActivePickerModal(null);
        }}
      />

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

      {/* Machine Categories Modal */}
      <MachineCategoryModal
        visible={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onCategoriesChanged={() => fetchMachines()}
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
    gap: spacingNumeric.sm,
  },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
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
  searchSection: {
    gap: spacingNumeric.xs,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterDropdownText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  resetAllText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resultsCountRow: {
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  resultsCountText: {
    fontSize: 11,
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
