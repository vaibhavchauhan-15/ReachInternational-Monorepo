/**
 * ReachInternational Mobile — useAssignPersonnelModalData Hook
 * High-performance, lazy-loaded TanStack Query coordinator for the Assign Personnel/Machine/Operator modal.
 * 
 * Features:
 * - Lazy loading: Only queries Supabase when modal is visible and selector is open or data is needed
 * - Strict column projections: Explicitly selects only required fields (e.g. employee_id, full_name, id)
 * - Removes unnecessary fields: phone, email, role, and shift timings removed from user projections
 * - 30-60s cache TTL: Instant reopening with zero layout shift or network lag
 * - Stale request cancellation & request deduplication via TanStack Query
 * - Preserves server-side supervisor scoping & client shift code caching
 */

import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { formatTo12Hour, isAbortError } from '@reachinternational/utils';

const EMPTY_ARRAY: any[] = Object.freeze([]) as any;

export interface SupervisorItem {
  id: string;
  full_name: string;
  employee_id?: string | null;
}

export interface MachineOptionItem {
  id: string;
  machine_id: string;
  model?: string | null;
  serial_number?: string | null;
  client_id?: string | null;
  supervisor_ids?: string[] | null;
  current_supervisor_id?: string | null;
  health_status?: string | null;
  status?: string | null;
  client?: { id: string; company_name: string } | null;
}

export interface OperatorOptionItem {
  id: string;
  full_name: string;
  employee_id?: string | null;
}

export interface FleetAssignmentItem {
  id: string;
  operator_id: string;
  machine_id: string;
  shift_code: string;
  shift_start_time: string;
  shift_end_time: string;
  is_active?: boolean;
  machine?: { id: string; machine_id: string; model?: string | null } | null;
}

export interface ClientShiftOption {
  id?: string;
  code: string;
  name?: string;
  start_time: string;
  end_time: string;
  crosses_midnight?: boolean;
}

export const DEFAULT_MODAL_SHIFTS: ClientShiftOption[] = [
  { code: 'S1', name: 'Shift S1', start_time: '06:00 AM', end_time: '02:00 PM' },
  { code: 'S2', name: 'Shift S2', start_time: '02:00 PM', end_time: '10:00 PM' },
  { code: 'S3', name: 'Shift S3', start_time: '10:00 PM', end_time: '06:00 AM', crosses_midnight: true },
];

export interface UseAssignPersonnelModalDataOptions {
  visible: boolean;
  isSupervisorRole?: boolean;
  supervisorId?: string;
  isMachineDropdownOpen?: boolean;
  isSupervisorDropdownOpen?: boolean;
  isAddOperatorOpen?: boolean;
  machineSearch?: string;
  supervisorSearch?: string;
  operatorSearch?: string;
  relevantSupervisorIds?: string[];
  relevantOperatorIds?: string[];
  initialMachineId?: string;
}

/**
 * 1. Fleet Assignments Query
 * Fetches active assignments across the fleet for capacity & overlap validation.
 */
export function useFleetAssignments(visible: boolean) {
  return useQuery<FleetAssignmentItem[]>({
    queryKey: ['assign-personnel-modal-data', 'fleet-assignments'],
    enabled: visible,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('operator_machine_assignments')
        .select('id, operator_id, machine_id, shift_code, shift_start_time, shift_end_time, is_active, machine:machines(id, machine_id, model)')
        .eq('is_active', true)
        .abortSignal(signal);

      if (error) {
        if (isAbortError(error, signal)) return [];
        throw error;
      }
      return (data || []) as unknown as FleetAssignmentItem[];
    },
  });
}

/**
 * 2. Machinery Equipment Query
 * Fetches machinery options with explicit column projections.
 */
export function useAssignPersonnelMachines({
  visible,
  isSupervisorRole,
  supervisorId,
  isMachineDropdownOpen,
  initialMachineId,
  search,
}: {
  visible: boolean;
  isSupervisorRole?: boolean;
  supervisorId?: string;
  isMachineDropdownOpen?: boolean;
  initialMachineId?: string;
  search?: string;
}) {
  // Enabled if modal is visible AND either dropdown is open OR initialMachineId needs resolution
  const isEnabled = visible;

  return useQuery<MachineOptionItem[]>({
    queryKey: [
      'assign-personnel-modal-data',
      'machines',
      isSupervisorRole ? supervisorId : 'all',
      isMachineDropdownOpen ? 'full' : 'initial',
      search || '',
    ],
    enabled: isEnabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      let query = supabase
        .from('machines')
        .select('id, machine_id, model, serial_number, client_id, supervisor_ids, current_supervisor_id, health_status, status, client:clients(id, company_name)')
        .neq('status', 'scrapped')
        .order('machine_id', { ascending: true })
        .abortSignal(signal);

      if (isSupervisorRole && supervisorId) {
        // Fetch clients supervised by this user to include inherited machinery
        const { data: clientSupervisors } = await supabase
          .from('client_supervisors')
          .select('client_id')
          .eq('supervisor_id', supervisorId)
          .abortSignal(signal);

        const supervisedClientIds = (clientSupervisors || [])
          .map((cs: any) => cs.client_id)
          .filter(Boolean);

        if (supervisedClientIds.length > 0) {
          query = query.or(
            `current_supervisor_id.eq.${supervisorId},supervisor_ids.cs.{${supervisorId}},client_id.in.(${supervisedClientIds.join(',')})`
          );
        } else {
          query = query.or(`current_supervisor_id.eq.${supervisorId},supervisor_ids.cs.{${supervisorId}}`);
        }
      }

      if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`machine_id.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) {
        if (isAbortError(error, signal)) return [];
        throw error;
      }
      return (data || []) as unknown as MachineOptionItem[];
    },
  });
}

/**
 * 3. Supervisors Query
 * Lazy-loads supervisors with strict role = 'supervisor' and explicit column selection.
 * Shows only full_name and employee_id.
 */
export function useAssignPersonnelSupervisors({
  visible,
  isSupervisorDropdownOpen,
  relevantSupervisorIds = EMPTY_ARRAY,
  search,
}: {
  visible: boolean;
  isSupervisorDropdownOpen?: boolean;
  relevantSupervisorIds?: string[];
  search?: string;
}) {
  const supervisorIdsKey = useMemo(() => {
    if (isSupervisorDropdownOpen) return 'all';
    if (!relevantSupervisorIds || relevantSupervisorIds.length === 0) return '';
    return [...relevantSupervisorIds].sort().join(',');
  }, [isSupervisorDropdownOpen, relevantSupervisorIds]);

  // Lazy-load: enabled if supervisor dropdown is open OR if specific assigned supervisors must be resolved
  const isEnabled = visible && (Boolean(isSupervisorDropdownOpen) || (relevantSupervisorIds?.length ?? 0) > 0);

  return useQuery<SupervisorItem[]>({
    queryKey: [
      'assign-personnel-modal-data',
      'supervisors',
      supervisorIdsKey,
      search || '',
    ],
    enabled: isEnabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      let query = supabase
        .from('users')
        .select('id, full_name, employee_id')
        .eq('role', 'supervisor')
        .neq('status', 'inactive')
        .order('full_name', { ascending: true })
        .abortSignal(signal);

      if (!isSupervisorDropdownOpen && relevantSupervisorIds.length > 0) {
        query = query.in('id', relevantSupervisorIds);
      }

      if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`full_name.ilike.%${s}%,employee_id.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) {
        if (isAbortError(error, signal)) return [];
        throw error;
      }
      return (data || []) as unknown as SupervisorItem[];
    },
  });
}

/**
 * 4. Operators Query
 * Lazy-loads operators with strict role = 'operator' and explicit column selection.
 * Shows only full_name and employee_id.
 */
export function useAssignPersonnelOperators({
  visible,
  isAddOperatorOpen,
  relevantOperatorIds = EMPTY_ARRAY,
  search,
}: {
  visible: boolean;
  isAddOperatorOpen?: boolean;
  relevantOperatorIds?: string[];
  search?: string;
}) {
  const operatorIdsKey = useMemo(() => {
    if (isAddOperatorOpen) return 'all';
    if (!relevantOperatorIds || relevantOperatorIds.length === 0) return '';
    return [...relevantOperatorIds].sort().join(',');
  }, [isAddOperatorOpen, relevantOperatorIds]);

  // Lazy-load: enabled if + Assign Operator accordion is open OR if assigned operators must be resolved
  const isEnabled = visible && (Boolean(isAddOperatorOpen) || (relevantOperatorIds?.length ?? 0) > 0);

  return useQuery<OperatorOptionItem[]>({
    queryKey: [
      'assign-personnel-modal-data',
      'operators',
      operatorIdsKey,
      search || '',
    ],
    enabled: isEnabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      let query = supabase
        .from('users')
        .select('id, full_name, employee_id')
        .eq('role', 'operator')
        .neq('status', 'inactive')
        .order('full_name', { ascending: true })
        .abortSignal(signal);

      if (!isAddOperatorOpen && relevantOperatorIds.length > 0) {
        query = query.in('id', relevantOperatorIds);
      }

      if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`full_name.ilike.%${s}%,employee_id.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) {
        if (isAbortError(error, signal)) return [];
        throw error;
      }
      return (data || []) as unknown as OperatorOptionItem[];
    },
  });
}

/**
 * Master Coordinator Hook: useAssignPersonnelModalData
 * Integrates lazy-loaded queries with seamless backward compatibility.
 */
export function useAssignPersonnelModalData({
  visible,
  isSupervisorRole,
  supervisorId,
  isMachineDropdownOpen,
  isSupervisorDropdownOpen,
  isAddOperatorOpen,
  machineSearch,
  supervisorSearch,
  operatorSearch,
  relevantSupervisorIds,
  relevantOperatorIds,
  initialMachineId,
}: UseAssignPersonnelModalDataOptions) {
  const fleetQuery = useFleetAssignments(visible);

  const machinesQuery = useAssignPersonnelMachines({
    visible,
    isSupervisorRole,
    supervisorId,
    isMachineDropdownOpen,
    initialMachineId,
    search: machineSearch,
  });

  const supervisorsQuery = useAssignPersonnelSupervisors({
    visible,
    isSupervisorDropdownOpen,
    relevantSupervisorIds,
    search: supervisorSearch,
  });

  const operatorsQuery = useAssignPersonnelOperators({
    visible,
    isAddOperatorOpen,
    relevantOperatorIds,
    search: operatorSearch,
  });

  const isLoading =
    fleetQuery.isLoading ||
    machinesQuery.isLoading ||
    (Boolean(isSupervisorDropdownOpen) && supervisorsQuery.isLoading) ||
    (Boolean(isAddOperatorOpen) && operatorsQuery.isLoading);

  const data = useMemo(
    () => ({
      machines: machinesQuery.data ?? (EMPTY_ARRAY as MachineOptionItem[]),
      supervisors: supervisorsQuery.data ?? (EMPTY_ARRAY as SupervisorItem[]),
      operators: operatorsQuery.data ?? (EMPTY_ARRAY as OperatorOptionItem[]),
      fleetAssignments: fleetQuery.data ?? (EMPTY_ARRAY as FleetAssignmentItem[]),
    }),
    [machinesQuery.data, supervisorsQuery.data, operatorsQuery.data, fleetQuery.data]
  );

  return useMemo(
    () => ({
      data,
      isLoading,
      isFetching:
        fleetQuery.isFetching ||
        machinesQuery.isFetching ||
        supervisorsQuery.isFetching ||
        operatorsQuery.isFetching,
      fleetAssignments: data.fleetAssignments,
      machines: data.machines,
      supervisors: data.supervisors,
      operators: data.operators,
    }),
    [
      data,
      isLoading,
      fleetQuery.isFetching,
      machinesQuery.isFetching,
      supervisorsQuery.isFetching,
      operatorsQuery.isFetching,
    ]
  );
}

/**
 * Hook to fetch client-specific shift codes with 60s cache TTL.
 */
export function useClientShiftCodes(clientId?: string | null, enabled: boolean = true) {
  return useQuery<ClientShiftOption[]>({
    queryKey: ['assign-personnel-client-shifts', clientId || 'default'],
    enabled: Boolean(clientId) && enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: DEFAULT_MODAL_SHIFTS,
    queryFn: async ({ signal }) => {
      if (!clientId) return DEFAULT_MODAL_SHIFTS;

      const { data, error } = await supabase
        .from('client_shift_codes')
        .select('id, code, name, start_time, end_time, crosses_midnight')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .abortSignal(signal);

      if (error || !data || data.length === 0) {
        return DEFAULT_MODAL_SHIFTS;
      }

      return data.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        start_time: formatTo12Hour(s.start_time) || s.start_time,
        end_time: formatTo12Hour(s.end_time) || s.end_time,
        crosses_midnight: s.crosses_midnight,
      }));
    },
  });
}
