import { redirect } from "next/navigation";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { getAttendanceSummary, type AttendanceSummaryResult } from "@/lib/data/attendance/attendance-summary";
import { getAttendanceDetail, type AttendanceDetailResult } from "@/lib/data/attendance/attendance-detail";
import { AttendanceClient } from "./AttendanceClient";
import { AttendanceDetailClient } from "./[userId]/AttendanceDetailClient";

export const metadata = {
  title: "Attendance | ReachInternational",
  description: "Monthly operator attendance tracking derived from machine operation logs.",
};

interface AttendancePageProps {
  searchParams?: Promise<{
    month?: string;
    page?: string;
    status?: string;
    search?: string;
    overtime?: string;
    state?: string;
    sortBy?: string;
  }>;
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : {};
  const normalizedRole = (user.role || "").toLowerCase().trim();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Parse month param: "2026-09" → { year: 2026, month: 9 }
  let year = currentYear;
  let month = currentMonth;
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m;
  }
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // Strict RBAC & Zero-Redirect Self Rendering:
  // Operators can STRICTLY ONLY view their own attendance record.
  // Directly render AttendanceDetailClient for the operator right on /attendance.
  // This eliminates redirect chains, avoids router bounces to /dashboard,
  // and keeps the Attendance sidebar nav link active.
  if (normalizedRole === "operator") {
    let initialData: AttendanceDetailResult;
    let loadError: string | null = null;
    try {
      initialData = await getAttendanceDetail(user.id, year, month);
    } catch (err: unknown) {
      console.error("[AttendancePage] Error loading operator attendance:", err);
      loadError = err instanceof Error ? err.message : "Failed to load live attendance";
      // Guaranteed non-crashing fallback
      initialData = {
        employee: {
          id: user.id,
          employee_id: (user as any).employee_id || `EMP-${user.id.slice(0, 8).toUpperCase()}`,
          full_name: user.full_name || "Operator",
          email: user.email || null,
          phone: user.phone || null,
          role: "operator",
          city: user.city || null,
          district: user.district || null,
          state: user.state || null,
          shift_start_time: user.shift_start_time || "06:00:00",
          shift_end_time: user.shift_end_time || "14:00:00",
        },
        year,
        month,
        days: [],
        weekdayRollup: [],
        summary: {
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          weekOffs: 0,
          disabledDays: 0,
          totalWorkedMinutes: 0,
          totalOtMinutes: 0,
          totalBreakdownMinutes: 0,
        },
      };
    }

    return (
      <AttendanceDetailClient
        data={initialData}
        currentMonth={monthStr}
        userRole={user.role}
        isSelf={true}
        loadError={loadError}
      />
    );
  }

  // Management roles: super_admin, admin, hr, manager, supervisor
  await requireRole("super_admin", "admin", "hr", "manager", "supervisor");

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  let initialData: AttendanceSummaryResult;
  try {
    initialData = await getAttendanceSummary({
      year,
      month,
      status: params.status || null,
      search: params.search || null,
      overtime: params.overtime || null,
      state: params.state || null,
      sortBy: params.sortBy || null,
      page,
      pageSize: 25,
    });
  } catch (err: unknown) {
    console.error("[AttendancePage] Error loading attendance summary:", err);
    initialData = {
      rows: [],
      total: 0,
      page,
      pageSize: 25,
      scheduledDays: 0,
      kpis: {
        totalEmployees: 0,
        presentCount: 0,
        absentCount: 0,
        halfDayCount: 0,
        totalWorkedMinutes: 0,
        totalOtMinutes: 0,
      },
    };
  }

  return (
    <AttendanceClient
      initialData={initialData}
      currentMonth={monthStr}
      currentPage={page}
      userRole={user.role}
    />
  );
}
