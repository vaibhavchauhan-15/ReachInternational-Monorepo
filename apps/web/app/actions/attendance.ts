"use server";

import { requireRole, getCurrentUser } from "@/lib/dal";
import { getAttendanceSummary, type AttendanceSummaryResult } from "@/lib/data/attendance/attendance-summary";
import { getAttendanceDetail, type AttendanceDetailResult } from "@/lib/data/attendance/attendance-detail";

import { resolveUserId } from "@/lib/data/users";

const ALLOWED_ADMIN_ROLES = ["super_admin", "admin", "hr", "manager", "supervisor"] as const;
const ALLOWED_SUMMARY_ROLES = ["super_admin", "admin", "hr", "manager", "supervisor"] as const;

/**
 * Server action: Get paginated attendance summary for a month.
 * Strictly restricted to management roles (super_admin, admin, hr, manager, supervisor).
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
  await requireRole(...ALLOWED_SUMMARY_ROLES);

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
 * - Operators can STRICTLY ONLY access their own attendance records.
 * - Managers, supervisors, HR, and admins can view employee attendance.
 */
export async function getAttendanceDetailAction(
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceDetailResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("Unauthorized: Session required");
  }

  if (!employeeId || typeof employeeId !== "string") {
    throw new Error("Invalid employee ID");
  }

  const resolvedId = (await resolveUserId(employeeId.trim())) || employeeId.trim();
  const normalizedRole = (currentUser.role || "").toLowerCase().trim();

  // Strict RBAC: Operators can only access their own attendance!
  if (normalizedRole === "operator") {
    if (resolvedId.toLowerCase() !== currentUser.id.toLowerCase()) {
      throw new Error("Forbidden: Operators can only access their own attendance records.");
    }
  } else if (!ALLOWED_ADMIN_ROLES.includes(normalizedRole as (typeof ALLOWED_ADMIN_ROLES)[number])) {
    throw new Error("Unauthorized: Attendance access denied.");
  }

  return getAttendanceDetail(resolvedId, year, month);
}

/**
 * Server action: Get full (unpaginated) attendance summary for export.
 * Strictly restricted to management roles (super_admin, admin, hr, manager).
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
  await requireRole(...ALLOWED_SUMMARY_ROLES);

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
