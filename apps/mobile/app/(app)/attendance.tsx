import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
  ActivityIndicator} from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from '../../components/ui/touch/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { MobileHeader, Card, Badge, EmptyState, HighlightText, KPICard, KPIGrid, type HeaderActionItem , Text, AppModal, SearchInput, useToast } from '../../components/ui';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { AttendanceListSkeleton, AttendanceDetailSkeleton } from '../../components/attendance';
import { supabase } from '../../lib/supabase';
import { getAttendanceDailyDetail } from '../../lib/queries/attendance';
import {
  CalendarCheck,
  Calendar,
  Search,
  Clock,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  ChevronRight,
  ChevronLeft,
  X,
  Phone,
  MapPin,
  AlertCircle,
  Check,
  Truck,
} from '../../components/ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

const ALLOWED_ROLES = ['super_admin', 'admin', 'hr', 'manager', 'supervisor', 'operator'];

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
  days: AttendanceDay[];
  summary: {
    presentDays: number;
    absentDays: number;
    halfDays: number;
    weekOffs: number;
    totalWorkedMinutes: number;
    totalOtMinutes: number;
    totalBreakdownMinutes: number;
  };
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendanceScreen() {
  const { theme, isDark } = useTheme();
  const { role, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Guard access
  const normalizedRole = (role || '').toLowerCase();
  const isAllowed = ALLOWED_ROLES.includes(normalizedRole);
  const isOperator = normalizedRole === 'operator';

  useEffect(() => {
    if (role && !isAllowed) {
      router.replace('/dashboard');
    }
  }, [role, isAllowed, router]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Persistent search and filter state
  const {
    search: debouncedSearchQuery,
    inputValue: searchQuery,
    setSearch: setSearchQuery,
    filters,
    setFilter,
    resetFilters: resetListFilters,
  } = usePersistentListState<{
    statusFilter: 'all' | 'present' | 'absent' | 'half_day' | 'has_absences' | 'perfect';
  }>({
    storageKey: 'reach_filters_attendance',
    defaultSearch: '',
    defaultFilters: {
      statusFilter: 'all',
    },
    debounceMs: 250,
  });

  const statusFilter = filters.statusFilter;
  const setStatusFilter = useCallback(
    (val: 'all' | 'present' | 'absent' | 'half_day' | 'has_absences' | 'perfect') => setFilter('statusFilter', val),
    [setFilter]
  );

  // Month state (YYYY-MM)
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [kpis, setKpis] = useState<AttendanceKpis>({
    totalEmployees: 0,
    presentCount: 0,
    absentCount: 0,
    halfDayCount: 0,
    totalWorkedMinutes: 0,
    totalOtMinutes: 0,
  });

  // Detail State (Used for both operator direct view and manager modal view)
  const [selectedEmployee, setSelectedEmployee] = useState<AttendanceEmployee | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<AttendanceDetailData | null>(null);

  const fetchAttendance = useCallback(async (y: number, m: number) => {
    try {
      setLoading(true);
      if (normalizedRole === 'operator') {
        if (!user?.id) {
          setLoading(false);
          setRefreshing(false);
          return;
        }
        const data = await getAttendanceDailyDetail(user.id, y, m);
        setDetailData(data);
      } else {
        const { data, error } = await supabase.rpc('get_attendance_monthly_summary', {
          p_year: y,
          p_month: m,
          p_page: 1,
          p_page_size: 200,
        });

        if (error) {
          console.error('[AttendanceScreen] Fetch error:', error);
          toast('error', 'Error', error.message || 'Failed to fetch attendance data');
        } else if (data) {
          setEmployees(data.rows || []);
          if (data.kpis) {
            setKpis(data.kpis);
          }
        }
      }
    } catch (err: any) {
      console.error('[AttendanceScreen] Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizedRole, user?.id, toast]);

  useEffect(() => {
    if (isAllowed) {
      if (normalizedRole === 'operator') {
        if (user?.id) {
          fetchAttendance(year, month);
        }
      } else {
        fetchAttendance(year, month);
      }
    }
  }, [year, month, isAllowed, normalizedRole, user?.id, fetchAttendance]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAttendance(year, month);
  }, [year, month, fetchAttendance]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleOpenDetail = async (emp: AttendanceEmployee) => {
    setSelectedEmployee(emp);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const data = await getAttendanceDailyDetail(emp.employee_id, year, month);
      setDetailData(data);
    } catch (err: any) {
      console.error('[AttendanceDetail] Error:', err);
      toast('error', 'Attendance', 'Unable to load employee detail');
    } finally {
      setDetailLoading(false);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    let list = employees;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const qNorm = q.replace(/\s+/g, "");
      list = list.filter(
        (emp) =>
          emp.full_name.toLowerCase().includes(q) ||
          emp.full_name.toLowerCase().replace(/\s+/g, "").includes(qNorm) ||
          (emp.phone && emp.phone.replace(/[\s+-]/g, "").includes(qNorm)) ||
          (emp.city && emp.city.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'present') {
        list = list.filter((e) => e.present_days > 0 && e.half_days === 0);
      } else if (statusFilter === 'absent') {
        list = list.filter((e) => e.present_days === 0);
      } else if (statusFilter === 'half_day') {
        list = list.filter((e) => e.half_days > 0);
      } else if (statusFilter === 'has_absences') {
        list = list.filter((e) => e.absent_days > 0);
      } else if (statusFilter === 'perfect') {
        list = list.filter((e) => e.absent_days === 0 && e.present_days > 0);
      }
    }
    return list;
  }, [employees, searchQuery, statusFilter]);

  const monthLabel = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [year, month]);

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getInitials = (name: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (t: string | null) => {
    if (!t) return '—';
    const parts = t.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  const formatTimeAMPM = (t: string | null) => {
    if (!t) return '—';
    const parts = t.trim().split(':');
    if (parts.length < 2) return t;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return t;
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const renderStatusBadge = (
    status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED',
    isToday = false
  ) => {
    switch (status) {
      case 'PRESENT':
        return <Badge variant="success" dot size="sm" customLabel="Present" />;
      case 'HALF_DAY':
        return <Badge variant="warning" dot size="sm" customLabel="Half Day" />;
      case 'WEEK_OFF':
        return <Badge variant="neutral" dot size="sm" customLabel="Rest Day" />;
      case 'DISABLED':
        return (
          <Badge
            variant="neutral"
            dot
            size="sm"
            customLabel={isToday ? 'In Progress' : 'Upcoming'}
          />
        );
      case 'ABSENT':
      default:
        return <Badge variant="error" dot size="sm" customLabel="Absent" />;
    }
  };

  const renderDetailBody = (data: AttendanceDetailData) => {
    const emp = data?.employee || {
      id: user?.id || '',
      employee_id: null,
      full_name: (user as any)?.user_metadata?.full_name || (user as any)?.full_name || 'Operator',
      email: user?.email || null,
      phone: (user as any)?.phone || null,
      role: 'operator',
      city: null,
      district: null,
      state: null,
      shift_start_time: '06:00:00',
      shift_end_time: '14:00:00',
    };
    const days = Array.isArray(data?.days) ? data.days : [];
    const summary = data?.summary || {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      weekOffs: 0,
      totalWorkedMinutes: 0,
      totalOtMinutes: 0,
      totalBreakdownMinutes: 0,
    };

    return (
      <View>
        {/* Employee Meta Card (Hidden when operator views their own attendance) */}
        {!isOperator && (
          <View style={[styles.modalEmpCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.modalEmpRow}>
              <View style={styles.modalEmpCol}>
                <Text style={[styles.modalEmpLabel, { color: theme.colors.mute }]}>EMPLOYEE ID</Text>
                <Text style={[styles.modalEmpValue, { color: theme.colors.ink }]}>
                  {emp.employee_id || `EMP-${emp.id.slice(0, 8).toUpperCase()}`}
                </Text>
              </View>
              <View style={styles.modalEmpCol}>
                <Text style={[styles.modalEmpLabel, { color: theme.colors.mute }]}>PHONE</Text>
                <Text style={[styles.modalEmpValue, { color: theme.colors.ink }]} numberOfLines={1}>
                  {emp.phone || '—'}
                </Text>
              </View>
            </View>

            <View style={[styles.modalEmpRow, { marginTop: 8 }]}>
              <View style={styles.modalEmpCol}>
                <Text style={[styles.modalEmpLabel, { color: theme.colors.mute }]}>SITE LOCATION</Text>
                <Text style={[styles.modalEmpValue, { color: theme.colors.ink }]} numberOfLines={1}>
                  {emp.city ? `${emp.city}${emp.state ? `, ${emp.state}` : ''}` : '—'}
                </Text>
              </View>
              <View style={styles.modalEmpCol}>
                <Text style={[styles.modalEmpLabel, { color: theme.colors.mute }]}>SHIFT</Text>
                <Text style={[styles.modalEmpValue, { color: theme.colors.ink }]} numberOfLines={1}>
                  {emp.shift_start_time && emp.shift_end_time
                    ? `${formatTimeAMPM(emp.shift_start_time)} – ${formatTimeAMPM(emp.shift_end_time)}`
                    : '08:00 AM – 05:00 PM'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.detailSummaryRow}>
          <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.detailStatNum, { color: '#16a34a' }]}>{summary.presentDays}</Text>
            <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Present</Text>
          </View>
          <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.detailStatNum, { color: '#dc2626' }]}>{summary.absentDays}</Text>
            <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Absent</Text>
          </View>
          <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.detailStatNum, { color: '#d97706' }]}>{summary.halfDays}</Text>
            <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Half Days</Text>
          </View>
          <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.detailStatNum, { color: '#6b7280' }]}>{summary.weekOffs}</Text>
            <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Week Offs</Text>
          </View>
        </View>

        {/* Total Hours Card */}
        <View style={[styles.hoursSummaryCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <View style={styles.hoursCol}>
            <Text style={[styles.hoursSub, { color: theme.colors.mute }]}>Total Worked</Text>
            <Text style={[styles.hoursMain, { color: theme.colors.ink }]}>
              {formatMins(summary.totalWorkedMinutes)}
            </Text>
          </View>
          <View style={styles.hoursCol}>
            <Text style={[styles.hoursSub, { color: theme.colors.mute }]}>Total Overtime</Text>
            <Text style={[styles.hoursMain, { color: '#2563eb' }]}>
              {formatMins(summary.totalOtMinutes)}
            </Text>
          </View>
        </View>

        {/* Day-by-Day Log List */}
        <Text style={[styles.sectionHeading, { color: theme.colors.ink }]}>Daily Attendance Records</Text>

        {days.map((day) => {
          const [yearStr, monthStr, dayNum] = day.date.split('-');
          const monthIdx = parseInt(monthStr, 10) - 1;
          const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIdx] || '';
          const dowShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.dow] || '';
          const isSunday = day.dow === 0;
          const todayStr = new Date().toISOString().slice(0, 10);
          const isFuture = day.date > todayStr;
          const isToday = day.date === todayStr;
          const hasWorked = day.worked_minutes > 0 || (day.entries && day.entries.length > 0);
          const isTodayNoLog = isToday && !hasWorked;

          // Effective status determination
          const effectiveStatus: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED' =
            hasWorked
              ? (day.status === 'WEEK_OFF' || day.status === 'DISABLED' ? 'PRESENT' : day.status)
              : isSunday
              ? 'WEEK_OFF'
              : (isFuture || isTodayNoLog)
              ? 'DISABLED'
              : day.status;

          const isCardDimmed = (effectiveStatus === 'DISABLED' && !isToday) || (effectiveStatus === 'WEEK_OFF');

          return (
            <View
              key={day.date}
              style={[
                styles.dayCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: isToday ? theme.colors.link : theme.colors.hairline,
                  opacity: isCardDimmed ? 0.75 : 1,
                },
              ]}
            >
              {/* Card Header: Date & Day of Week in ONE line at top, Today Badge, Status Badge */}
              <View
                style={[
                  styles.dayCardHeader,
                  { borderBottomColor: theme.colors.hairline },
                ]}
              >
                <View style={styles.dayCardDateRow}>
                  <Text
                    variant="label"
                    style={{ color: isToday ? theme.colors.link : theme.colors.ink }}
                  >
                    {dayNum} {monthName}
                  </Text>
                  <Text
                    variant="caption"
                    style={{ color: isSunday ? '#ef4444' : theme.colors.mute }}
                  >
                    • {dowShort}{isSunday ? ' (Rest)' : ''}
                  </Text>
                  {isToday && (
                    <Badge variant="default" size="sm" customLabel="TODAY" />
                  )}
                </View>

                {/* Status Badge using React Native Reusable Badge Component */}
                {renderStatusBadge(effectiveStatus, isToday)}
              </View>

              {/* Card Body: Worked Hours, Shift, Machine, Location */}
              {hasWorked ? (
                <View style={styles.dayCardContent}>
                  {/* Hours & Shift Box */}
                  <View
                    style={[
                      styles.dayHoursWell,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.dayPunchesCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} color={theme.colors.mute} />
                        <Text variant="caption" style={{ color: theme.colors.mute }}>
                          SHIFT
                        </Text>
                      </View>
                      <Text variant="small" style={[styles.dayPunchesTime, { color: theme.colors.ink }]}>
                        {day.punch_in && day.punch_out
                          ? `${formatTimeAMPM(day.punch_in)} – ${formatTimeAMPM(day.punch_out)}`
                          : emp.shift_start_time && emp.shift_end_time
                          ? `${formatTimeAMPM(emp.shift_start_time)} – ${formatTimeAMPM(emp.shift_end_time)}`
                          : '06:00 AM – 02:00 PM'}
                      </Text>
                    </View>

                    <View style={styles.dayWorkedCol}>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
                        WORKED
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text variant="small" style={[styles.dayWorkedHours, { color: theme.colors.ink }]}>
                          {formatMins(day.worked_minutes)}
                        </Text>
                        {day.overtime_minutes > 0 && (
                          <Badge
                            variant="warning"
                            size="sm"
                            customLabel={`+${formatMins(day.overtime_minutes)} OT`}
                          />
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Entries (Machinery & Location) */}
                  {day.entries && day.entries.length > 0 && (
                    <View style={styles.dayEntriesStack}>
                      {day.entries.map((entry, idx) => (
                        <View
                          key={entry.id || idx}
                          style={[
                            styles.dayEntryCard,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                              borderColor: theme.colors.hairline,
                            },
                          ]}
                        >
                          <View style={styles.dayEntryRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <Truck size={13} color={theme.colors.link} />
                              <Text variant="small" style={{ color: theme.colors.ink }} numberOfLines={1}>
                                {entry.machine_code || 'Machinery'}
                                {entry.machine_name ? ` • ${entry.machine_name}` : entry.model ? ` • ${entry.model}` : ''}
                              </Text>
                            </View>
                            {entry.shift_code && (
                              <Badge
                                variant="outline"
                                size="sm"
                                customLabel={`Shift ${entry.shift_code}`}
                              />
                            )}
                          </View>

                          <View style={[styles.dayEntryMetaRow, { marginTop: 4 }]}>
                            {entry.location ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                <MapPin size={11} color={theme.colors.mute} />
                                <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                                  {entry.location}
                                </Text>
                              </View>
                            ) : null}

                            {entry.is_breakdown ? (
                              <Badge
                                variant="error"
                                size="sm"
                                customLabel={entry.running_hours ? 'Breakdown' : 'Machine Breakdown'}
                              />
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                /* Non-worked informative message */
                <View
                  style={[
                    styles.dayEmptyStateWell,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    {isSunday
                      ? 'Scheduled Rest Day / Weekend Off'
                      : effectiveStatus === 'ABSENT'
                      ? 'No shift logs submitted for this scheduled workday'
                      : isToday
                      ? 'Shift in progress • No logs submitted yet'
                      : 'Upcoming scheduled working day'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    return [
      {
        id: 'refresh-attendance',
        label: 'Refresh Attendance',
        icon: <RefreshCw size={15} color={theme.colors.ink} loading={refreshing} />,
        onPress: onRefresh,
      },
    ];
  }, [theme.colors.ink, onRefresh, refreshing]);

  if (!isAllowed) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title={isOperator ? 'My Attendance' : 'Attendance'}
        actions={headerActions}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 84 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.ink}
          />
        }
      >
        {/* Month Selector Bar */}
        <View style={[styles.monthBar, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Pressable
            variant="iconButton"
            hitSlopToMin48
            style={styles.monthNavBtn}
            onPress={handlePrevMonth}
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={20} color={theme.colors.ink} />
          </Pressable>

          <View style={styles.monthLabelContainer}>
            <Calendar size={16} color={theme.colors.mute} style={{ marginRight: 6 }} />
            <Text style={[styles.monthLabelText, { color: theme.colors.ink }]}>{monthLabel}</Text>
          </View>

          <Pressable
            variant="iconButton"
            hitSlopToMin48
            style={styles.monthNavBtn}
            onPress={handleNextMonth}
            accessibilityLabel="Next month"
          >
            <ChevronRight size={20} color={theme.colors.ink} />
          </Pressable>
        </View>

        {isOperator ? (
          loading ? (
            <AttendanceDetailSkeleton showMetaCard={false} />
          ) : detailData ? (
            renderDetailBody(detailData)
          ) : (
            <EmptyState
              title="No Attendance Found"
              description="No attendance records found for this month."
            />
          )
        ) : loading && !refreshing ? (
          <AttendanceListSkeleton count={4} showKpi={true} showSearch={true} showFilters={true} />
        ) : (
          <>
            {/* KPI Strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kpiRow}
            >
              <KPICard
                label="Total Operators"
                value={kpis.totalEmployees}
                icon={Users}
                variant="default"
                containerStyle={{ width: 140, flex: 0 }}
              />

              <KPICard
                label="Present"
                value={kpis.presentCount}
                icon={UserCheck}
                variant="success"
                containerStyle={{ width: 140, flex: 0 }}
              />

              <KPICard
                label="Absent"
                value={kpis.absentCount}
                icon={UserX}
                variant={kpis.absentCount > 0 ? 'error' : 'default'}
                containerStyle={{ width: 140, flex: 0 }}
              />

              <KPICard
                label="Half Day"
                value={kpis.halfDayCount}
                icon={Clock}
                variant={kpis.halfDayCount > 0 ? 'warning' : 'default'}
                containerStyle={{ width: 140, flex: 0 }}
              />
            </ScrollView>

            {/* Search Input */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <SearchInput
                value={searchQuery}
                onChangeText={(text) => setSearchQuery(text)}
                onClear={() => setSearchQuery('', true)}
                placeholder="Search operator by name, phone, city..."
                placeholderTextColor={theme.colors.mute}
                autoCapitalize="none"
              />
            </View>

            {/* Status Filter Strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterStrip}
            >
              {(['all', 'present', 'absent', 'half_day', 'has_absences', 'perfect'] as const).map((st) => {
                const active = statusFilter === st;
                const labels: Record<string, string> = {
                  all: `All (${employees.length})`,
                  present: `Present (${kpis.presentCount})`,
                  absent: `Absent (${kpis.absentCount})`,
                  half_day: `Half Day (${kpis.halfDayCount})`,
                  has_absences: `Absences (${employees.filter((e) => e.absent_days > 0).length})`,
                  perfect: `Perfect (${employees.filter((e) => e.absent_days === 0 && e.present_days > 0).length})`,
                };
                return (
                  <Pressable
                    key={st}
                    variant="chip"
                    haptic="select"
                    onPress={() => setStatusFilter(st)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active
                          ? (isDark ? '#262626' : '#171717')
                          : theme.colors.canvasElevated,
                        borderColor: active
                          ? (isDark ? '#525252' : '#171717')
                          : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={[
                        styles.filterChipText,
                        { color: active ? '#ffffff' : theme.colors.ink },
                      ]}
                    >
                      {labels[st]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* List Content */}
            {filteredEmployees.length === 0 ? (
              <EmptyState
                title="No Attendance Found"
                description="No operator records match your filter criteria for this month."
              />
            ) : (
              <View style={styles.cardList}>
                {filteredEmployees.map((emp) => {
                  const initials = getInitials(emp.full_name);
                  return (
                    <Pressable
                      key={emp.employee_id}
                      variant="card"
                      style={[
                        styles.employeeCard,
                        { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                      ]}
                      onPress={() => handleOpenDetail(emp)}
                    >
                      {/* Header Row: Initials Avatar, Name, Role badge */}
                      <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View
                            style={[
                              styles.empAvatar,
                              {
                                backgroundColor: isDark ? '#262626' : '#f4f4f5',
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                          >
                            <Text style={[styles.empAvatarText, { color: theme.colors.ink }]}>
                              {initials}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.nameRow}>
                              <HighlightText
                                text={emp.full_name}
                                query={searchQuery}
                                style={[styles.empName, { color: theme.colors.ink }]}
                                numberOfLines={1}
                              />
                              <Badge variant="outline" size="sm" customLabel="OPERATOR" />
                            </View>

                            <View style={styles.metaRow}>
                              {emp.phone ? (
                                <View style={styles.metaItem}>
                                  <Phone size={11} color={theme.colors.mute} style={{ marginRight: 3 }} />
                                  <HighlightText
                                    text={emp.phone}
                                    query={searchQuery}
                                    style={[styles.metaText, { color: theme.colors.mute }]}
                                  />
                                </View>
                              ) : null}
                              {emp.city ? (
                                <View style={styles.metaItem}>
                                  <MapPin size={11} color={theme.colors.mute} style={{ marginRight: 3 }} />
                                  <HighlightText
                                    text={emp.city}
                                    query={searchQuery}
                                    style={[styles.metaText, { color: theme.colors.mute }]}
                                  />
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Day Counts Strip */}
                      <View style={[styles.statsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                        <View style={styles.statCol}>
                          <Text variant="small" style={[styles.statVal, { color: theme.colors.ink }]}>{emp.scheduled_days}</Text>
                          <Text variant="caption" style={[styles.statLbl, { color: theme.colors.mute }]}>Scheduled</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statCol}>
                          <Text variant="small" style={[styles.statVal, { color: '#16a34a' }]}>{Math.min(emp.present_days, emp.scheduled_days)}</Text>
                          <Text variant="caption" style={[styles.statLbl, { color: theme.colors.mute }]}>Present</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statCol}>
                          <Text variant="small" style={[styles.statVal, { color: '#dc2626' }]}>{emp.absent_days}</Text>
                          <Text variant="caption" style={[styles.statLbl, { color: theme.colors.mute }]}>Absent</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statCol}>
                          <Text variant="small" style={[styles.statVal, { color: '#d97706' }]}>{emp.half_days}</Text>
                          <Text variant="caption" style={[styles.statLbl, { color: theme.colors.mute }]}>Half-Day</Text>
                        </View>
                      </View>

                      {/* Hours & Shift Footer */}
                      <View style={styles.cardFooter}>
                        <View style={styles.hoursItem}>
                          <Clock size={13} color={theme.colors.mute} style={{ marginRight: 4 }} />
                          <Text variant="caption" style={[styles.hoursLabel, { color: theme.colors.mute }]}>Worked: </Text>
                          <Text variant="small" style={[styles.hoursValue, { color: theme.colors.ink }]}>
                            {formatMins(emp.worked_minutes)}
                          </Text>
                          {emp.overtime_minutes > 0 ? (
                            <Badge
                              variant="warning"
                              size="sm"
                              customLabel={`+${formatMins(emp.overtime_minutes)} OT`}
                              style={{ marginLeft: 6 }}
                            />
                          ) : null}
                        </View>

                        <View style={styles.viewDetailBtn}>
                          <Text style={styles.viewDetailText}>Daily Cards</Text>
                          <ChevronRight size={14} color="#0070f3" />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Employee Detail / Calendar Modal (Managers & Admins only) */}
      {!isOperator && (
        <AppModal
          visible={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          variant="fullscreen"
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                  {selectedEmployee?.full_name}
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
                  {monthLabel} • Shift: {formatTime(selectedEmployee?.shift_start_time ?? null)} - {formatTime(selectedEmployee?.shift_end_time ?? null)}
                </Text>
              </View>
              <Pressable
                variant="iconButton"
                hitSlopToMin48
                onPress={() => setSelectedEmployee(null)}
                style={styles.closeBtn}
                accessibilityLabel="Close modal"
              >
                <X size={22} color={theme.colors.ink} />
              </Pressable>
            </View>

            {detailLoading ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + 32 },
                ]}
              >
                <AttendanceDetailSkeleton showMetaCard={true} />
              </ScrollView>
            ) : detailData ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + 32 },
                ]}
              >
                {renderDetailBody(detailData)}
              </ScrollView>
            ) : null}
          </View>
        </AppModal>
      )}
    </View>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.md,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  monthNavBtn: {
    padding: 6,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabelText: {  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: spacingNumeric.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  searchInput: {
    flex: 1,    height: 44,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  filterStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: spacingNumeric.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,  },
  cardList: {
    gap: 12,
  },
  employeeCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  empName: {    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {    textTransform: 'uppercase',  },
  empAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: {  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleBadgeText: {  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    marginBottom: 10,
  },
  statCol: {
    alignItems: 'center',
  },
  statVal: {  },
  statLbl: {    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hoursItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hoursLabel: {  },
  hoursValue: {  },
  otBadge: {  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  viewDetailText: {    color: '#0070f3',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {  },
  modalSubtitle: {    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  modalEmpCard: {
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalEmpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalEmpCol: {
    flex: 1,
  },
  modalEmpLabel: {    marginBottom: 2,
  },
  modalEmpValue: {  },
  detailSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  detailStatCard: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  detailStatNum: {  },
  detailStatLabel: {    marginTop: 2,
  },
  hoursSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 20,
  },
  hoursCol: {
    alignItems: 'center',
  },
  hoursSub: {    marginBottom: 4,
  },
  hoursMain: {  },
  sectionHeading: {    marginBottom: 12,
    textTransform: 'uppercase',  },
  dayCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  dayCardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayCardContent: {
    gap: 8,
  },
  dayHoursWell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  dayPunchesCol: {
    flex: 1,
  },
  dayPunchesLabel: {},
  dayPunchesTime: {
    marginTop: 2,
  },
  dayWorkedCol: {
    alignItems: 'flex-end',
  },
  dayWorkedLabel: {},
  dayWorkedHours: {
    marginTop: 2,
  },
  dayEntriesStack: {
    gap: 6,
  },
  dayEntryCard: {
    padding: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  dayEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  entryMachineTitle: {},
  dayEntryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  entryMetaText: {},
  dayEmptyStateWell: {
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayEmptyStateText: {},
});
