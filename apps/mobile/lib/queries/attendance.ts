import { supabase } from '../supabase';

export interface AttendanceDayEntry {
  id: string;
  machine_id: string;
  machine_code?: string;
  machine_name?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  shift_code?: string | null;
  start_time: string | null;
  end_time: string | null;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  normal_working_hours: number;
  overtime_hours: number;
  is_breakdown: boolean;
  location: string | null;
}

export interface AttendanceDay {
  date: string;
  dow: number;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED';
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  log_count: number;
  punch_in?: string | null;
  punch_out?: string | null;
  entries: AttendanceDayEntry[];
}

export interface AttendanceDetailData {
  employee: {
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
  };
  year?: number;
  month?: number;
  page?: number;
  pageSize?: number;
  totalDays?: number;
  hasMore?: boolean;
  days: AttendanceDay[];
  summary: {
    presentDays: number;
    absentDays: number;
    halfDays: number;
    weekOffs: number;
    disabledDays?: number;
    totalWorkedMinutes: number;
    totalOtMinutes: number;
    totalBreakdownMinutes: number;
  };
  weekdayRollup?: any[];
}

/**
 * Resilient direct table query fallback when get_attendance_daily_detail RPC
 * encounters network timeouts, schema mismatches, or database errors.
 */
export async function fetchAttendanceDetailFallback(
  employeeId: string,
  year: number,
  month: number,
  page: number = 1,
  pageSize: number = 31
): Promise<AttendanceDetailData> {
  // 1. Fetch employee profile from public.users with safe default
  let employee: AttendanceDetailData['employee'] = {
    id: employeeId,
    employee_id: `EMP-${employeeId.slice(0, 8).toUpperCase()}`,
    full_name: 'Operator',
    email: null,
    phone: null,
    role: 'operator',
    city: null,
    district: null,
    state: null,
    shift_start_time: '06:00:00',
    shift_end_time: '14:00:00',
  };

  try {
    const { data: userData } = await supabase
      .from('users')
      .select('id, employee_id, full_name, email, phone, role, city, district, state, shift_start_time, shift_end_time')
      .eq('id', employeeId)
      .maybeSingle();

    if (userData) {
      employee = {
        id: userData.id,
        employee_id: userData.employee_id || `EMP-${userData.id.slice(0, 8).toUpperCase()}`,
        full_name: userData.full_name || 'Operator',
        email: userData.email || null,
        phone: userData.phone || null,
        role: userData.role || 'operator',
        city: userData.city || null,
        district: userData.district || null,
        state: userData.state || null,
        shift_start_time: userData.shift_start_time || '06:00:00',
        shift_end_time: userData.shift_end_time || '14:00:00',
      };
    }
  } catch (err) {
    console.warn('[attendance-detail] Fallback user profile lookup warning:', err);
  }

  // 2. Date boundaries for selected month
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  // 3. Fetch machine hour logs for the operator
  let logs: any[] = [];
  try {
    const { data: logData, error: logError } = await supabase
      .from('machine_hour_logs')
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
        shift_code,
        location,
        remarks,
        machines:machine_id (
          id,
          machine_id,
          machine_name,
          model,
          serial_number,
          manufacturer
        )
      `)
      .eq('operator_id', employeeId)
      .gte('log_date', monthStart)
      .lte('log_date', monthEnd)
      .order('start_time', { ascending: true });

    if (!logError && logData) {
      logs = logData;
    }
  } catch (err) {
    console.warn('[attendance-detail] Fallback logs lookup warning:', err);
  }

  // 4. Map logs by log_date
  const logsByDate = new Map<string, any[]>();
  for (const log of logs) {
    const d = log.log_date;
    if (!logsByDate.has(d)) {
      logsByDate.set(d, []);
    }
    logsByDate.get(d)!.push(log);
  }

  // 5. Authoritative Indian date string (YYYY-MM-DD) for past/future determination
  let today = new Date().toISOString().slice(0, 10);
  try {
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {}

  const days: AttendanceDay[] = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
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

      // Total shift work hours: default 8 hours when normal work hours logged
      const effectiveNormalH = normalH > 0 ? normalH : 8.0;

      workedMinutes += Math.round(effectiveNormalH * 60);
      normalMinutes += Math.round(effectiveNormalH * 60);
      overtimeMinutes += Math.round(otH * 60);
      breakdownMinutes += bdM;

      const mach = l.machines;
      return {
        id: l.id,
        machine_id: l.machine_id,
        machine_code: mach?.machine_id || '',
        machine_name: mach?.machine_name || mach?.model || '',
        model: mach?.model || '',
        serial_number: mach?.serial_number || '',
        manufacturer: mach?.manufacturer || '',
        start_time: l.start_time,
        end_time: l.end_time,
        start_meter: Number(l.start_meter) || 0,
        end_meter: Number(l.end_meter) || 0,
        running_hours: runningH,
        normal_working_hours: effectiveNormalH,
        overtime_hours: otH,
        is_breakdown: !!l.is_breakdown,
        location: l.location || null,
        shift_code: l.shift_code || null,
      };
    });

    if (dayLogs.length > 0) {
      const starts = dayLogs.map((l) => l.start_time).filter(Boolean).sort();
      const ends = dayLogs.map((l) => l.end_time).filter(Boolean).sort();
      if (starts.length > 0) punchIn = starts[0];
      if (ends.length > 0) punchOut = ends[ends.length - 1];
    }

    let status: AttendanceDay['status'] = 'ABSENT';
    if (normalMinutes >= 240) {
      status = 'PRESENT';
    } else if (normalMinutes > 0) {
      status = 'HALF_DAY';
    } else if (dow === 0) {
      status = 'WEEK_OFF';
    } else if (logCount === 0 && dateStr >= today) {
      status = 'DISABLED';
    } else {
      status = 'ABSENT';
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

  // 6. Monthly Summary KPIs
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let weekOffs = 0;
  let totalWorkedMinutes = 0;
  let totalOtMinutes = 0;
  let totalBreakdownMinutes = 0;

  for (const d of days) {
    if (d.status === 'PRESENT') presentDays++;
    else if (d.status === 'HALF_DAY') halfDays++;
    else if (d.status === 'WEEK_OFF') weekOffs++;
    else if (d.status === 'ABSENT' && d.date < today) absentDays++;

    if (d.status !== 'DISABLED') {
      totalWorkedMinutes += d.worked_minutes;
      totalOtMinutes += d.overtime_minutes;
      totalBreakdownMinutes += d.breakdown_minutes;
    }
  }

  const summary = {
    presentDays,
    absentDays,
    halfDays,
    weekOffs,
    totalWorkedMinutes,
    totalOtMinutes,
    totalBreakdownMinutes,
  };

  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(60, pageSize));
  const offset = (safePage - 1) * safePageSize;
  const pagedDays = days.slice(offset, offset + safePageSize);

  return {
    employee,
    year,
    month,
    page: safePage,
    pageSize: safePageSize,
    totalDays: days.length,
    hasMore: safePage * safePageSize < days.length,
    days: pagedDays,
    summary,
  };
}

/**
 * High-performance, dual-tier attendance detail fetcher:
 * Tier 1: Calls PostgreSQL RPC `get_attendance_daily_detail`.
 * Tier 2: Resilient direct database query fallback if RPC fails or is unavailable.
 */
export async function getAttendanceDailyDetail(
  employeeId: string,
  year: number,
  month: number,
  page: number = 1,
  pageSize: number = 31
): Promise<AttendanceDetailData> {
  // 1. Primary: PostgreSQL RPC
  try {
    const { data, error } = await supabase.rpc('get_attendance_daily_detail', {
      p_employee_id: employeeId,
      p_year: year,
      p_month: month,
      p_page: page,
      p_page_size: pageSize,
    });

    if (!error && data && typeof data === 'object' && !('error' in (data as any)) && Array.isArray((data as any).days)) {
      return data as unknown as AttendanceDetailData;
    }

    console.warn(
      '[getAttendanceDailyDetail] Primary RPC failed or returned error, engaging resilient fallback:',
      error?.message || (data as any)?.error
    );
  } catch (rpcErr) {
    console.warn('[getAttendanceDailyDetail] Primary RPC threw exception, engaging resilient fallback:', rpcErr);
  }

  // 2. Secondary: Resilient direct query fallback
  return fetchAttendanceDetailFallback(employeeId, year, month, page, pageSize);
}
