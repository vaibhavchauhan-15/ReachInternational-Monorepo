import type { UserRole } from "@reachinternational/types";

const CANONICAL_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "supervisor",
  "hr",
  "operator",
];

export type ApprovalAction = "submit" | "view" | "decide";

export interface ApprovalPermissionSubject {
  id: string;
  role?: UserRole | string | null;
}

export interface ApprovalTargetSubject {
  id?: string | null;
  role?: UserRole | string | null;
}

function normalizeRole(role?: string | null): UserRole | "" {
  if (!role) return "";
  const clean = role.toLowerCase().trim().replace(/[\s-]/g, "_");
  return CANONICAL_ROLES.includes(clean as UserRole) ? (clean as UserRole) : "";
}

/**
 * Base matrix defining allowed roles for each approval type.
 * Queue review and decision rights are restricted strictly to admin users.
 */
export const APPROVAL_TYPE_ROLES: Record<
  string,
  {
    submit: UserRole[];
    view: UserRole[];
    decide: UserRole[];
  }
> = {
  profile_change: {
    submit: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
    view: ["super_admin", "admin"],
    decide: ["super_admin", "admin"],
  },
  registration: {
    submit: ["super_admin", "admin", "hr", "operator"],
    view: ["super_admin", "admin"],
    decide: ["super_admin", "admin"],
  },
  document_verify: {
    submit: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
    view: ["super_admin", "admin"],
    decide: ["super_admin", "admin"],
  },
  document_replace: {
    submit: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
    view: ["super_admin", "admin"],
    decide: ["super_admin", "admin"],
  },
  account_deletion: {
    submit: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
    view: ["super_admin", "admin"],
    decide: ["super_admin", "admin"],
  },
  shift_conflict: {
    submit: ["operator", "supervisor"],
    view: ["super_admin", "admin"],
    decide: ["super_admin", "admin"],
  },
};

/**
 * Checks whether a role can submit a request of a given approval type.
 */
export function canSubmitApproval(
  role: UserRole | string | null | undefined,
  typeKey: string
): boolean {
  const norm = normalizeRole(role);
  if (!norm) return false;
  const config = APPROVAL_TYPE_ROLES[typeKey];
  if (!config) return false;
  return config.submit.includes(norm);
}

/**
 * Checks whether a user can view an approval request.
 * - Requesters can always view their own request.
 * - Target users can view their own request.
 * - Queue inspection is restricted strictly to admin users (super_admin, admin).
 */
export function canViewApproval(
  viewer: ApprovalPermissionSubject | null | undefined,
  target: ApprovalTargetSubject | null | undefined,
  typeKey: string,
  isRequester?: boolean
): boolean {
  if (!viewer?.id) return false;
  if (isRequester || (target?.id && viewer.id === target.id)) {
    return true;
  }

  const role = normalizeRole(viewer.role);
  if (!role) return false;

  // Super admin and admin can view all requests
  return role === "super_admin" || role === "admin";
}

/**
 * Checks whether a user can decide (approve/reject) an approval request.
 * Restricted strictly to admin users (super_admin, admin).
 * Enforces role hierarchy:
 * - Super admin can decide for all roles.
 * - Admin cannot decide super_admin requests.
 * - Non-admin roles (manager, supervisor, hr, operator) cannot decide.
 * - Self-approval is blocked by default unless allowSelfApprove is true.
 */
export function canDecideApproval(
  approver: ApprovalPermissionSubject | null | undefined,
  target: ApprovalTargetSubject | null | undefined,
  typeKey: string,
  allowSelfApprove = false
): boolean {
  if (!approver?.id) return false;

  // Prevent self-approval if disallowed
  if (!allowSelfApprove && target?.id && approver.id === target.id) {
    return false;
  }

  const approverRole = normalizeRole(approver.role);
  if (!approverRole) return false;

  // Strictly admin users can decide
  if (approverRole !== "super_admin" && approverRole !== "admin") {
    return false;
  }

  const config = APPROVAL_TYPE_ROLES[typeKey];
  if (!config) return false;

  // Check if role is in deciders list
  if (!config.decide.includes(approverRole)) {
    return false;
  }

  // Hierarchy check on target user role: admin cannot decide super_admin requests
  const targetRole = normalizeRole(target?.role);
  if (targetRole && approverRole === "admin") {
    return targetRole !== "super_admin";
  }

  return true;
}

/**
 * Returns all approval type keys that a given role is authorized to decide.
 */
export function getDecidableApprovalTypesForRole(
  role: UserRole | string | null | undefined
): string[] {
  const norm = normalizeRole(role);
  if (!norm) return [];

  const result: string[] = [];
  for (const [key, config] of Object.entries(APPROVAL_TYPE_ROLES)) {
    if (config.decide.includes(norm)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Checks whether a user can cancel a request.
 * Only the requester can cancel their own pending request.
 */
export function canCancelApproval(
  requesterId: string | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!requesterId || !userId) return false;
  return requesterId === userId;
}
