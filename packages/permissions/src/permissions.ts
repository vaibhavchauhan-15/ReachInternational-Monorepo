/**
 * Granular Permission Constants
 */
export const PERMISSIONS = {
  // Machines
  MACHINE_VIEW: "machine.view",
  MACHINE_CREATE: "machine.create",
  MACHINE_EDIT: "machine.edit",
  MACHINE_DELETE: "machine.delete",
  MACHINE_ASSIGN: "machine.assign",

  // Breakdown Complaints
  COMPLAINT_VIEW: "complaint.view",
  COMPLAINT_CREATE: "complaint.create",
  COMPLAINT_ASSIGN: "complaint.assign",
  COMPLAINT_UPDATE: "complaint.update",
  COMPLAINT_CLOSE: "complaint.close",

  // Service & Planning
  SERVICE_VIEW: "service.view",
  SERVICE_PLAN: "service.plan",
  SERVICE_CREATE: "service.create",
  SERVICE_ASSIGN: "service.assign",
  SERVICE_UPDATE: "service.update",
  SERVICE_CLOSE: "service.close",

  // Field Service Reports (FSR)
  FSR_VIEW: "fsr.view",
  FSR_CREATE: "fsr.create",
  FSR_UPDATE: "fsr.update",
  FSR_REVIEW: "fsr.review",
  FSR_APPROVE: "fsr.approve",

  // Inventory & Stock Ledger
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_CREATE: "inventory.create",
  INVENTORY_EDIT: "inventory.edit",
  INVENTORY_ARCHIVE: "inventory.archive",
  INVENTORY_STOCK_IN: "inventory.stock_in",
  INVENTORY_STOCK_OUT: "inventory.stock_out",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_TRANSFER: "inventory.transfer",
  INVENTORY_APPROVE_TRANSFER: "inventory.approve_transfer",
  INVENTORY_REQUEST: "inventory.request",
  PART_REQUEST_APPROVE: "part_request.approve",
  PART_REQUEST_REJECT: "part_request.reject",
  PART_REQUEST_ISSUE: "part_request.issue",
  PO_VIEW: "po.view",
  PO_CREATE: "po.create",
  PO_EDIT: "po.edit",
  PO_APPROVE: "po.approve",
  PO_CANCEL: "po.cancel",
  CHALLAN_VIEW: "challan.view",
  CHALLAN_CREATE: "challan.create",
  CHALLAN_EDIT: "challan.edit",
  CHALLAN_APPROVE: "challan.approve",
  CHALLAN_CANCEL: "challan.cancel",
  SUPPLIER_VIEW: "supplier.view",
  SUPPLIER_CREATE: "supplier.create",
  SUPPLIER_EDIT: "supplier.edit",
  SUPPLIER_ARCHIVE: "supplier.archive",
  GRN_VIEW: "grn.view",
  GRN_CREATE: "grn.create",
  PURCHASE_RETURN_VIEW: "purchase_return.view",
  PURCHASE_RETURN_CREATE: "purchase_return.create",

  // Employee & HR
  EMPLOYEE_VIEW: "employee.view",
  EMPLOYEE_CREATE: "employee.create",
  EMPLOYEE_EDIT: "employee.edit",
  EMPLOYEE_DELETE: "employee.delete",
  EMPLOYEE_ONBOARD: "employee.onboard",
  EMPLOYEE_STATUS_CHANGE: "employee.status_change",
  EMPLOYEE_SALARY_VIEW: "employee.salary.view",
  EMPLOYEE_SALARY_CREATE: "employee.salary.create",
  EMPLOYEE_SALARY_EDIT: "employee.salary.edit",
  DEPARTMENT_MANAGE: "department.manage",
  DESIGNATION_MANAGE: "designation.manage",
  USER_REQUEST_CREATE: "user_request.create",
  USER_REQUEST_VIEW: "user_request.view",
  EMPLOYEE_DOCUMENT_MANAGE: "employee.document.manage",

  // Rental Management
  RENTAL_VIEW: "rental.view",
  RENTAL_CREATE: "rental.create",
  RENTAL_EDIT: "rental.edit",
  RENTAL_APPROVE: "rental.approve",
  RENTAL_DISPATCH: "rental.dispatch",
  RENTAL_RETURN: "rental.return",
  RENTAL_INSPECT: "rental.inspect",
  RENTAL_DAMAGE_REPORT: "rental.damage_report",
  RENTAL_EXTEND: "rental.extend",
  RENTAL_CANCEL: "rental.cancel",
  RENTAL_BILLING_REQUEST: "rental.billing_request",
  RENTAL_CUSTOMER_MANAGE: "rental.customer_manage",
  RENTAL_ACCESSORY_MANAGE: "rental.accessory_manage",

  // Sales & CRM
  SALES_VIEW: "sales.view",
  SALES_CREATE: "sales.create",
  SALES_EDIT: "sales.edit",
  SALES_QUOTATION: "sales.quotation",
  SALES_LEAD_MANAGE: "sales.lead_manage",
  SALES_CUSTOMER_MANAGE: "sales.customer_manage",
  SALES_INTERACTION_LOG: "sales.interaction_log",
  SALES_OPPORTUNITY_MANAGE: "sales.opportunity_manage",
  SALES_QUOTATION_MANAGE: "sales.quotation_manage",
  SALES_DISCOUNT_APPROVE: "sales.discount_approve",
  SALES_ORDER_MANAGE: "sales.order_manage",
  SALES_ORDER_APPROVE: "sales.order_approve",
  SALES_MACHINE_RESERVE: "sales.machine_reserve",
  SALES_DELIVERY_COORDINATE: "sales.delivery_coordinate",
  SALES_HANDOVER_COORDINATE: "sales.handover_coordinate",
  SALES_SETTINGS_MANAGE: "sales.settings_manage",

  // Finance & Billing
  FINANCE_VIEW: "finance.view",
  FINANCE_INVOICE: "finance.invoice",
  FINANCE_INVOICE_CREATE: "finance.invoice.create",
  FINANCE_INVOICE_EDIT: "finance.invoice.edit",
  FINANCE_INVOICE_FINALIZE: "finance.invoice.finalize",
  FINANCE_INVOICE_CANCEL: "finance.invoice.cancel",
  FINANCE_CREDIT_NOTE: "finance.credit_note",
  FINANCE_DEBIT_NOTE: "finance.debit_note",
  FINANCE_PAYMENT: "finance.payment",
  FINANCE_PAYMENT_RECORD: "finance.payment.record",
  FINANCE_RECEIVABLE_MANAGE: "finance.receivable.manage",
  FINANCE_PAYABLE_MANAGE: "finance.payable.manage",
  FINANCE_3WAY_MATCH: "finance.3way_match",
  FINANCE_EXPENSE_MANAGE: "finance.expense.manage",
  FINANCE_EXPENSE_APPROVE: "finance.expense.approve",
  FINANCE_APPROVAL: "finance.approval",
  FINANCE_REPORT: "finance.report",
  FINANCE_SETTINGS_MANAGE: "finance.settings.manage",

  // User & RBAC Management
  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_EDIT: "user.edit",
  USER_DELETE: "user.delete",
  USER_ASSIGN_ROLE: "user.assign_role",

  // Operator & Meter Logs
  OPERATOR_VIEW: "operator.view",
  OPERATOR_ASSIGN: "operator.assign",
  OPERATOR_LOG_APPROVE: "operator.log_approve",
  OPERATOR_LOG_CREATE: "operator.log_create",
  OPERATOR_LOG_EDIT: "operator.log_edit",

  // Notifications
  NOTIFICATION_VIEW: "notification.view",
  NOTIFICATION_CONFIGURE: "notification.configure",
  NOTIFICATION_SEND: "notification.send",

  // System & Audit
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  AUDIT_VIEW: "audit.view",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
