/**
 * Centralized Audit Log Action Labels, Styling, Description & Category Helpers
 *
 * Provides human-readable labels, color-coded badge styles, descriptive sentences,
 * and category/severity mappings for the entire audit event taxonomy.
 */

import { AUDIT_CATEGORIES, AUDIT_CATEGORY_LABELS, AUDIT_SEVERITY_LABELS } from "@reachinternational/types";
import type { AuditCategory, AuditSeverity } from "@reachinternational/types";

// ---------------------------------------------------------------------------
// Action → Human Label Map
// ---------------------------------------------------------------------------

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Auth
  "auth.login": "User Signed In",
  "auth.logout": "User Signed Out",
  "auth.login_failed": "Login Failed",
  "auth.session_expired": "Session Expired",
  "user.signup": "User Registered",

  // Employees / Users
  "user.approved": "User Approved",
  "user.rejected": "User Rejected",
  "user.created": "User Created",
  "user.edited": "User Profile Updated",
  "user.updated": "User Profile Updated",
  "user.password_reset": "Password Reset",
  "user.activated": "User Account Activated",
  "user.deactivated": "User Account Deactivated",
  "user.role_updated": "User Role Updated",
  "user.deleted": "User Account Deleted",
  "employee.created": "Employee Created",
  "employee.updated": "Employee Updated",
  "employee.deleted": "Employee Deleted",
  "employee.activated": "Employee Activated",
  "employee.deactivated": "Employee Deactivated",
  "employee.approved": "Employee Approved",
  "employee.rejected": "Employee Rejected",
  "employee.role_changed": "Employee Role Changed",
  "employee.password_reset": "Employee Password Reset",
  "employee.profile_change_requested": "Profile Change Requested",
  "employee.profile_change_approved": "Profile Change Approved",
  "employee.profile_change_rejected": "Profile Change Rejected",

  // Machines
  "machine.created": "Machine Created",
  "machine.updated": "Machine Updated",
  "machine.reassigned": "Engineer Reassigned",
  "machine.deleted": "Machine Deleted",
  "machine.status_changed": "Machine Status Changed",
  "machine.hmr_updated": "Hour Meter Updated",
  "machine.assigned_to_client": "Machine Assigned to Client",
  "machine.removed_from_client": "Machine Removed from Client",

  // Assignments
  "assignment.operator_assigned": "Operator Assigned",
  "assignment.operator_changed": "Operator Changed",
  "assignment.operator_unassigned": "Operator Unassigned",
  "assignment.supervisor_assigned": "Supervisor Assigned",
  "assignment.supervisor_changed": "Supervisor Changed",
  "assignment.supervisor_unassigned": "Supervisor Unassigned",

  // Rental
  "rental.machine_rented": "Machine Rented",
  "rental.rental_ended": "Rental Ended",
  "rental.extended": "Rental Extended",
  "rental.cancelled": "Rental Cancelled",
  "rental.dispatched": "Rental Dispatched",
  "rental.returned": "Rental Returned",
  "rental.inspected": "Rental Inspected",
  "rental.damage_reported": "Damage Reported",

  // Operations
  "operations.log_created": "Machine Log Created",
  "operations.log_updated": "Machine Log Updated",
  "operations.log_deleted": "Machine Log Deleted",
  "operations.shift_started": "Shift Started",
  "operations.shift_ended": "Shift Ended",
  "operations.shift_changed": "Shift Changed",
  "operations.breakdown_created": "Breakdown Created",
  "operations.breakdown_updated": "Breakdown Updated",
  "operations.breakdown_resolved": "Breakdown Resolved",

  // Services
  "service.completed": "Service Logged",
  "service.reassigned": "Service Engineer Reassigned",
  "service.created": "Service Created",
  "service.cancelled": "Service Cancelled",

  // Clients
  "client.created": "Client Created",
  "client.updated": "Client Updated",
  "client.deleted": "Client Deleted",

  // Permissions
  "permission.role_changed": "Role Changed",
  "permission.access_granted": "Access Granted",
  "permission.access_revoked": "Access Revoked",

  // Security
  "security.unauthorized_action": "Unauthorized Action",
  "security.event": "Security Event",
  "security.rls_violation": "RLS Violation",
  "security.blocked_mutation": "Blocked Mutation",

  // Sales
  "sales.lead_created": "Lead Created",
  "sales.lead_updated": "Lead Updated",
  "sales.customer_created": "Customer Created",
  "sales.order_created": "Order Created",
  "sales.quotation_created": "Quotation Created",

  // System
  "system.settings_updated": "Settings Updated",
  "system.import_started": "Data Import Started",
  "system.import_completed": "Data Import Completed",
  "system.notification_sent": "Notification Sent",
  "system.reminder_dispatched": "Reminder Dispatched",
  "system.alert_run_started": "Cron Alert Started",
  "system.alert_run_completed": "Cron Alert Finished",

  // Legacy aliases
  "manual.reminder.sent": "Manual Reminder Sent",
  "reminders.sent": "Scheduled Reminders Sent",
  "notification.resent": "Notification Resent",
  "import.started": "Data Import Started",
  "import.completed": "Data Import Completed",
  "alert_run.started": "Cron Alert Started",
  "alert_run.completed": "Cron Alert Finished",
  "settings.updated": "Settings Updated",
};

// ---------------------------------------------------------------------------
// Format action key to human label
// ---------------------------------------------------------------------------

export function formatAuditAction(action: string): string {
  if (!action) return "Unknown Action";
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];

  // Fallback: "user.approved" → "User Approved"
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// ---------------------------------------------------------------------------
// Action → Badge Style
// ---------------------------------------------------------------------------

export function getAuditActionStyle(action: string): {
  badgeVariant: "success" | "error" | "warning" | "default";
  bgClass: string;
  textClass: string;
} {
  const lower = (action || "").toLowerCase();

  if (
    lower.includes("approved") ||
    lower.includes("created") ||
    lower.includes("completed") ||
    lower.includes("activated") ||
    lower.includes("signup") ||
    lower.includes("assigned") ||
    lower.includes("dispatched") ||
    lower.includes("resolved") ||
    lower.includes("returned")
  ) {
    return {
      badgeVariant: "success",
      bgClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      textClass: "text-emerald-600 dark:text-emerald-400",
    };
  }

  if (
    lower.includes("deleted") ||
    lower.includes("rejected") ||
    lower.includes("deactivated") ||
    lower.includes("unauthorized") ||
    lower.includes("violation") ||
    lower.includes("blocked") ||
    lower.includes("failed") ||
    lower.includes("cancelled")
  ) {
    return {
      badgeVariant: "error",
      bgClass: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
      textClass: "text-rose-600 dark:text-rose-400",
    };
  }

  if (
    lower.includes("reset") ||
    lower.includes("reassigned") ||
    lower.includes("role_updated") ||
    lower.includes("role_changed") ||
    lower.includes("changed") ||
    lower.includes("unassigned") ||
    lower.includes("removed") ||
    lower.includes("ended") ||
    lower.includes("updated") ||
    lower.includes("damage")
  ) {
    return {
      badgeVariant: "warning",
      bgClass: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
      textClass: "text-amber-600 dark:text-amber-400",
    };
  }

  return {
    badgeVariant: "default",
    bgClass: "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400",
    textClass: "text-sky-600 dark:text-sky-400",
  };
}

// ---------------------------------------------------------------------------
// Severity → Style
// ---------------------------------------------------------------------------

export function getAuditSeverityStyle(severity: string): {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  switch (severity) {
    case "critical":
      return {
        label: "Critical",
        bgClass: "bg-rose-500/10 border-rose-500/20",
        textClass: "text-rose-600 dark:text-rose-400",
        dotClass: "bg-rose-500",
      };
    case "warning":
      return {
        label: "Warning",
        bgClass: "bg-amber-500/10 border-amber-500/20",
        textClass: "text-amber-600 dark:text-amber-400",
        dotClass: "bg-amber-500",
      };
    default:
      return {
        label: "Info",
        bgClass: "bg-sky-500/10 border-sky-500/20",
        textClass: "text-sky-600 dark:text-sky-400",
        dotClass: "bg-sky-500",
      };
  }
}

// ---------------------------------------------------------------------------
// Category → Style
// ---------------------------------------------------------------------------

export function getAuditCategoryStyle(category: string): {
  label: string;
  bgClass: string;
  textClass: string;
} {
  const categoryLabels: Record<string, { label: string; bgClass: string; textClass: string }> = {
    auth: { label: "Authentication", bgClass: "bg-violet-500/10 border-violet-500/20", textClass: "text-violet-600 dark:text-violet-400" },
    employee: { label: "Employees", bgClass: "bg-blue-500/10 border-blue-500/20", textClass: "text-blue-600 dark:text-blue-400" },
    machine: { label: "Machines", bgClass: "bg-emerald-500/10 border-emerald-500/20", textClass: "text-emerald-600 dark:text-emerald-400" },
    assignment: { label: "Assignments", bgClass: "bg-cyan-500/10 border-cyan-500/20", textClass: "text-cyan-600 dark:text-cyan-400" },
    rental: { label: "Rental", bgClass: "bg-orange-500/10 border-orange-500/20", textClass: "text-orange-600 dark:text-orange-400" },
    client: { label: "Clients", bgClass: "bg-teal-500/10 border-teal-500/20", textClass: "text-teal-600 dark:text-teal-400" },
    operations: { label: "Operations", bgClass: "bg-indigo-500/10 border-indigo-500/20", textClass: "text-indigo-600 dark:text-indigo-400" },
    service: { label: "Services", bgClass: "bg-sky-500/10 border-sky-500/20", textClass: "text-sky-600 dark:text-sky-400" },
    sales: { label: "Sales & CRM", bgClass: "bg-pink-500/10 border-pink-500/20", textClass: "text-pink-600 dark:text-pink-400" },
    security: { label: "Security", bgClass: "bg-rose-500/10 border-rose-500/20", textClass: "text-rose-600 dark:text-rose-400" },
    system: { label: "System", bgClass: "bg-zinc-500/10 border-zinc-500/20", textClass: "text-zinc-600 dark:text-zinc-400" },
  };

  return categoryLabels[category] || { label: category || "Unknown", bgClass: "bg-zinc-500/10 border-zinc-500/20", textClass: "text-zinc-600 dark:text-zinc-400" };
}

// ---------------------------------------------------------------------------
// Audit Log Description Generator
// ---------------------------------------------------------------------------

export function getAuditLogDescription(log: {
  action: string;
  metadata?: Record<string, unknown> | null;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_name?: string | null;
  entity_name?: string | null;
}): string | null {
  const meta = log.metadata || {};
  const action = log.action;

  const userName = (meta.user_name || meta.full_name) as string | undefined;
  const userEmail = (meta.user_email || meta.email) as string | undefined;
  const machineName = (meta.machine_name || meta.name || meta.code || log.entity_name) as string | undefined;
  const targetUser = userName ? `${userName}${userEmail ? ` (${userEmail})` : ""}` : userEmail;

  const approvedBy = meta.approved_by_name
    ? `${meta.approved_by_name}${meta.approved_by_email ? ` (${meta.approved_by_email})` : ""}`
    : (meta.approved_by_email as string | undefined);
  const rejectedBy = meta.rejected_by_name
    ? `${meta.rejected_by_name}${meta.rejected_by_email ? ` (${meta.rejected_by_email})` : ""}`
    : (meta.rejected_by_email as string | undefined);
  const performedBy = (log.actor_name || meta.performed_by_name) as string | undefined;

  switch (action) {
    // Auth
    case "auth.login":
      return userEmail ? `Signed in: ${userEmail}` : "Successfully authenticated";
    case "auth.logout":
      return userEmail ? `Signed out: ${userEmail}` : "Session ended";
    case "auth.login_failed":
      return userEmail ? `Failed login attempt: ${userEmail}` : "Failed authentication attempt";

    // Users / Employees
    case "user.approved":
    case "employee.approved":
      return targetUser
        ? `Approved ${targetUser}${approvedBy ? ` by ${approvedBy}` : ""}`
        : `Approved pending account${approvedBy ? ` by ${approvedBy}` : ""}`;
    case "user.rejected":
    case "employee.rejected":
      return targetUser
        ? `Rejected ${targetUser}${rejectedBy ? ` by ${rejectedBy}` : ""}`
        : `Rejected application${rejectedBy ? ` by ${rejectedBy}` : ""}`;
    case "user.created":
    case "employee.created":
      return targetUser ? `Created account for ${targetUser}` : "Created new account";
    case "user.signup":
      return targetUser ? `Registered: ${targetUser}` : "New signup";
    case "user.edited":
    case "user.updated":
    case "employee.updated":
      return targetUser ? `Updated ${targetUser}` : "Updated profile";
    case "user.password_reset":
    case "employee.password_reset":
      return targetUser ? `Reset password for ${targetUser}` : "Password reset";
    case "user.activated":
    case "employee.activated":
      return targetUser ? `Activated ${targetUser}` : "Account activated";
    case "user.deactivated":
    case "employee.deactivated":
      return targetUser ? `Deactivated ${targetUser}` : "Account deactivated";
    case "user.role_updated":
    case "employee.role_changed":
    case "permission.role_changed":
      return targetUser && meta.new_role
        ? `Changed role of ${targetUser} to ${meta.new_role}`
        : "Updated role";
    case "user.deleted":
    case "employee.deleted":
      return targetUser ? `Deleted ${targetUser}` : "Deleted account";

    // Machines
    case "machine.created":
      return machineName ? `Created machine: ${machineName}` : "Created machine";
    case "machine.updated":
      return machineName ? `Updated ${machineName}` : "Updated machine";
    case "machine.deleted":
      return machineName ? `Deleted ${machineName}` : "Deleted machine";
    case "machine.status_changed":
      return machineName ? `Status changed: ${machineName}` : "Machine status changed";
    case "machine.hmr_updated":
      return machineName ? `Hour meter updated: ${machineName}` : "HMR updated";
    case "machine.assigned_to_client":
      return machineName ? `${machineName} assigned to client` : "Machine assigned to client";
    case "machine.removed_from_client":
      return machineName ? `${machineName} removed from client` : "Machine removed from client";

    // Assignments
    case "assignment.operator_assigned":
      return `Operator assigned${machineName ? ` to ${machineName}` : ""}${performedBy ? ` by ${performedBy}` : ""}`;
    case "assignment.operator_changed":
      return `Operator changed${machineName ? ` on ${machineName}` : ""}`;
    case "assignment.operator_unassigned":
      return `Operator unassigned${machineName ? ` from ${machineName}` : ""}`;
    case "assignment.supervisor_assigned":
      return `Supervisor assigned${machineName ? ` to ${machineName}` : ""}`;
    case "assignment.supervisor_changed":
      return `Supervisor changed${machineName ? ` on ${machineName}` : ""}`;
    case "assignment.supervisor_unassigned":
      return `Supervisor unassigned${machineName ? ` from ${machineName}` : ""}`;

    // Rental
    case "rental.machine_rented":
      return machineName ? `${machineName} rented` : "Machine rented";
    case "rental.rental_ended":
      return machineName ? `Rental ended: ${machineName}` : "Rental ended";

    // Operations
    case "operations.log_created":
      return machineName ? `Log created for ${machineName}` : "Machine log created";
    case "operations.log_updated":
      return machineName ? `Log updated for ${machineName}` : "Machine log updated";
    case "operations.log_deleted":
      return machineName ? `Log deleted for ${machineName}` : "Machine log deleted";

    // Services
    case "service.completed":
      return machineName ? `Service completed: ${machineName}` : "Service logged";

    // System
    case "manual.reminder.sent":
      return meta.recipient_email ? `Reminder sent to ${meta.recipient_email}` : "Reminder sent";
    case "reminders.sent":
      return meta.count ? `Dispatched ${meta.count} reminders` : "Reminders dispatched";
    case "notification.resent":
      return meta.recipient ? `Resent to ${meta.recipient}` : "Notification resent";

    // Security
    case "security.unauthorized_action":
      return "Unauthorized action blocked";
    case "security.rls_violation":
      return "Row-level security violation";
    case "security.blocked_mutation":
      return "Blocked mutation attempt";

    default:
      if (log.entity_name) return `${formatAuditAction(action)}: ${log.entity_name}`;
      if (log.entity_type) return `${log.entity_type} ID: ${log.entity_id || "N/A"}`;
      return null;
  }
}

// Re-export category/severity constants for convenience
export { AUDIT_CATEGORIES, AUDIT_CATEGORY_LABELS, AUDIT_SEVERITY_LABELS };
export type { AuditCategory, AuditSeverity };
