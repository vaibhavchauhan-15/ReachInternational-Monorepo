/**
 * Native Mobile Machines Fleet Server State & Business Logic Hook
 * Encapsulates TanStack Query caching, role-scoped queries, server-side pagination,
 * trigram search, fast KPI aggregations, and resilient mutations.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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

export const PAGE_SIZE = 15;

/**
 * 1. High-Performance Machine Directory KPI Aggregation
 * Calls PostgreSQL RPC `get_machines_directory_summary` for instant, indexed count calculations.
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

  return useQuery<MachineKPIStats>({
    queryKey: ['machines', 'kpis', { role: normalizedRole, userId, supervisorFilter, clientFilter }],
    enabled: enabled && Boolean(userId),
    staleTime: 15 * 1000,
    queryFn: async ({ signal }) => {
      let p_supervisor_id: string | null = null;
      let p_operator_id: string | null = null;
      let p_client_id: string | null = clientFilter !== 'all' ? clientFilter : null;

      if (normalizedRole === 'operator' && userId) {
        p_operator_id = userId;
      } else if ((normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor') && userId) {
        p_supervisor_id = userId;
      } else if (supervisorFilter && supervisorFilter !== 'all') {
        p_supervisor_id = supervisorFilter;
      }

      try {
        const { data, error } = await supabase.rpc('get_machines_directory_summary', {
          p_supervisor_id,
          p_operator_id,
          p_client_id,
        }).abortSignal(signal);

        if (error) {
          if (isAbortError(error, signal)) {
            return {
              totalCount: 0,
              availableCount: 0,
              rentedCount: 0,
              breakdownCount: 0,
            };
          }
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
        if (isAbortError(err, signal)) {
          return {
            totalCount: 0,
            availableCount: 0,
            rentedCount: 0,
            breakdownCount: 0,
          };
        }
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
 * 2. Infinite Chunked Machine Fleet Fetcher
 * Server-side pagination, GIN trigram text search, role-scoping, and indexed column ordering.
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
    enabled: enabled && Boolean(userId),
    initialPageParam: 1,
    staleTime: 30 * 1000,
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

        // Role-scoping matching canonical Web DAL
        if (normalizedRole === 'operator' && userId) {
          const { data: omaList, error: omaErr } = await supabase
            .from('operator_machine_assignments')
            .select('machine_id')
            .eq('operator_id', userId)
            .eq('is_active', true)
            .abortSignal(signal);

          if (omaErr && !isAbortError(omaErr, signal)) {
            console.warn('[useMachinesData] Operator assignment check warning:', omaErr);
          }

          const assignedMachineIds = (omaList || [])
            .map((r: any) => r.machine_id)
            .filter(Boolean);

          if (assignedMachineIds.length > 0) {
            query = query.or(
              `current_operator_id.eq.${userId},operator_ids.cs.{${userId}},id.in.(${assignedMachineIds.join(',')})`
            );
          } else {
            query = query.or(
              `current_operator_id.eq.${userId},operator_ids.cs.{${userId}}`
            );
          }
        } else if ((normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor') && userId) {
          query = query.or(`current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}}`);
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

        // Server-side supervisor filter
        if (supervisorFilter && supervisorFilter !== 'all') {
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
            return {
              machines: [],
              totalCount: 0,
              page,
              hasMore: false,
            };
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
          } catch (uErr) {
            if (!isAbortError(uErr, signal)) {
              console.warn('[useMachinesData] User hydration notice:', uErr);
            }
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
          return {
            machines: [],
            totalCount: 0,
            page,
            hasMore: false,
          };
        }
        throw err;
      }
    },
  });
}

/**
 * 3. Unified Hook for Machines Screen
 * Combines infinite server-side pagination, KPI summarization, lazy filter options, and mutations.
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

  // Infinite machines list query
  const infiniteQuery = useMachinesInfiniteQuery({
    userRole,
    userId,
    searchQuery,
    rentalFilter,
    healthFilter,
    supervisorFilter,
    clientFilter,
    sortBy,
    enabled,
  });

  // Dedicated fast scalar KPI RPC query
  const kpisQuery = useMachineKPIs({
    userRole,
    userId,
    supervisorFilter,
    clientFilter,
    enabled,
  });

  // Lazy loaded supervisor and client options for filter panel
  const { data: filterOptions = { supervisors: [], clients: [] }, isLoading: isLoadingOptions } = useQuery({
    queryKey: ['machines_filter_options'],
    staleTime: 5 * 60 * 1000,
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

  // Flattened deduplicated machines array across all loaded pages
  const machines = useMemo(() => {
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

  const totalCount = infiniteQuery.data?.pages?.[0]?.totalCount ?? machines.length;

  // Single unified refetch handler
  const refetch = useCallback(async () => {
    await Promise.all([infiniteQuery.refetch(), kpisQuery.refetch()]);
  }, [infiniteQuery, kpisQuery]);

  // Delete Machine Mutation with cache invalidation
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
    onSuccess: (deletedId) => {
      // Invalidate all machine queries
      queryClient.invalidateQueries({ queryKey: ['machines'] });
    },
  });

  return {
    machines,
    totalCount,
    kpis: kpisQuery.data || {
      totalCount: 0,
      availableCount: 0,
      rentedCount: 0,
      breakdownCount: 0,
    },
    isKPIsLoading: kpisQuery.isLoading,
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: Boolean(infiniteQuery.hasNextPage),
    fetchNextPage: infiniteQuery.fetchNextPage,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error ? infiniteQuery.error.message : null,
    refetch,
    supervisorsList: filterOptions.supervisors,
    clientsList: filterOptions.clients,
    isLoadingOptions,
    deleteMachine: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
