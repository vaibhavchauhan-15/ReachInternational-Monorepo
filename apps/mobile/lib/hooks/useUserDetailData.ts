/**
 * Native Mobile User Detail Server State & Data Access Hooks
 * Powered by TanStack Query for on-demand lazy loading across every detail tab.
 * Adheres to native backend architecture: 30s stale time, background refetching,
 * explicit column projections (zero SELECT *), offline caching, and strict RBAC.
 */

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getAppUrl } from '../env';
import type { UserRecord } from '../../components/users/UserDetailModal';

export interface UserDetailKPIs {
  assignedMachinesCount: number;
  totalRunningHours: number;
  totalDaysWorked: number;
  documentsCount: number;
}

export interface UserMachineItem {
  id: string;
  machine_id: string;
  machine_name: string;
  model: string;
  status: string;
  serial_number?: string | null;
  manufacturer?: string | null;
  year_of_mfg?: string | null;
  hour_meter?: number | null;
}

export interface UserRunningLogItem {
  id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  model: string;
  log_date: string;
  start_time: string | null;
  end_time: string | null;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  normal_working_hours: number | null;
  overtime_hours: number | null;
  is_breakdown: boolean;
  location: string | null;
  remarks: string | null;
  created_at: string;
}

export interface UserAssignmentItem {
  id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  model: string;
  shift_code?: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  is_active: boolean;
  assigned_at: string;
  ended_at: string | null;
}

export interface UserDocumentItem {
  id: string;
  user_id: string;
  document_type_code: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  type_label?: string;
  signed_url?: string | null;
}

export interface UserAuditItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  severity: string;
  category: string | null;
  details: Record<string, any> | null;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  created_at: string;
}

export interface UserMachinesPageChunk {
  machines: UserMachineItem[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export interface UserRunningLogsPageChunk {
  logs: UserRunningLogItem[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export interface UserAssignmentsPageChunk {
  assignments: UserAssignmentItem[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export interface UserAttendancePageChunk {
  totalActiveWorkDays: number;
  totalShiftRunningTime: number;
  shiftSchedule: string;
  logs: any[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export interface UserDocumentsPageChunk {
  documents: UserDocumentItem[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export interface UserAuditLogsPageChunk {
  logs: UserAuditItem[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export const USER_DETAIL_COLUMNS = `
  id,
  employee_id,
  full_name,
  email,
  phone,
  role,
  status,
  city,
  district,
  state,
  state_id,
  shift_start_time,
  shift_end_time,
  street,
  aadhaar_number,
  license_number,
  supervisor_id,
  monthly_salary,
  total_pl_quota,
  pl_used_as_on_date,
  doj,
  created_at
`;

/**
 * Hook 1: Primary Overview Profile & KPI Summaries
 */
export function useUserDetailOverview(userId?: string) {
  return useQuery({
    queryKey: ['user_detail', userId, 'overview'],
    enabled: Boolean(userId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<{ user: UserRecord; kpis: UserDetailKPIs; supervisorName?: string }> => {
      if (!userId) throw new Error('User ID is required');

      // 1. Fetch user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(USER_DETAIL_COLUMNS)
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error(userError?.message || 'Failed to fetch user profile');
      }

      // 2. Fetch supervisor name if assigned
      let supervisorName = 'Unassigned';
      if (userData.supervisor_id) {
        const { data: supData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', userData.supervisor_id)
          .maybeSingle();

        if (supData?.full_name) {
          supervisorName = supData.full_name;
        }
      }

      // 3. Fetch KPI metrics in parallel
      const [machinesRes, logsRes, docsRes] = await Promise.all([
        supabase
          .from('machines')
          .select('id', { count: 'exact', head: true })
          .or(`current_operator_id.eq.${userId},operator_ids.cs.{${userId}},current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}}`),
        supabase
          .from('machine_hour_logs')
          .select('running_hours, log_date')
          .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`),
        supabase
          .from('user_documents')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

      const logs = logsRes.data || [];
      const totalRunningHours = logs.reduce((acc, row) => acc + (Number(row.running_hours) || 0), 0);
      const distinctDates = new Set(logs.map((l) => l.log_date).filter(Boolean));

      const kpis: UserDetailKPIs = {
        assignedMachinesCount: machinesRes.count || 0,
        totalRunningHours: Math.round(totalRunningHours * 10) / 10,
        totalDaysWorked: distinctDates.size,
        documentsCount: docsRes.count || 0,
      };

      return {
        user: userData as unknown as UserRecord,
        kpis,
        supervisorName,
      };
    },
  });
}

/**
 * Hook 2: Assigned Machinery Fleet (Lazy Loaded on Machines Tab)
 */
export function useUserDetailMachines(userId?: string, enabled = false) {
  return useQuery({
    queryKey: ['user_detail', userId, 'machines'],
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<UserMachineItem[]> => {
      if (!userId) return [];

      const [directMachinesRes, activeAssignmentsRes] = await Promise.all([
        supabase
          .from('machines')
          .select('id, machine_id, machine_name, model, status, serial_number, manufacturer, year_of_mfg, hour_meter')
          .or(`current_operator_id.eq.${userId},operator_ids.cs.{${userId}},current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}}`)
          .order('machine_id'),
        supabase
          .from('operator_machine_assignments')
          .select(`
            machine_id,
            machines (id, machine_id, machine_name, model, status, serial_number, manufacturer, year_of_mfg, hour_meter)
          `)
          .eq('operator_id', userId)
          .eq('is_active', true),
      ]);

      const machineMap = new Map<string, UserMachineItem>();

      (directMachinesRes.data || []).forEach((m: any) => {
        machineMap.set(m.id, {
          id: m.id,
          machine_id: m.machine_id,
          machine_name: m.machine_name,
          model: m.model,
          status: m.status,
          serial_number: m.serial_number,
          manufacturer: m.manufacturer,
          year_of_mfg: m.year_of_mfg,
          hour_meter: m.hour_meter,
        });
      });

      (activeAssignmentsRes.data || []).forEach((item: any) => {
        const m = Array.isArray(item.machines) ? item.machines[0] : item.machines;
        if (m && !machineMap.has(m.id)) {
          machineMap.set(m.id, {
            id: m.id,
            machine_id: m.machine_id,
            machine_name: m.machine_name,
            model: m.model,
            status: m.status,
            serial_number: m.serial_number,
            manufacturer: m.manufacturer,
            year_of_mfg: m.year_of_mfg,
            hour_meter: m.hour_meter,
          });
        }
      });

      return Array.from(machineMap.values());
    },
  });
}

/**
 * Hook 2b: Assigned Machinery Fleet with Infinite Pagination (Chunked 20 per page)
 */
export function useUserDetailMachinesInfinite(userId?: string, enabled = false, pageSize = 20) {
  return useInfiniteQuery<UserMachinesPageChunk>({
    queryKey: ['user_detail', userId, 'machines_infinite', pageSize],
    enabled: Boolean(userId) && enabled,
    initialPageParam: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    queryFn: async ({ pageParam = 1 }): Promise<UserMachinesPageChunk> => {
      if (!userId) return { machines: [], totalCount: 0, page: 1, hasMore: false };
      const currentPage = Number(pageParam) || 1;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const [directMachinesRes, activeAssignmentsRes] = await Promise.all([
        supabase
          .from('machines')
          .select('id, machine_id, machine_name, model, status, serial_number, manufacturer, year_of_mfg, hour_meter')
          .or(`current_operator_id.eq.${userId},operator_ids.cs.{${userId}},current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}}`)
          .order('machine_id'),
        supabase
          .from('operator_machine_assignments')
          .select(`
            machine_id,
            machines (id, machine_id, machine_name, model, status, serial_number, manufacturer, year_of_mfg, hour_meter)
          `)
          .eq('operator_id', userId)
          .eq('is_active', true),
      ]);

      const machineMap = new Map<string, UserMachineItem>();

      (directMachinesRes.data || []).forEach((m: any) => {
        machineMap.set(m.id, {
          id: m.id,
          machine_id: m.machine_id,
          machine_name: m.machine_name,
          model: m.model,
          status: m.status,
          serial_number: m.serial_number,
          manufacturer: m.manufacturer,
          year_of_mfg: m.year_of_mfg,
          hour_meter: m.hour_meter,
        });
      });

      (activeAssignmentsRes.data || []).forEach((item: any) => {
        const m = Array.isArray(item.machines) ? item.machines[0] : item.machines;
        if (m && !machineMap.has(m.id)) {
          machineMap.set(m.id, {
            id: m.id,
            machine_id: m.machine_id,
            machine_name: m.machine_name,
            model: m.model,
            status: m.status,
            serial_number: m.serial_number,
            manufacturer: m.manufacturer,
            year_of_mfg: m.year_of_mfg,
            hour_meter: m.hour_meter,
          });
        }
      });

      const all = Array.from(machineMap.values());
      const totalCount = all.length;
      const paged = all.slice(from, to + 1);

      return {
        machines: paged,
        totalCount,
        page: currentPage,
        hasMore: to + 1 < totalCount,
      };
    },
  });
}

/**
 * Hook 3: Shift Running Logs (Lazy Loaded on Running Logs Tab)
 */
export function useUserDetailRunningLogs(userId?: string, enabled = false, limit = 50) {
  return useQuery({
    queryKey: ['user_detail', userId, 'logs', limit],
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<UserRunningLogItem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('machine_hour_logs')
        .select(`
          id, machine_id, log_date, start_time, end_time, start_meter, end_meter,
          running_hours, normal_working_hours, overtime_hours, is_breakdown, location, remarks, created_at,
          machines (id, machine_id, machine_name, model)
        `)
        .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`)
        .order('log_date', { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return data.map((log: any) => {
        const machine = Array.isArray(log.machines) ? log.machines[0] : log.machines;
        return {
          id: log.id,
          machine_id: log.machine_id,
          machine_code: machine?.machine_id || '—',
          machine_name: machine?.machine_name || 'Machine',
          model: machine?.model || '',
          log_date: log.log_date,
          start_time: log.start_time,
          end_time: log.end_time,
          start_meter: log.start_meter,
          end_meter: log.end_meter,
          running_hours: Number(log.running_hours) || 0,
          normal_working_hours: log.normal_working_hours != null ? Number(log.normal_working_hours) : null,
          overtime_hours: log.overtime_hours != null ? Number(log.overtime_hours) : null,
          is_breakdown: Boolean(log.is_breakdown),
          location: log.location || null,
          remarks: log.remarks || null,
          created_at: log.created_at,
        };
      });
    },
  });
}

/**
 * Hook 3b: Shift Running Logs with Server-Side Infinite Pagination
 */
export function useUserDetailRunningLogsInfinite(
  userId?: string,
  enabled = false,
  pageSize = 20
) {
  return useInfiniteQuery<UserRunningLogsPageChunk>({
    queryKey: ['user_detail', userId, 'logs_infinite', pageSize],
    enabled: Boolean(userId) && enabled,
    initialPageParam: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    queryFn: async ({ pageParam = 1 }): Promise<UserRunningLogsPageChunk> => {
      if (!userId) return { logs: [], totalCount: 0, page: 1, hasMore: false };
      const currentPage = Number(pageParam) || 1;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from('machine_hour_logs')
        .select(`
          id, machine_id, log_date, start_time, end_time, start_meter, end_meter,
          running_hours, normal_working_hours, overtime_hours, is_breakdown, location, remarks, created_at,
          machines (id, machine_id, machine_name, model)
        `, { count: 'exact' })
        .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`)
        .order('log_date', { ascending: false })
        .range(from, to);

      if (error || !data) {
        return { logs: [], totalCount: count || 0, page: currentPage, hasMore: false };
      }

      const totalCount = count || 0;
      const logs = data.map((log: any) => {
        const machine = Array.isArray(log.machines) ? log.machines[0] : log.machines;
        return {
          id: log.id,
          machine_id: log.machine_id,
          machine_code: machine?.machine_id || '—',
          machine_name: machine?.machine_name || 'Machine',
          model: machine?.model || '',
          log_date: log.log_date,
          start_time: log.start_time,
          end_time: log.end_time,
          start_meter: log.start_meter,
          end_meter: log.end_meter,
          running_hours: Number(log.running_hours) || 0,
          normal_working_hours: log.normal_working_hours != null ? Number(log.normal_working_hours) : null,
          overtime_hours: log.overtime_hours != null ? Number(log.overtime_hours) : null,
          is_breakdown: Boolean(log.is_breakdown),
          location: log.location || null,
          remarks: log.remarks || null,
          created_at: log.created_at,
        };
      });

      return {
        logs,
        totalCount,
        page: currentPage,
        hasMore: from + logs.length < totalCount,
      };
    },
  });
}

/**
 * Hook 4: Machine Assignment History (Lazy Loaded on Assignments Tab)
 */
export function useUserDetailAssignments(userId?: string, enabled = false) {
  return useQuery({
    queryKey: ['user_detail', userId, 'assignments'],
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<UserAssignmentItem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('operator_machine_assignments')
        .select(`
          id, machine_id, shift_code, shift_start_time, shift_end_time, is_active, assigned_at, ended_at,
          machines (id, machine_id, machine_name, model)
        `)
        .eq('operator_id', userId)
        .order('assigned_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];

      return data.map((item: any) => {
        const machine = Array.isArray(item.machines) ? item.machines[0] : item.machines;
        return {
          id: item.id,
          machine_id: item.machine_id,
          machine_code: machine?.machine_id || '—',
          machine_name: machine?.machine_name || 'Machine',
          model: machine?.model || '',
          shift_code: item.shift_code || null,
          shift_start_time: item.shift_start_time,
          shift_end_time: item.shift_end_time,
          is_active: Boolean(item.is_active),
          assigned_at: item.assigned_at,
          ended_at: item.ended_at,
        };
      });
    },
  });
}

/**
 * Hook 4b: Machine Assignment History with Server-Side Infinite Pagination
 */
export function useUserDetailAssignmentsInfinite(
  userId?: string,
  enabled = false,
  pageSize = 20
) {
  return useInfiniteQuery<UserAssignmentsPageChunk>({
    queryKey: ['user_detail', userId, 'assignments_infinite', pageSize],
    enabled: Boolean(userId) && enabled,
    initialPageParam: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    queryFn: async ({ pageParam = 1 }): Promise<UserAssignmentsPageChunk> => {
      if (!userId) return { assignments: [], totalCount: 0, page: 1, hasMore: false };
      const currentPage = Number(pageParam) || 1;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from('operator_machine_assignments')
        .select(`
          id, machine_id, shift_code, shift_start_time, shift_end_time, is_active, assigned_at, ended_at,
          machines (id, machine_id, machine_name, model)
        `, { count: 'exact' })
        .eq('operator_id', userId)
        .order('assigned_at', { ascending: false })
        .range(from, to);

      if (error || !data) {
        return { assignments: [], totalCount: count || 0, page: currentPage, hasMore: false };
      }

      const totalCount = count || 0;
      const assignments = data.map((item: any) => {
        const machine = Array.isArray(item.machines) ? item.machines[0] : item.machines;
        return {
          id: item.id,
          machine_id: item.machine_id,
          machine_code: machine?.machine_id || '—',
          machine_name: machine?.machine_name || 'Machine',
          model: machine?.model || '',
          shift_code: item.shift_code || null,
          shift_start_time: item.shift_start_time,
          shift_end_time: item.shift_end_time,
          is_active: Boolean(item.is_active),
          assigned_at: item.assigned_at,
          ended_at: item.ended_at,
        };
      });

      return {
        assignments,
        totalCount,
        page: currentPage,
        hasMore: from + assignments.length < totalCount,
      };
    },
  });
}

/**
 * Hook 5: Attendance Telemetry & Schedule (Lazy Loaded on Attendance Tab)
 */
export function useUserDetailAttendance(userId?: string, enabled = false) {
  return useQuery({
    queryKey: ['user_detail', userId, 'attendance'],
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<{
      totalActiveWorkDays: number;
      totalShiftRunningTime: number;
      shiftSchedule: string;
      recentLogs: any[];
    }> => {
      if (!userId) {
        return {
          totalActiveWorkDays: 0,
          totalShiftRunningTime: 0,
          shiftSchedule: '06:00 AM - 02:00 PM',
          recentLogs: [],
        };
      }

      const { data, error } = await supabase
        .from('machine_hour_logs')
        .select('id, log_date, start_time, end_time, running_hours, overtime_hours, normal_working_hours, remarks')
        .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`)
        .order('log_date', { ascending: false })
        .limit(60);

      const logs = data || [];
      const totalHours = logs.reduce((acc, row) => acc + (Number(row.running_hours) || 0), 0);
      const dates = new Set(logs.map((l) => l.log_date).filter(Boolean));

      return {
        totalActiveWorkDays: dates.size,
        totalShiftRunningTime: Math.round(totalHours * 10) / 10,
        shiftSchedule: '06:00 AM - 02:00 PM',
        recentLogs: logs.slice(0, 20),
      };
    },
  });
}

/**
 * Hook 5b: Attendance Telemetry with Infinite Paginated Logs
 */
export function useUserDetailAttendanceInfinite(
  userId?: string,
  enabled = false,
  pageSize = 20
) {
  return useInfiniteQuery<UserAttendancePageChunk>({
    queryKey: ['user_detail', userId, 'attendance_infinite', pageSize],
    enabled: Boolean(userId) && enabled,
    initialPageParam: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    queryFn: async ({ pageParam = 1 }): Promise<UserAttendancePageChunk> => {
      if (!userId) {
        return {
          totalActiveWorkDays: 0,
          totalShiftRunningTime: 0,
          shiftSchedule: '06:00 AM - 02:00 PM',
          logs: [],
          totalCount: 0,
          page: 1,
          hasMore: false,
        };
      }

      const currentPage = Number(pageParam) || 1;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // 1. Fetch aggregate metrics
      const { data: allLogs } = await supabase
        .from('machine_hour_logs')
        .select('running_hours, log_date')
        .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`);

      const aggLogs = allLogs || [];
      const totalHours = aggLogs.reduce((acc, row) => acc + (Number(row.running_hours) || 0), 0);
      const dates = new Set(aggLogs.map((l) => l.log_date).filter(Boolean));

      // 2. Fetch paginated slice of logs
      const { data: pagedLogs, count, error } = await supabase
        .from('machine_hour_logs')
        .select('id, log_date, start_time, end_time, running_hours, overtime_hours, normal_working_hours, remarks', { count: 'exact' })
        .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`)
        .order('log_date', { ascending: false })
        .range(from, to);

      if (error || !pagedLogs) {
        return {
          totalActiveWorkDays: dates.size,
          totalShiftRunningTime: Math.round(totalHours * 10) / 10,
          shiftSchedule: '06:00 AM - 02:00 PM',
          logs: [],
          totalCount: count || 0,
          page: currentPage,
          hasMore: false,
        };
      }

      const totalCount = count || 0;
      return {
        totalActiveWorkDays: dates.size,
        totalShiftRunningTime: Math.round(totalHours * 10) / 10,
        shiftSchedule: '06:00 AM - 02:00 PM',
        logs: pagedLogs,
        totalCount,
        page: currentPage,
        hasMore: from + pagedLogs.length < totalCount,
      };
    },
  });
}

/**
 * Hook 6: KYC & Identity Documents (Lazy Loaded on Documents Tab)
 */
export function useUserDetailDocuments(userId?: string, enabled = false) {
  return useQuery({
    queryKey: ['user_detail', userId, 'documents'],
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<UserDocumentItem[]> => {
      if (!userId) return [];

      const [docsRes, typesRes] = await Promise.all([
        supabase
          .from('user_documents')
          .select('id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_document_types')
          .select('code, label'),
      ]);

      const typeMap = new Map<string, string>();
      (typesRes.data || []).forEach((t: any) => {
        typeMap.set(t.code, t.label);
      });

      const docsList = docsRes.data || [];
      const withSignedUrls = await Promise.all(
        docsList.map(async (doc: any) => {
          let signedUrl: string | null = null;
          if (doc.storage_path) {
            try {
              const cleanPath = doc.storage_path.replace(/^\/+/, '');
              const { data: signedData } = await supabase.storage
                .from('user_files')
                .createSignedUrl(cleanPath, 3600);
              signedUrl = signedData?.signedUrl || null;
            } catch {
              // Storage fallback
            }
          }
          return {
            ...doc,
            type_label: typeMap.get(doc.document_type_code) || doc.document_type_code,
            signed_url: signedUrl,
          };
        })
      );

      return withSignedUrls;
    },
  });
}

/**
 * Hook 6b: KYC & Identity Documents with Infinite Pagination
 */
export function useUserDetailDocumentsInfinite(
  userId?: string,
  enabled = false,
  pageSize = 20
) {
  return useInfiniteQuery<UserDocumentsPageChunk>({
    queryKey: ['user_detail', userId, 'documents_infinite', pageSize],
    enabled: Boolean(userId) && enabled,
    initialPageParam: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    queryFn: async ({ pageParam = 1 }): Promise<UserDocumentsPageChunk> => {
      if (!userId) return { documents: [], totalCount: 0, page: 1, hasMore: false };
      const currentPage = Number(pageParam) || 1;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const [docsRes, typesRes] = await Promise.all([
        supabase
          .from('user_documents')
          .select('id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, created_at', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('user_document_types')
          .select('code, label'),
      ]);

      const typeMap = new Map<string, string>();
      (typesRes.data || []).forEach((t: any) => {
        typeMap.set(t.code, t.label);
      });

      const docsList = docsRes.data || [];
      const withSignedUrls = await Promise.all(
        docsList.map(async (doc: any) => {
          let signedUrl: string | null = null;
          if (doc.storage_path) {
            try {
              const cleanPath = doc.storage_path.replace(/^\/+/, '');
              const { data: signedData } = await supabase.storage
                .from('user_files')
                .createSignedUrl(cleanPath, 3600);
              signedUrl = signedData?.signedUrl || null;
            } catch {
              // Storage fallback
            }
          }
          return {
            ...doc,
            type_label: typeMap.get(doc.document_type_code) || doc.document_type_code,
            signed_url: signedUrl,
          };
        })
      );

      const totalCount = docsRes.count || 0;
      return {
        documents: withSignedUrls,
        totalCount,
        page: currentPage,
        hasMore: from + docsList.length < totalCount,
      };
    },
  });
}

/**
 * Hook 7: Audit Trail (Lazy Loaded on Audit Tab, RBAC Guarded)
 */
export function useUserDetailAuditLogs(userId?: string, enabled = false) {
  return useQuery({
    queryKey: ['user_detail', userId, 'audit'],
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<UserAuditItem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, actor_name, actor_role, severity, category, details, before_state, after_state, created_at')
        .or(`user_id.eq.${userId},entity_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];

      return data.map((log: any) => ({
        id: log.id,
        action: log.action || 'User Activity',
        entity_type: log.entity_type || 'user',
        entity_id: log.entity_id,
        actor_name: log.actor_name,
        actor_role: log.actor_role,
        severity: log.severity || 'info',
        category: log.category,
        details: log.details,
        before_state: log.before_state,
        after_state: log.after_state,
        created_at: log.created_at,
      }));
    },
  });
}

/**
 * Hook 7b: Audit Trail with Server-Side Infinite Pagination
 */
export function useUserDetailAuditLogsInfinite(
  userId?: string,
  enabled = false,
  pageSize = 20
) {
  return useInfiniteQuery<UserAuditLogsPageChunk>({
    queryKey: ['user_detail', userId, 'audit_infinite', pageSize],
    enabled: Boolean(userId) && enabled,
    initialPageParam: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    queryFn: async ({ pageParam = 1 }): Promise<UserAuditLogsPageChunk> => {
      if (!userId) return { logs: [], totalCount: 0, page: 1, hasMore: false };
      const currentPage = Number(pageParam) || 1;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, actor_name, actor_role, severity, category, details, before_state, after_state, created_at', { count: 'exact' })
        .or(`user_id.eq.${userId},entity_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error || !data) return { logs: [], totalCount: count || 0, page: currentPage, hasMore: false };

      const totalCount = count || 0;
      const logs = data.map((log: any) => ({
        id: log.id,
        action: log.action || 'User Activity',
        entity_type: log.entity_type || 'user',
        entity_id: log.entity_id,
        actor_name: log.actor_name,
        actor_role: log.actor_role,
        severity: log.severity || 'info',
        category: log.category,
        details: log.details,
        before_state: log.before_state,
        after_state: log.after_state,
        created_at: log.created_at,
      }));

      return {
        logs,
        totalCount,
        page: currentPage,
        hasMore: from + logs.length < totalCount,
      };
    },
  });
}

/**
 * Formats a clean temporary password: <UserFirstName>@<4DigitRandomNumber>
 */
export function generateUserFormattedPassword(fullName?: string): string {
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : 'Reach';
  const cleanFirst = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase().replace(/[^a-zA-Z]/g, '')
    : 'Reach';
  const finalName = cleanFirst.length > 0 ? cleanFirst : 'Reach';
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `${finalName}@${random4}`;
}

/**
 * Executes administrative password reset for a target user via authoritative backend.
 * Generates a temporary password, updates password in Supabase Auth via RPC or Admin API,
 * logs audit event, and returns the temporary password to display to the administrator.
 */
export async function resetUserPasswordMobile(
  userId: string,
  targetUserName?: string
): Promise<{
  success: boolean;
  userName?: string;
  temporaryPassword?: string;
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { success: false, error: 'Authentication session expired. Please log in again.' };
    }

    // 1. Direct Authoritative Supabase Database RPC Execution
    // Solves cross-origin CORS limitations, works identically in native, web, and offline-capable clients
    const temporaryPassword = generateUserFormattedPassword(targetUserName);
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: userId,
        new_password: temporaryPassword,
      });

      if (!rpcErr && rpcRes && (rpcRes as any).success) {
        return {
          success: true,
          userName: (rpcRes as any).userName || targetUserName,
          temporaryPassword,
        };
      }

      // If it was an explicit authorization or validation error, return it immediately
      if (rpcErr && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
        return {
          success: false,
          error: rpcErr.message,
        };
      }
    } catch {
      // Fallback to Next.js API Route
    }

    // 2. Next.js API Route Fallback
    const appUrl = getAppUrl();
    const response = await fetch(`${appUrl}/api/users/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'reset-password' }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || 'Failed to reset user password',
      };
    }

    return {
      success: true,
      userName: json.userName,
      temporaryPassword: json.temporaryPassword,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error occurred while resetting password',
    };
  }
}

/**
 * Selective User Refetch:
 * Fetches ONLY the single user row from Supabase and updates the TanStack Query cache
 * without invalidating or refetching heavy KPI queries (machines, logs, documents counts).
 */
export async function fetchUpdatedUserRecord(
  queryClient: any,
  userId: string
): Promise<UserRecord | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(USER_DETAIL_COLUMNS)
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    const userRecord = data as unknown as UserRecord;

    // Selectively patch query cache
    queryClient.setQueryData(['user_detail', userId, 'overview'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        user: { ...old.user, ...userRecord },
      };
    });

    return userRecord;
  } catch {
    return null;
  }
}

