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
