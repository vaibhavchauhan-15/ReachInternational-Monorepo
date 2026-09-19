/**
 * ReachInternational Dashboard Domain Types
 *
 * Strict role-specific DTOs for the 6-role dashboard architecture.
 * Each role gets its own read model — no "fetch everything then hide" pattern.
 */

// ---------------------------------------------------------------------------
// Role union
// ---------------------------------------------------------------------------

export type DashboardRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "supervisor"
  | "hr"
  | "operator";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface DashboardAlert {
  id: string;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description?: string;
  actionUrl?: string;
}

// ---------------------------------------------------------------------------
// Super Admin Dashboard DTO
// ---------------------------------------------------------------------------

export interface SuperAdminDashboardDTO {
  totalUsers: number;
  activeMachines: number;
  totalClients: number;
  activeAssignments: number;
  todayLogs: number;
  recentAuditActions: number;
  alerts: DashboardAlert[];
}

// ---------------------------------------------------------------------------
// Admin Dashboard DTO
// ---------------------------------------------------------------------------

export interface AdminDashboardDTO {
  totalMachines: number;
  activeUsers: number;
  totalClients: number;
  activeAssignments: number;
  todayLogs: number;
  operationalKpis: {
    breakdowns: number;
    overlappingLogs: number;
    overtimeEntries: number;
    incompleteEntries: number;
  };
  alerts: DashboardAlert[];
}

// ---------------------------------------------------------------------------
// Manager Dashboard DTO
// ---------------------------------------------------------------------------

export interface ManagerDashboardDTO {
  machineUtilization: {
    total: number;
    active: number;
    rented: number;
    spare: number;
    breakdown: number;
  };
  operationsToday: {
    totalLogs: number;
    totalHours: number;
  };
  activeAssignments: number;
  alerts: DashboardAlert[];
}

// ---------------------------------------------------------------------------
// Supervisor Dashboard DTO
// ---------------------------------------------------------------------------

export interface SupervisorDashboardDTO {
  assignedMachines: number;
  assignedOperators: number;
  todayLogs: {
    submitted: number;
    pending: number;
  };
  breakdowns: number;
  overtimeEntries: number;
  alerts: DashboardAlert[];
}

// ---------------------------------------------------------------------------
// HR Dashboard DTO
// ---------------------------------------------------------------------------

export interface HRDashboardDTO {
  totalEmployees: number;
  activeOperators: number;
  pendingProfileChanges: number;
  todayLogsCount: number;
  alerts: DashboardAlert[];
}

// ---------------------------------------------------------------------------
// Operator Dashboard DTO
// ---------------------------------------------------------------------------

export interface OperatorDashboardDTO {
  operator: {
    id: string;
    name: string;
  };
  machine: {
    id: string;
    name: string;
    model: string;
    serialNumber: string;
  } | null;
  client: {
    id: string;
    name: string;
    site: string;
  } | null;
  today: {
    entryStatus: "pending" | "submitted";
    lastHmr: number | null;
  };
  shift: {
    start: string;
    end: string;
  };
  alerts: DashboardAlert[];
}

// ---------------------------------------------------------------------------
// Union type for type-safe role resolution
// ---------------------------------------------------------------------------

export type RoleDashboardMap = {
  super_admin: SuperAdminDashboardDTO;
  admin: AdminDashboardDTO;
  manager: ManagerDashboardDTO;
  supervisor: SupervisorDashboardDTO;
  hr: HRDashboardDTO;
  operator: OperatorDashboardDTO;
};
