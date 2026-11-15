import type { ApplicationStatus } from "@reachinternational/types";

/**
 * Strict state transition matrix for Job Applications.
 * Terminal states (hired, rejected, withdrawn) have no outgoing transitions.
 */
export const APPLICATION_TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  new: ["screening", "shortlisted", "rejected", "withdrawn"],
  screening: ["shortlisted", "interview", "rejected", "withdrawn"],
  shortlisted: ["interview", "offered", "rejected", "withdrawn"],
  interview: ["shortlisted", "offered", "rejected", "withdrawn"],
  offered: ["hired", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
} as const;

/**
 * Returns allowed next statuses from current status.
 */
export function getAllowedApplicationTransitions(
  current: ApplicationStatus
): readonly ApplicationStatus[] {
  return APPLICATION_TRANSITIONS[current] ?? [];
}

/**
 * Checks whether transitioning from `from` to `to` is permitted.
 */
export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
  _role?: string
): boolean {
  if (from === to) return false;
  const allowed = APPLICATION_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
