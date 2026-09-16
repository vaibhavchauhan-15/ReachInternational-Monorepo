"use server";

import { getCurrentUser, requirePermission } from "@/lib/dal";
import {
  getAuditLogsFiltered,
  type AuditLogFilterParams,
  type AuditLogQueryResult,
} from "@/lib/queries/audit-logs";

export interface PaginatedAuditLogsResponse {
  success: boolean;
  data?: AuditLogQueryResult;
  error?: string;
}

/**
 * Server Action: Fetch paginated and filtered audit logs on demand.
 * Enables smooth mobile infinite scroll chunk-by-chunk loading.
 */
export async function getPaginatedAuditLogsAction(
  params: AuditLogFilterParams = {}
): Promise<PaginatedAuditLogsResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    await requirePermission("audit.view");

    const result = await getAuditLogsFiltered(params);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getPaginatedAuditLogsAction] Exception:", err);
    return {
      success: false,
      error: err?.message || "Failed to load audit logs.",
    };
  }
}
