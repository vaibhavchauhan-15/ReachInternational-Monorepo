import "server-only";
import { redirect } from "next/navigation";
import {
  MACHINE_CAPABILITIES,
  MACHINE_FORBIDDEN_CODE,
  canAccessMachinesRoute,
  getMachineCapabilities,
  getMachineScope,
  getRoleHomeRoute,
  hasMachineCapability,
  MACHINE_ROLE_CAPABILITIES,
  type MachineCapability,
  type MachineScope,
} from "@reachinternational/permissions";
import type { UserRole } from "@reachinternational/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import type { User } from "@/lib/types/database";

export { MACHINE_CAPABILITIES, MACHINE_FORBIDDEN_CODE, canAccessMachinesRoute };
export type { MachineCapability, MachineScope };

export interface MachineAuthorization {
  role: UserRole;
  /** Capabilities granted by @reachinternational/permissions. */
  capabilities: readonly MachineCapability[];
  /** Machine record scope (all / supervised / assigned / none). */
  scope: MachineScope;
  can: (capability: MachineCapability | string) => boolean;
}

/** Builds the single authorization object used by pages, actions and API routes. */
export function getMachineAuthorization(role: UserRole): MachineAuthorization {
  const capabilities = getMachineCapabilities(role);
  return {
    role,
    capabilities,
    scope: getMachineScope(role),
    can: (capability) => hasMachineCapability(role, capability),
  };
}

/** Thrown by requireMachineCapability; mapped to HTTP 403 / action code by callers. */
export class MachineForbiddenError extends Error {
  readonly code = MACHINE_FORBIDDEN_CODE;
  readonly status = 403;
  readonly capability: string;

  constructor(capability: string, message?: string) {
    super(message || "Forbidden: your role does not grant this machine capability.");
    this.name = "MachineForbiddenError";
    this.capability = capability;
  }
}

export function isMachineForbiddenError(error: unknown): error is MachineForbiddenError {
  return (
    error instanceof MachineForbiddenError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === MACHINE_FORBIDDEN_CODE)
  );
}

/**
 * Action-level guard. Unlike requireRole(), this never redirects: server actions
 * and API routes must answer with a 403-class result, not a login/home redirect.
 */
export async function requireMachineCapability(
  capability: MachineCapability | string
): Promise<{ user: User; auth: MachineAuthorization }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new MachineForbiddenError(capability, "Unauthorized: authentication required.");
  }
  const auth = getMachineAuthorization(user.role);
  if (!auth.can(capability)) {
    throw new MachineForbiddenError(
      capability,
      "Forbidden: your account role does not have authorization for this machine action."
    );
  }
  return { user, auth };
}

/** Page guard: unauthenticated → /login; roles without machine access → role home. */
export async function requireMachinesPageAccess(): Promise<{
  user: User;
  auth: MachineAuthorization;
}> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.status !== "active") {
    redirect("/login");
  }
  if (!canAccessMachinesRoute(user.role)) {
    redirect(getRoleHomeRoute(user.role));
  }
  return { user, auth: getMachineAuthorization(user.role) };
}

/**
 * Record-level scope check backed by the database predicate
 * `check_user_can_access_machine` (migration 231), so RLS, SQL RPCs and the app
 * layer agree on one definition of "supervised" / "actively assigned".
 *
 * Manager tier passes without a database roundtrip.
 */
export async function canAccessMachineRecord(
  user: Pick<User, "id" | "role">,
  machineId: string
): Promise<boolean> {
  const auth = getMachineAuthorization(user.role);
  if (auth.scope === "all") return true;
  if (auth.scope === "none") return false;
  if (!machineId) return false;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("check_user_can_access_machine", {
    p_machine_id: machineId,
    p_user_id: user.id,
  });
  if (error) {
    console.error("[machines auth] access predicate failed:", error.message);
    return false;
  }
  return data === true;
}

/** Throws MachineForbiddenError unless the caller can access this machine record. */
export async function requireMachineRecordAccess(
  user: Pick<User, "id" | "role">,
  machineId: string
): Promise<void> {
  const allowed = await canAccessMachineRecord(user, machineId);
  if (!allowed) {
    throw new MachineForbiddenError(
      MACHINE_CAPABILITIES.VIEW,
      "Forbidden: this machine is outside your assigned or supervised scope."
    );
  }
}

/** Standard action result for a blocked capability. */
export function machineForbiddenResult(error?: unknown): {
  success: false;
  error: string;
  code: typeof MACHINE_FORBIDDEN_CODE;
  status: 403;
} {
  return {
    success: false,
    error:
      error instanceof Error && error.message
        ? error.message
        : "Forbidden: your account role does not have authorization for this machine action.",
    code: MACHINE_FORBIDDEN_CODE,
    status: 403,
  };
}

/** Test/DI helper: capability matrix for a role without touching the session. */
export function capabilitiesForRole(role: UserRole): readonly MachineCapability[] {
  return MACHINE_ROLE_CAPABILITIES[role] ?? [];
}
