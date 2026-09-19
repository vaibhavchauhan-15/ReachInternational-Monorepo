import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  normalizeOperationsFilter,
  RawOperationsFilterInput,
  OPERATIONS_QUERY_KEYS,
  OPERATIONS_CACHE_TTLS,
} from '@reachinternational/utils';
import type { OperatorEntryContext } from '@reachinternational/types';
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
  full_name: string;
  phone?: string;
  shift_time?: string | null;
}

export interface OperationsMasterData {
  machinesList: MachineWithAssignments[];
  activeOperators: OperatorRecord[];
  clientsList: ClientRecord[];
}

export function useOperationsMasterData(enabled: boolean = true) {
  return useQuery<OperationsMasterData>({
    queryKey: ['operations', 'master'],
    enabled,
    queryFn: async () => {
      const [mchRes, assRes, opsRes, clientsRes] = await Promise.all([
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
          .select('id, full_name, phone, shift_time')
          .eq('role', 'operator')
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('clients')
          .select('id, code, company_name, phone, street, city, district, state, pincode')
          .order('company_name'),
      ]);

      const activeAssList = (assRes.data || []).filter((a: any) => a.is_active) as unknown as ActiveShiftAssignment[];
      const machinesList: MachineWithAssignments[] = (mchRes.data || []).map((m: any) => ({
        ...m,
        active_assignments: activeAssList.filter((a) => a.machine_id === m.id),
      }));

      const activeOperators: OperatorRecord[] = (opsRes.data || []) as OperatorRecord[];
      const clientsList: ClientRecord[] = (clientsRes.data || []) as ClientRecord[];

      return {
        machinesList,
        activeOperators,
        clientsList,
      };
    },
    staleTime: OPERATIONS_CACHE_TTLS.filterOperators * 1000, // 10 minutes cache stale time (600s)
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

  return useQuery<any[]>({
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
      } catch (rpcErr) {
        // Fallback gracefully to direct PostgREST query
        console.warn('get_operation_logs RPC fallback:', rpcErr);
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
        console.error('[useOperatorEntryContext] RPC Error:', error);
        return null;
      }

      const res = data as any;
      return {
        operator: res?.operator || null,
        machine: res?.machine || null,
        client: res?.client || null,
        last_hmr: typeof res?.last_hmr === 'number' ? res.last_hmr : Number(res?.last_hmr) || 0,
        last_log: res?.last_log || null,
      };
    },
    enabled: Boolean(operatorId),
    staleTime: 15_000, // 15 seconds operational cache
  });
}

