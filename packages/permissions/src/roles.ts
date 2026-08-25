import type { UserRole } from "@reachinternational/types";

export const CANONICAL_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "service_manager",
  "engineer",
  "service_engineer",
  "supervisor",
  "store_manager",
  "operator",
  "mechanic",
  "hr_manager",
  "finance_manager",
  "sales_executive",
  "rental_manager",
];

export interface RoleMetadata {
  code: UserRole;
  name: string;
  description: string;
  category: "admin" | "management" | "field" | "operations" | "finance" | "sales" | "hr";
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  super_admin: {
    code: "super_admin",
    name: "Super Admin",
    description: "Full system control across all organizations and modules.",
    category: "admin",
  },
  admin: {
    code: "admin",
    name: "System Admin",
    description: "Organization-wide administrative access.",
    category: "admin",
  },
  service_manager: {
    code: "service_manager",
    name: "Service Manager",
    description: "Service scheduling, breakdown complaint management, FSR review.",
    category: "management",
  },
  service_engineer: {
    code: "service_engineer",
    name: "Service Engineer",
    description: "Field maintenance, service record creation, and digital FSR submit.",
    category: "field",
  },
  engineer: {
    code: "engineer",
    name: "Field Engineer",
    description: "Field technical service & inspection.",
    category: "field",
  },
  supervisor: {
    code: "supervisor",
    name: "Site Supervisor",
    description: "On-site machine log approvals and operator assignments.",
    category: "field",
  },
  store_manager: {
    code: "store_manager",
    name: "Store Manager",
    description: "Inventory stock control, goods receipts, part issues, and POs.",
    category: "operations",
  },
  operator: {
    code: "operator",
    name: "Machine Operator",
    description: "Daily hour meter logging and breakdown complaint reporting.",
    category: "field",
  },
  mechanic: {
    code: "mechanic",
    name: "Workshop Mechanic",
    description: "Machine maintenance, parts requests, and repair logs.",
    category: "field",
  },
  hr_manager: {
    code: "hr_manager",
    name: "HR Manager",
    description: "Employee onboarding, salary management, and document tracking.",
    category: "hr",
  },
  finance_manager: {
    code: "finance_manager",
    name: "Finance Manager",
    description: "Invoicing, payment processing, expense approvals, and 3-way match.",
    category: "finance",
  },
  sales_executive: {
    code: "sales_executive",
    name: "Sales Executive",
    description: "CRM leads, quotations, opportunities, and sales order processing.",
    category: "sales",
  },
  rental_manager: {
    code: "rental_manager",
    name: "Rental Manager",
    description: "Rental agreements, fleet dispatch, damage reports, and return inspection.",
    category: "operations",
  },
};
