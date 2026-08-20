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
  machinesMeta: "machines-meta",
  machinesBranch: (branchId: string) => `machines:branch:${branchId}`,
  machineDetail: (id: string) => `machine:${id}`,

  clients: "clients",
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

  // Class D / User Scoped
  users: "users",
  notifications: "notifications",
  userNotifications: (userId: string) => `notifications:user:${userId}`,
} as const;

export type TagName = string;
