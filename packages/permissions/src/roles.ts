import type { UserRole } from "@reachinternational/types";

export const CANONICAL_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "supervisor",
  "hr",
  "operator",
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
  manager: {
    code: "manager",
    name: "Manager",
    description: "Operations, fleet, client contracts, and business management.",
    category: "management",
  },
  supervisor: {
    code: "supervisor",
    name: "Site Supervisor",
    description: "On-site machine log approvals and operator assignments.",
    category: "field",
  },
  hr: {
    code: "hr",
    name: "HR",
    description: "Human resources, employee onboarding, documents, and directory management.",
    category: "hr",
  },
  operator: {
    code: "operator",
    name: "Machine Operator",
    description: "Daily hour meter logging and breakdown complaint reporting.",
    category: "field",
  },
};

/**
 * Checks whether a given role is Manager tier or above (super_admin, admin, manager).
 */
export function isManagerOrAbove(role?: string | null): boolean {
  if (!role) return false;
  return (
    role === "super_admin" ||
    role === "admin" ||
    role === "manager"
  );
}

/**
 * Checks whether a given role requires a supervisor to be selected/assigned:
 * - operator
 */
export function isSupervisedRole(role?: string | null): boolean {
  if (!role) return false;
  return role === "operator";
}

