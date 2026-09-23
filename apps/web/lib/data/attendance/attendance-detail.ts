import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";

export interface AttendanceDayEntry {
  id: string;
  machine_id: string;
  start_time: string | null;
  end_time: string | null;
  start_meter: number;
  end_meter: number;
  running_hours: number;
  normal_working_hours: number;
  overtime_hours: number;
  is_breakdown: boolean;
  location: string | null;
}

export interface AttendanceDay {
  date: string;
  dow: number;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "WEEK_OFF";
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  log_count: number;
  entries: AttendanceDayEntry[];
}

export interface AttendanceWeekdayRollup {
  dow: number;
  total_days: number;
  present_days: number;
  absent_days: number;
  half_days: number;
  week_offs: number;
  avg_worked_minutes: number;
}

export interface AttendanceDetailSummary {
  presentDays: number;
  absentDays: number;
  halfDays: number;
  weekOffs: number;
  totalWorkedMinutes: number;
  totalOtMinutes: number;
  totalBreakdownMinutes: number;
}

export interface AttendanceDetailEmployee {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  city: string | null;
  state: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
}

export interface AttendanceDetailResult {
  employee: AttendanceDetailEmployee;
  year: number;
  month: number;
  days: AttendanceDay[];
  weekdayRollup: AttendanceWeekdayRollup[];
  summary: AttendanceDetailSummary;
}

/**
 * Fetches daily attendance detail for a single employee in a given month.
 * Wraps get_attendance_daily_detail RPC with 60s TTL cache.
 */
export async function getAttendanceDetail(
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceDetailResult> {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const fetcher = async () => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_attendance_daily_detail", {
      p_employee_id: employeeId,
      p_year: year,
      p_month: month,
    });

    if (error) {
      console.error("[getAttendanceDetail] RPC error:", error);
      throw new Error(error.message || "Failed to load attendance detail");
    }

    return data as unknown as AttendanceDetailResult;
  };

  return unstable_cache(
    fetcher,
    [`attendance-detail-${employeeId}-${yearMonth}`],
    { revalidate: 60, tags: [TAGS.attendance, TAGS.attendanceDetail(employeeId, yearMonth)] }
  )();
}
