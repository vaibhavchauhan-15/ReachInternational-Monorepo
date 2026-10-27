/**
 * Native Mobile Client Detail Server State & Data Access Hook
 *
 * Adheres to monorepo mobile backend architecture:
 * - TanStack Query (@tanstack/react-query) for server state caching
 * - 30-second stale time and background refetching
 * - Exact column projections (zero SELECT *)
 * - Canonical client ID resolution (supports CLI-0050, custom codes, and UUIDs)
 * - On-demand lazy tab loading (machines, sites, logs, assignments, shifts, history, audit)
 * - Mutation reconciliation with surgical cache invalidation
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ClientDetailRecord {
  id: string;
  client_id?: string;
  code: string;
  company_name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  street?: string | null;
  address?: string | null;
  city: string | null;
  district?: string | null;
  state: string | null;
  pincode?: string | null;
  is_billing_address_different?: boolean;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_district?: string | null;
  billing_state?: string | null;
  billing_pincode?: string | null;
  maintenance_allowance_minutes?: number | null;
  status: 'active' | 'inactive';
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDetailKPIs {
  fleetCount: number;
  sitesCount: number;
  activeAssignmentsCount: number;
  runningLogsCount: number;
  totalRunningHours: number;
}

export interface ClientMachineItem {
  id: string;
  machine_id: string;
  model: string;
  status: string;
  health_status: string;
  serial_number: string | null;
  manufacturer: string | null;
  year_of_mfg: string | null;
  hour_meter: number | null;
  updated_at: string;
}

export interface ClientSiteItem {
  id: string;
  client_id: string;
  site_code: string;
  site_name: string;
  street: string | null;
  city: string;
  district: string | null;
  state_id: number;
  state_name: string;
  pincode: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ClientRunningLogItem {
  id: string;
  machine_id: string;
  operator_id: string | null;
  log_date: string;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  normal_working_hours: number | null;
  overtime_hours: number | null;
  shift: string | null;
  is_breakdown: boolean;
  remarks: string | null;
  location: string | null;
  created_at: string;
  machine_code: string;
  machine_model: string;
  operator_name: string;
  operator_phone: string | null;
}

export interface ClientAssignmentItem {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_code: string | null;
  shift_name: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  is_active: boolean;
  assigned_at: string;
  machine_code: string;
  machine_model: string;
  operator_name: string;
  operator_phone: string | null;
}

export interface ClientShiftCodeItem {
  id: string;
  client_id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  ot_threshold_minutes: number;
  is_active: boolean;
  display_order: number;
}

export interface ClientHistoryItem {
  id: string;
  title: string;
  desc: string;
  date: string;
  badge_color?: 'emerald' | 'sky' | 'amber' | 'rose' | 'purple';
}

export interface ClientAuditItem {
  id: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  severity: string;
  created_at: string;
}

export interface ClientSupervisorItem {
  id: string; // client_supervisors.id
  client_id: string;
  supervisor_id: string;
  supervisor_name: string;
  supervisor_email?: string | null;
  supervisor_phone?: string | null;
  assigned_at: string;
  assigned_by?: string | null;
}

export interface CandidateSupervisorItem {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  employee_id?: string | null;
  status: string;
}

export type ClientDetailTabKey =
  | 'machines'
  | 'sites'
  | 'logs'
  | 'assignments'
  | 'shifts'
  | 'history'
  | 'audit';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Resolves a client identifier (UUID, CLI-0050, or code) securely to a database UUID.
 */
export async function resolveClientId(rawId: string): Promise<string | null> {
  if (!rawId || typeof rawId !== 'string') return null;
  const trimmed = decodeURIComponent(rawId).trim();
  if (!trimmed) return null;

  if (isValidUuid(trimmed)) {
    return trimmed;
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .or(`client_id.ilike.${trimmed},code.ilike.${trimmed}`)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export function useClientDetailData(rawId: string, activeTab: ClientDetailTabKey = 'machines') {
  const queryClient = useQueryClient();

  // 1. Resolve raw ID / code into UUID
  const {
    data: resolvedId,
    isLoading: isResolvingId,
    isError: isResolveError,
  } = useQuery<string | null>({
    queryKey: ['clientResolve', rawId],
    queryFn: () => resolveClientId(rawId),
    staleTime: 60 * 1000,
    enabled: Boolean(rawId),
  });

  const clientId = resolvedId || null;

  // 2. Fetch Client Overview Record & Key Metrics
  const {
    data: clientDetailData,
    isLoading: isClientLoading,
    isFetching: isClientFetching,
    isError: isClientError,
    error: clientError,
    refetch: refetchClient,
  } = useQuery<{ client: ClientDetailRecord; kpis: ClientDetailKPIs } | null>({
    queryKey: ['clientDetail', clientId, 'summary'],
    enabled: Boolean(clientId),
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return null;

      const [clientRes, fleetRes, sitesRes, assignmentsRes, logsRes] = await Promise.all([
        supabase
          .from('clients')
          .select(`
            id,
            client_id,
            code,
            company_name,
            contact_person,
            phone,
            gstin,
            pan_number,
            street,
            city,
            district,
            state,
            pincode,
            is_billing_address_different,
            billing_address,
            billing_city,
            billing_district,
            billing_state,
            billing_pincode,
            maintenance_allowance_minutes,
            status,
            deleted_at,
            created_at,
            updated_at
          `)
          .eq('id', clientId)
          .single(),
        supabase
          .from('machines')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('client_sites')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('operator_machine_assignments')
          .select('id, machines!inner(client_id)', { count: 'exact', head: true })
          .eq('machines.client_id', clientId)
          .eq('is_active', true),
        supabase
          .from('machine_hour_logs')
          .select('running_hours')
          .eq('client_id', clientId),
      ]);

      if (clientRes.error || !clientRes.data) {
        throw new Error(clientRes.error?.message || 'Client record not found');
      }

      const raw = clientRes.data as any;
      const client: ClientDetailRecord = {
        ...raw,
        address: raw.street || '',
        email: null,
      };
      const logs = logsRes.data || [];
      const totalHours = logs.reduce((acc, l: any) => acc + Number(l.running_hours || 0), 0);

      const kpis: ClientDetailKPIs = {
        fleetCount: fleetRes.count || 0,
        sitesCount: sitesRes.count || 0,
        activeAssignmentsCount: assignmentsRes.count || 0,
        runningLogsCount: logs.length,
        totalRunningHours: Math.round(totalHours * 10) / 10,
      };

      return { client, kpis };
    },
  });

  // 3. Tab: Machines Query (Lazy on tab active)
  const {
    data: machines = [],
    isLoading: isMachinesLoading,
    refetch: refetchMachines,
  } = useQuery<ClientMachineItem[]>({
    queryKey: ['clientDetail', clientId, 'machines'],
    enabled: Boolean(clientId) && activeTab === 'machines',
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('machines')
        .select(`
          id,
          machine_id,
          model,
          status,
          health_status,
          serial_number,
          manufacturer,
          year_of_mfg,
          hour_meter,
          updated_at
        `)
        .eq('client_id', clientId)
        .order('machine_id', { ascending: true });

      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.id,
        machine_id: m.machine_id,
        model: m.model,
        status: m.status,
        health_status: m.health_status,
        serial_number: m.serial_number,
        manufacturer: m.manufacturer,
        year_of_mfg: m.year_of_mfg ? String(m.year_of_mfg) : null,
        hour_meter: m.hour_meter !== null ? Number(m.hour_meter) : null,
        updated_at: m.updated_at,
      }));
    },
  });

  // 4. Tab: Sites Query (Lazy on tab active)
  const {
    data: sites = [],
    isLoading: isSitesLoading,
    refetch: refetchSites,
  } = useQuery<ClientSiteItem[]>({
    queryKey: ['clientDetail', clientId, 'sites'],
    enabled: Boolean(clientId) && activeTab === 'sites',
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_sites')
        .select(`
          id,
          client_id,
          site_code,
          site_name,
          street,
          city,
          district,
          state_id,
          pincode,
          status,
          created_at,
          updated_at,
          states!inner(name)
        `)
        .eq('client_id', clientId)
        .order('site_code', { ascending: true });

      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        client_id: s.client_id,
        site_code: s.site_code,
        site_name: s.site_name,
        street: s.street,
        city: s.city,
        district: s.district,
        state_id: s.state_id,
        state_name: s.states?.name || '',
        pincode: s.pincode,
        status: s.status,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
    },
  });

  // 5. Tab: Running Logs Query (Lazy on tab active, limited to 50 entries)
  const {
    data: runningLogs = [],
    isLoading: isLogsLoading,
    refetch: refetchLogs,
  } = useQuery<ClientRunningLogItem[]>({
    queryKey: ['clientDetail', clientId, 'logs'],
    enabled: Boolean(clientId) && activeTab === 'logs',
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('machine_hour_logs')
        .select(`
          id,
          machine_id,
          operator_id,
          log_date,
          start_meter,
          end_meter,
          running_hours,
          normal_working_hours,
          overtime_hours,
          shift,
          is_breakdown,
          remarks,
          location,
          created_at,
          machines!inner(id, machine_id, model),
          users!operator_id(id, full_name, phone)
        `)
        .eq('client_id', clientId)
        .order('log_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map((l: any) => {
        const m = Array.isArray(l.machines) ? l.machines[0] : l.machines;
        const u = Array.isArray(l.users) ? l.users[0] : l.users;
        return {
          id: l.id,
          machine_id: l.machine_id,
          operator_id: l.operator_id,
          log_date: l.log_date,
          start_meter: l.start_meter !== null ? Number(l.start_meter) : null,
          end_meter: l.end_meter !== null ? Number(l.end_meter) : null,
          running_hours: Number(l.running_hours ?? 0),
          normal_working_hours: l.normal_working_hours !== null ? Number(l.normal_working_hours) : null,
          overtime_hours: l.overtime_hours !== null ? Number(l.overtime_hours) : null,
          shift: l.shift,
          is_breakdown: Boolean(l.is_breakdown),
          remarks: l.remarks,
          location: l.location,
          created_at: l.created_at,
          machine_code: m?.machine_id || '—',
          machine_model: m?.model || '—',
          operator_name: u?.full_name || 'Unassigned',
          operator_phone: u?.phone || null,
        };
      });
    },
  });

  // 6. Tab: Assignments Query (Lazy on tab active)
  const {
    data: assignments = [],
    isLoading: isAssignmentsLoading,
    refetch: refetchAssignments,
  } = useQuery<ClientAssignmentItem[]>({
    queryKey: ['clientDetail', clientId, 'assignments'],
    enabled: Boolean(clientId) && activeTab === 'assignments',
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const [assRes, shiftsRes] = await Promise.all([
        supabase
          .from('operator_machine_assignments')
          .select(`
            id,
            machine_id,
            operator_id,
            shift_code,
            shift_start_time,
            shift_end_time,
            is_active,
            assigned_at,
            machines!inner(id, machine_id, model, client_id),
            users!operator_id(id, full_name, phone)
          `)
          .eq('machines.client_id', clientId)
          .order('is_active', { ascending: false })
          .order('assigned_at', { ascending: false }),
        supabase
          .from('client_shift_codes')
          .select('code, name, start_time, end_time')
          .eq('client_id', clientId),
      ]);

      if (assRes.error) throw assRes.error;
      const shiftsMap = new Map((shiftsRes.data || []).map((s: any) => [String(s.code).toUpperCase(), s]));

      return (assRes.data || []).map((a: any) => {
        const m = Array.isArray(a.machines) ? a.machines[0] : a.machines;
        const u = Array.isArray(a.users) ? a.users[0] : a.users;
        const sc = a.shift_code ? shiftsMap.get(String(a.shift_code).toUpperCase()) : null;
        const shiftName = sc?.name || (a.shift_code ? `Shift ${a.shift_code}` : 'Standard Shift');

        return {
          id: a.id,
          machine_id: a.machine_id,
          operator_id: a.operator_id,
          shift_code: a.shift_code,
          shift_name: shiftName,
          shift_start_time: a.shift_start_time,
          shift_end_time: a.shift_end_time,
          is_active: Boolean(a.is_active),
          assigned_at: a.assigned_at,
          machine_code: m?.machine_id || '—',
          machine_model: m?.model || '—',
          operator_name: u?.full_name || 'Unassigned',
          operator_phone: u?.phone || null,
        };
      });
    },
  });

  // 7. Tab: Shift Codes Query (Lazy on tab active)
  const {
    data: shiftCodes = [],
    isLoading: isShiftsLoading,
    refetch: refetchShifts,
  } = useQuery<ClientShiftCodeItem[]>({
    queryKey: ['clientDetail', clientId, 'shifts'],
    enabled: Boolean(clientId) && activeTab === 'shifts',
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_shift_codes')
        .select('id, client_id, code, name, start_time, end_time, scheduled_minutes, normal_minutes, is_active, display_order')
        .eq('client_id', clientId)
        .order('display_order', { ascending: true })
        .order('code', { ascending: true });

      if (error) throw error;
      return (data || []).map((sc: any) => ({
        id: sc.id,
        client_id: sc.client_id,
        code: sc.code,
        name: sc.name,
        start_time: sc.start_time,
        end_time: sc.end_time,
        scheduled_minutes: sc.scheduled_minutes,
        ot_threshold_minutes: sc.normal_minutes ?? 480,
        is_active: sc.is_active,
        display_order: sc.display_order,
      })) as ClientShiftCodeItem[];
    },
  });

  // 8. Tab: History Query (Lazy on tab active)
  const {
    data: history = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery<ClientHistoryItem[]>({
    queryKey: ['clientDetail', clientId, 'history'],
    enabled: Boolean(clientId) && activeTab === 'history',
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const [clientRes, machinesRes, auditRes] = await Promise.all([
        supabase.from('clients').select('created_at, code, status').eq('id', clientId).single(),
        supabase.from('machines').select('id, machine_id, created_at').eq('client_id', clientId),
        supabase
          .from('audit_logs')
          .select('id, action, actor_name, created_at')
          .or(`entity_id.eq.${clientId},details->>clientId.eq.${clientId}`)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      const events: ClientHistoryItem[] = [];

      if (clientRes.data?.created_at) {
        events.push({
          id: `hist-create-${clientId}`,
          title: 'Account Registered',
          desc: `Client profile created under code ${clientRes.data.code}. Status: ${clientRes.data.status?.toUpperCase() || 'ACTIVE'}.`,
          date: clientRes.data.created_at,
          badge_color: 'emerald',
        });
      }

      if (machinesRes.data && machinesRes.data.length > 0) {
        events.push({
          id: `hist-machines-${clientId}`,
          title: 'Fleet Equipment Deployed',
          desc: `${machinesRes.data.length} equipment unit(s) deployed: ${machinesRes.data.map((m: any) => m.machine_id).slice(0, 4).join(', ')}${machinesRes.data.length > 4 ? ` and ${machinesRes.data.length - 4} more` : ''}.`,
          date: machinesRes.data[0].created_at || new Date().toISOString(),
          badge_color: 'sky',
        });
      }

      if (auditRes.data) {
        for (const a of auditRes.data) {
          events.push({
            id: `hist-audit-${a.id}`,
            title: a.action.replace(/_/g, ' '),
            desc: `Audit event recorded by ${a.actor_name || 'System'}.`,
            date: a.created_at,
            badge_color: a.action.includes('DELETE') ? 'rose' : a.action.includes('UPDATE') ? 'amber' : 'purple',
          });
        }
      }

      return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });

  // 9. Tab: Audit Query (Lazy on tab active)
  const {
    data: audits = [],
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useQuery<ClientAuditItem[]>({
    queryKey: ['clientDetail', clientId, 'audit'],
    enabled: Boolean(clientId) && activeTab === 'audit',
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, actor_name, actor_role, severity, created_at')
        .or(`entity_id.eq.${clientId},details->>clientId.eq.${clientId}`)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        action: a.action,
        actor_name: a.actor_name,
        actor_role: a.actor_role,
        severity: a.severity || 'info',
        created_at: a.created_at,
      }));
    },
  });

  // 9b. Client Supervisors Query (Active when clientId exists)
  const {
    data: supervisors = [],
    isLoading: isSupervisorsLoading,
    refetch: refetchSupervisors,
  } = useQuery<ClientSupervisorItem[]>({
    queryKey: ['clientDetail', clientId, 'supervisors'],
    enabled: Boolean(clientId),
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_supervisors')
        .select(`
          id,
          client_id,
          supervisor_id,
          assigned_at,
          assigned_by,
          supervisor:users!client_supervisors_supervisor_id_fkey(id, full_name, email, phone, status)
        `)
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false });

      if (error) {
        return [];
      }

      return (data || []).map((row: any) => {
        const sup = Array.isArray(row.supervisor) ? row.supervisor[0] : row.supervisor;
        return {
          id: row.id,
          client_id: row.client_id,
          supervisor_id: row.supervisor_id,
          supervisor_name: sup?.full_name || 'Unknown Supervisor',
          supervisor_email: sup?.email || null,
          supervisor_phone: sup?.phone || null,
          assigned_at: row.assigned_at,
          assigned_by: row.assigned_by,
        };
      });
    },
  });

  // 10. Mutation: Update Client
  const updateClientMutation = useMutation({
    mutationFn: async (payload: Partial<ClientDetailRecord>) => {
      if (!clientId) throw new Error('No client selected');
      const { email: _e, address: _a, ...safePayload } = payload as any;
      const streetVal = safePayload.street || _a;

      const { data, error } = await supabase
        .from('clients')
        .update({
          ...safePayload,
          ...(streetVal ? { street: streetVal } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .select()
        .single();

      if (error) throw error;
      const raw = data as any;
      return {
        ...raw,
        address: raw.street || '',
        email: null,
      } as ClientDetailRecord;
    },
    onSuccess: (updatedClient) => {
      queryClient.setQueryData(
        ['clientDetail', clientId, 'summary'],
        (old: any) => (old ? { ...old, client: { ...old.client, ...updatedClient } } : old)
      );
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId] });
    },
  });

  // 11. Mutation: Add Client Site
  const addSiteMutation = useMutation({
    mutationFn: async (payload: {
      site_name: string;
      street?: string;
      city: string;
      district?: string;
      state_id: number;
      pincode?: string;
    }) => {
      if (!clientId) throw new Error('No client selected');

      // Auto-generate site_code if needed
      const siteCode = `SITE-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data, error } = await supabase
        .from('client_sites')
        .insert({
          client_id: clientId,
          site_code: siteCode,
          site_name: payload.site_name,
          street: payload.street || '',
          city: payload.city,
          district: payload.district || '',
          state_id: payload.state_id,
          pincode: payload.pincode || '',
          status: 'active',
        })
        .select(`
          id,
          client_id,
          site_code,
          site_name,
          street,
          city,
          district,
          state_id,
          pincode,
          status,
          created_at,
          updated_at,
          states!inner(name)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId, 'sites'] });
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId, 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // 12. Mutation: Assign Client Supervisor (with optimistic update & snapshot rollback)
  const assignSupervisorMutation = useMutation({
    mutationFn: async (payload: { supervisorId: string }) => {
      if (!clientId) throw new Error('No client selected');
      const { data, error } = await supabase.rpc('assign_client_supervisor_atomic', {
        p_client_id: clientId,
        p_supervisor_id: payload.supervisorId,
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to assign supervisor to client.');
      }
      return data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['clientDetail', clientId, 'supervisors'] });
      const previousSupervisors =
        queryClient.getQueryData<ClientSupervisorItem[]>(['clientDetail', clientId, 'supervisors']) || [];
      const eligible =
        queryClient.getQueryData<CandidateSupervisorItem[]>(['eligibleClientSupervisors', clientId]) || [];
      const candidate = eligible.find((c) => c.id === payload.supervisorId);

      if (candidate) {
        const optimisticItem: ClientSupervisorItem = {
          id: `tmp_${payload.supervisorId}_${Date.now()}`,
          client_id: clientId!,
          supervisor_id: payload.supervisorId,
          assigned_at: new Date().toISOString(),
          supervisor_name: candidate.full_name,
          supervisor_phone: candidate.phone || null,
          supervisor_email: candidate.email || null,
        };
        queryClient.setQueryData<ClientSupervisorItem[]>(
          ['clientDetail', clientId, 'supervisors'],
          [...previousSupervisors, optimisticItem]
        );
      }
      return { previousSupervisors };
    },
    onError: (_err, _payload, context) => {
      if (context?.previousSupervisors) {
        queryClient.setQueryData(['clientDetail', clientId, 'supervisors'], context.previousSupervisors);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId, 'supervisors'] });
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['eligibleClientSupervisors', clientId] });
    },
  });

  // 13. Mutation: Remove Client Supervisor (with optimistic update & snapshot rollback)
  const removeSupervisorMutation = useMutation({
    mutationFn: async (payload: { supervisorId: string }) => {
      if (!clientId) throw new Error('No client selected');
      const { data, error } = await supabase.rpc('remove_client_supervisor_atomic', {
        p_client_id: clientId,
        p_supervisor_id: payload.supervisorId,
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to remove supervisor from client.');
      }
      return data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['clientDetail', clientId, 'supervisors'] });
      const previousSupervisors =
        queryClient.getQueryData<ClientSupervisorItem[]>(['clientDetail', clientId, 'supervisors']) || [];
      queryClient.setQueryData<ClientSupervisorItem[]>(
        ['clientDetail', clientId, 'supervisors'],
        previousSupervisors.filter((s) => s.supervisor_id !== payload.supervisorId)
      );
      return { previousSupervisors };
    },
    onError: (_err, _payload, context) => {
      if (context?.previousSupervisors) {
        queryClient.setQueryData(['clientDetail', clientId, 'supervisors'], context.previousSupervisors);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId, 'supervisors'] });
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['eligibleClientSupervisors', clientId] });
    },
  });

  // 14. Combined Invalidation & Refresh Helper
  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchClient(),
      refetchSupervisors(),
      activeTab === 'machines' ? refetchMachines() : Promise.resolve(),
      activeTab === 'sites' ? refetchSites() : Promise.resolve(),
      activeTab === 'logs' ? refetchLogs() : Promise.resolve(),
      activeTab === 'assignments' ? refetchAssignments() : Promise.resolve(),
      activeTab === 'shifts' ? refetchShifts() : Promise.resolve(),
      activeTab === 'history' ? refetchHistory() : Promise.resolve(),
      activeTab === 'audit' ? refetchAudit() : Promise.resolve(),
    ]);
  }, [
    activeTab,
    refetchClient,
    refetchSupervisors,
    refetchMachines,
    refetchSites,
    refetchLogs,
    refetchAssignments,
    refetchShifts,
    refetchHistory,
    refetchAudit,
  ]);

  return {
    clientId,
    isResolvingId,
    isResolveError,
    client: clientDetailData?.client || null,
    kpis: clientDetailData?.kpis || null,
    isLoading: isResolvingId || isClientLoading,
    isFetching: isClientFetching,
    isError: isResolveError || isClientError,
    error: clientError,
    refetchAll,
    refetchClient,
    // Tab Data
    machines,
    isMachinesLoading,
    sites,
    isSitesLoading,
    runningLogs,
    isLogsLoading,
    assignments,
    isAssignmentsLoading,
    supervisors,
    isSupervisorsLoading,
    shiftCodes,
    isShiftsLoading,
    history,
    isHistoryLoading,
    audits,
    isAuditLoading,
    // Mutations
    updateClient: updateClientMutation.mutateAsync,
    isUpdatingClient: updateClientMutation.isPending,
    addSite: addSiteMutation.mutateAsync,
    isAddingSite: addSiteMutation.isPending,
    assignSupervisor: assignSupervisorMutation.mutateAsync,
    isAssigningSupervisor: assignSupervisorMutation.isPending,
    removeSupervisor: removeSupervisorMutation.mutateAsync,
    isRemovingSupervisor: removeSupervisorMutation.isPending,
  };
}

/**
 * Hook to fetch candidate supervisors eligible to be assigned to a client.
 * Excludes supervisors already assigned to the given clientId.
 */
export function useEligibleClientSupervisors(clientId?: string) {
  return useQuery<CandidateSupervisorItem[]>({
    queryKey: ['eligibleClientSupervisors', clientId || 'all'],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data: supervisors, error } = await supabase
        .from('users')
        .select('id, full_name, phone, email, employee_id, status')
        .eq('role', 'supervisor')
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (error || !supervisors) {
        return [];
      }

      if (!clientId || !isValidUuid(clientId)) {
        return (supervisors || []) as CandidateSupervisorItem[];
      }

      const { data: assigned } = await supabase
        .from('client_supervisors')
        .select('supervisor_id')
        .eq('client_id', clientId);

      const assignedIds = new Set((assigned || []).map((a: any) => a.supervisor_id));
      return ((supervisors || []) as CandidateSupervisorItem[]).filter((s) => !assignedIds.has(s.id));
    },
  });
}
