import type { UserRole } from "@reachinternational/types";

/**
 * Canonical machine capability codes.
 *
 * These are the ONLY capability strings used by the Web and Native Machines
 * modules. UI rendering, server actions, API routes, route guards and the
 * database migration comments all derive from this file.
 */
export const MACHINE_CAPABILITIES = {
  /** Route access + read of the machine record in scope. */
  VIEW: "machine.view",
  /** Fleet directory, KPIs, search and filters (scope still applies). */
  FLEET_VIEW: "machine.fleet_view",
  /** Add machine. */
  CREATE: "machine.create",
  /** Edit static specs: model, serial_number, manufacturer, year_of_mfg, machine_id. */
  EDIT_SPECS: "machine.edit_specs",
  /** Bulk import. */
  IMPORT: "machine.import",
  /** Delete machine. */
  DELETE: "machine.delete",
  /** Assign/change supervisors. */
  ASSIGN_SUPERVISOR: "machine.assign_supervisor",
  /** Update HMR, health status, rental status. */
  STATUS_UPDATE: "machine.status_update",
  /** Assign/unassign operators and shifts. */
  ASSIGN_OPERATOR: "machine.assign_operator",
  /** Assign client (rented status). */
  ASSIGN_CLIENT: "machine.assign_client",
  /** View commercial rental rates. */
  RENTAL_RATES_VIEW: "machine.rental_rates_view",
  /** Machine Audit tab. */
  AUDIT_VIEW: "machine.audit_view",
  /** Export Excel, CSV, PDF. */
  EXPORT: "machine.export",
  /** Dedicated assigned-machine operator view. */
  OPERATOR_VIEW: "machine.operator_view",
} as const;

export type MachineCapability =
  (typeof MACHINE_CAPABILITIES)[keyof typeof MACHINE_CAPABILITIES];

/** Machine access scope for the current role. */
export type MachineScope = "all" | "supervised" | "assigned" | "none";

// `machine.operator_view` is a UI mode, not a fleet permission: it selects the
// assigned-machine-only screen. It must never be granted to the manager tier,
// otherwise /machines renders the operator view (and its 0-or-1 row scope) for
// admins. Operator view is determined by role/scope, not by this capability.
const FLEET_CAPABILITIES: readonly MachineCapability[] = Object.values(
  MACHINE_CAPABILITIES
).filter((capability) => capability !== MACHINE_CAPABILITIES.OPERATOR_VIEW);

const MANAGER_TIER: readonly MachineCapability[] = FLEET_CAPABILITIES;

const SUPERVISOR_CAPABILITIES: readonly MachineCapability[] = [
  MACHINE_CAPABILITIES.VIEW,
  MACHINE_CAPABILITIES.FLEET_VIEW,
  MACHINE_CAPABILITIES.STATUS_UPDATE,
  MACHINE_CAPABILITIES.ASSIGN_OPERATOR,
  MACHINE_CAPABILITIES.ASSIGN_CLIENT,
  MACHINE_CAPABILITIES.AUDIT_VIEW,
  MACHINE_CAPABILITIES.EXPORT,
];

const OPERATOR_CAPABILITIES: readonly MachineCapability[] = [
  MACHINE_CAPABILITIES.VIEW,
  MACHINE_CAPABILITIES.OPERATOR_VIEW,
];

/**
 * Role → capability matrix.
 *
 * "confirm" cells from the shared matrix were resolved as:
 *   supervisor fleet/KPIs/search = supervised scope only (scope, not a capability)
 *   supervisor assign client     = YES
 *   supervisor rental rates      = NO
 *   supervisor audit tab         = YES
 *   supervisor export            = YES (supervised scope only)
 *   HR                           = no machine access at all
 */
export const MACHINE_ROLE_CAPABILITIES: Record<UserRole, readonly MachineCapability[]> = {
  super_admin: FLEET_CAPABILITIES,
  admin: MANAGER_TIER,
  manager: MANAGER_TIER,
  supervisor: SUPERVISOR_CAPABILITIES,
  hr: [],
  operator: OPERATOR_CAPABILITIES,
  sales: [],
  marketing: [],
};

/**
 * Normalizes DB/API role strings ("Site Supervisor", "super-admin", ...) into
 * a known role key. Unknown roles resolve to an empty string (deny by default).
 */
export function normalizeMachineRole(
  role?: string | null
): UserRole | "" {
  if (!role) return "";
  const clean = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (clean === "site_supervisor") return "supervisor";
  if (clean in MACHINE_ROLE_CAPABILITIES) return clean as UserRole;
  return "";
}

/**
 * Returns every capability granted to a role. Unknown roles get none.
 * A fresh array is returned so callers cannot mutate the matrix.
 */
export function getMachineCapabilities(
  role?: string | null
): MachineCapability[] {
  const normalized = normalizeMachineRole(role);
  if (!normalized) return [];
  if (normalized === "super_admin") return [...FLEET_CAPABILITIES];
  return [...MACHINE_ROLE_CAPABILITIES[normalized]];
}

/** Single capability check. Deny-by-default for unknown roles/capabilities. */
export function hasMachineCapability(
  role: string | null | undefined,
  capability: string
): boolean {
  const normalized = normalizeMachineRole(role);
  if (!normalized) return false;
  if (normalized === "super_admin") {
    return FLEET_CAPABILITIES.includes(capability as MachineCapability);
  }
  const granted = MACHINE_ROLE_CAPABILITIES[normalized];
  return granted.includes(capability as MachineCapability);
}

/** True when the role may open /machines (operator gets the assigned-only view). */
export function canAccessMachinesRoute(role?: string | null): boolean {
  return hasMachineCapability(role, MACHINE_CAPABILITIES.VIEW);
}

/** True for the dedicated assigned-machine operator view. */
export function isOperatorMachineView(role?: string | null): boolean {
  return normalizeMachineRole(role) === "operator";
}

/**
 * Machine record scope for a role:
 *   all        → manager tier
 *   supervised → supervisor (client allocation or direct assignment)
 *   assigned   → operator (active effective-dated assignment)
 *   none       → HR, sales, marketing, unknown
 */
export function getMachineScope(role?: string | null): MachineScope {
  const normalized = normalizeMachineRole(role);
  if (!normalized) return "none";
  if (normalized === "super_admin" || normalized === "admin" || normalized === "manager") {
    return "all";
  }
  if (normalized === "supervisor") return "supervised";
  if (normalized === "operator") return "assigned";
  return "none";
}

/** Error code used by server actions/API routes when a capability is missing. */
export const MACHINE_FORBIDDEN_CODE = "MACHINE_FORBIDDEN" as const;
