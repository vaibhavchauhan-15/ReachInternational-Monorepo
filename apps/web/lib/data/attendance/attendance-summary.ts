import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";

export interface AttendanceEmployee {
  employee_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  city: string | null;
  state: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  scheduled_days: number;
  present_days: number;
  half_days: number;
  absent_days: number;
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  status: "PRESENT" | "ABSENT" | "HALF_DAY";
}

export interface AttendanceKpis {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  totalWorkedMinutes: number;
  totalOtMinutes: number;
}

export interface AttendanceSummaryResult {
  rows: AttendanceEmployee[];
  total: number;
  page: number;
  pageSize: number;
  scheduledDays: number;
  kpis: AttendanceKpis;
}

interface AttendanceSummaryParams {
  year: number;
  month: number;
  role?: string | null;
  search?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
}

/**
 * Fetches paginated attendance summary for a given month.
 * Wraps get_attendance_monthly_summary RPC with 45s TTL cache.
 */
export async function getAttendanceSummary(
  params: AttendanceSummaryParams
): Promise<AttendanceSummaryResult> {
  const { year, month, role, search, status, page = 1, pageSize = 25 } = params;
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const fetcher = async () => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_attendance_monthly_summary", {
      p_year: year,
      p_month: month,
      p_role: role || null,
      p_search: search || null,
      p_status: status || null,
      p_page: page,
      p_page_size: pageSize,
    });

    if (error) {
      console.error("[getAttendanceSummary] RPC error:", error);
      throw new Error(error.message || "Failed to load attendance summary");
    }

    return (data as unknown as AttendanceSummaryResult) || {
      rows: [],
      total: 0,
      page,
      pageSize,
      scheduledDays: 0,
      kpis: { totalEmployees: 0, presentCount: 0, absentCount: 0, halfDayCount: 0, totalWorkedMinutes: 0, totalOtMinutes: 0 },
    };
  };

  // ponytail: 45s TTL, same tolerance as operations logs
  return unstable_cache(
    fetcher,
    [`attendance-summary-${yearMonth}-${page}-${pageSize}-${role || ""}-${search || ""}-${status || ""}`],
    { revalidate: 45, tags: [TAGS.attendance, TAGS.attendanceSummary(yearMonth)] }
  )();
}
