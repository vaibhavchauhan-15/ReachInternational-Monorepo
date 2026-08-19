import type { UserRole } from "@servicecentric/types";

/**
 * Role-Permission Matrix mapping all 14 system roles to granular permissions
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],

  admin: [
    "machine.view", "machine.create", "machine.edit", "machine.assign",
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
    "branch.view", "branch.edit",
    "report.view", "report.export", "audit.view", "settings.view"
  ],

  branch_manager: [
    "machine.view", "machine.create", "machine.edit", "machine.assign",
    "complaint.view", "complaint.create", "complaint.assign", "complaint.update", "complaint.close",
    "service.view", "service.plan", "service.create", "service.assign", "service.update", "service.close",
    "fsr.view", "fsr.review",
    "inventory.view", "inventory.transfer", "inventory.approve_transfer", "inventory.request", "part_request.approve",
    "employee.view", "rental.view", "sales.view", "finance.view", "user.view",
    "branch.view", "branch.edit",
    "report.view", "report.export", "audit.view"
  ],

  service_manager: [
    "machine.view", "machine.edit",
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
    "branch.view",
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
    "branch.view",
    "notification.view", "notification.send",
    "report.view", "report.export",
    "audit.view",
    "settings.view", "settings.edit"
  ],

  rental_manager: [
    "machine.view", "machine.edit",
    "rental.view", "rental.create", "rental.edit", "rental.approve", "rental.dispatch", "rental.return",
    "rental.inspect", "rental.damage_report", "rental.extend", "rental.cancel", "rental.billing_request", "rental.customer_manage", "rental.accessory_manage",
    "complaint.create", "complaint.view",
    "service.view", "fsr.view",
    "inventory.view", "inventory.request", "part_request.create", "part_request.view",
    "challan.view", "challan.create", "challan.edit",
    "employee.view",
    "sales.view", "sales.create", "sales.edit",
    "finance.view",
    "branch.view",
    "notification.view", "notification.send",
    "report.view", "report.export", "audit.view",
    "settings.view", "settings.edit"
  ],

  sales_executive: [
    "machine.view",
    "sales.view", "sales.create", "sales.edit", "sales.quotation",
    "sales.lead_manage", "sales.customer_manage", "sales.interaction_log",
    "sales.opportunity_manage", "sales.quotation_manage", "sales.discount_approve",
    "sales.order_manage", "sales.order_approve", "sales.machine_reserve",
    "sales.delivery_coordinate", "sales.handover_coordinate", "sales.settings_manage",
    "rental.view", "inventory.view", "finance.view", "complaint.create", "complaint.view",
    "service.view", "fsr.view", "notification.view", "notification.send",
    "report.view", "audit.view"
  ],

  finance_manager: [
    "machine.view", "inventory.view", "employee.view", "employee.salary.view",
    "finance.view", "finance.invoice", "finance.invoice.create", "finance.invoice.edit",
    "finance.invoice.finalize", "finance.invoice.cancel", "finance.credit_note", "finance.debit_note",
    "finance.payment", "finance.payment.record", "finance.receivable.manage", "finance.payable.manage",
    "finance.3way_match", "finance.expense.manage", "finance.expense.approve", "finance.approval",
    "finance.report", "finance.settings.manage", "rental.view", "sales.view", "po.view", "grn.view",
    "supplier.view", "challan.view", "service.view", "complaint.view", "fsr.view", "branch.view",
    "notification.view", "notification.send", "report.view", "report.export", "audit.view",
    "settings.view", "settings.edit"
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
    "branch:read": "branch.view",
    "audit:read": "audit.view",
  };
  return map[perm] || perm;
}
