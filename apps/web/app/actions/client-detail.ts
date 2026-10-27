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
  checkSupervisorClientAccess,
} from "@/lib/data/clients";
import { getCurrentUser } from "@/lib/dal";

const AUTHORIZED_ROLES = ["super_admin", "admin", "manager", "supervisor"] as const;

async function checkAccess(clientId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !user.role) return false;
  if (!AUTHORIZED_ROLES.includes(user.role as any)) return false;
  if (user.role === "supervisor") {
    return checkSupervisorClientAccess(clientId, user.id);
  }
  return true;
}

export async function getClientDetailAction(id: string) {
  if (!(await checkAccess(id))) return null;
  return getClientDetail(id);
}

export async function getClientSummaryAction(id: string) {
  if (!(await checkAccess(id))) return null;
  return getClientSummary(id);
}

export async function getClientLocationAction(id: string) {
  if (!(await checkAccess(id))) return null;
  return getClientDetailLocation(id);
}

export async function getClientMachinesAction(id: string) {
  if (!(await checkAccess(id))) return [];
  return getClientMachines(id);
}

export async function getClientRunningLogsAction(id: string, limit = 20) {
  if (!(await checkAccess(id))) return [];
  return getClientRunningLogs(id, limit);
}

export async function getClientAssignmentsAction(id: string) {
  if (!(await checkAccess(id))) return [];
  return getClientAssignments(id);
}

export async function getClientHistoryAction(id: string) {
  if (!(await checkAccess(id))) return [];
  return getClientHistory(id);
}

export async function getClientAuditLogsAction(id: string, limit = 30) {
  if (!(await checkAccess(id))) return [];
  return getClientAuditLogs(id, limit);
}

