/**
 * Centralized Audit Action Dictionary & Types
 *
 * Single source of truth for all audit event types across the ReachInternational platform.
 * Shared by Web (apps/web), Mobile (apps/mobile), and backend Server Actions.
 */

// ---------------------------------------------------------------------------
// Audit Action Constants
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = {
  // ── Authentication ──────────────────────────────────────────────────────
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_LOGIN_FAILED: "auth.login_failed",
  AUTH_SESSION_EXPIRED: "auth.session_expired",

  // ── Employees / Users ───────────────────────────────────────────────────
  EMPLOYEE_CREATED: "employee.created",
  EMPLOYEE_UPDATED: "employee.updated",
  EMPLOYEE_DELETED: "employee.deleted",
  EMPLOYEE_ACTIVATED: "employee.activated",
  EMPLOYEE_DEACTIVATED: "employee.deactivated",
  EMPLOYEE_APPROVED: "employee.approved",
  EMPLOYEE_REJECTED: "employee.rejected",
  EMPLOYEE_ROLE_CHANGED: "employee.role_changed",
  EMPLOYEE_PASSWORD_RESET: "employee.password_reset",
  EMPLOYEE_PROFILE_CHANGE_REQUESTED: "employee.profile_change_requested",
  EMPLOYEE_PROFILE_CHANGE_APPROVED: "employee.profile_change_approved",
  EMPLOYEE_PROFILE_CHANGE_REJECTED: "employee.profile_change_rejected",

  // ── Machines ────────────────────────────────────────────────────────────
  MACHINE_CREATED: "machine.created",
  MACHINE_UPDATED: "machine.updated",
  MACHINE_DELETED: "machine.deleted",
  MACHINE_STATUS_CHANGED: "machine.status_changed",
  MACHINE_HMR_UPDATED: "machine.hmr_updated",
  MACHINE_ASSIGNED_TO_CLIENT: "machine.assigned_to_client",
  MACHINE_REMOVED_FROM_CLIENT: "machine.removed_from_client",

  // ── Operator Assignments ────────────────────────────────────────────────
  OPERATOR_ASSIGNED: "assignment.operator_assigned",
  OPERATOR_CHANGED: "assignment.operator_changed",
  OPERATOR_UNASSIGNED: "assignment.operator_unassigned",

  // ── Supervisor Assignments ──────────────────────────────────────────────
  SUPERVISOR_ASSIGNED: "assignment.supervisor_assigned",
  SUPERVISOR_CHANGED: "assignment.supervisor_changed",
  SUPERVISOR_UNASSIGNED: "assignment.supervisor_unassigned",

  // ── Rental ──────────────────────────────────────────────────────────────
  MACHINE_RENTED: "rental.machine_rented",
  MACHINE_RENTAL_ENDED: "rental.rental_ended",
  RENTAL_EXTENDED: "rental.extended",
  RENTAL_CANCELLED: "rental.cancelled",
  RENTAL_DISPATCHED: "rental.dispatched",
  RENTAL_RETURNED: "rental.returned",
  RENTAL_INSPECTED: "rental.inspected",
  RENTAL_DAMAGE_REPORTED: "rental.damage_reported",

  // ── Operations / Running Logs ───────────────────────────────────────────
  MACHINE_LOG_CREATED: "operations.log_created",
  MACHINE_LOG_UPDATED: "operations.log_updated",
  MACHINE_LOG_DELETED: "operations.log_deleted",
  SHIFT_STARTED: "operations.shift_started",
  SHIFT_ENDED: "operations.shift_ended",
  SHIFT_CHANGED: "operations.shift_changed",
  BREAKDOWN_CREATED: "operations.breakdown_created",
  BREAKDOWN_UPDATED: "operations.breakdown_updated",
  BREAKDOWN_RESOLVED: "operations.breakdown_resolved",

  // ── Clients ─────────────────────────────────────────────────────────────
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  CLIENT_DELETED: "client.deleted",

  // ── Services ────────────────────────────────────────────────────────────
  SERVICE_CREATED: "service.created",
  SERVICE_COMPLETED: "service.completed",
  SERVICE_REASSIGNED: "service.reassigned",
  SERVICE_CANCELLED: "service.cancelled",

  // ── Permissions / Roles ─────────────────────────────────────────────────
  ROLE_CHANGED: "permission.role_changed",
  ACCESS_GRANTED: "permission.access_granted",
  ACCESS_REVOKED: "permission.access_revoked",

  // ── Security ────────────────────────────────────────────────────────────
  UNAUTHORIZED_ACTION: "security.unauthorized_action",
  SECURITY_EVENT: "security.event",
  RLS_VIOLATION: "security.rls_violation",
  BLOCKED_MUTATION: "security.blocked_mutation",

  // ── System / Config ─────────────────────────────────────────────────────
  SETTINGS_UPDATED: "system.settings_updated",
  IMPORT_STARTED: "system.import_started",
  IMPORT_COMPLETED: "system.import_completed",
  NOTIFICATION_SENT: "system.notification_sent",
  REMINDER_DISPATCHED: "system.reminder_dispatched",
  ALERT_RUN_STARTED: "system.alert_run_started",
  ALERT_RUN_COMPLETED: "system.alert_run_completed",

  // ── Sales / CRM ─────────────────────────────────────────────────────────
  LEAD_CREATED: "sales.lead_created",
  LEAD_UPDATED: "sales.lead_updated",
  CUSTOMER_CREATED: "sales.customer_created",
  ORDER_CREATED: "sales.order_created",
  QUOTATION_CREATED: "sales.quotation_created",
} as const;

// ---------------------------------------------------------------------------
// Audit Categories
// ---------------------------------------------------------------------------

export const AUDIT_CATEGORIES = [
  "auth",
  "employee",
  "machine",
  "assignment",
  "rental",
  "client",
  "operations",
  "service",
  "sales",
  "security",
  "system",
] as const;

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: "Authentication",
  employee: "Employees",
  machine: "Machines",
  assignment: "Assignments",
  rental: "Rental",
  client: "Clients",
  operations: "Operations",
  service: "Services",
  sales: "Sales & CRM",
  security: "Security",
  system: "System",
};

// ---------------------------------------------------------------------------
// Audit Severities
// ---------------------------------------------------------------------------

export const AUDIT_SEVERITIES = ["info", "warning", "critical"] as const;

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

// ---------------------------------------------------------------------------
// Derived Types
// ---------------------------------------------------------------------------

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

/** Shape of a single audit log record from the database */
export interface AuditLogRecord {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  category: AuditCategory | null;
  severity: AuditSeverity;
  metadata: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  actor_name: string | null;
  actor_role: string | null;
  entity_name: string | null;
  ip_address: string | null;
  created_at: string;
}

/** Cursor-paginated response for audit logs */
export interface AuditLogsPaginatedResponse {
  logs: AuditLogRecord[];
  nextCursor: string | null;
  hasMore: boolean;
  totalEstimate: number;
  metrics: AuditKpiMetrics;
}

/** KPI metrics for audit dashboard */
export interface AuditKpiMetrics {
  todayCount: number;
  machineCount: number;
  employeeCount: number;
  securityCount: number;
}

// ---------------------------------------------------------------------------
// Action → Category mapping (for auto-derivation)
// ---------------------------------------------------------------------------

export function deriveAuditCategory(action: string): AuditCategory {
  if (action.startsWith("auth.")) return "auth";
  if (action.startsWith("employee.") || action.startsWith("user.")) return "employee";
  if (action.startsWith("machine.")) return "machine";
  if (action.startsWith("assignment.") || action.startsWith("operator.")) return "assignment";
  if (action.startsWith("rental.")) return "rental";
  if (action.startsWith("client.")) return "client";
  if (action.startsWith("operations.") || action.startsWith("shift.")) return "operations";
  if (action.startsWith("service.")) return "service";
  if (action.startsWith("sales.")) return "sales";
  if (action.startsWith("security.")) return "security";
  if (action.startsWith("permission.")) return "security";
  return "system";
}

/** Derive severity from action type */
export function deriveAuditSeverity(action: string): AuditSeverity {
  const lower = action.toLowerCase();
  if (lower.includes("security") || lower.includes("unauthorized") || lower.includes("rls_violation") || lower.includes("blocked")) return "critical";
  if (lower.includes("deleted") || lower.includes("rejected") || lower.includes("deactivated") || lower.includes("failed")) return "warning";
  return "info";
}
