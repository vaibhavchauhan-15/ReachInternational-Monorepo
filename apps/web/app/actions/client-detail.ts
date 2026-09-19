"use server";

import {
  getClientDetail,
  getClientSummary,
  getClientDetailLocation,
  getClientMachines,
  getClientRunningLogs,
  getClientAssignments,
  getClientHistory,
  getClientAuditLogs,
} from "@/lib/data/clients";
import { getCurrentUser } from "@/lib/dal";

const AUTHORIZED_ROLES = ["super_admin", "admin", "manager", "supervisor"] as const;

function isAuthorized(role?: string): boolean {
  if (!role) return false;
  return AUTHORIZED_ROLES.includes(role as any);
}

export async function getClientDetailAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return null;
  return getClientDetail(id);
}

export async function getClientSummaryAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return null;
  return getClientSummary(id);
}

export async function getClientLocationAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return null;
  return getClientDetailLocation(id);
}

export async function getClientMachinesAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return [];
  return getClientMachines(id);
}

export async function getClientRunningLogsAction(id: string, limit = 20) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return [];
  return getClientRunningLogs(id, limit);
}

export async function getClientAssignmentsAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return [];
  return getClientAssignments(id);
}

export async function getClientHistoryAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return [];
  return getClientHistory(id);
}

export async function getClientAuditLogsAction(id: string, limit = 30) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user.role)) return [];
  return getClientAuditLogs(id, limit);
}
