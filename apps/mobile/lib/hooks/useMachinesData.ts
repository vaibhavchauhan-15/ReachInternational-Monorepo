/**
 * Native Mobile Machines Fleet Server State & Business Logic Hook
 * Encapsulates TanStack Query caching, role-capability scoped queries, server-side pagination,
 * trigram search, fast KPI aggregations, and resilient mutations.
 *
 * RBAC: every gate here reads from `@reachinternational/permissions` (MACHINE_CAPABILITIES) so the
 * native Machines module has exactly one capability source of truth shared with Web.
 *
 * Data contracts:
 *  - Fleet tier (super_admin / admin / manager) and supervised tier (supervisor) → `machines` PostgREST
 *    read scoped by RLS + `get_machines_directory_summary` RPC (identical contract to the Web DAL).
 *  - Operator tier → `get_operator_assigned_machines` RPC only. The operator never receives the fleet
 *    list, fleet KPIs, filter options, rental rates or audit rows (server-enforced 42501 for non-operators).
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  MACHINE_CAPABILITIES,
  getMachineScope,
  hasMachineCapability,
  isOperatorMachineView,
} from '@reachinternational/permissions';
import { supabase } from '../supabase';
import { notifyMachineDeleted } from '../notifications';
import { isAbortError } from '@reachinternational/utils';

// Module-level cache for hydrated user entities (supervisors/operators) across chunk boundaries
const knownUsersCache = new Map<string, { id: string; full_name: string }>();

export const MACHINE_SELECT_COLUMNS = `
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
  site_id,
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
  current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name),
  current_operator:users!machines_current_operator_id_fkey(id, full_name)
`;

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

export interface UseMachinesDataOptions {
  userRole?: string | null;
  userId?: string | null;
  searchQuery?: string;
  rentalFilter?: RentalFilterType;
  healthFilter?: HealthFilterType;
  supervisorFilter?: string;
  clientFilter?: string;
  sortBy?: SortOptionType;
  enabled?: boolean;
}

export interface MachineKPIStats {
  totalCount: number;
  availableCount: number;
  rentedCount: number;
  breakdownCount: number;
  maintenanceCount?: number;
  spareCount?: number;
  activeCount?: number;
}

/** Progressive chunk size — 10 rows keeps first paint and windowed rendering small. */
export const PAGE_SIZE = 10;

/** Cache policy: fleet reads are operational (fast) but must not thrash on tab focus. */
const LIST_STALE_MS = 60 * 1000;
const LIST_GC_MS = 10 * 60 * 1000;
const KPI_STALE_MS = 30 * 1000;
const OPERATOR_STALE_MS = 60 * 1000;
const FILTER_OPTIONS_STALE_MS = 10 * 60 * 1000;

/** Row shape returned by the operator-only RPC (slim, server-projected). */
export interface OperatorAssignedMachineRow {
  id: string;
  machine_id: string;
  machine_name?: string | null;
  model?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  year_of_mfg?: number | null;
  health_status?: string | null;
  status?: string | null;
  hour_meter?: number | string | null;
  client_id?: string | null;
  client_name?: string | null;
  client_code?: string | null;
  worksite_name?: string | null;
  worksite_city?: string | null;
  worksite_state?: string | null;
  site_supervisor_id?: string | null;
  site_supervisor_name?: string | null;
  shift_codes?: string | null;
}

/**
 * Maps the operator RPC row onto the shared card/detail shape.
 * Deliberately omits operator_ids / supervisor_ids / customer PII — operators only get
 * their own machinery, the worksite and the site supervisor.
 */
function mapOperatorMachine(row: OperatorAssignedMachineRow): any {
  const supervisor = row.site_supervisor_id && row.site_supervisor_name
    ? { id: row.site_supervisor_id, full_name: row.site_supervisor_name }
    : null;

  return {
    id: row.id,
    machine_id: row.machine_id,
    machine_name: row.machine_name ?? null,
    model: row.model ?? null,
    serial_number: row.serial_number ?? null,
    manufacturer: row.manufacturer ?? null,
    year_of_mfg: row.year_of_mfg ?? null,
    health_status: row.health_status ?? 'active',
    status: row.status ?? 'available',
    hour_meter: row.hour_meter ?? 0,
    client_id: row.client_id ?? null,
    client: row.client_name
      ? { id: row.client_id ?? null, code: row.client_code ?? null, company_name: row.client_name }
      : null,
    worksite_name: row.worksite_name ?? null,
    worksite_city: row.worksite_city ?? null,
    worksite_state: row.worksite_state ?? null,
    current_supervisor: supervisor,
    supervisors: supervisor ? [supervisor] : [],
    current_operator: null,
    operators: [],
    shift_codes: row.shift_codes ?? null,
  };
}

/**
 * 1. High-Performance Machine Directory KPI Aggregation
 * Calls PostgreSQL RPC `get_machines_directory_summary` for instant, indexed count calculations.
 * Disabled for every role without FLEET_VIEW (operators and HR never fetch fleet aggregates).
 */
export function useMachineKPIs({
  userRole,
  userId,
  supervisorFilter = 'all',
  clientFilter = 'all',
  enabled = true,
}: {
  userRole?: string | null;
  userId?: string | null;
  supervisorFilter?: string;
  clientFilter?: string;
  enabled?: boolean;
}) {
  const normalizedRole = (userRole || '').toLowerCase();
  const canViewFleet = hasMachineCapability(userRole, MACHINE_CAPABILITIES.FLEET_VIEW);
  const scope = getMachineScope(userRole);

  return useQuery<MachineKPIStats>({
    queryKey: ['machines', 'kpis', { role: normalizedRole, userId, supervisorFilter, clientFilter }],
    enabled: enabled && canViewFleet && Boolean(userId),
    staleTime: KPI_STALE_MS,
    gcTime: LIST_GC_MS,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      let p_supervisor_id: string | null = null;
      let p_operator_id: string | null = null;
      const p_client_id: string | null = clientFilter !== 'all' ? clientFilter : null;

      if (scope === 'supervised' && userId) {
        // Supervisors are always pinned to their supervised scope, whatever the filter says.
        p_supervisor_id = userId;
      } else if (supervisorFilter && supervisorFilter !== 'all') {
        p_supervisor_id = supervisorFilter;
      }

      const emptyStats: MachineKPIStats = {
        totalCount: 0,
        availableCount: 0,
        rentedCount: 0,
        breakdownCount: 0,
      };

      try {
        const { data, error } = await supabase.rpc('get_machines_directory_summary', {
          p_supervisor_id,
          p_operator_id,
          p_client_id,
        }).abortSignal(signal);

        if (error) {
          if (isAbortError(error, signal)) return emptyStats;
          // 42501 → capability denied by the database; surface an explicit zero rather than fleet data.
          if ((error as any).code === '42501') return emptyStats;
          throw error;
        }

        return {
          totalCount: Number(data?.total ?? 0),
          availableCount: Number(data?.available ?? 0),
          rentedCount: Number(data?.rented ?? 0),
          breakdownCount: Number(data?.breakdown ?? 0),
          maintenanceCount: Number(data?.maintenance ?? 0),
          spareCount: Number(data?.spare ?? 0),
          activeCount: Number(data?.active ?? 0),
        };
      } catch (err: any) {
        if (isAbortError(err, signal)) return emptyStats;
        throw err;
      }
    },
  });
}

export interface MachinePageChunk {
  machines: any[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

/**
 * 2a. Operator assigned-machine query (RPC contract, slim server-side projection).
 * Never touches the fleet list, KPIs, filter options or audit surfaces.
 */
export function useOperatorAssignedMachines({
  userId,
  machineId,
  enabled = true,
}: {
  userId?: string | null;
  machineId?: string | null;
  enabled?: boolean;
}) {
  return useQuery<any[]>({
    queryKey: ['machines', 'operator', userId, machineId || 'all'],
    enabled: enabled && Boolean(userId),
    staleTime: OPERATOR_STALE_MS,
    gcTime: LIST_GC_MS,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc('get_operator_assigned_machines', { p_machine_id: machineId || null })
        .abortSignal(signal);

      if (error) {
        if (isAbortError(error, signal)) return [];
        throw new Error(error.message || 'Failed to load assigned machinery');
      }

      return ((data || []) as OperatorAssignedMachineRow[]).map(mapOperatorMachine);
    },
  });
}

/**
 * 2b. Infinite Chunked Machine Fleet Fetcher
 * Server-side pagination, GIN trigram text search, role-scoping, and indexed column ordering.
 * Fleet + supervised tiers only (capability-gated at the query level).
 */
export function useMachinesInfiniteQuery({
  userRole,
  userId,
  searchQuery = '',
  rentalFilter = 'all',
  healthFilter = 'all',
  supervisorFilter = 'all',
  clientFilter = 'all',
  sortBy = 'machine_id_asc',
  enabled = true,
}: UseMachinesDataOptions) {
  const normalizedRole = (userRole || '').toLowerCase();
  const scope = getMachineScope(userRole);
  const canViewFleet = hasMachineCapability(userRole, MACHINE_CAPABILITIES.FLEET_VIEW);
  const trimmedSearch = searchQuery.trim();

  return useInfiniteQuery<MachinePageChunk, Error>({
    queryKey: [
      'machines',
      'infinite',
      {
        role: normalizedRole,
        userId,
        search: trimmedSearch,
        rentalFilter,
        healthFilter,
        supervisorFilter,
        clientFilter,
        sortBy,
      },
    ],
    enabled: enabled && canViewFleet && Boolean(userId),
    initialPageParam: 1,
    staleTime: LIST_STALE_MS,
    gcTime: LIST_GC_MS,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length + 1 : undefined;
    },
    queryFn: async ({ pageParam = 1, signal }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1;
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      try {
        let query = supabase
          .from('machines')
          .select(MACHINE_SELECT_COLUMNS, { count: 'exact' })
          .abortSignal(signal);

        // Supervised tier: RLS is the authority, the client filter keeps the query plan narrow.
        if (scope === 'supervised' && userId) {
          const { data: clientSupervisors } = await supabase
            .from('client_supervisors')
            .select('client_id')
            .eq('supervisor_id', userId)
            .abortSignal(signal);

          const supervisedClientIds = (clientSupervisors || [])
            .map((cs: any) => cs.client_id)
            .filter(Boolean);

          if (supervisedClientIds.length > 0) {
            query = query.or(
              `current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}},client_id.in.(${supervisedClientIds.join(',')})`
            );
          } else {
            query = query.or(`current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}}`);
          }
        }

        // Full-fleet search across trigram-indexed columns (machine_id, model, serial_number)
        if (trimmedSearch) {
          const s = trimmedSearch.replace(/[,()"\\]/g, '').trim();
          if (s) {
            query = query.or(`machine_id.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%`);
          }
        }

        // Server-side rental filter
        if (rentalFilter && rentalFilter !== 'all') {
          query = query.eq('status', rentalFilter);
        }

        // Server-side health filter
        if (healthFilter && healthFilter !== 'all') {
          query = query.eq('health_status', healthFilter);
        }

        // Server-side supervisor filter (filter options are only requested by fleet-capable roles)
        if (supervisorFilter && supervisorFilter !== 'all' && scope === 'all') {
          query = query.or(`current_supervisor_id.eq.${supervisorFilter},supervisor_ids.cs.{${supervisorFilter}}`);
        }

        // Server-side client filter
        if (clientFilter && clientFilter !== 'all') {
          query = query.eq('client_id', clientFilter);
        }

        // Server-side indexed sorting with deterministic secondary tie-breaker
        switch (sortBy) {
          case 'machine_id_asc':
            query = query.order('machine_id', { ascending: true }).order('id', { ascending: true });
            break;
          case 'machine_id_desc':
            query = query.order('machine_id', { ascending: false }).order('id', { ascending: true });
            break;
          case 'model_asc':
            query = query.order('model', { ascending: true }).order('id', { ascending: true });
            break;
          case 'newest_yum':
            query = query.order('year_of_mfg', { ascending: false, nullsFirst: false }).order('id', { ascending: true });
            break;
          case 'oldest_yum':
            query = query.order('year_of_mfg', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
            break;
          case 'highest_hmr':
            query = query.order('hour_meter', { ascending: false, nullsFirst: false }).order('id', { ascending: true });
            break;
          case 'lowest_hmr':
            query = query.order('hour_meter', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
            break;
          default:
            query = query.order('created_at', { ascending: false }).order('id', { ascending: true });
            break;
        }

        // Bounded chunk range
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) {
          if (isAbortError(error, signal)) {
            return { machines: [], totalCount: 0, page, hasMore: false };
          }
          throw new Error(error.message || 'Failed to fetch fleet machines');
        }

        const rawMachines = data || [];
        const totalCount = count ?? rawMachines.length;
        const hasMore = (count != null) ? (to + 1 < count) : (rawMachines.length === PAGE_SIZE);

        // Populate known cache from direct joins and collect only un-cached missing user IDs
        const missingUserIds = new Set<string>();
        rawMachines.forEach((m: any) => {
          if (m.current_supervisor?.id && m.current_supervisor?.full_name) {
            knownUsersCache.set(m.current_supervisor.id, m.current_supervisor);
          }
          if (m.current_operator?.id && m.current_operator?.full_name) {
            knownUsersCache.set(m.current_operator.id, m.current_operator);
          }
          if (Array.isArray(m.supervisor_ids)) {
            m.supervisor_ids.forEach((id: string) => {
              if (id && !knownUsersCache.has(id)) missingUserIds.add(id);
            });
          }
          if (Array.isArray(m.operator_ids)) {
            m.operator_ids.forEach((id: string) => {
              if (id && !knownUsersCache.has(id)) missingUserIds.add(id);
            });
          }
        });

        if (missingUserIds.size > 0) {
          try {
            const { data: usersData } = await supabase
              .from('users')
              .select('id, full_name')
              .in('id', Array.from(missingUserIds))
              .abortSignal(signal);

            (usersData || []).forEach((u: any) => {
              if (u?.id && u?.full_name) knownUsersCache.set(u.id, u);
            });
          } catch {
            // Silently handled non-fatal user hydration fallback
          }
        }

        // Hydrate clean personnel arrays reusing cached users
        const hydratedMachines = rawMachines.map((m: any) => {
          const supIds: string[] = Array.isArray(m.supervisor_ids)
            ? m.supervisor_ids
            : m.current_supervisor_id
              ? [m.current_supervisor_id]
              : [];

          const opIds: string[] = Array.isArray(m.operator_ids)
            ? m.operator_ids
            : m.current_operator_id
              ? [m.current_operator_id]
              : [];

          const supervisorsList = supIds
            .map((id: string) => knownUsersCache.get(id) || (m.current_supervisor?.id === id ? m.current_supervisor : null))
            .filter(Boolean);

          const operatorsList = opIds
            .map((id: string) => knownUsersCache.get(id) || (m.current_operator?.id === id ? m.current_operator : null))
            .filter(Boolean);

          return {
            ...m,
            supervisors: supervisorsList.length > 0 ? supervisorsList : (m.current_supervisor ? [m.current_supervisor] : []),
            operators: operatorsList.length > 0 ? operatorsList : (m.current_operator ? [m.current_operator] : []),
            current_supervisor: supervisorsList[0] || m.current_supervisor || null,
            current_operator: operatorsList[0] || m.current_operator || null,
          };
        });

        return {
          machines: hydratedMachines,
          totalCount,
          page,
          hasMore,
        };
      } catch (err: any) {
        if (isAbortError(err, signal)) {
          return { machines: [], totalCount: 0, page, hasMore: false };
        }
        throw err;
      }
    },
  });
}

/**
 * 3. Unified Hook for the Machines Screen
 * Combines role-scoped server state, KPI summarisation, lazy filter options, cache patching
 * and mutations. The TanStack cache is the single source of truth (no mirrored local array).
 */
export function useMachinesData({
  userRole,
  userId,
  searchQuery = '',
  rentalFilter = 'all',
  healthFilter = 'all',
  supervisorFilter = 'all',
  clientFilter = 'all',
  sortBy = 'machine_id_asc',
  enabled = true,
}: UseMachinesDataOptions) {
  const queryClient = useQueryClient();

  const operatorView = isOperatorMachineView(userRole);
  const canViewFleet = hasMachineCapability(userRole, MACHINE_CAPABILITIES.FLEET_VIEW);
  const canFilter = canViewFleet && hasMachineCapability(userRole, MACHINE_CAPABILITIES.VIEW);

  // Operator tier: dedicated RPC, no fleet queries at all.
  const operatorQuery = useOperatorAssignedMachines({
    userId,
    enabled: enabled && operatorView,
  });

  // Infinite machines list query (fleet + supervised tiers only)
  const infiniteQuery = useMachinesInfiniteQuery({
    userRole,
    userId,
    searchQuery,
    rentalFilter,
    healthFilter,
    supervisorFilter,
    clientFilter,
    sortBy,
    enabled: enabled && !operatorView,
  });

  // Dedicated fast scalar KPI RPC query (FLEET_VIEW only)
  const kpisQuery = useMachineKPIs({
    userRole,
    userId,
    supervisorFilter,
    clientFilter,
    enabled: enabled && !operatorView && canViewFleet,
  });

  // Lazy loaded supervisor and client options for the filter drawer (FLEET_VIEW only)
  const { data: filterOptions = { supervisors: [], clients: [] }, isLoading: isLoadingOptions } = useQuery({
    queryKey: ['machines_filter_options'],
    enabled: enabled && canFilter,
    staleTime: FILTER_OPTIONS_STALE_MS,
    gcTime: LIST_GC_MS,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const [supsRes, clientsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name')
          .in('role', ['supervisor', 'manager', 'admin', 'super_admin'])
          .eq('status', 'active')
          .order('full_name', { ascending: true })
          .abortSignal(signal),
        supabase
          .from('clients')
          .select('id, company_name, code')
          .is('deleted_at', null)
          .order('company_name', { ascending: true })
          .abortSignal(signal),
      ]);

      const supervisors = (supsRes.data || []) as Array<{ id: string; full_name: string }>;
      supervisors.forEach((u) => {
        if (u?.id && u?.full_name) knownUsersCache.set(u.id, u);
      });

      return {
        supervisors,
        clients: (clientsRes.data || []) as Array<{ id: string; company_name: string; code?: string }>,
      };
    },
  });

  // Flattened deduplicated machines array across all loaded pages (fleet tier)
  const fleetMachines = useMemo(() => {
    if (!infiniteQuery.data?.pages) return [];
    const seen = new Set<string>();
    const list: any[] = [];
    for (const page of infiniteQuery.data.pages) {
      if (Array.isArray(page.machines)) {
        for (const m of page.machines) {
          if (m?.id && !seen.has(m.id)) {
            seen.add(m.id);
            list.push(m);
          }
        }
      }
    }
    return list;
  }, [infiniteQuery.data?.pages]);

  const operatorMachines = operatorQuery.data ?? EMPTY_MACHINES;
  const machines = operatorView ? operatorMachines : fleetMachines;
  const totalCount = operatorView
    ? operatorMachines.length
    : infiniteQuery.data?.pages?.[0]?.totalCount ?? fleetMachines.length;

  /** Patches one machine inside every cached machine page/list (single source of truth). */
  const patchMachine = useCallback(
    (patch: any) => {
      if (!patch?.id) return;
      queryClient.setQueriesData<any>({ queryKey: ['machines', 'infinite'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            machines: Array.isArray(page.machines)
              ? page.machines.map((m: any) => (m.id === patch.id ? { ...m, ...patch } : m))
              : page.machines,
          })),
        };
      });
      queryClient.setQueriesData<any>({ queryKey: ['machines', 'operator'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((m: any) => (m.id === patch.id ? { ...m, ...patch } : m));
      });
    },
    [queryClient]
  );

  /** Optimistically removes one machine, then re-syncs only the affected machine keys. */
  const removeMachineFromCache = useCallback(
    (machineId: string) => {
      if (!machineId) return;
      queryClient.setQueriesData<any>({ queryKey: ['machines', 'infinite'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            machines: Array.isArray(page.machines)
              ? page.machines.filter((m: any) => m.id !== machineId)
              : page.machines,
            totalCount: Math.max(0, (page.totalCount || 1) - 1),
          })),
        };
      });
      queryClient.setQueriesData<any>({ queryKey: ['machines', 'operator'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((m: any) => m.id !== machineId);
      });
    },
    [queryClient]
  );

  /** Authoritative resync — used as the rollback path for optimistic mutations. */
  const resyncMachines = useCallback(() => {
    const tasks: Array<Promise<unknown>> = [
      queryClient.invalidateQueries({ queryKey: ['machines', 'infinite'] }),
      queryClient.invalidateQueries({ queryKey: ['machines', 'operator'] }),
    ];
    if (canViewFleet) {
      tasks.push(queryClient.invalidateQueries({ queryKey: ['machines', 'kpis'] }));
    }
    return Promise.all(tasks);
  }, [canViewFleet, queryClient]);

  /** Refreshes KPIs only (list rows are patched optimistically). */
  const invalidateMachineKPIs = useCallback(() => {
    if (!canViewFleet) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: ['machines', 'kpis'] });
  }, [canViewFleet, queryClient]);

  // Single unified refetch handler (pull-to-refresh / sync / header action)
  const refetch = useCallback(async () => {
    if (operatorView) {
      await operatorQuery.refetch();
      return;
    }
    await Promise.all([infiniteQuery.refetch(), kpisQuery.refetch()]);
  }, [infiniteQuery, kpisQuery, operatorQuery, operatorView]);

  // Delete Machine Mutation — optimistic, capability-assumed (DB RLS/trigger is the authority)
  const deleteMutation = useMutation({
    mutationFn: async (machine: any) => {
      const machineDbId = machine.id;
      const machineCode = machine.machine_id;

      const { error: delError } = await supabase
        .from('machines')
        .delete()
        .eq('id', machineDbId);

      if (delError) {
        throw new Error(delError.message || 'Failed to delete machine');
      }

      try {
        notifyMachineDeleted(machineCode);
      } catch {
        // non-blocking
      }

      return machineDbId;
    },
    onMutate: async (machine: any) => {
      await queryClient.cancelQueries({ queryKey: ['machines'] });
      removeMachineFromCache(machine?.id);
      return { machineId: machine?.id };
    },
    onError: async () => {
      await resyncMachines();
    },
    onSuccess: async () => {
      await invalidateMachineKPIs();
    },
  });

  const isLoading = operatorView ? operatorQuery.isLoading : infiniteQuery.isLoading;
  const isFetching = operatorView ? operatorQuery.isFetching : infiniteQuery.isFetching;
  const error = operatorView
    ? (operatorQuery.error ? operatorQuery.error.message : null)
    : (infiniteQuery.error ? infiniteQuery.error.message : null);

  return {
    /** 'operator' → assigned-machine view; 'fleet' → directorate view. */
    mode: operatorView ? ('operator' as const) : ('fleet' as const),
    canViewFleet,
    canFilter,
    machines,
    totalCount,
    kpis: canViewFleet
      ? (kpisQuery.data || {
          totalCount: 0,
          availableCount: 0,
          rentedCount: 0,
          breakdownCount: 0,
        })
      : null,
    isKPIsLoading: canViewFleet ? kpisQuery.isLoading : false,
    isLoading,
    isFetching,
    isFetchingNextPage: operatorView ? false : infiniteQuery.isFetchingNextPage,
    hasNextPage: operatorView ? false : Boolean(infiniteQuery.hasNextPage),
    fetchNextPage: operatorView ? noop : infiniteQuery.fetchNextPage,
    isError: operatorView ? operatorQuery.isError : infiniteQuery.isError,
    error,
    refetch,
    supervisorsList: canFilter ? filterOptions.supervisors : EMPTY_OPTIONS,
    clientsList: canFilter ? filterOptions.clients : EMPTY_OPTIONS,
    isLoadingOptions: canFilter ? isLoadingOptions : false,
    deleteMachine: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    patchMachine,
    removeMachineFromCache,
    resyncMachines,
    invalidateMachineKPIs,
  };
}

const EMPTY_MACHINES: any[] = [];
const EMPTY_OPTIONS: Array<{ id: string; full_name?: string; company_name?: string; code?: string }> = [];
const noop = () => undefined;
