/**
 * ReachInternational Domain Query Keys & Cache Architecture
 *
 * Canonical deterministic query-key and cache-key definitions
 * shared between Web (Next.js App Router, Server Actions, RSC)
 * and Native Mobile (TanStack Query v5, PersistQueryClient).
 */

export const DOMAIN_QUERY_ROOTS = {
  MACHINES: 'machines',
  CLIENTS: 'clients',
  USERS: 'users',
  OPERATIONS: 'operations',
  ATTENDANCE: 'attendance',
  PAYROLL: 'payroll',
  AUDIT: 'audit',
  PREFERENCES: 'preferences',
} as const;

export type DomainQueryRoot = typeof DOMAIN_QUERY_ROOTS[keyof typeof DOMAIN_QUERY_ROOTS];

// ── Machines Query Keys ──────────────────────────────────────────────────────
export interface MachineFilterParams {
  search?: string;
  status?: string;
  health_status?: string;
  supervisor?: string;
  client_id?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export const machineQueryKeys = {
  all: [DOMAIN_QUERY_ROOTS.MACHINES] as const,
  lists: () => [...machineQueryKeys.all, 'list'] as const,
  list: (role?: string | null, userId?: string | null, filters?: MachineFilterParams) =>
    [
      ...machineQueryKeys.lists(),
      role?.toLowerCase() || 'global',
      userId || 'all',
      filters ? JSON.stringify(filters) : 'default',
    ] as const,
  details: () => [...machineQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...machineQueryKeys.details(), id] as const,
  kpis: (filters?: Record<string, any>) =>
    [...machineQueryKeys.all, 'kpis', filters ? JSON.stringify(filters) : 'all'] as const,
  filterOptions: () => [...machineQueryKeys.all, 'filter_options'] as const,
};

// ── Users Query Keys ────────────────────────────────────────────────────────
export interface UserFilterParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const userQueryKeys = {
  all: [DOMAIN_QUERY_ROOTS.USERS] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  list: (role?: string | null, filters?: UserFilterParams) =>
    [
      ...userQueryKeys.lists(),
      role?.toLowerCase() || 'global',
      filters ? JSON.stringify(filters) : 'default',
    ] as const,
  details: () => [...userQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...userQueryKeys.details(), id] as const,
  pendingApprovals: () => [...userQueryKeys.all, 'pending_approvals'] as const,
  supervisors: () => [...userQueryKeys.all, 'supervisors'] as const,
  operators: () => [...userQueryKeys.all, 'operators'] as const,
};

// ── Attendance Query Keys ───────────────────────────────────────────────────
export const attendanceQueryKeys = {
  all: [DOMAIN_QUERY_ROOTS.ATTENDANCE] as const,
  summaries: () => [...attendanceQueryKeys.all, 'summary'] as const,
  summary: (year: number, month: number, filters?: Record<string, any>) =>
    [...attendanceQueryKeys.summaries(), `${year}-${String(month).padStart(2, '0')}`, filters ? JSON.stringify(filters) : 'all'] as const,
  details: () => [...attendanceQueryKeys.all, 'detail'] as const,
  detail: (userId: string, year: number, month: number) =>
    [...attendanceQueryKeys.details(), userId, `${year}-${String(month).padStart(2, '0')}`] as const,
};

// ── Payroll Query Keys ──────────────────────────────────────────────────────
export const payrollQueryKeys = {
  all: [DOMAIN_QUERY_ROOTS.PAYROLL] as const,
  summaries: () => [...payrollQueryKeys.all, 'summary'] as const,
  summary: (month: string, filters?: Record<string, any>) =>
    [...payrollQueryKeys.summaries(), month, filters ? JSON.stringify(filters) : 'all'] as const,
  detail: (userId: string, month: string) =>
    [...payrollQueryKeys.all, 'detail', userId, month] as const,
};
