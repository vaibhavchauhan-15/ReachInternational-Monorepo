"use server";

import {
  getLogSummary,
  getLogDetails,
  getLogHistory,
  getLogAssignments,
  getLogAudit,
} from "@/lib/data/operations";
import { getCurrentUser } from "@/lib/dal";

/**
 * PHASE 14 — Details Architecture Server Actions
 *
 * Dedicated, independent, authenticated server actions for the 5 log detail tabs:
 * - getLogSummaryAction
 * - getLogDetailsAction
 * - getLogHistoryAction
 * - getLogAssignmentsAction
 * - getLogAuditAction
 *
 * Each action enforces authentication and calls only its respective DAL query.
 */

export async function getLogSummaryAction(logId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return getLogSummary(logId);
}

export async function getLogDetailsAction(logId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return getLogDetails(logId);
}

export async function getLogHistoryAction(logId: string, limit = 10) {
  const user = await getCurrentUser();
  if (!user) return [];
  return getLogHistory(logId, limit);
}

export async function getLogAssignmentsAction(logId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  return getLogAssignments(logId);
}

export async function getLogAuditAction(logId: string, limit = 20) {
  const user = await getCurrentUser();
  if (!user) return [];
  return getLogAudit(logId, limit);
}
