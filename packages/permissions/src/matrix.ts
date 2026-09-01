import type { UserRole } from "@reachinternational/types";

/**
 * Role-Permission Matrix mapping all 14 system roles to granular permissions
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],

  admin: [
    "machine.view", "machine.create", "machine.edit", "machine.delete", "machine.assign",
    "complaint.view", "complaint.create", "complaint.assign", "complaint.update", "complaint.close",
    "service.view", "service.plan", "service.create", "service.assign", "service.update", "service.close",
    "fsr.view", "fsr.create", "fsr.update", "fsr.review", "fsr.approve",
    "inventory.view", "inventory.create", "inventory.stock_in", "inventory.stock_out", "inventory.adjust", "inventory.transfer", "inventory.approve_transfer", "inventory.request", "part_request.approve",
    "employee.view", "employee.create", "employee.edit", "employee.salary.view",
    "rental.view", "rental.create", "rental.edit", "rental.approve", "rental.dispatch", "rental.return",
    "sales.view", "sales.create", "sales.edit",
    "finance.view",
    "operator.view", "operator.assign", "operator.log_approve",
    "notification.view", "notification.send",
    "user.view", "user.create", "user.edit", "user.assign_role",
    "report.view", "report.export", "audit.view", "settings.view"
  ],

  service_manager: [
    "machine.view", "machine.create", "machine.edit", "machine.delete", "machine.assign",
    "complaint.view", "complaint.create", "complaint.assign", "complaint.update", "complaint.close", "complaint.escalate", "complaint.update_status",
    "service.view", "service.plan", "service.create", "service.assign", "service.update", "service.close", "service.cancel", "service.reschedule", "service.complete", "service.approve",
    "fsr.view", "fsr.review", "fsr.approve",
    "inventory.view", "inventory.request", "part_request.create", "part_request.view", "part_request.edit", "part_request.approve", "part_request.approve_service_req", "part_request.reject", "part_request.escalate",
    "employee.view", "engineer.workload.view", "mechanic.workload.view", "mechanic.assign",
    "operator.view", "rental.view",
    "notification.view", "notification.send",
    "report.view", "report.export", "audit.view"
  ],

  service_engineer: [
    "machine.view",
    "complaint.view", "complaint.create", "complaint.update", "complaint.close",
    "service.view", "service.update", "service.close",
    "fsr.view", "fsr.create", "fsr.update",
    "inventory.view", "inventory.request",
    "operator.view", "notification.view",
    "report.view", "audit.view"
  ],

  engineer: [
    "machine.view",
    "complaint.view", "complaint.create", "complaint.update", "complaint.close",
    "service.view", "service.update", "service.close",
    "fsr.view", "fsr.create", "fsr.update",
    "inventory.view", "inventory.request",
    "operator.view", "notification.view",
    "report.view", "audit.view"
  ],

  supervisor: [
    "machine.view", "machine.edit",
    "complaint.view", "complaint.create",
    "service.view",
    "operator.view", "operator.assign", "operator.log_approve", "operator.create", "operator.salary_manage",
    "site_movement.view", "site_movement.manage",
    "notification.view", "notification.send"
  ],

  mechanic: [
    "machine.view",
    "complaint.view", "complaint.create", "complaint.update",
    "service.view", "service.update",
    "fsr.view", "fsr.create", "fsr.update",
    "inventory.view", "inventory.request", "part_request.create", "part_request.view",
    "operator.view", "rental.view",
    "notification.view",
    "report.view", "audit.view"
  ],

  operator: [
    "machine.view",
    "complaint.view",
    "complaint.create",
    "complaint.update",
    "service.view",
    "fsr.view",
    "operator.view",
    "operator.log_create",
    "operator.log_edit",
    "part_request.create",
    "part_request.view",
    "rental.view",
    "notification.view",
    "notification.send",
    "report.view",
    "audit.view"
  ],

  store_manager: [
    "machine.view",
    "complaint.view",
    "service.view",
    "fsr.view",
    "inventory.view", "inventory.create", "inventory.edit", "inventory.archive", "inventory.stock_in", "inventory.stock_out", "inventory.adjust", "inventory.transfer", "inventory.approve_transfer", "inventory.request",
    "part_request.create", "part_request.view", "part_request.approve", "part_request.reject", "part_request.issue",
    "po.view", "po.create", "po.edit", "po.approve", "po.cancel",
    "challan.view", "challan.create", "challan.edit", "challan.approve", "challan.cancel",
    "supplier.view", "supplier.create", "supplier.edit", "supplier.archive",
    "grn.view", "grn.create",
    "purchase_return.view", "purchase_return.create",
    "employee.view",
    "rental.view",
    "finance.view",
    "notification.view", "notification.send",
    "report.view", "report.export", "audit.view",
    "settings.view", "settings.edit"
  ],

  hr_manager: [
    "employee.view", "employee.create", "employee.edit", "employee.delete", "employee.onboard", "employee.status_change",
    "employee.salary.view", "employee.salary.create", "employee.salary.edit",
    "department.manage", "designation.manage",
    "employee.document.manage",
    "user_request.create", "user_request.view", "user.view",
    "notification.view", "notification.send",
    "report.view", "report.export",
    "audit.view",
    "settings.view", "settings.edit"
  ],

  manager: [
    "machine.view", "machine.create", "machine.edit", "machine.delete", "machine.assign",
    "complaint.view", "complaint.create", "complaint.assign", "complaint.update", "complaint.close",
    "service.view", "service.plan", "service.create", "service.assign", "service.update", "service.close",
    "fsr.view", "fsr.create", "fsr.update", "fsr.review", "fsr.approve",
    "inventory.view", "inventory.create", "inventory.edit", "inventory.stock_in", "inventory.stock_out", "inventory.adjust", "inventory.transfer", "inventory.approve_transfer", "inventory.request", "part_request.create", "part_request.view", "part_request.approve", "part_request.reject",
    "po.view", "po.create", "po.edit", "po.approve", "po.cancel",
    "challan.view", "challan.create", "challan.edit", "challan.approve", "challan.cancel",
    "supplier.view", "supplier.create", "supplier.edit",
    "employee.view", "employee.create", "employee.edit", "employee.salary.view",
    "rental.view", "rental.create", "rental.edit", "rental.approve", "rental.dispatch", "rental.return", "rental.inspect", "rental.damage_report", "rental.extend", "rental.cancel",
    "sales.view", "sales.create", "sales.edit", "sales.quotation", "sales.lead_manage", "sales.customer_manage", "sales.opportunity_manage", "sales.order_manage",
    "finance.view", "finance.invoice", "finance.invoice.create", "finance.invoice.edit", "finance.payment", "finance.expense.manage", "finance.report",
    "operator.view", "operator.assign", "operator.log_approve",
    "notification.view", "notification.send",
    "user.view", "user.create", "user.edit",
    "report.view", "report.export", "audit.view", "settings.view"
  ],
};

/**
 * Check if a role has a specific permission string
 */
export function roleHasPermission(role: UserRole, permission: string): boolean {
  if (role === "super_admin") return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  if (permissions.includes("*")) return true;

  // Direct match
  if (permissions.includes(permission)) return true;

  // Normalize colon to dot
  const normalized = normalizePermissionKey(permission);
  if (permissions.includes(normalized)) return true;

  return false;
}

export function hasAnyPermission(role: UserRole, permissions: string[]): boolean {
  return permissions.some((perm) => roleHasPermission(role, perm));
}

export function hasAllPermissions(role: UserRole, permissions: string[]): boolean {
  return permissions.every((perm) => roleHasPermission(role, perm));
}

function normalizePermissionKey(perm: string): string {
  const map: Record<string, string> = {
    "machine:read": "machine.view",
    "machine:create": "machine.create",
    "machine:update": "machine.edit",
    "machine:delete": "machine.delete",
    "service:read": "service.view",
    "service:create": "service.create",
    "service:update": "service.update",
    "service:approve": "fsr.approve",
    "complaint:read": "complaint.view",
    "complaint:create": "complaint.create",
    "complaint:update": "complaint.update",
    "complaint:close": "complaint.close",
    "inventory:read": "inventory.view",
    "inventory:create": "inventory.create",
    "inventory:stock_in": "inventory.stock_in",
    "inventory:stock_out": "inventory.stock_out",
    "inventory:transfer": "inventory.transfer",
    "employee:read": "employee.view",
    "employee:create": "employee.create",
    "employee:update": "employee.edit",
    "hr:read_salary": "employee.salary.view",
    "rental:read": "rental.view",
    "rental:create": "rental.create",
    "sales:read": "sales.view",
    "finance:read": "finance.view",
    "user:read": "user.view",
    "user:create": "user.create",
    "audit:read": "audit.view",
  };
  return map[perm] || perm;
}
