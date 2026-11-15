import type { UserRole } from "@reachinternational/types";

export type ProfileRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export const PROFILE_REQUEST_TRANSITIONS: Readonly<Record<ProfileRequestStatus, readonly ProfileRequestStatus[]>> = {
  pending: ["approved", "rejected", "cancelled"],
  approved: [],
  rejected: [],
  cancelled: [],
} as const;

export function canTransitionProfileRequest(
  from: ProfileRequestStatus,
  to: ProfileRequestStatus
): boolean {
  if (from === to) return false;
  const allowed = PROFILE_REQUEST_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function canApproveProfileChange(
  approverRole: UserRole,
  requesterRole: UserRole
): boolean {
  if (approverRole === "super_admin") return true;
  if (approverRole === "admin") {
    return requesterRole !== "super_admin" && requesterRole !== "admin";
  }
  if (["manager", "hr"].includes(approverRole)) {
    return !["super_admin", "admin", "manager", "hr"].includes(requesterRole);
  }
  return false;
}
