import "server-only";

/**
 * ReachInternational Multi-Layer Performance Architecture
 * Standardized Cache Tags & Tag Generators
 */
export const TAGS = {
  // Class A: Static / Reference Data
  categories: "categories",
  manufacturers: "manufacturers",
  branches: "branches",
  departments: "departments",
  documentTypes: "document-types",
  settings: "system-settings",

  // Class B: Semi-Dynamic Directories & Catalogs
  machines: "machines",
  machinesList: "machines:list",
  machinesKpis: "machines:kpis",
  machinesMeta: "machines-meta",
  machinesBranch: (branchId: string) => `machines:branch:${branchId}`,
  machineDetail: (id: string) => `machine:${id}`,

  clients: "clients",
  clientsList: "clients:list",
  clientsKpis: "clients:kpis",
  clientsLocations: "clients:locations",
  clientsBranch: (branchId: string) => `clients:branch:${branchId}`,
  clientDetail: (id: string) => `client:${id}`,

  vendors: "vendors",
  vendorsBranch: (branchId: string) => `vendors:branch:${branchId}`,
  vendorDetail: (id: string) => `vendor:${id}`,

  inventoryProducts: "inventory-products",
  inventoryStockBranch: (branchId: string) => `inventory:branch:${branchId}`,

  employees: "employees",
  employeesBranch: (branchId: string) => `employees:branch:${branchId}`,

  // Class C: Operational Data
  dashboard: "dashboard",
  dashboardKpis: "dashboard:kpis",
  dashboardCharts: "dashboard:charts",
  dashboardDueLists: "dashboard:due-lists",
  dashboardActivity: "dashboard:activity",
  userDashboard: (userId: string) => `dashboard:user:${userId}`,
  dashboardSuperAdmin: (userId: string) => `dashboard:super_admin:${userId}`,
  dashboardAdmin: (userId: string) => `dashboard:admin:${userId}`,
  dashboardManager: (userId: string) => `dashboard:manager:${userId}`,
  dashboardSupervisor: (userId: string) => `dashboard:supervisor:${userId}`,
  dashboardHR: (userId: string) => `dashboard:hr:${userId}`,
  dashboardOperator: (userId: string) => `dashboard:operator:${userId}`,

  services: "services",
  machineServices: (machineId: string) => `machine-services:${machineId}`,

  complaints: "complaints",
  machineComplaints: (machineId: string) => `machine-complaints:${machineId}`,

  purchaseOrders: "purchase-orders",
  purchaseOrdersBranch: (branchId: string) => `purchase-orders:branch:${branchId}`,

  challans: "challans",
  challansBranch: (branchId: string) => `challans:branch:${branchId}`,

  documents: "documents",
  documentsBranch: (branchId: string) => `documents:branch:${branchId}`,

  hourLogs: "hour-logs",
  machineHourLogs: (machineId: string) => `hour-logs:machine:${machineId}`,
  operatorHourLogs: (operatorId: string) => `hour-logs:operator:${operatorId}`,

  assignments: "assignments",
  operatorAssignment: (operatorId: string) => `assignment:operator:${operatorId}`,
  machineAssignment: (machineId: string) => `assignment:machine:${machineId}`,

  // Operations Domain (Canonical)
  operations: "operations",
  operationsLogs: "operations:logs",
  operationsAssignments: "operations:assignments",
  operationsFilters: "operations:filters",
  operationsSummaries: "operations:summaries",
  operationLogDetail: (id: string) => `operations:log-detail:${id}`,
  operationAssignmentDetail: (id: string) => `operations:assignment-detail:${id}`,
  clientOperations: (clientId: string) => `operations:client:${clientId}`,
  machineOperations: (machineId: string) => `operations:machine:${machineId}`,
  operatorOperations: (operatorId: string) => `operations:operator:${operatorId}`,

  // Attendance Domain
  attendance: "attendance",
  attendanceSummary: (yearMonth: string) => `attendance:summary:${yearMonth}`,
  attendanceDetail: (userId: string, yearMonth: string) => `attendance:detail:${userId}:${yearMonth}`,

  // Class D / User Scoped
  users: "users",
} as const;

export type TagName = string;
