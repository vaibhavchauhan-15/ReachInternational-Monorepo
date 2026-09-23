import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { MobileHeader, Card, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  CalendarCheck,
  Calendar,
  Search,
  Clock,
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
} from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

const ALLOWED_ROLES = ['super_admin', 'admin', 'hr'];

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
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF';
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  log_count: number;
  entries: AttendanceDayEntry[];
}

export interface AttendanceDetailData {
  employee: {
    id: string;
    full_name: string;
    phone: string | null;
    role: string;
    city: string | null;
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
  const { role } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Guard access
  const normalizedRole = (role || '').toLowerCase();
  const isAllowed = ALLOWED_ROLES.includes(normalizedRole);

  useEffect(() => {
    if (role && !isAllowed) {
      router.replace('/(app)/dashboard');
    }
  }, [role, isAllowed, router]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'half_day'>('all');

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

  // Detail Modal State
  const [selectedEmployee, setSelectedEmployee] = useState<AttendanceEmployee | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<AttendanceDetailData | null>(null);

  const fetchAttendance = useCallback(async (y: number, m: number) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_attendance_monthly_summary', {
        p_year: y,
        p_month: m,
        p_page: 1,
        p_page_size: 200,
      });

      if (error) {
        console.error('[AttendanceScreen] Fetch error:', error);
        Alert.alert('Error', error.message || 'Failed to fetch attendance data');
      } else if (data) {
        setEmployees(data.rows || []);
        if (data.kpis) {
          setKpis(data.kpis);
        }
      }
    } catch (err: any) {
      console.error('[AttendanceScreen] Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) {
      fetchAttendance(year, month);
    }
  }, [year, month, isAllowed, fetchAttendance]);

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
      const { data, error } = await supabase.rpc('get_attendance_daily_detail', {
        p_employee_id: emp.employee_id,
        p_year: year,
        p_month: month,
      });
      if (error) {
        Alert.alert('Error', error.message || 'Failed to load employee detail');
      } else if (data) {
        setDetailData(data as unknown as AttendanceDetailData);
      }
    } catch (err: any) {
      console.error('[AttendanceDetail] Error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    let list = employees;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (emp) =>
          emp.full_name.toLowerCase().includes(q) ||
          (emp.phone && emp.phone.includes(q)) ||
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

  const formatTime = (t: string | null) => {
    if (!t) return '—';
    const parts = t.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  const renderStatusBadge = (status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF') => {
    switch (status) {
      case 'PRESENT':
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(22, 163, 74, 0.12)', borderColor: 'rgba(22, 163, 74, 0.3)' }]}>
            <Text style={[styles.statusBadgeText, { color: '#16a34a' }]}>Present</Text>
          </View>
        );
      case 'HALF_DAY':
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(217, 119, 6, 0.12)', borderColor: 'rgba(217, 119, 6, 0.3)' }]}>
            <Text style={[styles.statusBadgeText, { color: '#d97706' }]}>Half Day</Text>
          </View>
        );
      case 'WEEK_OFF':
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(107, 114, 128, 0.12)', borderColor: 'rgba(107, 114, 128, 0.3)' }]}>
            <Text style={[styles.statusBadgeText, { color: '#6b7280' }]}>Week Off</Text>
          </View>
        );
      case 'ABSENT':
      default:
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(220, 38, 38, 0.12)', borderColor: 'rgba(220, 38, 38, 0.3)' }]}>
            <Text style={[styles.statusBadgeText, { color: '#dc2626' }]}>Absent</Text>
          </View>
        );
    }
  };

  if (!isAllowed) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader title="Attendance" />

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
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={handlePrevMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={20} color={theme.colors.ink} />
          </TouchableOpacity>

          <View style={styles.monthLabelContainer}>
            <Calendar size={16} color={theme.colors.mute} style={{ marginRight: 6 }} />
            <Text style={[styles.monthLabelText, { color: theme.colors.ink }]}>{monthLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={handleNextMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronRight size={20} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        {/* KPI Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiRow}
        >
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.kpiHeader}>
              <Users size={14} color={theme.colors.mute} />
              <Text style={[styles.kpiTitle, { color: theme.colors.mute }]}>Total Operators</Text>
            </View>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>{kpis.totalEmployees}</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.kpiHeader}>
              <UserCheck size={14} color="#16a34a" />
              <Text style={[styles.kpiTitle, { color: theme.colors.mute }]}>Present</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{kpis.presentCount}</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.kpiHeader}>
              <UserX size={14} color="#dc2626" />
              <Text style={[styles.kpiTitle, { color: theme.colors.mute }]}>Absent</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{kpis.absentCount}</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.kpiHeader}>
              <Clock size={14} color="#d97706" />
              <Text style={[styles.kpiTitle, { color: theme.colors.mute }]}>Half Day</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>{kpis.halfDayCount}</Text>
          </View>
        </ScrollView>

        {/* Search Input */}
        <View style={[styles.searchBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Search size={16} color={theme.colors.mute} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.ink }]}
            placeholder="Search operator by name, phone, city..."
            placeholderTextColor={theme.colors.mute}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={theme.colors.mute} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Filter Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterStrip}
        >
          {(['all', 'present', 'absent', 'half_day'] as const).map((st) => {
            const active = statusFilter === st;
            const labels = {
              all: `All (${employees.length})`,
              present: `Present (${kpis.presentCount})`,
              absent: `Absent (${kpis.absentCount})`,
              half_day: `Half Day (${kpis.halfDayCount})`,
            };
            return (
              <TouchableOpacity
                key={st}
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
                  style={[
                    styles.filterChipText,
                    { color: active ? '#ffffff' : theme.colors.ink },
                  ]}
                >
                  {labels[st]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.ink} />
            <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading attendance...</Text>
          </View>
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            title="No Attendance Found"
            description="No operator records match your filter criteria for this month."
          />
        ) : (
          <View style={styles.cardList}>
            {filteredEmployees.map((emp) => (
              <TouchableOpacity
                key={emp.employee_id}
                style={[
                  styles.employeeCard,
                  { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                ]}
                activeOpacity={0.7}
                onPress={() => handleOpenDetail(emp)}
              >
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.empName, { color: theme.colors.ink }]} numberOfLines={1}>
                      {emp.full_name}
                    </Text>
                    {renderStatusBadge(emp.status)}
                  </View>

                  <View style={styles.metaRow}>
                    {emp.phone ? (
                      <View style={styles.metaItem}>
                        <Phone size={12} color={theme.colors.mute} style={{ marginRight: 3 }} />
                        <Text style={[styles.metaText, { color: theme.colors.mute }]}>{emp.phone}</Text>
                      </View>
                    ) : null}
                    {emp.city ? (
                      <View style={styles.metaItem}>
                        <MapPin size={12} color={theme.colors.mute} style={{ marginRight: 3 }} />
                        <Text style={[styles.metaText, { color: theme.colors.mute }]}>{emp.city}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Day Counts Strip */}
                <View style={[styles.statsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                  <View style={styles.statCol}>
                    <Text style={[styles.statVal, { color: theme.colors.ink }]}>{emp.scheduled_days}</Text>
                    <Text style={[styles.statLbl, { color: theme.colors.mute }]}>Scheduled</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statVal, { color: '#16a34a' }]}>{emp.present_days}</Text>
                    <Text style={[styles.statLbl, { color: theme.colors.mute }]}>Present</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statVal, { color: '#dc2626' }]}>{emp.absent_days}</Text>
                    <Text style={[styles.statLbl, { color: theme.colors.mute }]}>Absent</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statVal, { color: '#d97706' }]}>{emp.half_days}</Text>
                    <Text style={[styles.statLbl, { color: theme.colors.mute }]}>Half-Day</Text>
                  </View>
                </View>

                {/* Hours & Shift Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.hoursItem}>
                    <Clock size={13} color={theme.colors.mute} style={{ marginRight: 4 }} />
                    <Text style={[styles.hoursLabel, { color: theme.colors.mute }]}>Worked: </Text>
                    <Text style={[styles.hoursValue, { color: theme.colors.ink }]}>
                      {formatMins(emp.worked_minutes)}
                    </Text>
                    {emp.overtime_minutes > 0 ? (
                      <Text style={[styles.otBadge, { color: '#2563eb' }]}>
                        {' '}+{formatMins(emp.overtime_minutes)} OT
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.viewDetailBtn}>
                    <Text style={styles.viewDetailText}>View Calendar</Text>
                    <ChevronRight size={14} color="#0070f3" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Employee Detail / Calendar Modal */}
      <Modal
        visible={!!selectedEmployee}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedEmployee(null)}
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
            <TouchableOpacity
              onPress={() => setSelectedEmployee(null)}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color={theme.colors.ink} />
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.ink} />
              <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading daily calendar...</Text>
            </View>
          ) : detailData ? (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: insets.bottom + 32 },
              ]}
            >
              {/* Summary Cards */}
              <View style={styles.detailSummaryRow}>
                <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.detailStatNum, { color: '#16a34a' }]}>{detailData.summary.presentDays}</Text>
                  <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Present</Text>
                </View>
                <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.detailStatNum, { color: '#dc2626' }]}>{detailData.summary.absentDays}</Text>
                  <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Absent</Text>
                </View>
                <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.detailStatNum, { color: '#d97706' }]}>{detailData.summary.halfDays}</Text>
                  <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Half Days</Text>
                </View>
                <View style={[styles.detailStatCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.detailStatNum, { color: '#6b7280' }]}>{detailData.summary.weekOffs}</Text>
                  <Text style={[styles.detailStatLabel, { color: theme.colors.mute }]}>Week Offs</Text>
                </View>
              </View>

              {/* Total Hours Card */}
              <View style={[styles.hoursSummaryCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                <View style={styles.hoursCol}>
                  <Text style={[styles.hoursSub, { color: theme.colors.mute }]}>Total Worked</Text>
                  <Text style={[styles.hoursMain, { color: theme.colors.ink }]}>
                    {formatMins(detailData.summary.totalWorkedMinutes)}
                  </Text>
                </View>
                <View style={styles.hoursCol}>
                  <Text style={[styles.hoursSub, { color: theme.colors.mute }]}>Total Overtime</Text>
                  <Text style={[styles.hoursMain, { color: '#2563eb' }]}>
                    {formatMins(detailData.summary.totalOtMinutes)}
                  </Text>
                </View>
              </View>

              {/* Day-by-Day Log List */}
              <Text style={[styles.sectionHeading, { color: theme.colors.ink }]}>Daily Attendance Records</Text>

              {detailData.days.map((day) => {
                const dayNum = day.date.split('-')[2];
                const dowLabel = DOW_LABELS[day.dow];
                const isSunday = day.dow === 0;

                return (
                  <View
                    key={day.date}
                    style={[
                      styles.dayRowCard,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: isSunday
                          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
                          : theme.colors.hairline,
                        opacity: isSunday ? 0.75 : 1,
                      },
                    ]}
                  >
                    <View style={styles.dayDateCol}>
                      <Text style={[styles.dayNum, { color: theme.colors.ink }]}>{dayNum}</Text>
                      <Text style={[styles.dayDow, { color: isSunday ? '#ef4444' : theme.colors.mute }]}>{dowLabel}</Text>
                    </View>

                    <View style={styles.dayDetailsCol}>
                      <View style={styles.dayStatusRow}>
                        {renderStatusBadge(day.status)}
                        {day.worked_minutes > 0 ? (
                          <Text style={[styles.dayWorkedText, { color: theme.colors.ink }]}>
                            {formatMins(day.worked_minutes)}
                          </Text>
                        ) : null}
                        {day.overtime_minutes > 0 ? (
                          <Text style={[styles.dayOtText, { color: '#2563eb' }]}>
                            +{formatMins(day.overtime_minutes)} OT
                          </Text>
                        ) : null}
                      </View>

                      {day.entries && day.entries.length > 0 ? (
                        <View style={styles.dayEntriesWrap}>
                          {day.entries.map((entry, idx) => (
                            <View key={entry.id || idx} style={styles.dayEntryItem}>
                              <Text style={[styles.entryTime, { color: theme.colors.mute }]} numberOfLines={1}>
                                {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                                {entry.location ? ` • ${entry.location}` : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
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
  monthLabelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: spacingNumeric.md,
  },
  kpiCard: {
    width: 124,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
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
    flex: 1,
    fontSize: 14,
    height: 44,
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
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
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
  empName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
  },
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
  statVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
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
  hoursLabel: {
    fontSize: 12,
  },
  hoursValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  otBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0070f3',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
  detailStatNum: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
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
  hoursSub: {
    fontSize: 12,
    marginBottom: 4,
  },
  hoursMain: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayRowCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  dayDateCol: {
    width: 44,
    alignItems: 'center',
    marginRight: 12,
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '700',
  },
  dayDow: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  dayDetailsCol: {
    flex: 1,
  },
  dayStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dayWorkedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayOtText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayEntriesWrap: {
    marginTop: 4,
    gap: 2,
  },
  dayEntryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryTime: {
    fontSize: 11,
  },
});
