/**
 * Centralized Audit Log Action Labels, Styling & Description Helpers
 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Auth
  "auth.login": "User Signed In",
  "auth.logout": "User Signed Out",
  "user.signup": "User Registered",

  // Users
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

  // Machines
  "machine.created": "Machine Created",
  "machine.updated": "Machine Updated",
  "machine.reassigned": "Engineer Reassigned",
  "machine.deleted": "Machine Deleted",

  // Services
  "service.completed": "Service Logged",
  "service.reassigned": "Service Engineer Reassigned",

  // Notifications & Reminders
  "manual.reminder.sent": "Manual Reminder Sent",
  "reminders.sent": "Scheduled Reminders Sent",
  "notification.resent": "Notification Resent",

  // System & Imports
  "import.started": "Data Import Started",
  "import.completed": "Data Import Completed",
  "alert_run.started": "Cron Alert Started",
  "alert_run.completed": "Cron Alert Finished",
  "settings.updated": "Settings Updated",
};

/**
 * Format any raw action key (e.g. "user.approved" or "custom.action_name")
 * into a clean, human-readable title.
 */
export function formatAuditAction(action: string): string {
  if (!action) return "Unknown Action";
  if (AUDIT_ACTION_LABELS[action]) {
    return AUDIT_ACTION_LABELS[action];
  }

  // Fallback dynamic humanization:
  // "user.approved" -> "User Approved"
  // "custom_action.name" -> "Custom Action Name"
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns a color badge style and variant for the audit action type.
 */
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
    lower.includes("signup")
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
    lower.includes("deactivated")
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
    lower.includes("role_updated")
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

/**
 * Generates a friendly sentence describing the audit log event using its metadata.
 */
export function getAuditLogDescription(log: {
  action: string;
  metadata?: Record<string, unknown> | null;
  entity_type?: string | null;
  entity_id?: string | null;
}): string | null {
  const meta = log.metadata || {};
  const action = log.action;

  const userName = (meta.user_name || meta.full_name) as string | undefined;
  const userEmail = (meta.user_email || meta.email) as string | undefined;
  const machineName = (meta.machine_name || meta.name || meta.code) as string | undefined;
  const targetUser = userName ? `${userName}${userEmail ? ` (${userEmail})` : ""}` : userEmail;

  const approvedBy = meta.approved_by_name
    ? `${meta.approved_by_name}${meta.approved_by_email ? ` (${meta.approved_by_email})` : ""}`
    : (meta.approved_by_email as string | undefined);
  const rejectedBy = meta.rejected_by_name
    ? `${meta.rejected_by_name}${meta.rejected_by_email ? ` (${meta.rejected_by_email})` : ""}`
    : (meta.rejected_by_email as string | undefined);
  const performedBy = meta.performed_by_name
    ? `${meta.performed_by_name}${meta.performed_by_email ? ` (${meta.performed_by_email})` : ""}`
    : (meta.performed_by_email as string | undefined);
  const createdBy = meta.created_by_name
    ? `${meta.created_by_name}${meta.created_by_email ? ` (${meta.created_by_email})` : ""}`
    : (meta.created_by as string | undefined);
  const resetBy = meta.reset_by_name
    ? `${meta.reset_by_name}${meta.reset_by_email ? ` (${meta.reset_by_email})` : ""}`
    : (meta.reset_by as string | undefined);
  const updatedBy = meta.updated_by_name
    ? `${meta.updated_by_name}${meta.updated_by_email ? ` (${meta.updated_by_email})` : ""}`
    : (meta.updated_by as string | undefined);

  switch (action) {
    case "user.approved":
      return targetUser
        ? `Approved registration for ${targetUser}${approvedBy ? ` by ${approvedBy}` : ""}`
        : `Approved pending user account${approvedBy ? ` by ${approvedBy}` : ""}`;
    case "user.rejected":
      return targetUser
        ? `Rejected registration for ${targetUser}${rejectedBy ? ` by ${rejectedBy}` : ""}`
        : `Rejected pending user application${rejectedBy ? ` by ${rejectedBy}` : ""}`;
    case "user.created":
      return targetUser
        ? `Created user account for ${targetUser}${createdBy ? ` by ${createdBy}` : ""}`
        : `Created new user account${createdBy ? ` by ${createdBy}` : ""}`;
    case "user.signup":
      return targetUser
        ? `Registered new account: ${targetUser}`
        : userEmail
          ? `Registered new account with email ${userEmail}`
          : "Submitted self-service signup application";
    case "user.edited":
    case "user.updated":
      return targetUser
        ? `Updated user account details for ${targetUser}${updatedBy ? ` by ${updatedBy}` : ""}`
        : "Updated user profile information";
    case "user.password_reset":
      return targetUser
        ? `Reset account password for ${targetUser}${resetBy ? ` by ${resetBy}` : ""}`
        : "Reset user password";
    case "user.activated":
      return targetUser
        ? `Activated user account for ${targetUser}${performedBy ? ` by ${performedBy}` : ""}`
        : "Activated user account";
    case "user.deactivated":
      return targetUser
        ? `Deactivated user account for ${targetUser}${performedBy ? ` by ${performedBy}` : ""}`
        : "Deactivated user account";
    case "user.role_updated":
      return targetUser && meta.new_role
        ? `Changed role of ${targetUser} to ${meta.new_role}${updatedBy ? ` by ${updatedBy}` : ""}`
        : "Updated user authorization role";
    case "user.deleted":
      return targetUser
        ? `Permanently deleted account for ${targetUser}`
        : "Deleted user account";

    case "machine.created":
      return machineName ? `Registered new machine: ${machineName}` : "Created new machine record";
    case "machine.updated":
      return machineName ? `Updated configuration for ${machineName}` : "Updated machine specifications";
    case "machine.reassigned":
      return machineName ? `Reassigned service engineer for ${machineName}` : "Reassigned machine engineer";
    case "machine.deleted":
      return machineName ? `Removed machine record: ${machineName}` : "Deleted machine from registry";

    case "service.completed":
      return machineName ? `Completed service log for ${machineName}` : "Logged machine service maintenance";
    case "manual.reminder.sent":
      return meta.recipient_email
        ? `Sent manual service alert email to ${meta.recipient_email}`
        : "Sent manual email reminder";
    case "reminders.sent":
      return meta.count
        ? `Dispatched ${meta.count} automated machine service reminder emails`
        : "Executed scheduled email reminder batch";
    case "notification.resent":
      return meta.recipient
        ? `Resent notification email to ${meta.recipient}`
        : "Resent notification log";

    case "auth.login":
      return userEmail ? `Signed in user session: ${userEmail}` : "Successfully authenticated session";
    case "auth.logout":
      return userEmail ? `Signed out user session: ${userEmail}` : "Ended active user session";

    default:
      if (log.entity_type) {
        return `${log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)} ID: ${log.entity_id || "N/A"}`;
      }
      return null;
  }
}
