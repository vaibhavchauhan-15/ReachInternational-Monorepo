export type UserRole = 
  | "super_admin"
  | "admin"
  | "manager"
  | "service_manager"
  | "engineer"
  | "service_engineer"
  | "supervisor"
  | "store_manager"
  | "operator"
  | "mechanic"
  | "hr_manager";

export type PermissionScope = 
  | "ORGANIZATION"
  | "REGION"
  | "DEPARTMENT"
  | "WAREHOUSE"
  | "ASSIGNED"
  | "SELF";

export type UserStatus = "active" | "inactive" | "pending";
export type MachineStatus = "available" | "rented" | "active" | "inactive" | "on_rent" | "under_maintenance";
export type MachineHealthStatus = "active" | "under_maintenance" | "breakdown";
export type OwnershipType = "company_owned" | "customer_owned" | "rental_fleet";
export type ComplaintStatus = "open" | "in_progress" | "pending_parts" | "resolved" | "closed";
export type ServiceStatus = "scheduled" | "in_progress" | "completed" | "overdue";
export type InventoryTransactionType = 
  | "OPENING_STOCK"
  | "PURCHASE" 
  | "PURCHASE_RECEIPT"
  | "STOCK_IN" 
  | "STOCK_OUT" 
  | "PART_ISSUE"
  | "PART_RETURN"
  | "SERVICE_ISSUE" 
  | "RETURN" 
  | "TRANSFER" 
  | "ADJUSTMENT" 
  | "DAMAGE"
  | "LOSS"
  | "REVERSAL";
export type StockTransferStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type EmploymentType = "full_time" | "contract" | "part_time";
export type EmployeeStatus = "pending_onboarding" | "active" | "on_leave" | "notice_period" | "resigned" | "terminated" | "retired" | "inactive" | "archived";

export type AlertType = 
  | "today" 
  | "tomorrow" 
  | "overdue" 
  | "new_machine" 
  | "machine_updated" 
  | "machine_deleted" 
  | "excel_import" 
  | "system_error" 
  | "reminder_failed" 
  | "daily_summary" 
  | "engineer_summary" 
  | "weekly_report" 
  | "monthly_report";

export type NotificationStatus = "pending" | "sent" | "failed";
export type NotificationChannel = "whatsapp" | "sms" | "email" | "in_app";
export type ImportBatchStatus = "processing" | "completed" | "failed";

export interface Role {
  id: string;
  code: UserRole;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  module: string;
  description: string | null;
  created_at: string;
}

export interface User {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  branch_id?: string | null;
  location?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  state_id?: number | null;
  aadhaar_number?: string | null;
  license_number?: string | null;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  designation: string;
  department: string | null;
  branch_id?: string | null;
  user_id: string | null;
  joining_date: string;
  employment_type: EmploymentType;
  reporting_manager_id: string | null;
  salary: number | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
  user?: Pick<User, "id" | "email" | "role"> | null;
  reporting_manager?: Pick<Employee, "id" | "full_name" | "employee_code"> | null;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  employee_count?: number;
}

export interface Designation {
  id: string;
  code: string;
  title: string;
  department_code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  employee_count?: number;
}

export interface EmployeeSalaryHistory {
  id: string;
  employee_id: string;
  salary: number;
  fixed_component: number;
  variable_component: number;
  ctc: number | null;
  effective_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  creator?: Pick<User, "id" | "email" | "full_name"> | null;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: "joining" | "identity" | "qualification" | "employment" | "offer_letter" | "appointment_letter" | "resignation" | "experience" | "other";
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface UserAccountRequest {
  id: string;
  employee_id: string;
  requested_by: string;
  request_type: "create_account" | "deactivate_account" | "role_change";
  requested_role: UserRole;
  target_branch_id: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: Pick<Employee, "id" | "employee_code" | "full_name" | "email"> | null;
  requester?: Pick<User, "id" | "full_name" | "email"> | null;
}

export interface Manufacturer {
  id: string;
  name: string;
  country: string | null;
  created_at: string;
}

export interface MachineModel {
  id: string;
  manufacturer_id: string;
  model_name: string;
  category_id: string | null;
  specs: Record<string, unknown> | null;
  created_at: string;
  manufacturer?: Manufacturer | null;
}

export interface MachineCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  machine_id: string;
  model: string | null;
  serial_number: string | null;
  year_of_mfg: string | null;
  manufacturer: string | null;
  current_supervisor_id: string | null;
  hour_meter: number;
  current_operator_id: string | null;
  client_id?: string | null;
  health_status: MachineHealthStatus;
  status: MachineStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  current_operator?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  current_supervisor?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  client?: Pick<
    CRMClient,
    | "id"
    | "code"
    | "company_name"
    | "city"
    | "district"
    | "state"
    | "pincode"
    | "phone"
    | "contact_person"
    | "address"
    | "gstin"
    | "pan_number"
    | "is_billing_address_different"
    | "billing_address"
    | "billing_city"
    | "billing_district"
    | "billing_state"
    | "billing_pincode"
    | "status"
  > | CRMClient | null;

  // Backward-compatibility optional fields for transition
  machine_code?: string;
  machine_name?: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string | null;
  customer_address?: string | null;
  city?: string;
  state?: string;
  branch_id?: string | null;
  engineer_id?: string | null;
}

export interface MachineWithEngineer extends Machine {
  engineer?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  category?: MachineCategory | null;
}

export interface MachineAssignment {
  id: string;
  machine_id: string;
  operator_id: string;
  assigned_by: string | null;
  assigned_at: string;
  unassigned_at: string | null;
  status: "active" | "ended";
  notes: string | null;
  created_at: string;
  operator?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  assigner?: Pick<User, "id" | "full_name"> | null;
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name" | "model" | "serial_number"> | null;
}

export interface MachineHourLog {
  id: string;
  machine_id: string;
  operator_id: string;
  supervisor_id?: string | null;
  client_id?: string | null;
  log_date: string;
  end_date?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  start_meter: number;
  end_meter: number;
  running_hours: number;
  location: string | null;
  remarks: string | null;
  shift?: "shift_1" | "shift_2" | "shift_3" | "custom" | string | null;
  machine_condition?: "good" | "fair" | "needs_attention" | "breakdown" | string | null;
  start_time?: string | null;
  end_time?: string | null;
  overtime_hours?: number | null;
  normal_working_hours?: number | null;
  is_breakdown?: boolean | null;
  idempotency_key?: string | null;
  created_at: string;
  operator?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  supervisor?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name" | "model" | "serial_number"> | null;
  client?: CRMClient | null;
}

export interface MachineComplaint {
  id: string;
  complaint_no: string;
  machine_id: string;
  supervisor_id: string | null;
  engineer_id: string | null;
  complaint_date: string;
  end_date: string | null;
  location: string | null;
  state_name: string | null;
  city: string | null;
  hour_meter: number;
  required_part: string | null;
  part_quantity: number;
  complaint: string;
  work_done: string | null;
  pending_work: string | null;
  images: string[];
  pdf_report_url: string | null;
  checklist_data: Record<string, unknown> | null;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
}

export interface ComplaintWithDetails extends MachineComplaint {
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name" | "model" | "serial_number" | "city" | "state" | "branch_id">;
  supervisor?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  engineer?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
}

export interface ServiceRecord {
  id: string;
  machine_id: string;
  engineer_id: string | null;
  supervisor_id: string | null;
  service_date: string;
  service_category: string | null;
  service_status: ServiceStatus;
  service_due_date: string | null;
  service_completion_date: string | null;
  hour_meter: number;
  location: string | null;
  pdf_report_url: string | null;
  notes: string | null;
  photo_urls: string[] | null;
  next_service_due_date: string | null;
  created_at: string;
}

export interface ServiceRecordWithDetails extends ServiceRecord {
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name" | "model" | "serial_number" | "customer_name" | "city" | "state">;
  engineer?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
  supervisor?: Pick<User, "id" | "full_name" | "phone" | "email"> | null;
}

export interface InventoryProduct {
  id: string;
  part_number: string;
  name: string;
  description?: string | null;
  category: string | null;
  subcategory?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  oem_part_number?: string | null;
  alternate_part_number?: string | null;
  barcode?: string | null;
  unit: string;
  min_stock_level: number;
  reorder_level?: number;
  reorder_quantity?: number;
  max_stock_level?: number;
  reserved_quantity?: number;
  unit_cost: number;
  last_purchase_price?: number;
  average_purchase_price?: number;
  default_branch_id?: string | null;
  warehouse_zone?: string;
  rack_number?: string;
  shelf_number?: string;
  bin_number?: string;
  storage_location?: string | null;
  compatible_machines?: string | null;
  compatible_models?: string | null;
  part_type?: "spare" | "consumable" | "tool" | "assembly" | "lubricant";
  criticality?: "normal" | "high" | "critical";
  status?: "active" | "inactive" | "discontinued";
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  current_stock?: number;
  available_stock?: number;
}

export interface StorageLocation {
  id: string;
  branch_id: string;
  store_name: string;
  zone: string;
  rack: string;
  shelf: string;
  bin: string;
  capacity: number;
  notes?: string | null;
  created_at: string;
}

export interface PurchaseRequestItem {
  id: string;
  request_id: string;
  product_id: string;
  current_stock: number;
  min_stock: number;
  requested_quantity: number;
  approved_quantity?: number | null;
  unit: string;
  estimated_unit_cost: number;
  remarks?: string | null;
  created_at: string;
  product?: InventoryProduct | null;
}

export interface PurchaseRequest {
  id: string;
  request_no: string;
  branch_id: string;
  requested_by: string;
  sent_to_manager_id: string;
  priority: "normal" | "high" | "urgent";
  reason: string;
  status: "draft" | "submitted" | "pending_approval" | "approved" | "partially_approved" | "rejected" | "converted_to_po" | "cancelled";
  manager_remarks?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  requester?: Pick<User, "id" | "full_name" | "email" | "role"> | null;
  target_manager?: Pick<User, "id" | "full_name" | "email" | "role"> | null;
  approver?: Pick<User, "id" | "full_name" | "email" | "role"> | null;
  items?: PurchaseRequestItem[];
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id?: string | null;
  part_number: string;
  product_description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
  gst_amount: number;
  total_amount: number;
  created_at: string;
  product?: InventoryProduct | null;
}

export interface GoodsReceiptItem {
  id: string;
  grn_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  tax_amount: number;
  total_amount: number;
  rack: string;
  shelf: string;
  bin: string;
  batch_number?: string | null;
  serial_number?: string | null;
  created_at: string;
  product?: InventoryProduct | null;
}

export interface GoodsReceipt {
  id: string;
  grn_number: string;
  po_id?: string | null;
  supplier_id?: string | null;
  supplier_name: string;
  supplier_gstin?: string | null;
  bill_number: string;
  bill_date: string;
  delivery_date: string;
  transport_details?: string | null;
  bill_document_url?: string | null;
  branch_id: string;
  received_by: string;
  remarks?: string | null;
  created_at: string;
  receiver?: Pick<User, "id" | "full_name" | "email"> | null;
  items?: GoodsReceiptItem[];
  po?: PurchaseOrder | null;
}

export interface PartIssueItem {
  id: string;
  issue_id: string;
  product_id: string;
  quantity_issued: number;
  quantity_returned: number;
  unit: string;
  machine_code?: string | null;
  is_returnable: boolean;
  created_at: string;
  product?: InventoryProduct | null;
}

export interface PartIssue {
  id: string;
  issue_number: string;
  challan_number: string;
  branch_id: string;
  machine_id?: string | null;
  complaint_id?: string | null;
  service_record_id?: string | null;
  issued_by: string;
  issued_to_user_id?: string | null;
  issued_to_name: string;
  issue_date: string;
  is_returnable: boolean;
  expected_return_date?: string | null;
  status: "issued" | "partially_returned" | "fully_returned" | "cancelled";
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name"> | null;
  issuer?: Pick<User, "id" | "full_name"> | null;
  recipient?: Pick<User, "id" | "full_name"> | null;
  items?: PartIssueItem[];
}

export interface PartReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  quantity_returned: number;
  condition: "good" | "damaged" | "scrap";
  remarks?: string | null;
  created_at: string;
  product?: InventoryProduct | null;
}

export interface PartReturn {
  id: string;
  return_number: string;
  issue_id: string;
  returned_by_name: string;
  received_by: string;
  return_date: string;
  remarks?: string | null;
  created_at: string;
  receiver?: Pick<User, "id" | "full_name"> | null;
  issue?: PartIssue | null;
  items?: PartReturnItem[];
}

export interface DeliveryChallanItem {
  id: string;
  challan_id: string;
  product_id?: string | null;
  part_number: string;
  description: string;
  quantity: number;
  unit: string;
  machine_number?: string | null;
  issue_to?: string | null;
  returnable_status: string;
  created_at: string;
  product?: InventoryProduct | null;
}

export interface InventoryStock {
  id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  updated_at: string;
  product?: InventoryProduct | null;
}

export interface InventoryTransaction {
  id: string;
  transaction_no: string;
  product_id: string;
  branch_id: string;
  type: InventoryTransactionType;
  quantity: number;
  reference_id: string | null;
  user_id: string | null;
  remarks: string | null;
  created_at: string;
  product?: InventoryProduct | null;
  user?: Pick<User, "id" | "full_name" | "email"> | null;
}

export interface StockTransfer {
  id: string;
  transfer_no: string;
  from_branch_id: string;
  to_branch_id: string;
  product_id: string;
  quantity: number;
  status: StockTransferStatus;
  requested_by: string | null;
  accepted_by: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  product?: InventoryProduct | null;
  requester?: Pick<User, "id" | "full_name"> | null;
  accepter?: Pick<User, "id" | "full_name"> | null;
}

export interface Notification {
  id: string;
  machine_id: string | null;
  recipient_id: string | null;
  alert_type: AlertType;
  alert_date: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  whatsapp_message_id: string | null;
  email_message_id: string | null;
  payload: Record<string, unknown> | null;
  provider_response: Record<string, unknown> | null;
  retry_count: number;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationWithDetails extends Notification {
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name" | "customer_name" | "customer_mobile"> | null;
  recipient?: Pick<User, "id" | "full_name" | "phone" | "email" | "role"> | null;
}

export interface ImportBatch {
  id: string;
  uploaded_by: string | null;
  filename: string;
  total_rows: number;
  success_count: number;
  failed_count: number;
  status: ImportBatchStatus;
  created_at: string;
}

export interface ImportError {
  id: string;
  batch_id: string;
  row_number: number;
  error_message: string;
  raw_data: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogWithUser extends AuditLog {
  user?: Pick<User, "id" | "full_name" | "email" | "role"> | null;
}

export interface SystemSettings {
  id: string;
  whatsapp_phone_number_id: string | null;
  whatsapp_access_token_ref: string | null;
  gmail_sender_email: string | null;
  gmail_app_password_ref: string | null;
  email_from_name: string | null;
  daily_run_time: string;
  default_service_interval_days: number;
  updated_at: string;
}

export interface DashboardSummary {
  total_machines: number;
  active_machines: number;
  today_due: number;
  tomorrow_due: number;
  overdue: number;
  completed_today: number;
  notifications_sent_today: number;
  notifications_failed_today: number;
  total_branches?: number;
  open_complaints?: number;
  active_operators?: number;
}

export interface MonthlyServiceData {
  month: string;
  count: number;
}

export interface StoreManagerDashboardMetrics {
  totalParts: number;
  totalStockQty: number;
  totalStockValue: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingPartRequests: number;
  pendingPurchaseRequests: number;
  pendingPurchaseOrders: number;
  incomingShipments: number;
  partsIssuedToday: number;
  partsReceivedToday: number;
  partsReturnedToday: number;
  overdueReturnablePartsCount: number;
}

export interface CRMClient {
  id: string;
  code: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  address: string;
  city: string;
  district?: string | null;
  state: string;
  pincode?: string | null;
  is_billing_address_different?: boolean;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_district?: string | null;
  billing_state?: string | null;
  billing_pincode?: string | null;
  branch_id?: string | null;
  machine_count?: number;
  open_complaints?: number;
  status: "active" | "inactive";
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string;
  /** @deprecated Backward compatibility alias mapped from company_name */
  client_name?: string;
  /** @deprecated Backward compatibility optional alias */
  email?: string | null;
  /** @deprecated Backward compatibility optional alias */
  notes?: string | null;
}

export interface Vendor {
  id: string;
  vendor_name: string;
  code: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  city: string;
  rating: number;
  status: "active" | "inactive";
  created_at: string;
}

export interface OverdueTrendData {
  date: string;
  count: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  request_id?: string | null;
  vendor_id: string;
  vendor_name: string;
  vendor_gstin?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  amount: number;
  subtotal?: number;
  tax_amount?: number;
  grand_total?: number;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "sent" | "received" | "closed";
  due_date: string | null;
  requested_by: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface DeliveryChallan {
  id: string;
  challan_number: string;
  client_name: string;
  destination: string;
  status: "draft" | "pending" | "dispatched" | "in_transit" | "delivered" | "returned" | "cancelled";
  amount: number;
  issue_date: string;
  expected_delivery: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  document_name: string;
  entity_type: "machine" | "client" | "vendor" | "hr" | "po" | "challan";
  entity_id: string;
  entity_label: string;
  document_type: string;
  file_url: string;
  status: "valid" | "expiring_soon" | "expired" | "pending_approval" | "missing_required";
  expiry_date: string | null;
  branch_id: string | null;
  owner_id: string | null;
  created_at: string;
}

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Requirement Identified" | "Quotation" | "Negotiation" | "Won" | "Lost";
export type OpportunityStage = "Lead" | "Qualified" | "Opportunity" | "Quotation" | "Negotiation" | "Order Won" | "Order Lost";
export type QuotationStatus = "draft" | "pending_approval" | "sent" | "accepted" | "rejected" | "revised" | "cancelled" | "expired";
export type DiscountApprovalStatus = "auto_approved" | "pending_approval" | "approved" | "rejected";
export type SalesOrderStatus = "draft" | "pending_approval" | "approved" | "machine_reserved" | "delivery_requested" | "dispatched" | "delivered" | "handover_completed" | "cancelled";
export type SalesOrderApprovalStatus = "pending_approval" | "sales_manager_approved" | "admin_approved" | "finance_approved" | "rejected";
export type SalesDeliveryStatus = "requested" | "store_confirmed" | "in_transit" | "delivered" | "handover_completed";

export interface SalesLead {
  id: string;
  lead_number: string;
  lead_name: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string | null;
  location: string | null;
  city: string;
  state: string;
  requirement: string | null;
  machine_model: string | null;
  category_id: string | null;
  expected_quantity: number;
  expected_purchase_date: string | null;
  lead_source: string;
  status: LeadStatus;
  assigned_to: string | null;
  branch_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Pick<User, "id" | "full_name" | "email"> | null;
}

export interface SalesCustomer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  city: string;
  state: string;
  gstin: string | null;
  credit_limit: number;
  status: "active" | "inactive" | "archived";
  branch_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  orders_count?: number;
  quotations_count?: number;
}

export interface SalesInteraction {
  id: string;
  interaction_number: string;
  customer_id: string | null;
  lead_id: string | null;
  interaction_type: "Phone Call" | "Meeting" | "Email" | "Site Visit" | "Requirement Note" | "Negotiation Note" | "Customer Feedback";
  summary: string;
  notes: string | null;
  follow_up_date: string | null;
  salesperson_id: string | null;
  created_at: string;
  customer?: Pick<SalesCustomer, "id" | "company_name" | "contact_person"> | null;
  lead?: Pick<SalesLead, "id" | "lead_number" | "company_name"> | null;
  salesperson?: Pick<User, "id" | "full_name" | "email"> | null;
}

export interface SalesOpportunity {
  id: string;
  opp_number: string;
  title: string;
  customer_id: string;
  lead_id: string | null;
  machine_model: string;
  category_id: string | null;
  quantity: number;
  expected_value: number;
  expected_closing_date: string | null;
  probability: number;
  stage: OpportunityStage;
  competitor: string | null;
  requirement_notes: string | null;
  salesperson_id: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  customer?: Pick<SalesCustomer, "id" | "company_name" | "contact_person" | "phone"> | null;
  salesperson?: Pick<User, "id" | "full_name"> | null;
}

export interface SalesQuotation {
  id: string;
  quotation_number: string;
  revision_number: number;
  parent_quotation_id: string | null;
  opportunity_id: string | null;
  customer_id: string;
  customer_name: string;
  machine_id: string | null;
  machine_model: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  delivery_charges: number;
  transport_charges: number;
  subtotal: number;
  grand_total: number;
  warranty_terms: string;
  payment_terms: string;
  delivery_terms: string;
  validity_period: string | null;
  remarks: string | null;
  discount_approval_status: DiscountApprovalStatus;
  discount_approved_by: string | null;
  status: QuotationStatus;
  salesperson_id: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  customer?: Pick<SalesCustomer, "id" | "company_name" | "contact_person" | "phone" | "email"> | null;
  salesperson?: Pick<User, "id" | "full_name"> | null;
  discount_approver?: Pick<User, "id" | "full_name"> | null;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  quotation_id: string | null;
  customer_id: string;
  customer_name: string;
  machine_id: string | null;
  machine_model: string;
  quantity: number;
  final_unit_price: number;
  final_discount_percent: number;
  tax_amount: number;
  total_amount: number;
  delivery_location: string;
  delivery_date: string | null;
  payment_terms: string | null;
  warranty_terms: string | null;
  approval_status: SalesOrderApprovalStatus;
  sales_manager_approved_by: string | null;
  admin_approved_by: string | null;
  finance_approved_by: string | null;
  status: SalesOrderStatus;
  machine_reserved: boolean;
  delivery_instruction: string | null;
  salesperson_id: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  customer?: Pick<SalesCustomer, "id" | "company_name" | "contact_person" | "phone"> | null;
  quotation?: Pick<SalesQuotation, "id" | "quotation_number"> | null;
  salesperson?: Pick<User, "id" | "full_name"> | null;
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name" | "model"> | null;
}

export interface SalesMachineReservation {
  id: string;
  reservation_number: string;
  sales_order_id: string;
  machine_id: string;
  customer_id: string | null;
  reserved_until: string;
  status: "active" | "fulfilled" | "cancelled" | "expired";
  reserved_by: string | null;
  branch_id: string | null;
  created_at: string;
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name" | "model" | "serial_number" | "city"> | null;
  sales_order?: Pick<SalesOrder, "id" | "order_number" | "customer_name"> | null;
  reserver?: Pick<User, "id" | "full_name"> | null;
}

export interface SalesDeliveryCoordination {
  id: string;
  coordination_number: string;
  sales_order_id: string;
  customer_id: string | null;
  machine_id: string | null;
  delivery_location: string;
  special_instructions: string | null;
  requested_delivery_date: string;
  store_challan_id: string | null;
  delivery_status: SalesDeliveryStatus;
  handover_signed_doc_url: string | null;
  handover_date: string | null;
  created_by: string | null;
  created_at: string;
  sales_order?: Pick<SalesOrder, "id" | "order_number" | "customer_name" | "machine_model"> | null;
  machine?: Pick<Machine, "id" | "machine_code" | "machine_name"> | null;
  creator?: Pick<User, "id" | "full_name"> | null;
}

export interface SalesSettings {
  id: string;
  discount_limit_sales: number;
  discount_limit_manager: number;
  discount_limit_admin: number;
  sales_stages: string[];
  lead_sources: string[];
  document_templates: Record<string, unknown>[];
  updated_at: string;
}

export interface SalesDashboardMetrics {
  totalLeads: number;
  newLeads: number;
  followUpsDue: number;
  activeOpportunities: number;
  quotationPending: number;
  quotationAccepted: number;
  quotationRejected: number;
  ordersWon: number;
  ordersLost: number;
  pipelineValue: number;
  monthlySales: number;
  salesTarget: number;
  customerCount: number;
  reservedMachinesCount: number;
  pendingDeliveryCount: number;
  pendingApprovalsCount: number;
}

export type InvoiceType = "sales" | "rental" | "service" | "custom";
export type InvoiceStatus = "draft" | "under_review" | "finalized" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled" | "disputed";
export type PaymentMethod = "bank_transfer" | "upi" | "cheque" | "cash" | "card" | "other";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "disputed";
export type CreditDebitNoteType = "credit_note" | "debit_note";
export type ExpenseApprovalStatus = "pending" | "approved" | "rejected" | "on_hold" | "escalated_higher_approval";
export type ThreeWayMatchStatus = "matched" | "mismatch_quantity" | "mismatch_amount" | "mismatch_both" | "pending_verification" | "on_hold" | "approved_for_payment";

export interface FinanceInvoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  customer_id: string | null;
  customer_name: string;
  customer_gstin: string | null;
  billing_address: string | null;
  reference_type: string | null;
  reference_id: string | null;
  branch_id: string | null;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: InvoiceStatus;
  is_finalized: boolean;
  notes: string | null;
  created_by: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<User, "id" | "full_name"> | null;
  finalizer?: Pick<User, "id" | "full_name"> | null;
  items?: FinanceInvoiceItem[];
  payments?: FinancePayment[];
  notes_history?: FinanceCreditDebitNote[];
}

export interface FinanceInvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

export interface FinancePayment {
  id: string;
  payment_number: string;
  invoice_id: string | null;
  customer_name: string | null;
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference: string | null;
  payment_date: string;
  remarks: string | null;
  proof_document_url: string | null;
  status: PaymentStatus;
  recorded_by: string | null;
  branch_id: string | null;
  created_at: string;
  invoice?: Pick<FinanceInvoice, "id" | "invoice_number" | "customer_name"> | null;
  recorder?: Pick<User, "id" | "full_name"> | null;
}

export interface FinanceCreditDebitNote {
  id: string;
  note_number: string;
  note_type: CreditDebitNoteType;
  invoice_id: string;
  amount: number;
  tax_amount: number;
  reason: string;
  status: "draft" | "issued" | "applied" | "cancelled";
  issued_by: string | null;
  branch_id: string | null;
  created_at: string;
  invoice?: Pick<FinanceInvoice, "id" | "invoice_number" | "customer_name"> | null;
  issuer?: Pick<User, "id" | "full_name"> | null;
}

export interface FinanceExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FinanceExpense {
  id: string;
  expense_number: string;
  category: string;
  amount: number;
  expense_date: string;
  branch_id: string | null;
  department_id: string | null;
  vendor_name: string | null;
  vendor_id: string | null;
  payment_method: string;
  supporting_document_url: string | null;
  remarks: string | null;
  approval_status: ExpenseApprovalStatus;
  approval_limit_exceeded: boolean;
  requires_higher_approval: boolean;
  approved_by: string | null;
  recorded_by: string | null;
  created_at: string;
  department?: Pick<Department, "id" | "name"> | null;
  approver?: Pick<User, "id" | "full_name"> | null;
  recorder?: Pick<User, "id" | "full_name"> | null;
}

export interface Finance3WayMatchingReview {
  id: string;
  po_id: string | null;
  po_number: string;
  grn_id: string | null;
  grn_number: string | null;
  supplier_invoice_number: string | null;
  supplier_invoice_amount: number | null;
  po_amount: number | null;
  grn_quantity: number | null;
  po_quantity: number | null;
  invoice_quantity: number | null;
  match_status: ThreeWayMatchStatus;
  hold_reason: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  reviewer?: Pick<User, "id" | "full_name"> | null;
}

export interface FinanceVendorPayment {
  id: string;
  voucher_number: string;
  vendor_id: string | null;
  po_id: string | null;
  amount: number;
  payment_method: string;
  transaction_reference: string | null;
  payment_date: string;
  approval_status: "pending" | "approved" | "rejected" | "on_hold";
  approved_by: string | null;
  remarks: string | null;
  branch_id: string | null;
  created_at: string;
  approver?: Pick<User, "id" | "full_name"> | null;
}

export interface FinanceReceivableFollowup {
  id: string;
  invoice_id: string;
  followup_date: string;
  action_type: string;
  notes: string;
  performed_by: string | null;
  created_at: string;
  performer?: Pick<User, "id" | "full_name"> | null;
}

export interface FinanceDashboardMetrics {
  totalRevenue: number;
  salesRevenue: number;
  rentalRevenue: number;
  serviceRevenue: number;
  outstandingReceivables: number;
  pendingPaymentsCount: number;
  paidInvoicesCount: number;
  overdueInvoicesCount: number;
  totalExpenses: number;
  pendingVendorPayments: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netProfitLoss: number;
  cashReceived: number;
  cashPaid: number;
  netCashFlow: number;
}

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled" | "reopened";
export type TaskReminderOffset = "none" | "10m" | "30m" | "1h" | "1d";

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string;
  user?: Pick<User, "id" | "full_name" | "email" | "role"> | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: "attachment" | "completion_proof";
  uploaded_by: string;
  created_at: string;
  uploader?: Pick<User, "id" | "full_name"> | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  user?: Pick<User, "id" | "full_name" | "role"> | null;
}

export interface TaskActivityLog {
  id: string;
  task_id: string;
  actor_id: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
  actor?: Pick<User, "id" | "full_name" | "role"> | null;
}

export interface Task {
  id: string;
  task_no: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: string;
  branch_id: string | null;
  reminder_offset: TaskReminderOffset | null;
  completion_notes: string | null;
  completed_by: string | null;
  completed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<User, "id" | "full_name" | "email" | "role"> | null;
  completer?: Pick<User, "id" | "full_name" | "role"> | null;
  verifier?: Pick<User, "id" | "full_name" | "role"> | null;
  assignees?: TaskAssignee[];
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
  activity_logs?: TaskActivityLog[];
}

export interface TaskStats {
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueToday: number;
  highPriority: number;
  completionRate: number;
}

export interface TaskFilterParams {
  tab?: "all" | "my_tasks" | "assigned_to_me" | "completed" | "pending" | "overdue" | "in_progress";
  search?: string;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  assigneeId?: string;
  branchId?: string;
  dueDate?: string;
  sortBy?: "due_date" | "priority" | "created_at" | "status" | "title";
  sortOrder?: "asc" | "desc";
}

export interface MasterState {
  id: string;
  name: string;
  type: "state" | "union_territory";
  state_code: string | null;
  lgd_code: string | null;
  census_code: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface MasterDistrict {
  id: string;
  state_name: string;
  district_name: string;
  district_lgd_code: string | null;
  short_name: string | null;
  census_code: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface MasterCity {
  id: string;
  state_name: string;
  district_name: string;
  city_name: string;
  town_type: string;
  town_code: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface MasterLocation {
  id: string;
  state: string;
  union_territory: string | null;
  location_type: "state" | "union_territory";
  district: string;
  city_town: string;
  town_type: string;
  town_code?: string | null;
  district_code?: string | null;
  state_code?: string | null;
  search_text?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Relational Indian Locations Hierarchy (states, districts, cities, towns, villages)
// Official Government Integer / Smallint IDs
// ---------------------------------------------------------------------------
export interface State {
  id: number; // SMALLINT
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface District {
  id: number; // SMALLINT
  state_id: number; // SMALLINT REFERENCES states(id)
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface City {
  id: number; // INTEGER PRIMARY KEY (Census Location Code)
  district_id: number; // SMALLINT REFERENCES districts(id)
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface Town {
  id: number; // INTEGER PRIMARY KEY (Census Town / Tehsil Code)
  district_id: number; // SMALLINT REFERENCES districts(id)
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface Village {
  id: number; // INTEGER PRIMARY KEY (Census Village Code)
  district_id: number; // SMALLINT REFERENCES districts(id)
  name: string;
  created_at?: string;
  updated_at?: string;
}

