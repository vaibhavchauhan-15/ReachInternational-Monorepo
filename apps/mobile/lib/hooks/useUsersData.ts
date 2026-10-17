/**
 * Native Mobile Users / Staff Server State & Business Logic Hook
 * Encapsulates TanStack Query caching, role-scoped queries, server-side pagination,
 * indexed trigram search, fast scalar KPI aggregations, supervisor caching, and resilient mutations.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { isAbortError, sanitizeDatabaseError } from '@reachinternational/utils';
import type { UserRecord } from '../../components/users/UserDetailModal';
import { haptics } from '../haptics';

// Module-level caches for fast, zero-roundtrip hydration across pagination boundaries
const activeSupervisorsCache = new Map<string, { id: string; full_name: string; email?: string | null }>();
const userMachinesCache = new Map<string, Array<{ id: string; machine_id: string; model?: string | null }>>();

export const USER_SELECT_COLUMNS = `
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
  created_at
`;

export interface UsersKPIStats {
  totalCount: number;
  activeCount: number;
  operatorCount: number;
  newRegistrationsCount: number;
  pendingApprovalsCount: number;
  states: Array<{ id: string; label: string }>;
}

export interface UseUsersInfiniteQueryOptions {
  searchQuery?: string;
  roleFilter?: string;
  statusFilter?: string;
  stateFilter?: string;
  kycFilter?: string;
  dateRangeFilter?: string;
  sortBy?: string;
  supervisorId?: string | null;
  userRole?: string | null;
  enabled?: boolean;
  pageSize?: number;
}

export interface UsersPageChunk {
  users: UserRecord[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export const USERS_PAGE_SIZE = 15;

export function sanitizeSearchToken(token: string): string {
  return token
    .replace(/[,()"]/g, '')
    .replace(/[\\%_]/g, '\\$&')
    .trim();
}

export function buildOptimizedUserSearchQuery(query: any, search?: string) {
  if (!search) return query;
  const trimmed = search.trim();
  if (trimmed.length === 0) return query;

  const sanitized = sanitizeSearchToken(trimmed);
  if (!sanitized) return query;

  if (/^emp/i.test(trimmed)) {
    return query.or(`employee_id.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

  const isDigitsOnly = /^[0-9+\s\-()]+$/.test(trimmed);
  const digits = trimmed.replace(/\D/g, '');

  if (isDigitsOnly && digits.length >= 1) {
    let phoneDigits = digits;
    if (digits.length === 12 && digits.startsWith('91')) {
      phoneDigits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      phoneDigits = digits.slice(1);
    }

    const conditions: string[] = [];
    conditions.push(`employee_id.ilike.%${digits}%`);
    if (phoneDigits.length >= 3) {
      conditions.push(`phone.ilike.%${phoneDigits}%`);
    }
    if (digits.length >= 4) {
      conditions.push(`aadhaar_number.ilike.%${digits}%`);
    }
    conditions.push(`license_number.ilike.%${sanitized}%`);
    conditions.push(`full_name.ilike.%${sanitized}%`);

    return query.or(conditions.join(','));
  }

  if (trimmed.includes('@') || trimmed.endsWith('.com') || trimmed.endsWith('.in')) {
    return query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

  const words = trimmed.split(/\s+/).map(sanitizeSearchToken).filter((w) => w.length >= 2);
  const roleSlug = sanitized.toLowerCase().replace(/\s+/g, '_');
  const isKnownRole = [
    'super_admin',
    'admin',
    'manager',
    'supervisor',
    'hr',
    'operator',
  ].some((r) => r === roleSlug || r.includes(roleSlug) || roleSlug.includes(r));

  if (words.length > 1) {
    if (isKnownRole) {
      return query.or(`role.ilike.%${roleSlug}%,full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
    }

    for (const word of words) {
      const wRole = word.toLowerCase().replace(/s$/, '');
      query = query.or(
        `employee_id.ilike.%${word}%,full_name.ilike.%${word}%,role.ilike.%${wRole}%,city.ilike.%${word}%,district.ilike.%${word}%,state.ilike.%${word}%,email.ilike.%${word}%`
      );
    }
    return query;
  }

  const roleVariant = sanitized.toLowerCase().replace(/s$/, '');
  const conditions = [
    `employee_id.ilike.%${sanitized}%`,
    `full_name.ilike.%${sanitized}%`,
    `email.ilike.%${sanitized}%`,
    `role.ilike.%${sanitized}%`,
    `city.ilike.%${sanitized}%`,
    `district.ilike.%${sanitized}%`,
    `state.ilike.%${sanitized}%`,
    `license_number.ilike.%${sanitized}%`,
  ];

  if (roleVariant !== sanitized.toLowerCase()) {
    conditions.push(`role.ilike.%${roleVariant}%`);
  }

  if (digits.length >= 3) {
    conditions.push(`phone.ilike.%${digits}%`);
    conditions.push(`aadhaar_number.ilike.%${digits}%`);
  }

  return query.or(conditions.join(','));
}

/**
 * 1. High-Performance Users Directory KPI Aggregations
 * Calls PostgreSQL RPC `get_users_directory_summary` for instant scalar counts in <1ms.
 */
export function useUsersSummaryKPIs({
  userRole,
  userId,
  enabled = true,
}: {
  userRole?: string | null;
  userId?: string | null;
  enabled?: boolean;
}) {
  const normalizedRole = (userRole || '').toLowerCase();
  const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor';
  const effectiveSupervisorId = isSupervisor ? userId : null;

  return useQuery<UsersKPIStats>({
    queryKey: ['users', 'kpis', { role: normalizedRole, supervisorId: effectiveSupervisorId }],
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      try {
        const { data, error } = await supabase
          .rpc('get_users_directory_summary', {
            p_supervisor_id: effectiveSupervisorId || null,
          })
          .abortSignal(signal);

        if (error) {
          if (isAbortError(error, signal)) {
            return {
              totalCount: 0,
              activeCount: 0,
              operatorCount: 0,
              newRegistrationsCount: 0,
              pendingApprovalsCount: 0,
              states: [],
            };
          }
          throw error;
        }

        const total = Number(data?.total ?? 0);
        const active = Number(data?.active ?? 0);
        const operators = Number(data?.operators ?? data?.engineers ?? 0);
        const newRegistrations = Number(data?.new_registrations ?? 0);

        return {
          totalCount: total,
          activeCount: active,
          operatorCount: operators,
          newRegistrationsCount: newRegistrations,
          pendingApprovalsCount: newRegistrations,
          states: Array.isArray(data?.states) ? data.states : [],
        };
      } catch (err: any) {
        if (isAbortError(err, signal)) {
          return {
            totalCount: 0,
            activeCount: 0,
            operatorCount: 0,
            newRegistrationsCount: 0,
            pendingApprovalsCount: 0,
            states: [],
          };
        }
        throw err;
      }
    },
  });
}

/**
 * 2. Active Supervisors Master List Caching
 * Pre-fetches and caches active supervisors across user cards, eliminating N+1 supervisor queries.
 */
export function useActiveSupervisors({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<Array<{ id: string; full_name: string; email?: string | null }>>({
    queryKey: ['users', 'active_supervisors'],
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('role', ['supervisor', 'admin', 'super_admin', 'manager'])
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (error) return [];
      const list = (data || []).map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email || null,
      }));

      // Populate module-level cache
      list.forEach((s) => activeSupervisorsCache.set(s.id, s));
      return list;
    },
  });
}

/**
 * Helper to hydrate user records with supervisor information and machine assignments
 * using targeted batch lookups instead of unbounded fleet downloads.
 */
async function hydrateUserSlice(rawUsers: any[], abortSignal?: AbortSignal): Promise<UserRecord[]> {
  if (!rawUsers || rawUsers.length === 0) return [];

  const userIds = rawUsers.map((u) => u.id);

  // 1. Resolve missing supervisors from database if not already cached
  const missingSupIds = new Set<string>();
  rawUsers.forEach((u) => {
    if (u.supervisor_id && !activeSupervisorsCache.has(u.supervisor_id)) {
      missingSupIds.add(u.supervisor_id);
    }
  });

  if (missingSupIds.size > 0) {
    try {
      const { data: sups } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', Array.from(missingSupIds));
      if (sups) {
        sups.forEach((s) => activeSupervisorsCache.set(s.id, s));
      }
    } catch {
      // non-blocking
    }
  }

  // 2. Targeted Batch Machine Assignments: Query ONLY users on this page slice
  const uncachedUserIds = userIds.filter((id) => !userMachinesCache.has(id));
  if (uncachedUserIds.length > 0) {
    try {
      // A: Operator active assignments
      const { data: assignments } = await supabase
        .from('operator_machine_assignments')
        .select(`
          operator_id,
          shift_code,
          machine:machines!operator_machine_assignments_machine_id_fkey(id, machine_id, model)
        `)
        .in('operator_id', uncachedUserIds)
        .eq('is_active', true);

      const opAssignmentsMap = new Map<string, Array<{ id: string; machine_id: string; model?: string | null }>>();
      if (assignments) {
        assignments.forEach((a: any) => {
          if (a.operator_id && a.machine) {
            const list = opAssignmentsMap.get(a.operator_id) || [];
            list.push({
              id: a.machine.id,
              machine_id: a.machine.machine_id,
              model: a.machine.model || null,
            });
            opAssignmentsMap.set(a.operator_id, list);
          }
        });
      }

      // B: Supervisor assigned machines
      const supUserIds = rawUsers
        .filter((u) => (u.role === 'supervisor' || u.role === 'manager') && uncachedUserIds.includes(u.id))
        .map((u) => u.id);

      if (supUserIds.length > 0) {
        const { data: supMachines } = await supabase
          .from('machines')
          .select('id, machine_id, model, supervisor_ids')
          .overlaps('supervisor_ids', supUserIds);

        if (supMachines) {
          supUserIds.forEach((supId) => {
            const matches = supMachines
              .filter((m: any) => Array.isArray(m.supervisor_ids) && m.supervisor_ids.includes(supId))
              .map((m: any) => ({
                id: m.id,
                machine_id: m.machine_id,
                model: m.model || null,
              }));
            const existing = opAssignmentsMap.get(supId) || [];
            opAssignmentsMap.set(supId, [...existing, ...matches]);
          });
        }
      }

      // Cache resolved assignments for each user
      uncachedUserIds.forEach((id) => {
        userMachinesCache.set(id, opAssignmentsMap.get(id) || []);
      });
    } catch {
      // non-blocking fallback
    }
  }

  // 3. Assemble complete UserRecord items
  return rawUsers.map((u) => {
    const primarySup = u.supervisor_id ? activeSupervisorsCache.get(u.supervisor_id) || null : null;
    const supIds: string[] = Array.isArray(u.supervisor_ids) && u.supervisor_ids.length > 0
      ? u.supervisor_ids
      : u.supervisor_id
      ? [u.supervisor_id]
      : [];

    const supervisorsList = supIds
      .map((id) => activeSupervisorsCache.get(id))
      .filter(Boolean) as Array<{ id: string; full_name: string; email?: string | null }>;

    const assignedMachines = userMachinesCache.get(u.id) || [];

    return {
      ...u,
      address: u.street || u.address || null,
      shift_time:
        u.shift_start_time && u.shift_end_time
          ? `${u.shift_start_time.slice(0, 5)} - ${u.shift_end_time.slice(0, 5)}`
          : null,
      supervisor_id: primarySup?.id || null,
      supervisor_ids: supIds,
      supervisor: primarySup,
      supervisors: supervisorsList,
      assigned_machines: assignedMachines,
    };
  });
}

/**
 * 3. Infinite Server-Paginated Staff Query with Deterministic Sorting & Lean Projections
 */
export function useUsersInfiniteQuery({
  searchQuery = '',
  roleFilter = 'all',
  statusFilter = 'all',
  stateFilter = 'all',
  kycFilter = 'all',
  dateRangeFilter = 'all',
  sortBy = 'newest',
  supervisorId = null,
  userRole = null,
  enabled = true,
  pageSize = USERS_PAGE_SIZE,
}: UseUsersInfiniteQueryOptions) {
  const normalizedRole = (userRole || '').toLowerCase();
  const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor';
  const effectiveSupervisorId = isSupervisor ? supervisorId : null;

  return useInfiniteQuery<UsersPageChunk>({
    queryKey: [
      'users',
      'infinite',
      {
        search: searchQuery.trim(),
        role: roleFilter,
        status: statusFilter,
        state: stateFilter,
        kyc: kycFilter,
        dateRange: dateRangeFilter,
        sortBy,
        supervisorId: effectiveSupervisorId,
        pageSize,
      },
    ],
    enabled,
    initialPageParam: 1,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    queryFn: async ({ pageParam = 1, signal }) => {
      const currentPage = Number(pageParam) || 1;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('users')
        .select(USER_SELECT_COLUMNS, { count: 'exact' });

      // Supervisor scoping: limit to supervised operators
      if (effectiveSupervisorId) {
        query = query.eq('supervisor_id', effectiveSupervisorId);
        if (roleFilter !== 'all') {
          query = query.eq('role', roleFilter);
        } else {
          query = query.in('role', ['operator', 'mechanic', 'service_engineer', 'engineer']);
        }
      } else {
        // Standard Role Filter
        if (roleFilter !== 'all') {
          if (roleFilter === 'operators') {
            query = query.eq('role', 'operator');
          } else if (roleFilter === 'managers') {
            query = query.in('role', ['manager', 'admin', 'super_admin']);
          } else {
            query = query.eq('role', roleFilter);
          }
        }
      }

      // Status Filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // State Filter
      if (stateFilter !== 'all') {
        query = query.ilike('state', `%${stateFilter}%`);
      }

      // KYC Filter
      if (kycFilter === 'verified') {
        query = query.not('aadhaar_number', 'is', null).neq('aadhaar_number', '');
      } else if (kycFilter === 'unverified') {
        query = query.or('aadhaar_number.is.null,aadhaar_number.eq.');
      }

      // Date Range Filter
      if (dateRangeFilter !== 'all') {
        const now = new Date();
        if (dateRangeFilter === 'today') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          query = query.gte('created_at', today);
        } else if (dateRangeFilter === 'last_7_days') {
          const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          query = query.gte('created_at', d7);
        } else if (dateRangeFilter === 'last_30_days') {
          const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          query = query.gte('created_at', d30);
        } else if (dateRangeFilter === 'last_90_days') {
          const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
          query = query.gte('created_at', d90);
        }
      }

      // Indexed Search
      query = buildOptimizedUserSearchQuery(query, searchQuery);

      // Deterministic Sorting with Tie-Breaker
      if (sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (sortBy === 'name_asc') {
        query = query.order('full_name', { ascending: true });
      } else if (sortBy === 'name_desc') {
        query = query.order('full_name', { ascending: false });
      } else if (sortBy === 'role') {
        query = query.order('role', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      query = query.order('id', { ascending: true });

      query = query.range(from, to).abortSignal(signal);

      const { data, count, error } = await query;

      if (error) {
        if (isAbortError(error, signal)) {
          return {
            users: [],
            totalCount: 0,
            page: currentPage,
            hasMore: false,
          };
        }
        throw error;
      }

      const rawUsers = data || [];
      const totalCount = count !== null ? count : 0;
      const hydrated = await hydrateUserSlice(rawUsers, signal);

      const receivedCount = rawUsers.length;
      const totalFetched = (currentPage - 1) * pageSize + receivedCount;
      const hasMore = receivedCount === pageSize && (count !== null ? totalFetched < count : true);

      return {
        users: hydrated,
        totalCount,
        page: currentPage,
        hasMore,
      };
    },
  });
}

/**
 * 4. Pending Approval & Deletion Requests Query
 */
export function usePendingApprovalRequests({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['users', 'pending_requests'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // 1. Profile change requests
      const { data: pReqs } = await supabase
        .from('profile_change_requests')
        .select(`
          id,
          user_id,
          requester_role,
          current_data,
          requested_data,
          target_approver_role,
          status,
          created_at,
          user:users!profile_change_requests_user_id_fkey(id, full_name, email, role, phone)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const standardProfileReqs = (pReqs as any[] || []).filter(
        (r) => r.requested_data?.type !== 'account_deletion'
      );

      // 2. Account deletion requests
      let delList: any[] = [];
      try {
        const { data: directReqs, error: directErr } = await supabase
          .from('account_deletion_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!directErr && directReqs && directReqs.length > 0) {
          delList = directReqs;
        }
      } catch {
        // Direct table fallback
      }

      if (pReqs && pReqs.length > 0) {
        const delFromProfile = (pReqs as any[]).filter(
          (r) => r.requested_data?.type === 'account_deletion'
        );
        const directIds = new Set(delList.map((d) => d.id));
        for (const pr of delFromProfile) {
          if (!directIds.has(pr.id)) {
            delList.push({
              id: pr.id,
              user_id: pr.user_id,
              email: pr.requested_data?.email || pr.user?.email || '',
              phone: pr.requested_data?.phone || pr.user?.phone || null,
              reason: pr.requested_data?.reason || 'Account deletion requested via mobile settings',
              status: pr.status,
              source: pr.requested_data?.source || 'mobile',
              created_at: pr.created_at,
              user: pr.user,
              _isProfileChangeRequest: true,
            });
          }
        }
      }

      return {
        profileRequests: standardProfileReqs,
        deletionRequests: delList,
      };
    },
  });
}

/**
 * 5. Targeted Single User Fetcher
 * Fetches and fully hydrates a single user record without reloading the directory.
 */
export async function fetchSingleUserRecord(userId: string): Promise<UserRecord | null> {
  try {
    const { data: u, error } = await supabase
      .from('users')
      .select(USER_SELECT_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error || !u) return null;

    const hydrated = await hydrateUserSlice([u]);
    return hydrated[0] || null;
  } catch (err) {
    console.warn('Error fetching single user record:', err);
    return null;
  }
}

/**
 * Invalidate cached assignments for a user after machine/shift assignment changes
 */
export function invalidateUserMachinesCache(userId?: string) {
  if (userId) {
    userMachinesCache.delete(userId);
  } else {
    userMachinesCache.clear();
  }
}
