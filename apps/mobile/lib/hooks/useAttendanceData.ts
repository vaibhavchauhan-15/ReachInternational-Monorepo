/**
 * Native Mobile Attendance Server State & Business Logic Hook
 * Encapsulates TanStack Query caching, monthly queries, and filtering for Operator Shift Attendance.
 */

import { useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import {
  getAttendanceDailyDetail,
  type AttendanceDetailData,
  type AttendanceDay,
} from '../queries/attendance';

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
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY';
}

export interface AttendanceKpis {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  totalWorkedMinutes: number;
  totalOtMinutes: number;
}

export interface UseAttendanceDataOptions {
  month: string; // "YYYY-MM"
  searchQuery?: string;
  statusFilter?: string; // 'all' | 'PRESENT' | 'ABSENT' | 'HALF_DAY'
  overtimeFilter?: string; // 'all' | 'with_ot' | 'no_ot'
  stateFilter?: string;
  sortBy?: string;
  enabled?: boolean;
}

export function useAttendanceData({
  month,
  searchQuery = '',
  statusFilter = 'all',
  overtimeFilter = 'all',
  stateFilter = 'all',
  sortBy = 'name_asc',
  enabled = true,
}: UseAttendanceDataOptions) {
  const targetDate = `${month}-01`;

  // 1. Fetch Monthly Attendance via RPC or fallback
  const {
    data: attendanceResult = { rows: [], scheduledDays: 30 },
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['attendance', month],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const [yStr, mStr] = month.split('-');
      const pYear = parseInt(yStr, 10) || new Date().getFullYear();
      const pMonth = parseInt(mStr, 10) || (new Date().getMonth() + 1);

      const { data, error: rpcErr } = await supabase.rpc('get_attendance_monthly_summary', {
        p_year: pYear,
        p_month: pMonth,
        p_page: 1,
        p_page_size: 200,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Failed to fetch attendance data');
      }

      const rows: AttendanceEmployee[] = Array.isArray(data)
        ? data
        : (data && Array.isArray((data as any).rows) ? (data as any).rows : []);

      return {
        rows,
        scheduledDays: (data && !Array.isArray(data) && (data as any).scheduledDays) || 30,
      };
    },
  });

  const allRows = attendanceResult.rows;

  // 2. Filter & Sort Attendance Rows
  const filteredRows = useMemo(() => {
    let result = [...allRows];
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      result = result.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.employee_id.toLowerCase().includes(q) ||
          (r.phone && r.phone.includes(q)) ||
          (r.city && r.city.toLowerCase().includes(q)) ||
          (r.state && r.state.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (overtimeFilter === 'with_ot') {
      result = result.filter((r) => (r.overtime_minutes || 0) > 0);
    } else if (overtimeFilter === 'no_ot') {
      result = result.filter((r) => (r.overtime_minutes || 0) === 0);
    }

    if (stateFilter !== 'all') {
      result = result.filter((r) => r.state === stateFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.full_name.localeCompare(b.full_name);
        case 'name_desc':
          return b.full_name.localeCompare(a.full_name);
        case 'highest_present':
          return (b.present_days || 0) - (a.present_days || 0);
        case 'highest_absent':
          return (b.absent_days || 0) - (a.absent_days || 0);
        case 'highest_ot':
          return (b.overtime_minutes || 0) - (a.overtime_minutes || 0);
        case 'highest_hours':
          return (b.worked_minutes || 0) - (a.worked_minutes || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [allRows, searchQuery, statusFilter, overtimeFilter, stateFilter, sortBy]);

  // 3. Domain KPIs Calculation
  const kpis: AttendanceKpis = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let totalWorkedMinutes = 0;
    let totalOtMinutes = 0;

    for (const r of allRows) {
      if (r.status === 'PRESENT') presentCount++;
      else if (r.status === 'ABSENT') absentCount++;
      else if (r.status === 'HALF_DAY') halfDayCount++;

      totalWorkedMinutes += r.worked_minutes || 0;
      totalOtMinutes += r.overtime_minutes || 0;
    }

    return {
      totalEmployees: allRows.length,
      presentCount,
      absentCount,
      halfDayCount,
      totalWorkedMinutes,
      totalOtMinutes,
    };
  }, [allRows]);

  return {
    allRows,
    rows: filteredRows,
    totalCount: filteredRows.length,
    scheduledDays: attendanceResult.scheduledDays,
    kpis,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
}

export interface UseOperatorAttendanceOptions {
  employeeId?: string | null;
  year: number;
  month: number;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * High-performance operator attendance infinite query with TanStack Query caching.
 * - Paginated server-side daily records (e.g. 10 days per chunk)
 * - Complete monthly summary computed in DB CTE without historical overhead
 * - Scope-aware cache key deduplication
 * - 60s stale time / 10m cache retention for instant month navigation
 */
export function useOperatorAttendanceInfiniteQuery({
  employeeId,
  year,
  month,
  pageSize = 10,
  enabled = true,
}: UseOperatorAttendanceOptions) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const query = useInfiniteQuery<AttendanceDetailData, Error>({
    queryKey: ['attendance', 'detail', employeeId, monthStr, pageSize],
    enabled: Boolean(enabled && employeeId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage?.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    queryFn: async ({ pageParam = 1 }) => {
      if (!employeeId) throw new Error('Employee ID required for attendance detail');
      return getAttendanceDailyDetail(employeeId, year, month, pageParam as number, pageSize);
    },
  });

  const days: AttendanceDay[] = useMemo(() => {
    if (!query.data?.pages) return [];
    return query.data.pages.flatMap((page) => page.days || []);
  }, [query.data?.pages]);

  const summary = query.data?.pages?.[0]?.summary || null;
  const employee = query.data?.pages?.[0]?.employee || null;
  const totalDays = query.data?.pages?.[0]?.totalDays || days.length;
  const hasMore = query.data?.pages?.[query.data.pages.length - 1]?.hasMore ?? false;

  return {
    ...query,
    days,
    summary,
    employee,
    totalDays,
    hasMore,
    isEmpty: !query.isLoading && days.length === 0,
  };
}

export interface UseAttendanceDetailQueryOptions {
  employeeId?: string | null;
  year: number;
  month: number;
  enabled?: boolean;
}

/**
 * Dedicated cached query for employee detail modals (managers / supervisors / admins).
 */
export function useAttendanceDetailQuery({
  employeeId,
  year,
  month,
  enabled = true,
}: UseAttendanceDetailQueryOptions) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  return useQuery({
    queryKey: ['attendance', 'detail-full', employeeId, monthStr],
    enabled: Boolean(enabled && employeeId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!employeeId) throw new Error('Employee ID required for attendance detail');
      return getAttendanceDailyDetail(employeeId, year, month, 1, 31);
    },
  });
}

