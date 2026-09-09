import type { UserRole, PermissionScope } from "@reachinternational/types";

/**
 * Maps each user role to their default permission scope level
 */
export const ROLE_DEFAULT_SCOPES: Record<UserRole, PermissionScope> = {
  super_admin: "ORGANIZATION",
  admin: "ORGANIZATION",
  manager: "ORGANIZATION",
  hr_manager: "ORGANIZATION",
  service_manager: "ORGANIZATION",
  store_manager: "ORGANIZATION",
  service_engineer: "ASSIGNED",
  engineer: "ASSIGNED",
  supervisor: "ORGANIZATION",
  mechanic: "ASSIGNED",
  operator: "ASSIGNED",
};

/**
 * Scope hierarchy ordering
 */
export const SCOPE_HIERARCHY: Record<PermissionScope, number> = {
  ORGANIZATION: 5,
  REGION: 4,
  DEPARTMENT: 2,
  WAREHOUSE: 2,
  ASSIGNED: 1,
  SELF: 0,
};

/**
 * Responsibility Fallback Matrix for dynamic workflow routing when branch positions are unstaffed.
 */
export function resolveApproverFallback(
  functionType: "hr" | "procurement" | "finance" | "service",
  hasBranchStaff: boolean
): string {
  if (hasBranchStaff) {
    return "Branch Manager";
  }

  switch (functionType) {
    case "hr":
      return "Central HR Team";
    case "procurement":
      return "Central Procurement Manager";
    case "finance":
      return "Central Finance Team";
    case "service":
      return "Regional Service Manager";
    default:
      return "Regional Manager";
  }
}

/**
 * Checks whether a given role can access a target scope
 */
export function canAccessScope(
  userRole: UserRole,
  requiredScope: PermissionScope
): boolean {
  if (userRole === "super_admin" || userRole === "admin") return true;

  const userScope = ROLE_DEFAULT_SCOPES[userRole];
  return SCOPE_HIERARCHY[userScope] >= SCOPE_HIERARCHY[requiredScope];
}

import { roleHasPermission } from "./matrix";

/**
 * Roles that supervisors are permitted to view and oversee.
 */
export const SUPERVISOR_VISIBLE_USER_ROLES = [
  "operator",
  "mechanic",
  "service_engineer",
  "engineer",
] as const;

export type SupervisorVisibleUserRole = (typeof SUPERVISOR_VISIBLE_USER_ROLES)[number];

export function canViewUsers(role?: string | null): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, "user.view");
}

export function canCreateUser(role?: string | null): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, "user.create");
}

export function canUpdateUser(role?: string | null): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, "user.edit");
}

export function canDeleteUser(role?: string | null): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, "user.delete");
}

export function canActivateUser(role?: string | null): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, "user.activate");
}

export function canAssignSupervisor(role?: string | null): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, "user.assign_supervisor");
}

export function canBulkMutateUsers(role?: string | null): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, "user.bulk_manage");
}

export function getUserDataScope(role?: string | null): 
  | { kind: "ALL" }
  | { kind: "ASSIGNED"; roles: readonly string[] } {
  if (role === "supervisor") {
    return { kind: "ASSIGNED", roles: SUPERVISOR_VISIBLE_USER_ROLES };
  }
  return { kind: "ALL" };
}
