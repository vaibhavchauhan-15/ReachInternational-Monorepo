import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, useTheme, MobileHeader, HeaderActionItem } from '../../components/ui';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { MobileConflictResolutionModal } from '../../components/operations/MobileConflictResolutionModal';
import { OperationsExportModal } from '../../components/operations/OperationsExportModal';
import { OperationLogListSkeleton } from '../../components/operations/OperationsSkeleton';
import { useOperationsMasterData, useOperationsLogs } from '../../lib/hooks/useOperationsData';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  formatShiftTimingRange,
  formatDate,
} from '@reachinternational/utils';
import {
  Clock,
  User,
  AlertTriangle,
  Calendar,
  Truck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Printer,
  FileText,
} from 'lucide-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type LogsViewMode = 'machine' | 'client' | 'operator';

export interface HourLogRecord {
  id: string;
  machine_id?: string;
  machine_code: string;
  log_date: string;
  shift?: string;
  shift_code?: string;
  shift_scheduled_minutes?: number;
  start_meter: number;
  end_meter: number;
  running_hours: number;
  start_time?: string;
  end_time?: string;
  overtime_hours?: number;
  normal_working_hours?: number;
  location?: string;
  is_breakdown: boolean;
  remarks?: string;
  operator_id?: string;
  client_id?: string;
  created_at?: string;
  conflict_flag?: boolean;
  conflict_reason?: string;
  conflict_status?: string;
  machine?: {
    id?: string;
    machine_id: string;
    model?: string;
    serial_number?: string;
  } | null;
  operator?: { id?: string; full_name: string; phone?: string } | null;
  client?: {
    id?: string;
    company_name?: string;
    street?: string;
    city?: string;
  } | null;
}

export const MONTH_OPTIONS = [
  { id: '01', label: 'January' },
  { id: '02', label: 'February' },
  { id: '03', label: 'March' },
  { id: '04', label: 'April' },
  { id: '05', label: 'May' },
  { id: '06', label: 'June' },
  { id: '07', label: 'July' },
  { id: '08', label: 'August' },
  { id: '09', label: 'September' },
  { id: '10', label: 'October' },
  { id: '11', label: 'November' },
  { id: '12', label: 'December' },
  { id: 'all', label: 'All Months' },
];

export default function RunningLogsScreen() {
  const { theme, isDark } = useTheme();
  const { role, user } = useAuth();
  const router = useRouter();

  // Guard: Restrict operator role from accessing Daily Running Logs
  useEffect(() => {
    if (role && role.toLowerCase() === 'operator') {
      Alert.alert('Access Denied', 'You do not have permission to view Daily Running Logs.');
      router.replace('/(app)/operations');
    }
  }, [role, router]);

  // Master Data State
  const [logs, setLogs] = useState<HourLogRecord[]>([]);
  const [machinesList, setMachinesList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [activeOperators, setActiveOperators] = useState<any[]>([]);

  // View Mode: 'machine' | 'client' | 'operator'
  const [logsViewMode, setLogsViewMode] = useState<LogsViewMode>('machine');

  const getCurrentMonthValue = (): string => {
    const m = new Date().getMonth() + 1;
    return m < 10 ? `0${m}` : `${m}`;
  };

  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSiteLocation, setSelectedSiteLocation] = useState<string>('');
  const [selectedClientMachineId, setSelectedClientMachineId] = useState<string>('all');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthValue());

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [selectedConflictLog, setSelectedConflictLog] = useState<HourLogRecord | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [editingLogRecord, setEditingLogRecord] = useState<HourLogRecord | null>(null);

  // Expandable date groups
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateExpanded = useCallback((dateKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  }, []);

  const [allExpanded, setAllExpanded] = useState<boolean>(false);
  const toggleAllExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAllExpanded((prev) => !prev);
  }, []);

  // TanStack Query Data Fetching
  const { data: masterData, refetch: refetchMaster } = useOperationsMasterData();
  const { data: logsData, isLoading: isLogsLoading, refetch: refetchLogs } = useOperationsLogs();

  useEffect(() => {
    if (!masterData) return;
    setActiveOperators(masterData.activeOperators as any);
    setClientsList(masterData.clientsList as any);
    setMachinesList(masterData.machinesList as any);

    if (!selectedMachineId && masterData.machinesList.length > 0) {
      setSelectedMachineId(masterData.machinesList[0].id);
    }
    if (!selectedOperatorId && masterData.activeOperators.length > 0) {
      setSelectedOperatorId(masterData.activeOperators[0].id);
    }
  }, [masterData, selectedMachineId, selectedOperatorId]);

  useEffect(() => {
    if (!logsData) return;
    setLogs(logsData as any);
  }, [logsData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMaster(), refetchLogs()]);
    setRefreshing(false);
  }, [refetchMaster, refetchLogs]);

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Conflict logs
  const pendingConflicts = useMemo(() => {
    return logs.filter((l) => l.conflict_flag && l.conflict_status !== 'resolved');
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const matchesMachine = (log.machine_code || '').toLowerCase().includes(q) ||
          (log.machine?.model || '').toLowerCase().includes(q);
        const matchesOperator = (log.operator?.full_name || '').toLowerCase().includes(q);
        const matchesClient = (log.client?.company_name || '').toLowerCase().includes(q);
        if (!matchesMachine && !matchesOperator && !matchesClient) return false;
      }
      return true;
    });
  }, [logs, debouncedSearch]);

  // Date-grouped logs
  const groupedLogs = useMemo(() => {
    const groups: Record<string, HourLogRecord[]> = {};
    filteredLogs.forEach((l) => {
      const d = l.log_date || 'Unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(l);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLogs]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalRunningHours = 0;
    let totalOvertimeHours = 0;
    let totalWorkingHours = 0;
    let totalBreakdowns = 0;
    filteredLogs.forEach((l) => {
      totalRunningHours += Number(l.running_hours) || 0;
      totalOvertimeHours += Number(l.overtime_hours) || 0;
      totalWorkingHours += Number(l.normal_working_hours) || 8;
      if (l.is_breakdown) totalBreakdowns++;
    });
    return {
      totalRunningHours: Math.round(totalRunningHours * 10) / 10,
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
      totalBreakdowns,
      totalShifts: filteredLogs.length,
      totalDays: groupedLogs.length,
    };
  }, [filteredLogs, groupedLogs]);

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [
      {
        id: 'export-print',
        label: 'Export / Print Report',
        icon: <Printer size={16} color={theme.colors.ink} />,
        onPress: () => setShowExportModal(true),
      },
      {
        id: 'refresh-data',
        label: 'Refresh Running Logs',
        icon: <RefreshCw size={16} color={theme.colors.ink} />,
        onPress: () => onRefresh(),
      },
    ];
    if (pendingConflicts.length > 0) {
      list.push({
        id: 'review-conflict',
        label: `Review Conflicts (${pendingConflicts.length})`,
        icon: <AlertTriangle size={16} color="#d97706" />,
        badge: pendingConflicts.length,
        onPress: () => {
          setSelectedConflictLog(pendingConflicts[0]);
          setShowConflictModal(true);
        },
      });
    }
    return list;
  }, [theme.colors.ink, onRefresh, pendingConflicts]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MobileHeader
        title="Daily Running Logs"
        actions={headerActions}
      />

      {/* View Mode Strip: Machine | Client | Operator */}
      <View style={[styles.viewModeStrip, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewModeContent}>
          <TouchableOpacity
            onPress={() => setLogsViewMode('machine')}
            activeOpacity={0.8}
            style={[
              styles.viewModeTab,
              logsViewMode === 'machine'
                ? [styles.viewModeTabActive, { backgroundColor: theme.colors.ink }]
                : [styles.viewModeTabInactive, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }],
            ]}
          >
            <Text style={[styles.viewModeTabText, { color: logsViewMode === 'machine' ? theme.colors.canvas : theme.colors.body }]}>
              Machine View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLogsViewMode('client')}
            activeOpacity={0.8}
            style={[
              styles.viewModeTab,
              logsViewMode === 'client'
                ? [styles.viewModeTabActive, { backgroundColor: theme.colors.ink }]
                : [styles.viewModeTabInactive, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }],
            ]}
          >
            <Text style={[styles.viewModeTabText, { color: logsViewMode === 'client' ? theme.colors.canvas : theme.colors.body }]}>
              Client View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLogsViewMode('operator')}
            activeOpacity={0.8}
            style={[
              styles.viewModeTab,
              logsViewMode === 'operator'
                ? [styles.viewModeTabActive, { backgroundColor: theme.colors.ink }]
                : [styles.viewModeTabInactive, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }],
            ]}
          >
            <Text style={[styles.viewModeTabText, { color: logsViewMode === 'operator' ? theme.colors.canvas : theme.colors.body }]}>
              Operator View
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Feed */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* KPI Summary Cards */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>RUNNING HOURS</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>{summaryMetrics.totalRunningHours}h</Text>
            <Text style={[styles.kpiSub, { color: theme.colors.mute }]}>{summaryMetrics.totalDays} Days Logged</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>WORKING HOURS</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{summaryMetrics.totalWorkingHours}h</Text>
            <Text style={[styles.kpiSub, { color: theme.colors.mute }]}>{summaryMetrics.totalShifts} Shifts</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>OVERTIME</Text>
            <Text style={[styles.kpiValue, { color: '#0070f3' }]}>{summaryMetrics.totalOvertimeHours}h</Text>
            <Text style={[styles.kpiSub, { color: theme.colors.mute }]}>Overtime Total</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>BREAKDOWNS</Text>
            <Text style={[styles.kpiValue, { color: summaryMetrics.totalBreakdowns > 0 ? '#ef4444' : theme.colors.ink }]}>
              {summaryMetrics.totalBreakdowns}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.mute }]}>Incidents</Text>
          </View>
        </View>

        {/* Expand / Collapse All Toggle Strip */}
        <View style={styles.controlsStrip}>
          <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
            Daily Logs ({groupedLogs.length} days)
          </Text>
          <TouchableOpacity
            onPress={toggleAllExpanded}
            style={[styles.expandAllBtn, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated }]}
          >
            <Text style={[styles.expandAllText, { color: theme.colors.ink }]}>
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLogsLoading && logs.length === 0 ? (
          <OperationLogListSkeleton count={4} />
        ) : groupedLogs.length === 0 ? (
          <View style={[styles.emptyContainer, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated }]}>
            <FileText size={32} color={theme.colors.mute} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No Running Logs Found</Text>
            <Text style={[styles.emptySub, { color: theme.colors.mute }]}>
              No running hour logs match the selected filter criteria.
            </Text>
          </View>
        ) : (
          /* Date Grouped Log Cards */
          groupedLogs.map(([dateKey, dayLogs]) => {
            const isExpanded = allExpanded || Boolean(expandedDates[dateKey]);
            const dayRunningHours = Math.round(dayLogs.reduce((acc, cur) => acc + (Number(cur.running_hours) || 0), 0) * 10) / 10;
            const dayOtHours = Math.round(dayLogs.reduce((acc, cur) => acc + (Number(cur.overtime_hours) || 0), 0) * 10) / 10;
            const startMeter = Math.min(...dayLogs.map((l) => l.start_meter));
            const endMeter = Math.max(...dayLogs.map((l) => l.end_meter));

            return (
              <View
                key={dateKey}
                style={[
                  styles.dayGroupCard,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                {/* Header (1-tap to expand/collapse) */}
                <TouchableOpacity
                  onPress={() => toggleDateExpanded(dateKey)}
                  activeOpacity={0.7}
                  style={styles.dayGroupHeader}
                >
                  <View style={styles.dayGroupHeaderLeft}>
                    <Text style={[styles.dayGroupDate, { color: theme.colors.ink }]}>
                      {formatDate(dateKey)}
                    </Text>
                    <View style={styles.dayGroupBadges}>
                      <View style={[styles.countBadge, { backgroundColor: isDark ? '#262626' : '#f5f5f5' }]}>
                        <Text style={[styles.countBadgeText, { color: theme.colors.body }]}>
                          {dayLogs.length} shift{dayLogs.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                      {dayOtHours > 0 && (
                        <View style={[styles.otBadge, { backgroundColor: '#0070f318' }]}>
                          <Text style={styles.otBadgeText}>+{dayOtHours}h OT</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.dayGroupHeaderRight}>
                    <View style={styles.dayGroupTotals}>
                      <Text style={[styles.dayHmrTotal, { color: theme.colors.mute }]}>
                        HMR: {startMeter} → {endMeter}
                      </Text>
                      <Text style={[styles.dayRunningTotal, { color: theme.colors.ink }]}>
                        {dayRunningHours}h M/C RT
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={16} color={theme.colors.mute} />
                    ) : (
                      <ChevronDown size={16} color={theme.colors.mute} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expanded Shifts Mini Table */}
                {isExpanded && (
                  <View style={[styles.dayShiftsList, { borderTopColor: theme.colors.hairline }]}>
                    {dayLogs.map((log) => (
                      <View
                        key={log.id}
                        style={[
                          styles.shiftItemCard,
                          {
                            borderBottomColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.shiftItemTop}>
                          <View style={styles.shiftCodeBadge}>
                            <Text style={styles.shiftCodeText}>
                              {log.shift_code ? `Shift ${log.shift_code}` : log.shift || 'Shift'}
                            </Text>
                          </View>
                          <Text style={[styles.shiftTimingText, { color: theme.colors.mute }]}>
                            {formatShiftTimingRange(log.start_time, log.end_time)}
                          </Text>
                          <View style={styles.shiftHmrPill}>
                            <Text style={[styles.shiftHmrText, { color: theme.colors.ink }]}>
                              {log.start_meter} → {log.end_meter} ({log.running_hours}h)
                            </Text>
                          </View>
                        </View>

                        <View style={styles.shiftItemBottom}>
                          <Text style={[styles.shiftOperatorText, { color: theme.colors.body }]}>
                            {log.operator?.full_name || 'Unassigned'} • {log.machine?.model || log.machine_code}
                          </Text>
                          {log.overtime_hours ? (
                            <Text style={[styles.shiftOtText, { color: '#0070f3' }]}>
                              +{log.overtime_hours}h OT
                            </Text>
                          ) : null}
                        </View>

                        {log.remarks && (
                          <Text style={[styles.shiftRemarksText, { color: theme.colors.mute }]}>
                            {log.remarks}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Export Report Modal */}
      {showExportModal && (
        <OperationsExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          logs={filteredLogs as any}
          viewMode={logsViewMode}
          selectedEntityName={
            logsViewMode === 'machine'
              ? machinesList.find((m) => m.id === selectedMachineId)?.machine_id || 'Machine'
              : logsViewMode === 'client'
              ? clientsList.find((c) => c.id === selectedClientId)?.company_name || 'Client'
              : activeOperators.find((o) => o.id === selectedOperatorId)?.full_name || 'Operator'
          }
          selectedMonthLabel={MONTH_OPTIONS.find((m) => m.id === selectedMonth)?.label || 'All Months'}
          selectedLocationLabel={selectedSiteLocation}
          selectedMachineLabel={
            selectedClientMachineId === 'all'
              ? 'All Machines'
              : machinesList.find((m) => m.id === selectedClientMachineId)?.machine_id
          }
          totalRunningHours={summaryMetrics.totalRunningHours}
          totalOtHours={summaryMetrics.totalOvertimeHours}
          totalBreakdowns={summaryMetrics.totalBreakdowns}
          supervisorName={user?.user_metadata?.full_name || 'Supervisor'}
        />
      )}

      {/* Conflict Resolution Modal */}
      {showConflictModal && selectedConflictLog && (
        <MobileConflictResolutionModal
          visible={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          log={selectedConflictLog as any}
          currentUserId={user?.id || ''}
          onSuccess={() => onRefresh()}
        />
      )}

      {/* Edit Log Modal */}
      {editingLogRecord && (
        <MeterLogModal
          visible={Boolean(editingLogRecord)}
          onClose={() => setEditingLogRecord(null)}
          onSubmit={() => onRefresh()}
          machineId={editingLogRecord.machine_id}
          machineCode={editingLogRecord.machine_code}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  viewModeStrip: {
    borderBottomWidth: 1,
    paddingVertical: spacingNumeric.xs,
  },
  viewModeContent: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.md,
  },
  viewModeTab: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs + 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  viewModeTabActive: {
    borderWidth: 0,
  },
  viewModeTabInactive: {},
  viewModeTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: spacingNumeric.xl * 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 12,
    marginTop: 2,
  },
  controlsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacingNumeric.xs,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  expandAllBtn: {
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 5,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  expandAllText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
  dayGroupCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacingNumeric.md,
  },
  dayGroupHeaderLeft: {
    gap: 4,
  },
  dayGroupDate: {
    fontSize: 15,
    fontWeight: '700',
  },
  dayGroupBadges: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  otBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
  },
  otBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0070f3',
  },
  dayGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  dayGroupTotals: {
    alignItems: 'flex-end',
  },
  dayHmrTotal: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dayRunningTotal: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  dayShiftsList: {
    borderTopWidth: 1,
    paddingHorizontal: spacingNumeric.md,
  },
  shiftItemCard: {
    borderBottomWidth: 1,
    paddingVertical: spacingNumeric.sm,
    gap: 4,
  },
  shiftItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  shiftCodeBadge: {
    backgroundColor: '#0070f315',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
  },
  shiftCodeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0070f3',
  },
  shiftTimingText: {
    fontSize: 12.5,
    flex: 1,
  },
  shiftHmrPill: {},
  shiftHmrText: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shiftItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftOperatorText: {
    fontSize: 12.5,
  },
  shiftOtText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  shiftRemarksText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
