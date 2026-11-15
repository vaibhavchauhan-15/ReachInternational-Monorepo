import type { JobStatus } from "@reachinternational/types";

/**
 * Strict state transition matrix for Job Postings.
 * draft -> published, closed, archived
 * published -> draft (unpublish), closed, archived
 * closed -> published (reopen), archived
 * archived -> terminal (no transitions)
 */
export const JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  draft: ["published", "closed", "archived"],
  published: ["draft", "closed", "archived"],
  closed: ["published", "archived"],
  archived: [],
} as const;

/**
 * Returns allowed next statuses from current status.
 */
export function getAllowedJobTransitions(
  current: JobStatus
): readonly JobStatus[] {
  return JOB_TRANSITIONS[current] ?? [];
}

/**
 * Checks whether transitioning from `from` to `to` is permitted.
 */
export function canTransitionJob(
  from: JobStatus,
  to: JobStatus
): boolean {
  if (from === to) return false;
  const allowed = JOB_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
