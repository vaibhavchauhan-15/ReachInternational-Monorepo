import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from '../../components/ui/touch/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import {
  MobileHeader,
  Badge,
  EmptyState,
  ErrorState,
  PermissionDeniedView,
  KPICard,
  type HeaderActionItem,
  Text,
  AppModal,
  SearchInput,
  useToast,
} from '../../components/ui';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import {
  AttendanceListSkeleton,
  AttendanceDetailSkeleton,
  AttendanceDayCard,
  AttendanceEmployeeCard,
} from '../../components/attendance';
import {
  useOperatorAttendanceInfiniteQuery,
  useAttendanceData,
  useAttendanceDetailQuery,
  type AttendanceEmployee,
  type AttendanceKpis,
} from '../../lib/hooks/useAttendanceData';
import { useScreenSync } from '../../lib/offline';
import {
  Calendar,
  Clock,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  ChevronRight,
  ChevronLeft,
  X,
  SlidersHorizontal,
} from '../../components/ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { AttendanceDay, AttendanceDetailData } from '../../lib/queries/attendance';

const ALLOWED_ROLES = ['super_admin', 'admin', 'hr', 'manager', 'supervisor', 'operator'];

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

  // Month navigation state (YYYY-MM)
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const monthStr = useMemo(
    () => `${year}-${String(month).padStart(2, '0')}`,
    [year, month]
  );

  // Month Label: e.g. "October 2026"
  const monthLabel = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [year, month]);

  const [refreshing, setRefreshing] = useState(false);

  // Operator status quick filter state
  const [operatorStatusFilter, setOperatorStatusFilter] = useState<
    'all' | 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF'
  >('all');

  // Manager persistent search and filter state
  const {
    search: debouncedSearchQuery,
    inputValue: searchQuery,
    setSearch: setSearchQuery,
    filters,
    setFilter,
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
    (val: 'all' | 'present' | 'absent' | 'half_day' | 'has_absences' | 'perfect') =>
      setFilter('statusFilter', val),
    [setFilter]
  );

  // 1. Operator Infinite Query (Server-side paginated 10 days per chunk + complete month summary)
  const operatorQuery = useOperatorAttendanceInfiniteQuery({
    employeeId: user?.id,
    year,
    month,
    pageSize: 10,
    enabled: isAllowed && isOperator && Boolean(user?.id),
  });

  // 2. Manager Monthly Query (Roster summary for admins/managers)
  const managementQuery = useAttendanceData({
    month: monthStr,
    searchQuery: debouncedSearchQuery,
    statusFilter,
    enabled: isAllowed && !isOperator,
  });

  // 3. Manager Modal Detail State & Query
  const [selectedEmployee, setSelectedEmployee] = useState<AttendanceEmployee | null>(null);
  const detailQuery = useAttendanceDetailQuery({
    employeeId: selectedEmployee?.employee_id,
    year,
    month,
    enabled: Boolean(selectedEmployee?.employee_id),
  });

  // Screen-scoped synchronization on reconnect
  const handleSyncRefresh = useCallback(async () => {
    if (isOperator) {
      await operatorQuery.refetch();
    } else {
      await managementQuery.refetch();
    }
  }, [isOperator, operatorQuery, managementQuery]);

  useScreenSync({
    screen: 'attendance',
    onRefresh: handleSyncRefresh,
  });

  // Month navigation handlers
  const handlePrevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const handleNextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await handleSyncRefresh();
    } catch {
      toast('error', 'Sync', 'Failed to refresh attendance');
    } finally {
      setRefreshing(false);
    }
  }, [handleSyncRefresh, toast]);

  // Header Actions
  const headerActions = useMemo<HeaderActionItem[]>(() => {
    return [
      {
        id: 'refresh-attendance',
        label: 'Refresh Attendance',
        icon: (
          <RefreshCw
            size={15}
            color={theme.colors.ink}
            loading={refreshing || operatorQuery.isFetching || managementQuery.isFetching}
          />
        ),
        onPress: onRefresh,
      },
    ];
  }, [theme.colors.ink, onRefresh, refreshing, operatorQuery.isFetching, managementQuery.isFetching]);

  // Formatters
  const formatMins = useCallback((mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }, []);

  const formatTime = useCallback((t: string | null) => {
    if (!t) return '—';
    const parts = t.split(':');
    return `${parts[0]}:${parts[1]}`;
  }, []);

  const formatTimeAMPM = useCallback((t?: string | null) => {
    if (!t) return '—';
    const parts = t.trim().split(':');
    if (parts.length < 2) return t;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return t;
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  }, []);

  // Filtered daily records for operator
  const visibleDays = useMemo(() => {
    const allDays = operatorQuery.days;
    if (operatorStatusFilter === 'all') return allDays;
    return allDays.filter((d) => d.status === operatorStatusFilter);
  }, [operatorQuery.days, operatorStatusFilter]);

  // End reached pagination trigger
  const handleEndReached = useCallback(() => {
    if (operatorQuery.hasNextPage && !operatorQuery.isFetchingNextPage) {
      operatorQuery.fetchNextPage();
    }
  }, [operatorQuery.hasNextPage, operatorQuery.isFetchingNextPage, operatorQuery.fetchNextPage]);

  // Operator FlatList Header
  const renderOperatorListHeader = useCallback(() => {
    const summary = operatorQuery.summary || {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      weekOffs: 0,
      totalWorkedMinutes: 0,
      totalOtMinutes: 0,
    };

    return (
      <View style={styles.listHeaderContainer}>
        {/* 4 Summary Stat Cards */}
        <View style={styles.detailSummaryRow}>
          <Pressable
            variant="card"
            onPress={() =>
              setOperatorStatusFilter((prev) => (prev === 'PRESENT' ? 'all' : 'PRESENT'))
            }
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor:
                  operatorStatusFilter === 'PRESENT' ? '#16a34a' : theme.colors.hairline,
                borderWidth: operatorStatusFilter === 'PRESENT' ? 1.5 : 1,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#16a34a' }}>
              {summary.presentDays}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Present
            </Text>
          </Pressable>

          <Pressable
            variant="card"
            onPress={() =>
              setOperatorStatusFilter((prev) => (prev === 'ABSENT' ? 'all' : 'ABSENT'))
            }
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor:
                  operatorStatusFilter === 'ABSENT' ? '#dc2626' : theme.colors.hairline,
                borderWidth: operatorStatusFilter === 'ABSENT' ? 1.5 : 1,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#dc2626' }}>
              {summary.absentDays}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Absent
            </Text>
          </Pressable>

          <Pressable
            variant="card"
            onPress={() =>
              setOperatorStatusFilter((prev) => (prev === 'HALF_DAY' ? 'all' : 'HALF_DAY'))
            }
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor:
                  operatorStatusFilter === 'HALF_DAY' ? '#d97706' : theme.colors.hairline,
                borderWidth: operatorStatusFilter === 'HALF_DAY' ? 1.5 : 1,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#d97706' }}>
              {summary.halfDays}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Half Days
            </Text>
          </Pressable>

          <Pressable
            variant="card"
            onPress={() =>
              setOperatorStatusFilter((prev) => (prev === 'WEEK_OFF' ? 'all' : 'WEEK_OFF'))
            }
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor:
                  operatorStatusFilter === 'WEEK_OFF' ? '#6b7280' : theme.colors.hairline,
                borderWidth: operatorStatusFilter === 'WEEK_OFF' ? 1.5 : 1,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#6b7280' }}>
              {summary.weekOffs}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Week Offs
            </Text>
          </Pressable>
        </View>

        {/* 2 Total Hours Cards */}
        <View
          style={[
            styles.hoursSummaryCard,
            { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
          ]}
        >
          <View style={styles.hoursCol}>
            <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 4 }}>
              Total Worked
            </Text>
            <Text variant="title" style={{ color: theme.colors.ink }}>
              {formatMins(summary.totalWorkedMinutes)}
            </Text>
          </View>
          <View style={[styles.hoursDivider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.hoursCol}>
            <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 4 }}>
              Total Overtime
            </Text>
            <Text variant="title" style={{ color: '#2563eb' }}>
              {formatMins(summary.totalOtMinutes)}
            </Text>
          </View>
        </View>

        {/* Section Heading Row */}
        <View style={styles.sectionHeadingRow}>
          <Text variant="subheading" style={[styles.sectionHeading, { color: theme.colors.ink }]}>
            DAILY ATTENDANCE RECORDS
          </Text>
          {operatorStatusFilter !== 'all' && (
            <Pressable
              variant="chip"
              onPress={() => setOperatorStatusFilter('all')}
              style={[styles.filterClearChip, { borderColor: theme.colors.hairline }]}
            >
              <Text variant="micro" style={{ color: theme.colors.link }}>
                Filter: {operatorStatusFilter} ✕
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }, [operatorQuery.summary, operatorStatusFilter, theme.colors, formatMins]);

  // Operator Day Item Renderer
  const renderDayItem = useCallback(
    ({ item }: { item: AttendanceDay }) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const isSunday = item.dow === 0;
      const isFuture = item.date > todayStr;
      const isToday = item.date === todayStr;
      const hasWorked = item.worked_minutes > 0 || (item.entries && item.entries.length > 0);
      const isTodayNoLog = isToday && !hasWorked;

      const effectiveStatus: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED' =
        hasWorked
          ? item.status === 'WEEK_OFF' || item.status === 'DISABLED'
            ? 'PRESENT'
            : item.status
          : isSunday
          ? 'WEEK_OFF'
          : isFuture || isTodayNoLog
          ? 'DISABLED'
          : item.status;

      const isCardDimmed =
        (effectiveStatus === 'DISABLED' && !isToday) || effectiveStatus === 'WEEK_OFF';

      return (
        <AttendanceDayCard
          day={item}
          employeeShiftStart={operatorQuery.employee?.shift_start_time}
          employeeShiftEnd={operatorQuery.employee?.shift_end_time}
          isToday={isToday}
          isSunday={isSunday}
          isCardDimmed={isCardDimmed}
          effectiveStatus={effectiveStatus}
          hasWorked={hasWorked}
        />
      );
    },
    [operatorQuery.employee?.shift_start_time, operatorQuery.employee?.shift_end_time]
  );

  // Operator Footer (loading next page indicator)
  const renderOperatorListFooter = useCallback(() => {
    if (operatorQuery.isFetchingNextPage) {
      return (
        <View style={styles.paginationLoadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.link} />
          <Text variant="caption" style={{ color: theme.colors.mute, marginLeft: 8 }}>
            Loading more daily records...
          </Text>
        </View>
      );
    }
    return <View style={{ height: 24 }} />;
  }, [operatorQuery.isFetchingNextPage, theme.colors]);

  // Operator Empty State
  const renderOperatorEmpty = useCallback(() => {
    if (operatorQuery.isLoading) return null;
    return (
      <EmptyState
        title={operatorStatusFilter !== 'all' ? 'No Matching Records' : 'No Attendance Found'}
        description={
          operatorStatusFilter !== 'all'
            ? `No records found with status ${operatorStatusFilter}.`
            : 'No attendance records found for this month.'
        }
        actionLabel={operatorStatusFilter !== 'all' ? 'Show All Records' : undefined}
        onAction={operatorStatusFilter !== 'all' ? () => setOperatorStatusFilter('all') : undefined}
      />
    );
  }, [operatorQuery.isLoading, operatorStatusFilter]);

  // Manager Detail Modal Body Renderer
  const renderModalDetailBody = (data: AttendanceDetailData) => {
    const emp = data?.employee || {
      id: selectedEmployee?.employee_id || '',
      employee_id: selectedEmployee?.employee_id || null,
      full_name: selectedEmployee?.full_name || 'Operator',
      email: null,
      phone: selectedEmployee?.phone || null,
      role: 'operator',
      city: selectedEmployee?.city || null,
      district: null,
      state: selectedEmployee?.state || null,
      shift_start_time: selectedEmployee?.shift_start_time || '06:00:00',
      shift_end_time: selectedEmployee?.shift_end_time || '14:00:00',
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
        <View
          style={[
            styles.modalEmpCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.modalEmpRow}>
            <View style={styles.modalEmpCol}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                EMPLOYEE ID
              </Text>
              <Text variant="label" style={{ color: theme.colors.ink }}>
                {emp.employee_id || `EMP-${emp.id.slice(0, 8).toUpperCase()}`}
              </Text>
            </View>
            <View style={styles.modalEmpCol}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                PHONE
              </Text>
              <Text variant="label" style={{ color: theme.colors.ink }} numberOfLines={1}>
                {emp.phone || '—'}
              </Text>
            </View>
          </View>

          <View style={[styles.modalEmpRow, { marginTop: 8 }]}>
            <View style={styles.modalEmpCol}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                SITE LOCATION
              </Text>
              <Text variant="label" style={{ color: theme.colors.ink }} numberOfLines={1}>
                {emp.city ? `${emp.city}${emp.state ? `, ${emp.state}` : ''}` : '—'}
              </Text>
            </View>
            <View style={styles.modalEmpCol}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                SHIFT
              </Text>
              <Text variant="label" style={{ color: theme.colors.ink }} numberOfLines={1}>
                {emp.shift_start_time && emp.shift_end_time
                  ? `${formatTimeAMPM(emp.shift_start_time)} – ${formatTimeAMPM(emp.shift_end_time)}`
                  : '08:00 AM – 05:00 PM'}
              </Text>
            </View>
          </View>
        </View>

        {/* Modal Summary Row */}
        <View style={styles.detailSummaryRow}>
          <View
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#16a34a' }}>
              {summary.presentDays}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Present
            </Text>
          </View>
          <View
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#dc2626' }}>
              {summary.absentDays}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Absent
            </Text>
          </View>
          <View
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#d97706' }}>
              {summary.halfDays}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Half Days
            </Text>
          </View>
          <View
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="title" style={{ color: '#6b7280' }}>
              {summary.weekOffs}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Week Offs
            </Text>
          </View>
        </View>

        {/* Modal Hours Row */}
        <View
          style={[
            styles.hoursSummaryCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.hoursCol}>
            <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 4 }}>
              Total Worked
            </Text>
            <Text variant="title" style={{ color: theme.colors.ink }}>
              {formatMins(summary.totalWorkedMinutes)}
            </Text>
          </View>
          <View style={[styles.hoursDivider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.hoursCol}>
            <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 4 }}>
              Total Overtime
            </Text>
            <Text variant="title" style={{ color: '#2563eb' }}>
              {formatMins(summary.totalOtMinutes)}
            </Text>
          </View>
        </View>

        {/* Modal Day-by-Day Log List */}
        <Text variant="subheading" style={[styles.sectionHeading, { color: theme.colors.ink }]}>
          DAILY ATTENDANCE RECORDS
        </Text>

        {days.map((day) => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const isSunday = day.dow === 0;
          const isFuture = day.date > todayStr;
          const isToday = day.date === todayStr;
          const hasWorked = day.worked_minutes > 0 || (day.entries && day.entries.length > 0);
          const isTodayNoLog = isToday && !hasWorked;

          const effectiveStatus: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED' =
            hasWorked
              ? day.status === 'WEEK_OFF' || day.status === 'DISABLED'
                ? 'PRESENT'
                : day.status
              : isSunday
              ? 'WEEK_OFF'
              : isFuture || isTodayNoLog
              ? 'DISABLED'
              : day.status;

          const isCardDimmed =
            (effectiveStatus === 'DISABLED' && !isToday) || effectiveStatus === 'WEEK_OFF';

          return (
            <AttendanceDayCard
              key={day.date}
              day={day}
              employeeShiftStart={emp.shift_start_time}
              employeeShiftEnd={emp.shift_end_time}
              isToday={isToday}
              isSunday={isSunday}
              isCardDimmed={isCardDimmed}
              effectiveStatus={effectiveStatus}
              hasWorked={hasWorked}
            />
          );
        })}
      </View>
    );
  };

  if (!isAllowed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader title={isOperator ? 'My Attendance' : 'Attendance'} />
        <PermissionDeniedView
          featureName="Attendance Roster"
          currentRole={role}
          requiredRoles={ALLOWED_ROLES}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title={isOperator ? 'My Attendance' : 'Attendance'}
        actions={headerActions}
      />

      {/* Month Selector Bar — Static-first instant component */}
      <View style={[styles.monthBarContainer, { backgroundColor: theme.colors.canvas }]}>
        <View
          style={[
            styles.monthBar,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
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
            <Text variant="label" style={{ color: theme.colors.ink }}>
              {monthLabel}
            </Text>
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
      </View>

      {/* Main Content Area */}
      {isOperator ? (
        operatorQuery.isLoading && !operatorQuery.data ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 84 },
            ]}
          >
            <AttendanceDetailSkeleton showMetaCard={false} />
          </ScrollView>
        ) : operatorQuery.isError && !operatorQuery.data ? (
          <View style={styles.errorContainer}>
            <ErrorState
              error={operatorQuery.error as Error}
              onRetry={() => {
                void operatorQuery.refetch();
              }}
              actionLabel="Retry Loading Attendance"
            />
          </View>
        ) : (
          <FlatList<AttendanceDay>
            data={visibleDays}
            keyExtractor={(item) => item.date}
            renderItem={renderDayItem}
            ListHeaderComponent={renderOperatorListHeader}
            ListFooterComponent={renderOperatorListFooter}
            ListEmptyComponent={renderOperatorEmpty}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={[
              styles.flatListContent,
              { paddingBottom: insets.bottom + 90 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.ink}
              />
            }
          />
        )
      ) : managementQuery.isLoading && !managementQuery.allRows.length ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 84 },
          ]}
        >
          <AttendanceListSkeleton count={4} showKpi={true} showSearch={true} showFilters={true} />
        </ScrollView>
      ) : managementQuery.isError && !managementQuery.allRows.length ? (
        <View style={styles.errorContainer}>
          <ErrorState
            error={managementQuery.error as Error}
            onRetry={() => {
              void managementQuery.refetch();
            }}
            actionLabel="Retry Loading Attendance"
          />
        </View>
      ) : (
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
          {/* KPI Strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiRow}
          >
            <KPICard
              label="Total Operators"
              value={managementQuery.kpis.totalEmployees}
              icon={Users}
              variant="default"
              containerStyle={{ width: 140, flex: 0 }}
            />
            <KPICard
              label="Present"
              value={managementQuery.kpis.presentCount}
              icon={UserCheck}
              variant="success"
              containerStyle={{ width: 140, flex: 0 }}
            />
            <KPICard
              label="Absent"
              value={managementQuery.kpis.absentCount}
              icon={UserX}
              variant={managementQuery.kpis.absentCount > 0 ? 'error' : 'default'}
              containerStyle={{ width: 140, flex: 0 }}
            />
            <KPICard
              label="Half Day"
              value={managementQuery.kpis.halfDayCount}
              icon={Clock}
              variant={managementQuery.kpis.halfDayCount > 0 ? 'warning' : 'default'}
              containerStyle={{ width: 140, flex: 0 }}
            />
          </ScrollView>

          {/* Search Input */}
          <View style={{ marginBottom: 12 }}>
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
            {(['all', 'present', 'absent', 'half_day', 'has_absences', 'perfect'] as const).map(
              (st) => {
                const active = statusFilter === st;
                const labels: Record<string, string> = {
                  all: `All (${managementQuery.allRows.length})`,
                  present: `Present (${managementQuery.kpis.presentCount})`,
                  absent: `Absent (${managementQuery.kpis.absentCount})`,
                  half_day: `Half Day (${managementQuery.kpis.halfDayCount})`,
                  has_absences: `Absences (${
                    managementQuery.allRows.filter((e) => e.absent_days > 0).length
                  })`,
                  perfect: `Perfect (${
                    managementQuery.allRows.filter(
                      (e) => e.absent_days === 0 && e.present_days > 0
                    ).length
                  })`,
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
                          ? isDark
                            ? '#262626'
                            : '#171717'
                          : theme.colors.canvasElevated,
                        borderColor: active
                          ? isDark
                            ? '#525252'
                            : '#171717'
                          : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{ color: active ? '#ffffff' : theme.colors.ink }}
                    >
                      {labels[st]}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>

          {managementQuery.rows.length === 0 ? (
            searchQuery.trim().length > 0 ? (
              <EmptyState
                variant="no-results"
                title="No Operators Found"
                description={`No operator attendance records matched "${searchQuery.trim()}".`}
                actionLabel="Clear Search"
                onAction={() => setSearchQuery('', true)}
              />
            ) : statusFilter !== 'all' ? (
              <EmptyState
                variant="filtered"
                title="No Matching Records"
                description="No operators match the selected attendance filter."
                actionLabel="Show All Operators"
                onAction={() => setStatusFilter('all')}
              />
            ) : (
              <EmptyState
                title="No Attendance Found"
                description="No operator records found for this month."
              />
            )
          ) : (
            <View style={styles.cardList}>
              {managementQuery.rows.map((emp) => (
                <AttendanceEmployeeCard
                  key={emp.employee_id}
                  employee={emp}
                  searchQuery={searchQuery}
                  onPress={(e) => setSelectedEmployee(e)}
                  formatMins={formatMins}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Operator Filter Floating Action Button */}
      {isOperator && (
        <Pressable
          variant="fab"
          haptic="select"
          accessibilityLabel="Filter daily records"
          onPress={() => {
            setOperatorStatusFilter((cur) => {
              if (cur === 'all') return 'PRESENT';
              if (cur === 'PRESENT') return 'ABSENT';
              if (cur === 'ABSENT') return 'HALF_DAY';
              if (cur === 'HALF_DAY') return 'WEEK_OFF';
              return 'all';
            });
          }}
          style={[
            styles.fabBtn,
            {
              backgroundColor: isDark ? '#262626' : '#171717',
              borderColor: isDark ? '#404040' : '#262626',
              bottom: insets.bottom + 84,
            },
          ]}
        >
          <SlidersHorizontal size={20} color="#ffffff" />
        </Pressable>
      )}

      {/* Employee Detail / Calendar Modal (Managers & Admins only) */}
      {!isOperator && (
        <AppModal
          visible={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          variant="fullscreen"
        >
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.colors.canvas, paddingTop: insets.top },
            ]}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={{ flex: 1 }}>
                <Text variant="title" style={{ color: theme.colors.ink }} numberOfLines={1}>
                  {selectedEmployee?.full_name}
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                  {monthLabel} • Shift:{' '}
                  {formatTime(selectedEmployee?.shift_start_time ?? null)} -{' '}
                  {formatTime(selectedEmployee?.shift_end_time ?? null)}
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

            {detailQuery.isLoading ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + 32 },
                ]}
              >
                <AttendanceDetailSkeleton showMetaCard={true} />
              </ScrollView>
            ) : detailQuery.data ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + 32 },
                ]}
              >
                {renderModalDetailBody(detailQuery.data)}
              </ScrollView>
            ) : (
              <ErrorState
                title="Failed to Load Detail"
                message="Unable to load operator daily attendance detail."
                retryLabel="Retry"
                onRetry={() => {
                  if (selectedEmployee) {
                    void detailQuery.refetch();
                  }
                }}
              />
            )}
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
  monthBarContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.xs,
    paddingBottom: spacingNumeric.xs,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.md,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  flatListContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  listHeaderContainer: {
    marginBottom: spacingNumeric.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: spacingNumeric.md,
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
  cardList: {
    gap: 12,
  },
  errorContainer: {
    flex: 1,
    padding: spacingNumeric.md,
    justifyContent: 'center',
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
    minHeight: 64,
    justifyContent: 'center',
  },
  hoursSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  hoursCol: {
    flex: 1,
    alignItems: 'center',
  },
  hoursDivider: {
    width: 1,
    height: 36,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeading: {
    textTransform: 'uppercase',
  },
  filterClearChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  paginationLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  fabBtn: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
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
});
