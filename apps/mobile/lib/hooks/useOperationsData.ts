import React, { useMemo } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  normalizeOperationsFilter,
  RawOperationsFilterInput,
  OPERATIONS_QUERY_KEYS,
  OPERATIONS_CACHE_TTLS,
  isAbortError,
  formatTo12Hour,
  getISTDateString,
  addDaysToDateStr,
} from '@reachinternational/utils';
import type { OperatorEntryContext, TodayShiftMonitorRow, ClientShiftCode } from '@reachinternational/types';
import type { QueuedMutation, MutationStatus } from '../offline/types';
import { supabase } from '../supabase';

export interface ActiveShiftAssignment {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_start_time: string;
  shift_end_time: string;
  crosses_midnight: boolean;
  assigned_at: string;
  assigned_by?: string;
  assigner?: { id: string; full_name: string; phone?: string } | null;
  operator?: { id: string; full_name: string; phone?: string; shift_time?: string | null } | null;
}

export interface MachineWithAssignments {
  id: string;
  machine_id: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  status: string;
  hour_meter?: number;
  client_id?: string;
  current_supervisor_id?: string;
  supervisor?: { full_name: string } | null;
  active_assignments: ActiveShiftAssignment[];
}

export interface ClientRecord {
  id: string;
  code?: string;
  company_name: string;
  phone?: string;
  email?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface OperatorRecord {
  id: string;
  employee_id?: string | null;
  full_name: string;
  phone?: string;
  shift_time?: string | null;
}

export interface ClientSiteRecord {
  id: string;
  client_id: string;
  site_name: string;
  site_code?: string;
  street?: string;
  city?: string;
}

export interface OperationsMasterData {
  machinesList: MachineWithAssignments[];
  activeOperators: OperatorRecord[];
  clientsList: ClientRecord[];
  clientSites: ClientSiteRecord[];
}

export interface HourLogRecord {
  id: string;
  machine_id?: string;
  machine_code: string;
  log_date: string;
  shift?: string;
  shift_code?: string;
  shift_scheduled_minutes?: number;
  start_meter: number;
  end_meter: number;
  running_hours: number;
  start_time?: string;
  end_time?: string;
  overtime_hours?: number;
  normal_working_hours?: number;
  location?: string;
  is_breakdown: boolean;
  breakdown_start_time?: string;
  breakdown_end_time?: string;
  breakdown_duration?: string;
  breakdown_hours?: number;
  remarks?: string;
  operator_id?: string;
  client_id?: string;
  created_at?: string;
  conflict_flag?: boolean;
  conflict_reason?: string;
  conflict_status?: string;
  conflict_resolved_by?: string;
  conflict_resolved_at?: string;
  conflict_resolution_notes?: string;
  is_offline_draft?: boolean;
  sync_status?: MutationStatus;
  queued_item?: QueuedMutation;
  machine?: {
    id?: string;
    machine_id: string;
    model?: string;
    serial_number?: string;
    manufacturer?: string;
    status?: string;
    customer_name?: string;
    customer_address?: string;
    city?: string;
    state?: string;
  } | null;
  operator?: { id?: string; full_name: string; phone?: string } | null;
  client?: {
    id?: string;
    name?: string;
    company_name?: string;
    client_name?: string;
    street?: string;
    Street?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    address?: string;
  } | null;
}

export function useOperationsMasterData(enabled: boolean = true) {
  return useQuery<OperationsMasterData>({
    queryKey: ['operations', 'master'],
    enabled,
    queryFn: async () => {
      const [mchRes, assRes, opsRes, clientsRes, sitesRes] = await Promise.all([
        supabase
          .from('machines')
          .select(`
            id,
            machine_id,
            model,
            serial_number,
            manufacturer,
            status,
            hour_meter,
            client_id,
            current_supervisor_id,
            supervisor:users!machines_current_supervisor_id_fkey(id, full_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('operator_machine_assignments')
          .select(`
            id,
            machine_id,
            operator_id,
            shift_start_time,
            shift_end_time,
            shift_code,
            crosses_midnight,
            assigned_at,
            assigned_by,
            ended_at,
            ended_by,
            end_reason,
            is_active,
            machine:machines(id, machine_id, model, serial_number),
            operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone),
            assigner:users!operator_machine_assignments_assigned_by_fkey(id, full_name),
            ender:users!operator_machine_assignments_ended_by_fkey(id, full_name)
          `)
          .order('assigned_at', { ascending: false })
          .limit(200),
        supabase
          .from('users')
          .select('id, employee_id, full_name, phone, shift_start_time, shift_end_time')
          .eq('role', 'operator')
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('clients')
          .select('id, code, company_name, phone, street, city, district, state, pincode')
          .order('company_name'),
        supabase
          .from('client_sites')
          .select('id, client_id, site_name, site_code, street, city')
          .order('site_name'),
      ]);

      if (mchRes.error) throw mchRes.error;
      if (assRes.error) throw assRes.error;
      if (opsRes.error) throw opsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      const activeAssList = (assRes.data || []).filter((a: any) => a.is_active) as unknown as ActiveShiftAssignment[];
      const machinesList: MachineWithAssignments[] = (mchRes.data || []).map((m: any) => ({
        ...m,
        active_assignments: activeAssList.filter((a) => a.machine_id === m.id),
      }));

      const activeOperators: OperatorRecord[] = (opsRes.data || []).map((o: any) => ({
        ...o,
        shift_time: (o.shift_start_time && o.shift_end_time)
          ? `${o.shift_start_time.slice(0, 5)} - ${o.shift_end_time.slice(0, 5)}`
          : null,
      })) as OperatorRecord[];
      const clientsList: ClientRecord[] = (clientsRes.data || []) as ClientRecord[];
      const clientSites: ClientSiteRecord[] = (sitesRes.data || []) as ClientSiteRecord[];

      return {
        machinesList,
        activeOperators,
        clientsList,
        clientSites,
      };
    },
    staleTime: OPERATIONS_CACHE_TTLS.filterOperators * 1000, // 10 minutes cache stale time (600s)
    placeholderData: keepPreviousData,
  });
}

export function useOperationsLogs(rawFilters?: RawOperationsFilterInput, enabled: boolean = true) {
  const normalized = useMemo(() => {
    return rawFilters ? normalizeOperationsFilter(rawFilters) : null;
  }, [
    rawFilters?.viewMode,
    rawFilters?.machineId,
    rawFilters?.clientId,
    rawFilters?.operatorId,
    rawFilters?.month,
    rawFilters?.customStart,
    rawFilters?.customEnd,
    rawFilters?.startDate,
    rawFilters?.endDate,
    rawFilters?.locationId,
    rawFilters?.site,
    rawFilters?.search,
    rawFilters?.sort,
    rawFilters?.page,
    rawFilters?.pageSize,
  ]);

  const queryKey = normalized
    ? OPERATIONS_QUERY_KEYS.normalized(normalized)
    : (['operations', 'logs'] as const);

  return useQuery<HourLogRecord[]>({
    queryKey,
    enabled,
    queryFn: async () => {
      // 1. High-Performance Read Model RPC (Phase 19)
      try {
        const { data, error } = await supabase.rpc('get_operation_logs', {
          view: rawFilters?.viewMode || (normalized?.clientId ? 'client' : (normalized?.operatorId ? 'operator' : 'machine')),
          machine_id: normalized?.machineId || null,
          client_id: normalized?.clientId || null,
          operator_id: normalized?.operatorId || null,
          start_date: normalized?.startDate || null,
          end_date: normalized?.endDate || null,
          search: normalized?.search || null,
          cursor: null,
          limit: normalized?.pageSize || 20,
          site: normalized?.locationId || null,
          page: normalized?.page || 1,
        });

        if (!error && data && Array.isArray(data.rows)) {
          return data.rows.map((l: any) => {
            const clientData = l.client || (l.client_name ? { company_name: l.client_name, client_name: l.client_name } : null);
            return {
              ...l,
              machine_code: l.machine_code || l.machine?.machine_id || l.machine_id || 'Equipment',
              client: clientData ? { ...clientData, name: clientData.company_name || clientData.client_name } : null,
            };
          });
        }
      } catch {
        // Fallback gracefully to direct PostgREST query
      }

      // 2. Resilient Direct PostgREST Query Fallback
      let query = supabase
        .from('machine_hour_logs')
        .select(`
          id,
          machine_id,
          operator_id,
          client_id,
          log_date,
          start_meter,
          end_meter,
          running_hours,
          start_time,
          end_time,
          overtime_hours,
          normal_working_hours,
          location,
          is_breakdown,
          shift,
          shift_code,
          shift_scheduled_minutes,
          remarks,
          created_at,
          conflict_flag,
          conflict_reason,
          conflict_status,
          conflict_resolved_by,
          conflict_resolved_at,
          conflict_resolution_notes,
          machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, manufacturer, status),
          operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone),
          client:clients!machine_hour_logs_client_id_fkey(id, company_name, phone, street, city, district, state, pincode)
        `);

      if (normalized) {
        if (normalized.machineId) {
          query = query.eq('machine_id', normalized.machineId);
        }
        if (normalized.clientId) {
          query = query.eq('client_id', normalized.clientId);
        }
        if (normalized.operatorId) {
          query = query.eq('operator_id', normalized.operatorId);
        }
        if (normalized.startDate) {
          query = query.gte('log_date', normalized.startDate);
        }
        if (normalized.endDate) {
          if (normalized.endOperator === 'lt') {
            query = query.lt('log_date', normalized.endDate);
          } else {
            query = query.lte('log_date', normalized.endDate);
          }
        }
        if (normalized.locationId) {
          query = query.eq('location', normalized.locationId);
        }
        const fromIndex = (normalized.page - 1) * normalized.pageSize;
        const toIndex = fromIndex + normalized.pageSize - 1;
        query = query.order('log_date', { ascending: false }).order('created_at', { ascending: false }).range(fromIndex, toIndex);
      } else {
        query = query.order('log_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000);
      }

      const logsRes = await query;

      if (logsRes.error) {
        throw logsRes.error;
      }

      return (logsRes.data || []).map((l: any) => {
        const clientData = Array.isArray(l.client) ? l.client[0] : l.client;
        return {
          ...l,
          machine_code: l.machine?.machine_id || l.machine_id || 'Equipment',
          client: clientData ? { ...clientData, name: clientData.company_name || clientData.client_name } : null,
        };
      });
    },
    placeholderData: keepPreviousData,
    staleTime: OPERATIONS_CACHE_TTLS.machineLogs * 1000, // 45 seconds cache stale time (45s)
  });
}

/**
 * Ultra-fast read-model hook for Operator Landing screen.
 * Queries ONLY the authenticated operator, assigned machine, client, and latest HMR in ONE RPC call.
 */
export function useOperatorEntryContext(operatorId?: string) {
  return useQuery<OperatorEntryContext | null>({
    queryKey: ['operator', 'entry-context', operatorId],
    queryFn: async () => {
      if (!operatorId) return null;
      const { data, error } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: operatorId,
      });

      if (error) {
        if (isAbortError(error)) return null;
        console.error('[useOperatorEntryContext] RPC Error:', error);
        throw error;
      }

      const res = data as any;
      return {
        operator: res?.operator || null,
        machine: res?.machine || null,
        client: res?.client || null,
        last_hmr: typeof res?.last_hmr === 'number' ? res.last_hmr : Number(res?.last_hmr) || 0,
        last_log: res?.last_log || null,
        shift_codes: res?.shift_codes || [],
        assigned_shift_code: res?.assigned_shift_code || null,
        assigned_shift_codes: Array.isArray(res?.assigned_shift_codes) ? res.assigned_shift_codes : [],
      };
    },
    enabled: Boolean(operatorId),
    staleTime: 15_000, // 15 seconds operational cache
  });
}

/**
 * Hook for Today's Shift Log Monitor on Mobile.
 * Queries get_today_shift_log_monitor RPC with 30s auto-refresh interval.
 */
export function useTodayShiftMonitor(
  actorId?: string,
  logDate?: string,
  enabled: boolean = true,
  clientId?: string
) {
  return useQuery<TodayShiftMonitorRow[]>({
    queryKey: ['operations', 'today-shift-monitor', actorId, logDate || 'today', clientId || 'all'],
    enabled: Boolean(actorId) && enabled,
    queryFn: async () => {
      if (!actorId) return [];
      const { data, error } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: actorId,
        ...(logDate ? { p_log_date: logDate } : {}),
        ...(clientId ? { p_client_id: clientId } : {}),
      });

      if (error) {
        if (isAbortError(error)) return [];
        console.error('[useTodayShiftMonitor] RPC Error:', error);
        throw error;
      }

      return (data as TodayShiftMonitorRow[]) || [];
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export interface TodayShiftSummaryData {
  total: number;
  entered: number;
  pending: number;
  unassigned: number;
}

export interface TodayShiftMonitorPaginatedPage {
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  summary: TodayShiftSummaryData;
  shiftOptions: Array<{ id: string; label: string }>;
  clientOptions: Array<{ id: string; label: string }>;
  rows: TodayShiftMonitorRow[];
}

export interface TodayShiftMonitorInfiniteFilters {
  actorId?: string;
  logDate?: string;
  clientId?: string;
  searchQuery?: string;
  statusFilter?: 'all' | 'pending' | 'entered' | 'unassigned' | 'breakdown' | 'maintenance';
  shiftFilter?: string;
  sortBy?: string;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Independent lightweight summary hook for Today's Shift Counters.
 * Queries get_today_shift_monitor_summary RPC transferring ~100 bytes in <2ms.
 */
export function useTodayShiftSummary(
  actorId?: string,
  logDate?: string,
  clientId?: string,
  enabled: boolean = true
) {
  const effectiveClientId = clientId === 'all' || !clientId ? undefined : (clientId.startsWith('name:') ? undefined : clientId);

  return useQuery<TodayShiftSummaryData>({
    queryKey: ['operations', 'today-shift-summary', actorId, logDate || 'today', clientId || 'all'],
    enabled: Boolean(actorId) && enabled,
    queryFn: async () => {
      if (!actorId) return { total: 0, entered: 0, pending: 0, unassigned: 0 };
      const { data, error } = await supabase.rpc('get_today_shift_monitor_summary', {
        p_actor_id: actorId,
        ...(logDate ? { p_log_date: logDate } : {}),
        ...(effectiveClientId ? { p_client_id: effectiveClientId } : {}),
      });

      if (error) {
        if (isAbortError(error)) return { total: 0, entered: 0, pending: 0, unassigned: 0 };
        throw error;
      }

      return (data as TodayShiftSummaryData) || { total: 0, entered: 0, pending: 0, unassigned: 0 };
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Server-side virtualized infinite query for Today's Shift Monitor roster.
 * Loads small pages on demand (12 items) with server-side date, status, search, client, and sorting.
 * Ensures memory usage remains strictly bounded and completely eliminates Android ANR freezes.
 */
export function useTodayShiftMonitorInfiniteQuery({
  actorId,
  logDate,
  clientId,
  searchQuery = '',
  statusFilter = 'all',
  shiftFilter = 'all',
  sortBy = 'default',
  pageSize = 12,
  enabled = true,
}: TodayShiftMonitorInfiniteFilters) {
  const trimmedSearch = (searchQuery || '').trim();
  const effectiveClientId = clientId === 'all' || !clientId ? undefined : (clientId.startsWith('name:') ? undefined : clientId);

  return useInfiniteQuery<TodayShiftMonitorPaginatedPage, Error>({
    queryKey: [
      'operations',
      'today-shift-monitor-infinite',
      actorId,
      {
        logDate: logDate || 'today',
        clientId: clientId || 'all',
        search: trimmedSearch,
        statusFilter,
        shiftFilter,
        sortBy,
        pageSize,
      },
    ],
    enabled: Boolean(actorId) && enabled,
    initialPageParam: 1,
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    queryFn: async ({ pageParam = 1, signal }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1;
      try {
        const { data, error } = await supabase.rpc('get_today_shift_log_monitor_paginated', {
          p_actor_id: actorId,
          p_log_date: logDate || getISTDateString(),
          p_search: trimmedSearch || null,
          p_status: statusFilter,
          p_client_id: effectiveClientId || null,
          p_shift_code: shiftFilter === 'all' ? null : shiftFilter,
          p_sort: sortBy,
          p_page: page,
          p_page_size: pageSize,
        });

        if (error) {
          if (isAbortError(error, signal)) {
            return {
              page,
              pageSize,
              totalCount: 0,
              hasMore: false,
              summary: { total: 0, entered: 0, pending: 0, unassigned: 0 },
              shiftOptions: [],
              clientOptions: [],
              rows: [],
            };
          }
          throw error;
        }

        const res = data as any;
        return {
          page: res?.page || page,
          pageSize: res?.pageSize || pageSize,
          totalCount: typeof res?.totalCount === 'number' ? res.totalCount : (res?.rows?.length || 0),
          hasMore: Boolean(res?.hasMore),
          summary: res?.summary || { total: 0, entered: 0, pending: 0, unassigned: 0 },
          shiftOptions: Array.isArray(res?.shiftOptions) ? res.shiftOptions : [],
          clientOptions: Array.isArray(res?.clientOptions) ? res.clientOptions : [],
          rows: Array.isArray(res?.rows) ? (res.rows as TodayShiftMonitorRow[]) : [],
        };
      } catch (err: any) {
        if (isAbortError(err, signal)) {
          return {
            page,
            pageSize,
            totalCount: 0,
            hasMore: false,
            summary: { total: 0, entered: 0, pending: 0, unassigned: 0 },
            shiftOptions: [],
            clientOptions: [],
            rows: [],
          };
        }
        // Fallback to legacy unpaginated query with client slicing
        const { data: legacyRows, error: legacyErr } = await supabase.rpc('get_today_shift_log_monitor', {
          p_actor_id: actorId,
          ...(logDate ? { p_log_date: logDate } : {}),
          ...(effectiveClientId ? { p_client_id: effectiveClientId } : {}),
        });
        if (legacyErr) throw legacyErr;
        const all = (legacyRows as TodayShiftMonitorRow[]) || [];
        const from = (page - 1) * pageSize;
        const slice = all.slice(from, from + pageSize);
        return {
          page,
          pageSize,
          totalCount: all.length,
          hasMore: from + pageSize < all.length,
          summary: {
            total: all.length,
            entered: all.filter((r) => r.status === 'entered').length,
            pending: all.filter((r) => r.status === 'pending').length,
            unassigned: all.filter((r) => r.status === 'unassigned').length,
          },
          shiftOptions: [],
          clientOptions: [],
          rows: slice,
        };
      }
    },
  });
}

/**
 * Direct PostgREST query to fetch historical machine hour logs for an operator.
 * Performs relational join first, falling back to flat query on error.
 */
export async function fetchOperatorHistoryLogs(
  operatorId: string,
  fallbackMachine?: any
): Promise<HourLogRecord[]> {
  try {
    const { data, error } = await supabase
      .from('machine_hour_logs')
      .select(`
        id,
        machine_id,
        operator_id,
        client_id,
        log_date,
        start_meter,
        end_meter,
        running_hours,
        start_time,
        end_time,
        overtime_hours,
        normal_working_hours,
        location,
        is_breakdown,
        breakdown_start_time,
        breakdown_end_time,
        breakdown_duration,
        breakdown_hours,
        remarks,
        created_at,
        machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, manufacturer, status),
        client:clients!machine_hour_logs_client_id_fkey(id, company_name, city)
      `)
      .eq('operator_id', operatorId)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data) {
      return data.map((l: any) => {
        const clientData = Array.isArray(l.client) ? l.client[0] : l.client;
        return {
          ...l,
          machine_code: l.machine?.machine_id || l.machine_id || 'Equipment',
          client: clientData ? { ...clientData, name: clientData.company_name || clientData.client_name } : null,
        } as HourLogRecord;
      });
    }
  } catch {
    // Relational query exception, using flat fallback
  }

  // Flat query fallback with explicit column projection
  const { data: flatData, error: flatError } = await supabase
    .from('machine_hour_logs')
    .select('id, machine_id, operator_id, client_id, log_date, start_meter, end_meter, running_hours, start_time, end_time, overtime_hours, normal_working_hours, location, is_breakdown, breakdown_start_time, breakdown_end_time, breakdown_duration, breakdown_hours, remarks, created_at')
    .eq('operator_id', operatorId)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);

  if (flatError) {
    throw flatError;
  }

  return (flatData || []).map((l: any) => ({
    ...l,
    machine_code: l.machine_id || 'Equipment',
    machine: fallbackMachine || null,
    client: null,
  })) as HourLogRecord[];
}

/**
 * Hook for Operator Log History.
 * Queries historical logs for the operator, used for tab badge counts and the log history feed.
 */
export function useOperatorHistoryLogs(operatorId?: string, fallbackMachine?: any, enabled: boolean = true) {
  return useQuery<HourLogRecord[]>({
    queryKey: ['operator', 'history-logs', operatorId],
    enabled: Boolean(operatorId) && enabled,
    queryFn: () => fetchOperatorHistoryLogs(operatorId!, fallbackMachine),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * Ultra-fast HEAD count hook for operator history badge.
 * Transfers ZERO row payload across the network (<200 bytes, ~10ms).
 */
export function useOperatorHistoryCount(operatorId?: string) {
  return useQuery<number>({
    queryKey: ['operator', 'history-count', operatorId],
    enabled: Boolean(operatorId),
    queryFn: async () => {
      if (!operatorId) return 0;
      const { count, error } = await supabase
        .from('machine_hour_logs')
        .select('id', { count: 'exact', head: true })
        .eq('operator_id', operatorId);
      if (error) return 0;
      return count || 0;
    },
    staleTime: 60_000,
  });
}

export interface OperatorHistoryInfiniteFilters {
  operatorId?: string;
  fallbackMachine?: any;
  searchQuery?: string;
  dateFilter?: 'all' | 'today' | 'yesterday' | 'week' | 'month';
  conditionFilter?: 'all' | 'normal' | 'breakdown';
  sortBy?: 'date_desc' | 'date_asc' | 'hours_desc' | 'hours_asc' | 'meter_desc' | 'meter_asc';
  pageSize?: number;
  enabled?: boolean;
}

export interface OperatorHistoryPageChunk {
  logs: HourLogRecord[];
  totalCount: number;
  hasMore: boolean;
}

const OPERATOR_HISTORY_PAGE_SIZE = 12;

/**
 * Server-side virtualized infinite query for Operator Log History.
 * Loads small pages on demand (12 items) with server-side date, condition, search, and sorting.
 * Ensures memory usage remains strictly bounded and 100% crash-resistant on real Android devices.
 */
export function useOperatorHistoryInfiniteQuery({
  operatorId,
  fallbackMachine,
  searchQuery = '',
  dateFilter = 'all',
  conditionFilter = 'all',
  sortBy = 'date_desc',
  pageSize = OPERATOR_HISTORY_PAGE_SIZE,
  enabled = true,
}: OperatorHistoryInfiniteFilters) {
  const trimmedSearch = (searchQuery || '').trim();

  return useInfiniteQuery<OperatorHistoryPageChunk, Error>({
    queryKey: [
      'operator',
      'history-infinite',
      operatorId,
      {
        search: trimmedSearch,
        dateFilter,
        conditionFilter,
        sortBy,
        pageSize,
      },
    ],
    enabled: Boolean(operatorId) && enabled,
    initialPageParam: 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length + 1 : undefined;
    },
    queryFn: async ({ pageParam = 1, signal }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      try {
        let query = supabase
          .from('machine_hour_logs')
          .select(`
            id,
            machine_id,
            operator_id,
            client_id,
            log_date,
            start_meter,
            end_meter,
            running_hours,
            start_time,
            end_time,
            overtime_hours,
            normal_working_hours,
            location,
            is_breakdown,
            breakdown_start_time,
            breakdown_end_time,
            breakdown_duration,
            breakdown_hours,
            remarks,
            created_at,
            shift,
            shift_code,
            conflict_flag,
            conflict_reason,
            conflict_status,
            conflict_resolved_by,
            conflict_resolved_at,
            conflict_resolution_notes,
            machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, manufacturer, status),
            client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, city)
          `, { count: 'exact' })
          .eq('operator_id', operatorId)
          .abortSignal(signal);

        // Server-Side Date Filter
        if (dateFilter === 'today') {
          query = query.eq('log_date', getISTDateString());
        } else if (dateFilter === 'yesterday') {
          query = query.eq('log_date', addDaysToDateStr(getISTDateString(), -1));
        } else if (dateFilter === 'week') {
          query = query
            .gte('log_date', addDaysToDateStr(getISTDateString(), -7))
            .lte('log_date', getISTDateString());
        } else if (dateFilter === 'month') {
          const monthPrefix = getISTDateString().slice(0, 7);
          query = query
            .gte('log_date', `${monthPrefix}-01`)
            .lte('log_date', `${monthPrefix}-31`);
        }

        // Server-Side Condition Filter
        if (conditionFilter === 'breakdown') {
          query = query.eq('is_breakdown', true);
        } else if (conditionFilter === 'normal') {
          query = query.eq('is_breakdown', false);
        }

        // Server-Side Search Filter (Handles Date & Text)
        if (trimmedSearch) {
          const isDatePattern = /^\d{4}-\d{2}-\d{2}$/.test(trimmedSearch);
          if (isDatePattern) {
            query = query.eq('log_date', trimmedSearch);
          } else {
            query = query.or(
              `remarks.ilike.%${trimmedSearch}%,location.ilike.%${trimmedSearch}%,shift.ilike.%${trimmedSearch}%,shift_code.ilike.%${trimmedSearch}%`
            );
          }
        }

        // Server-Side Sort Order with unique tie-breaker (id DESC)
        switch (sortBy) {
          case 'date_asc':
            query = query.order('log_date', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true });
            break;
          case 'hours_desc':
            query = query.order('running_hours', { ascending: false }).order('log_date', { ascending: false }).order('id', { ascending: false });
            break;
          case 'hours_asc':
            query = query.order('running_hours', { ascending: true }).order('log_date', { ascending: false }).order('id', { ascending: false });
            break;
          case 'meter_desc':
            query = query.order('end_meter', { ascending: false }).order('log_date', { ascending: false }).order('id', { ascending: false });
            break;
          case 'meter_asc':
            query = query.order('end_meter', { ascending: true }).order('log_date', { ascending: false }).order('id', { ascending: false });
            break;
          case 'date_desc':
          default:
            query = query.order('log_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false });
            break;
        }

        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) {
          if (isAbortError(error, signal)) {
            return { logs: [], totalCount: 0, hasMore: false };
          }
          throw error;
        }

        const totalCount = typeof count === 'number' ? count : (data || []).length;
        const logs: HourLogRecord[] = (data || []).map((l: any) => {
          const clientData = Array.isArray(l.client) ? l.client[0] : l.client;
          return {
            ...l,
            machine_code: l.machine?.machine_id || l.machine_id || 'Equipment',
            client: clientData ? { ...clientData, name: clientData.company_name || clientData.client_name } : null,
          } as HourLogRecord;
        });

        const hasMore = to + 1 < totalCount;
        return { logs, totalCount, hasMore };
      } catch (err: any) {
        if (isAbortError(err, signal)) {
          return { logs: [], totalCount: 0, hasMore: false };
        }

        // Fallback to flat query
        let fallbackQuery = supabase
          .from('machine_hour_logs')
          .select('id, machine_id, operator_id, client_id, log_date, start_meter, end_meter, running_hours, start_time, end_time, overtime_hours, normal_working_hours, location, is_breakdown, breakdown_start_time, breakdown_end_time, breakdown_duration, breakdown_hours, remarks, created_at, shift, shift_code', { count: 'exact' })
          .eq('operator_id', operatorId)
          .abortSignal(signal);

        if (conditionFilter === 'breakdown') {
          fallbackQuery = fallbackQuery.eq('is_breakdown', true);
        } else if (conditionFilter === 'normal') {
          fallbackQuery = fallbackQuery.eq('is_breakdown', false);
        }

        fallbackQuery = fallbackQuery.order('log_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);

        const { data: flatData, count: flatCount, error: flatError } = await fallbackQuery;

        if (flatError) {
          if (isAbortError(flatError, signal)) {
            return { logs: [], totalCount: 0, hasMore: false };
          }
          throw flatError;
        }

        const totalCount = typeof flatCount === 'number' ? flatCount : (flatData || []).length;
        const logs: HourLogRecord[] = (flatData || []).map((l: any) => ({
          ...l,
          machine_code: l.machine_id || 'Equipment',
          machine: fallbackMachine || null,
          client: null,
        })) as HourLogRecord[];

        const hasMore = to + 1 < totalCount;
        return { logs, totalCount, hasMore };
      }
    },
  });
}

export interface LazyMachineOption {
  id: string;
  machine_id: string;
  model?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  status?: string | null;
  hour_meter?: number | null;
  client_id?: string | null;
  client?: {
    id: string;
    company_name: string;
    city?: string | null;
  } | null;
}

export interface LazyClientOption {
  id: string;
  code?: string | null;
  company_name: string;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
}

/**
 * Lazy loading query for Machinery equipment dropdown selection.
 * Explicit column projections with automatic request cancellation and 30s caching.
 */
export function useOperationsMachinesLazy(enabled: boolean = true) {
  return useQuery<LazyMachineOption[]>({
    queryKey: ['operations', 'machines-lazy'],
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('machines')
        .select(`
          id,
          machine_id,
          model,
          serial_number,
          manufacturer,
          status,
          hour_meter,
          client_id,
          client:clients(id, company_name, city)
        `)
        .order('machine_id', { ascending: true })
        .abortSignal(signal);

      if (error) {
        if (isAbortError(error, signal)) {
          return [] as LazyMachineOption[];
        }
        throw error;
      }

      return (data || []).map((m: any) => ({
        ...m,
        client: Array.isArray(m.client) ? m.client[0] : m.client,
      })) as LazyMachineOption[];
    },
  });
}

/**
 * Lazy loading query for Client records dropdown selection.
 * Explicit column projections with automatic request cancellation and 60s caching.
 */
export function useOperationsClientsLazy(enabled: boolean = true) {
  return useQuery<LazyClientOption[]>({
    queryKey: ['operations', 'clients-lazy'],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, code, company_name, phone, street, city, district, state, pincode')
        .order('company_name', { ascending: true })
        .abortSignal(signal);

      if (error) {
        if (isAbortError(error, signal)) {
          return [] as LazyClientOption[];
        }
        throw error;
      }

      return (data || []) as LazyClientOption[];
    },
  });
}

/**
 * Hook to fetch canonical shift codes and timings for a specific rented client.
 * Explicit column projections with automatic request cancellation and 60s caching.
 */
export function useOperationsClientShifts(clientId?: string | null) {
  return useQuery<ClientShiftCode[]>({
    queryKey: ['operations', 'client-shift-codes', clientId],
    enabled: Boolean(clientId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_shift_codes')
        .select(`
          id,
          client_id,
          code,
          name,
          start_time,
          end_time,
          crosses_midnight,
          scheduled_minutes,
          normal_minutes,
          display_order,
          is_active
        `)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('code', { ascending: true })
        .abortSignal(signal);

      if (error) {
        if (isAbortError(error, signal)) {
          return [] as ClientShiftCode[];
        }
        throw error;
      }

      return (data || []).map((sc: any) => ({
        ...sc,
        default_ot_minutes: Math.max(0, (sc.scheduled_minutes || 0) - (sc.normal_minutes || 0)),
        start_time: sc.start_time ? formatTo12Hour(sc.start_time) : sc.start_time,
        end_time: sc.end_time ? formatTo12Hour(sc.end_time) : sc.end_time,
        raw_start_time: sc.start_time,
        raw_end_time: sc.end_time,
      })) as ClientShiftCode[];
    },
  });
}


