import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";

export interface AttendanceDayEntry {
  id: string;
  machine_id: string;
  machine_code?: string;
  machine_name?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
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
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "WEEK_OFF" | "DISABLED";
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  log_count: number;
  punch_in?: string | null;
  punch_out?: string | null;
  entries: AttendanceDayEntry[];
}

export interface AttendanceWeekdayRollup {
  dow: number;
  total_days: number;
  present_days: number;
  absent_days: number;
  half_days: number;
  week_offs: number;
  disabled_days?: number;
  avg_worked_minutes: number;
}

export interface AttendanceDetailSummary {
  presentDays: number;
  absentDays: number;
  halfDays: number;
  weekOffs: number;
  disabledDays?: number;
  totalWorkedMinutes: number;
  totalOtMinutes: number;
  totalBreakdownMinutes: number;
}

export interface AttendanceDetailEmployee {
  id: string;
  employee_id?: string | null;
  full_name: string;
  email?: string | null;
  phone: string | null;
  role: string;
  city: string | null;
  district?: string | null;
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
 * Resilient direct table query fallback when RPC get_attendance_daily_detail is unavailable,
 * outdated, or returns an error.
 */
async function fetchAttendanceDetailFallback(
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceDetailResult> {
  const supabase = createSupabaseAdminClient();

  // 1. Fetch employee profile from public.users with safe default
  let employee: AttendanceDetailEmployee = {
    id: employeeId,
    employee_id: `EMP-${employeeId.slice(0, 8).toUpperCase()}`,
    full_name: "Operator",
    email: null,
    phone: null,
    role: "operator",
    city: null,
    district: null,
    state: null,
    shift_start_time: "06:00:00",
    shift_end_time: "14:00:00",
  };

  try {
    const { data: userData } = await supabase
      .from("users")
      .select("id, employee_id, full_name, email, phone, role, city, district, state, shift_start_time, shift_end_time")
      .eq("id", employeeId)
      .maybeSingle();

    if (userData) {
      employee = {
        id: userData.id,
        employee_id: userData.employee_id || `EMP-${userData.id.slice(0, 8).toUpperCase()}`,
        full_name: userData.full_name || "Operator",
        email: userData.email || null,
        phone: userData.phone || null,
        role: userData.role || "operator",
        city: userData.city || null,
        district: userData.district || null,
        state: userData.state || null,
        shift_start_time: userData.shift_start_time || "06:00:00",
        shift_end_time: userData.shift_end_time || "14:00:00",
      };
    }
  } catch (err) {
    console.warn("[attendance-detail] Fallback user profile lookup warning:", err);
  }

  // 2. Compute date boundaries for month
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  // 3. Fetch machine hour logs for the operator
  let logs: any[] = [];
  try {
    const { data: logData, error: logError } = await supabase
      .from("machine_hour_logs")
      .select(`
        id,
        machine_id,
        log_date,
        start_time,
        end_time,
        start_meter,
        end_meter,
        running_hours,
        normal_working_hours,
        overtime_hours,
        breakdown_hours,
        breakdown_minutes,
        is_breakdown,
        location,
        remarks,
        machines (
          id,
          machine_id,
          machine_name,
          model,
          serial_number,
          manufacturer
        )
      `)
      .eq("operator_id", employeeId)
      .gte("log_date", monthStart)
      .lte("log_date", monthEnd)
      .order("start_time", { ascending: true });

    if (!logError && logData) {
      logs = logData;
    }
  } catch (err) {
    console.warn("[attendance-detail] Fallback logs lookup warning:", err);
  }

  // 4. Map logs by date
  const logsByDate = new Map<string, any[]>();
  for (const log of logs) {
    const d = log.log_date;
    if (!logsByDate.has(d)) {
      logsByDate.set(d, []);
    }
    logsByDate.get(d)!.push(log);
  }

  // 5. Authoritative Indian date string (YYYY-MM-DD) for past/future determination
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const days: AttendanceDay[] = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const dayDate = new Date(year, month - 1, dayNum);
    const dow = dayDate.getDay(); // 0 = Sunday

    const dayLogs = logsByDate.get(dateStr) || [];
    const logCount = dayLogs.length;

    let punchIn: string | null = null;
    let punchOut: string | null = null;
    let workedMinutes = 0;
    let normalMinutes = 0;
    let overtimeMinutes = 0;
    let breakdownMinutes = 0;

    const entries: AttendanceDayEntry[] = dayLogs.map((l) => {
      const runningH = Number(l.running_hours) || 0;
      const normalH = Number(l.normal_working_hours) || 0;
      const otH = Number(l.overtime_hours) || 0;
      const bdH = Number(l.breakdown_hours) || 0;
      const bdM = Number(l.breakdown_minutes) || Math.round(bdH * 60);

      // Operator shift working hours: lunch & normal work included = total shift work hours (NOT machine running hours HMR)
      const effectiveNormalH = normalH > 0 ? normalH : 8.0;

      workedMinutes += Math.round(effectiveNormalH * 60);
      normalMinutes += Math.round(effectiveNormalH * 60);
      overtimeMinutes += Math.round(otH * 60);
      breakdownMinutes += bdM;

      const mach = l.machines;
      return {
        id: l.id,
        machine_id: l.machine_id,
        machine_code: mach?.machine_id || "",
        machine_name: mach?.machine_name || "",
        model: mach?.model || "",
        serial_number: mach?.serial_number || "",
        manufacturer: mach?.manufacturer || "",
        start_time: l.start_time,
        end_time: l.end_time,
        start_meter: Number(l.start_meter) || 0,
        end_meter: Number(l.end_meter) || 0,
        running_hours: runningH,
        normal_working_hours: effectiveNormalH,
        overtime_hours: otH,
        is_breakdown: !!l.is_breakdown,
        location: l.location || null,
      };
    });

    if (dayLogs.length > 0) {
      const starts = dayLogs.map((l) => l.start_time).filter(Boolean).sort();
      const ends = dayLogs.map((l) => l.end_time).filter(Boolean).sort();
      if (starts.length > 0) punchIn = starts[0];
      if (ends.length > 0) punchOut = ends[ends.length - 1];
    }

    let status: AttendanceDay["status"] = "ABSENT";
    if (dow === 0) {
      status = "WEEK_OFF";
    } else if (logCount === 0 && dateStr >= today) {
      status = "DISABLED";
    } else if (logCount === 0) {
      status = "ABSENT";
    } else if (normalMinutes >= 240) {
      status = "PRESENT";
    } else if (normalMinutes > 0) {
      status = "HALF_DAY";
    } else {
      status = "ABSENT";
    }

    days.push({
      date: dateStr,
      dow,
      status,
      worked_minutes: workedMinutes,
      overtime_minutes: overtimeMinutes,
      breakdown_minutes: breakdownMinutes,
      log_count: logCount,
      punch_in: punchIn,
      punch_out: punchOut,
      entries,
    });
  }

  // 6. Day-of-week rollups (0 to 6)
  const weekdayRollup: AttendanceWeekdayRollup[] = [0, 1, 2, 3, 4, 5, 6].map((targetDow) => {
    const dowDays = days.filter((d) => d.dow === targetDow);
    const total_days = dowDays.length;
    const present_days = dowDays.filter((d) => d.status === "PRESENT").length;
    const absent_days = dowDays.filter((d) => d.status === "ABSENT" && d.date < today).length;
    const half_days = dowDays.filter((d) => d.status === "HALF_DAY").length;
    const week_offs = dowDays.filter((d) => d.status === "WEEK_OFF").length;
    const disabled_days = dowDays.filter((d) => d.status === "DISABLED").length;

    const workedDays = dowDays.filter((d) => d.status !== "WEEK_OFF" && d.status !== "DISABLED");
    const avg_worked_minutes = workedDays.length > 0
      ? Math.round(workedDays.reduce((acc, d) => acc + d.worked_minutes, 0) / workedDays.length)
      : 0;

    return {
      dow: targetDow,
      total_days,
      present_days,
      absent_days,
      half_days,
      week_offs,
      disabled_days,
      avg_worked_minutes,
    };
  });

  // 7. Monthly Summary KPIs
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let weekOffs = 0;
  let disabledDays = 0;
  let totalWorkedMinutes = 0;
  let totalOtMinutes = 0;
  let totalBreakdownMinutes = 0;

  for (const d of days) {
    if (d.status === "PRESENT") presentDays++;
    else if (d.status === "HALF_DAY") halfDays++;
    else if (d.status === "WEEK_OFF") weekOffs++;
    else if (d.status === "DISABLED") disabledDays++;
    else if (d.status === "ABSENT" && d.date < today) absentDays++;

    if (d.status !== "DISABLED") {
      totalWorkedMinutes += d.worked_minutes;
      totalOtMinutes += d.overtime_minutes;
      totalBreakdownMinutes += d.breakdown_minutes;
    }
  }

  const summary: AttendanceDetailSummary = {
    presentDays,
    absentDays,
    halfDays,
    weekOffs,
    disabledDays,
    totalWorkedMinutes,
    totalOtMinutes,
    totalBreakdownMinutes,
  };

  return {
    employee,
    year,
    month,
    days,
    weekdayRollup,
    summary,
  };
}

/**
 * Fetches daily attendance detail for a single employee in a given month.
 * Wraps get_attendance_daily_detail RPC with 60s TTL cache and resilient direct table query fallback.
 */
export async function getAttendanceDetail(
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceDetailResult> {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const fetcher = async (): Promise<AttendanceDetailResult> => {
    // 1. Try primary high-performance RPC
    try {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase.rpc("get_attendance_daily_detail", {
        p_employee_id: employeeId,
        p_year: year,
        p_month: month,
      });

      if (!error && data && typeof data === "object" && !("error" in data) && Array.isArray((data as any).days)) {
        return data as unknown as AttendanceDetailResult;
      }

      console.warn(
        "[getAttendanceDetail] Primary RPC failed or returned error payload, engaging resilient table fallback:",
        error?.message || (data as any)?.error
      );
    } catch (rpcErr) {
      console.warn("[getAttendanceDetail] Primary RPC threw exception, engaging resilient table fallback:", rpcErr);
    }

    // 2. Resilient direct database query fallback
    try {
      return await fetchAttendanceDetailFallback(employeeId, year, month);
    } catch (fallbackErr) {
      console.error("[getAttendanceDetail] Fallback query failed, returning safe empty matrix:", fallbackErr);
      return {
        employee: {
          id: employeeId,
          employee_id: `EMP-${employeeId.slice(0, 8).toUpperCase()}`,
          full_name: "Operator",
          email: null,
          phone: null,
          role: "operator",
          city: null,
          district: null,
          state: null,
          shift_start_time: "06:00:00",
          shift_end_time: "14:00:00",
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
  };

  return unstable_cache(
    fetcher,
    [`attendance-detail-${employeeId}-${yearMonth}`],
    { revalidate: 60, tags: [TAGS.attendance, TAGS.attendanceDetail(employeeId, yearMonth)] }
  )();
}
