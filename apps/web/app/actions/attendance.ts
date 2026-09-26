"use server";

import { requireRole } from "@/lib/dal";
import { getAttendanceSummary, type AttendanceSummaryResult } from "@/lib/data/attendance/attendance-summary";
import { getAttendanceDetail, type AttendanceDetailResult } from "@/lib/data/attendance/attendance-detail";

const ALLOWED_ROLES = ["super_admin", "admin", "hr"] as const;

/**
 * Server action: Get paginated attendance summary for a month.
 */
export async function getAttendanceSummaryAction(
  year: number,
  month: number,
  filters?: {
    role?: string | null;
    search?: string | null;
    status?: string | null;
    overtime?: string | null;
    state?: string | null;
    sortBy?: string | null;
    page?: number;
    pageSize?: number;
  }
): Promise<AttendanceSummaryResult> {
  await requireRole(...ALLOWED_ROLES);

  return getAttendanceSummary({
    year,
    month,
    role: filters?.role,
    search: filters?.search,
    status: filters?.status,
    overtime: filters?.overtime,
    state: filters?.state,
    sortBy: filters?.sortBy,
    page: filters?.page || 1,
    pageSize: filters?.pageSize || 25,
  });
}

/**
 * Server action: Get daily attendance detail for a single employee.
 */
export async function getAttendanceDetailAction(
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceDetailResult> {
  await requireRole(...ALLOWED_ROLES);

  if (!employeeId || typeof employeeId !== "string") {
    throw new Error("Invalid employee ID");
  }

  return getAttendanceDetail(employeeId, year, month);
}

/**
 * Server action: Get full (unpaginated) attendance summary for export.
 */
export async function getAttendanceExportAction(
  year: number,
  month: number,
  filters?: {
    role?: string | null;
    search?: string | null;
    status?: string | null;
    overtime?: string | null;
    state?: string | null;
    sortBy?: string | null;
  }
): Promise<AttendanceSummaryResult> {
  await requireRole(...ALLOWED_ROLES);

  return getAttendanceSummary({
    year,
    month,
    role: filters?.role,
    search: filters?.search,
    status: filters?.status,
    overtime: filters?.overtime,
    state: filters?.state,
    sortBy: filters?.sortBy,
    page: 1,
    pageSize: 10000, // ponytail: large enough for export, not infinity
  });
}
