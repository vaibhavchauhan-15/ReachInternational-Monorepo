/**
 * ServiceCentric Shared API — Endpoint Contracts
 * Canonical endpoint contract declarations for all 11 monorepo operational domains.
 */

import { ApiResponse, ApiPaginatedResponse } from '../response';
import { QueryOptions } from '../query';
import type {
  User,
  Machine,
  MachineComplaint,
  ServiceRecord,
  MachineHourLog,
  InventoryProduct,
  PurchaseOrder,
  DeliveryChallan,
  SalesLead,
  SalesOrder,
  FinanceInvoice,
  Employee,
  Notification,
} from '@servicecentric/types';

export interface AuthApiContract {
  login(credentials: { email: string; password: string }): Promise<ApiResponse<{ user: User; token: string }>>;
  logout(): Promise<ApiResponse<{ success: boolean }>>;
  getSession(): Promise<ApiResponse<{ user: User | null }>>;
  resetPassword(email: string): Promise<ApiResponse<{ success: boolean }>>;
}

export interface MachinesApiContract {
  getMachines(options?: QueryOptions): Promise<ApiPaginatedResponse<Machine>>;
  getMachineById(id: string): Promise<ApiResponse<Machine>>;
  createMachine(payload: Partial<Machine>): Promise<ApiResponse<Machine>>;
  updateMachine(id: string, payload: Partial<Machine>): Promise<ApiResponse<Machine>>;
  reassignMachine(id: string, branchId: string): Promise<ApiResponse<Machine>>;
}

export interface ComplaintsApiContract {
  getComplaints(options?: QueryOptions): Promise<ApiPaginatedResponse<MachineComplaint>>;
  getComplaintById(id: string): Promise<ApiResponse<MachineComplaint>>;
  createComplaint(payload: Partial<MachineComplaint>): Promise<ApiResponse<MachineComplaint>>;
  updateComplaintStatus(id: string, status: string): Promise<ApiResponse<MachineComplaint>>;
  resolveWithFsr(complaintId: string, fsrPayload: Record<string, unknown>): Promise<ApiResponse<MachineComplaint>>;
}

export interface ServicesApiContract {
  getServices(options?: QueryOptions): Promise<ApiPaginatedResponse<ServiceRecord>>;
  getServiceById(id: string): Promise<ApiResponse<ServiceRecord>>;
  completeService(id: string, notes: string): Promise<ApiResponse<ServiceRecord>>;
}

export interface OperationsApiContract {
  getMeterLogs(options?: QueryOptions): Promise<ApiPaginatedResponse<MachineHourLog>>;
  submitMeterLog(payload: Partial<MachineHourLog>): Promise<ApiResponse<MachineHourLog>>;
  verifyMeterLog(id: string, status: string, remarks?: string): Promise<ApiResponse<MachineHourLog>>;
}

export interface InventoryApiContract {
  getProducts(options?: QueryOptions): Promise<ApiPaginatedResponse<InventoryProduct>>;
  getPurchaseOrders(options?: QueryOptions): Promise<ApiPaginatedResponse<PurchaseOrder>>;
  approvePurchaseOrder(poId: string): Promise<ApiResponse<PurchaseOrder>>;
}

export interface RentalsApiContract {
  getDeliveryChallans(options?: QueryOptions): Promise<ApiPaginatedResponse<DeliveryChallan>>;
  dispatchMachine(challanId: string): Promise<ApiResponse<DeliveryChallan>>;
  recordReturn(challanId: string, returnMeter: number, fuelLevel: number, condition: string): Promise<ApiResponse<DeliveryChallan>>;
}

export interface SalesApiContract {
  getLeads(options?: QueryOptions): Promise<ApiPaginatedResponse<SalesLead>>;
  convertLead(leadId: string): Promise<ApiResponse<{ customerId: string; opportunityId: string }>>;
  getOrders(options?: QueryOptions): Promise<ApiPaginatedResponse<SalesOrder>>;
}

export interface FinanceApiContract {
  getInvoices(options?: QueryOptions): Promise<ApiPaginatedResponse<FinanceInvoice>>;
  finalizeInvoice(invoiceId: string): Promise<ApiResponse<FinanceInvoice>>;
  recordPayment(invoiceId: string, amount: number, paymentMethod: string): Promise<ApiResponse<FinanceInvoice>>;
}

export interface HrApiContract {
  getEmployees(options?: QueryOptions): Promise<ApiPaginatedResponse<Employee>>;
  changeEmployeeStatus(employeeId: string, status: string): Promise<ApiResponse<Employee>>;
}

export interface NotificationsApiContract {
  getNotifications(options?: QueryOptions): Promise<ApiPaginatedResponse<Notification>>;
  markAsRead(notificationId: string): Promise<ApiResponse<{ success: boolean }>>;
}
