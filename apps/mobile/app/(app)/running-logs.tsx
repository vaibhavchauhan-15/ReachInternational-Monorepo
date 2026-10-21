import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useTheme,
  MobileHeader,
  HeaderActionItem,
  EmptyState,
  ErrorState,
  PermissionDeniedView,
  SearchInput,
  SegmentedToggle,
  Text,
} from '../../components/ui';
import {
  MobileConflictResolutionModal,
  OperationsExportModal,
  OperationLogListSkeleton,
  RunningLogFilterPanel,
  RunningLogShiftCard,
  RunningLogSummaryCard,
  RunningLogMachineHeaderCard,
  type LogsViewMode,
} from '../../components/operations';
import {
  useOperationsMasterData,
  useOperationsLogs,
  type HourLogRecord,
  type MachineWithAssignments,
} from '../../lib/hooks/useOperationsData';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  AlertTriangle,
  RefreshCw,
  Printer,
  Search,
} from '../../components/ui/icon';

export type { HourLogRecord } from '../../lib/hooks/useOperationsData';

export default function RunningLogsScreen() {
  const { theme, isDark } = useTheme();
  const { role, user } = useAuth();
  const router = useRouter();

  // Guard: Restrict operator role from accessing Daily Running Logs
  const isOperator = (role || '').toLowerCase() === 'operator';

  if (role && isOperator) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader title="Running logs" showBack={false} />
        <PermissionDeniedView
          featureName="Daily Running Logs"
          currentRole={role}
          requiredRoles={['super_admin', 'admin', 'manager', 'supervisor']}
        />
      </View>
    );
  }

  // View Mode: 'machine' | 'client' | 'operator'
  const [logsViewMode, setLogsViewMode] = useState<LogsViewMode>('client');

  const getCurrentMonthValue = (): string => {
    const m = new Date().getMonth() + 1;
    return m < 10 ? `0${m}` : `${m}`;
  };

  // Filter States
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSiteLocation, setSelectedSiteLocation] = useState<string>('');
  const [selectedClientMachineId, setSelectedClientMachineId] = useState<string>('all');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthValue());
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Search
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [selectedConflictLog, setSelectedConflictLog] = useState<HourLogRecord | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Master Data Hook
  const {
    data: masterData,
    isError: isMasterError,
    error: masterError,
    refetch: refetchMaster,
  } = useOperationsMasterData();

  const machinesList = useMemo(() => masterData?.machinesList || [], [masterData]);
  const clientsList = useMemo(() => masterData?.clientsList || [], [masterData]);
  const clientSites = useMemo(() => masterData?.clientSites || [], [masterData]);
  const activeOperators = useMemo(() => masterData?.activeOperators || [], [masterData]);

  // Initialize selections once master data arrives
  useEffect(() => {
    if (!masterData) return;
    if (!selectedClientId && masterData.clientsList.length > 0) {
      setSelectedClientId(masterData.clientsList[0].id);
    }
    if (!selectedMachineId && masterData.machinesList.length > 0) {
      setSelectedMachineId(masterData.machinesList[0].id);
    }
    if (!selectedOperatorId && masterData.activeOperators.length > 0) {
      setSelectedOperatorId(masterData.activeOperators[0].id);
    }
  }, [masterData, selectedClientId, selectedMachineId, selectedOperatorId]);

  // Build Normalized Query Filters for TanStack Query
  const logsQueryFilters = useMemo(() => {
    return {
      viewMode: logsViewMode,
      machineId: logsViewMode === 'machine' ? selectedMachineId : undefined,
      clientId: logsViewMode === 'client' ? selectedClientId : undefined,
      operatorId: logsViewMode === 'operator' ? selectedOperatorId : undefined,
      month: selectedMonth,
      customStart: selectedMonth === 'custom' ? customStartDate : undefined,
      customEnd: selectedMonth === 'custom' ? customEndDate : undefined,
      search: debouncedSearch || undefined,
      site: selectedSiteLocation || undefined,
    };
  }, [
    logsViewMode,
    selectedMachineId,
    selectedClientId,
    selectedOperatorId,
    selectedMonth,
    customStartDate,
    customEndDate,
    debouncedSearch,
    selectedSiteLocation,
  ]);

  // Query logs from TanStack Query
  const {
    data: rawLogsData,
    isLoading: isLogsLoading,
    isError: isLogsError,
    error: logsError,
    refetch: refetchLogs,
  } = useOperationsLogs(logsQueryFilters);

  const logs = useMemo<HourLogRecord[]>(() => {
    return (rawLogsData as HourLogRecord[]) || [];
  }, [rawLogsData]);

  // On refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMaster(), refetchLogs()]);
    setRefreshing(false);
  }, [refetchMaster, refetchLogs]);

  // Compute Client Machines for selected client
  const clientMachines = useMemo<MachineWithAssignments[]>(() => {
    if (!selectedClientId) return [];
    const directMachines = machinesList.filter((m) => m.client_id === selectedClientId);

    // Also include machines that have logs recorded under this client
    const logMachineIds = new Set<string>();
    logs.forEach((l) => {
      if (l.client_id === selectedClientId && l.machine_id) {
        logMachineIds.add(l.machine_id);
      }
    });

    const additionalMachines = machinesList.filter(
      (m) => logMachineIds.has(m.id) && !directMachines.some((dm) => dm.id === m.id)
    );

    return [...directMachines, ...additionalMachines];
  }, [selectedClientId, machinesList, logs]);

  // Active Client, Machine, and Operator Objects
  const activeClient = useMemo(() => {
    return clientsList.find((c) => c.id === selectedClientId) || clientsList[0] || null;
  }, [clientsList, selectedClientId]);

  const activeMachine = useMemo(() => {
    return machinesList.find((m) => m.id === selectedMachineId) || machinesList[0] || null;
  }, [machinesList, selectedMachineId]);

  const activeOperator = useMemo(() => {
    return activeOperators.find((o) => o.id === selectedOperatorId) || activeOperators[0] || null;
  }, [activeOperators, selectedOperatorId]);

  // Filter logs for the active view mode
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Client view matching
      if (logsViewMode === 'client') {
        if (selectedClientId && log.client_id && log.client_id !== selectedClientId) {
          return false;
        }
        if (selectedSiteLocation && log.location !== selectedSiteLocation) {
          return false;
        }
        if (selectedClientMachineId && selectedClientMachineId !== 'all') {
          if (log.machine_id !== selectedClientMachineId) return false;
        }
      }

      // Machine view matching
      if (logsViewMode === 'machine') {
        if (selectedMachineId && log.machine_id && log.machine_id !== selectedMachineId) {
          return false;
        }
      }

      // Operator view matching
      if (logsViewMode === 'operator') {
        if (selectedOperatorId && log.operator_id && log.operator_id !== selectedOperatorId) {
          return false;
        }
      }

      // Month matching
      if (selectedMonth && selectedMonth !== 'all' && selectedMonth !== 'custom') {
        const logMonth = log.log_date ? log.log_date.slice(5, 7) : '';
        if (logMonth && logMonth !== selectedMonth) return false;
      }

      // Custom date range matching
      if (selectedMonth === 'custom' && customStartDate && customEndDate) {
        if (log.log_date && (log.log_date < customStartDate || log.log_date > customEndDate)) {
          return false;
        }
      }

      // Free text search matching
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchesMachine =
          (log.machine_code || '').toLowerCase().includes(q) ||
          (log.machine?.model || '').toLowerCase().includes(q) ||
          (log.machine?.serial_number || '').toLowerCase().includes(q);
        const matchesOperator = (log.operator?.full_name || '').toLowerCase().includes(q);
        const matchesClient = (log.client?.company_name || '').toLowerCase().includes(q);
        const matchesRemarks = (log.remarks || '').toLowerCase().includes(q);
        if (!matchesMachine && !matchesOperator && !matchesClient && !matchesRemarks) {
          return false;
        }
      }

      return true;
    });
  }, [
    logs,
    logsViewMode,
    selectedClientId,
    selectedSiteLocation,
    selectedClientMachineId,
    selectedMachineId,
    selectedOperatorId,
    selectedMonth,
    customStartDate,
    customEndDate,
    debouncedSearch,
  ]);

  // Conflict Logs
  const pendingConflicts = useMemo(() => {
    return filteredLogs.filter((l) => l.conflict_flag && l.conflict_status !== 'resolved');
  }, [filteredLogs]);

  // Overall summary metrics for active view
  const summaryMetrics = useMemo(() => {
    let totalRunHours = 0;
    let totalWorkingHours = 0;
    let totalBreakdowns = 0;
    const dateSet = new Set<string>();

    filteredLogs.forEach((l) => {
      totalRunHours += Number(l.running_hours) || 0;
      totalWorkingHours +=
        (Number(l.normal_working_hours) || 8) + (Number(l.overtime_hours) || 0);
      if (l.is_breakdown) totalBreakdowns++;
      if (l.log_date) dateSet.add(l.log_date);
    });

    return {
      totalRunHours: Math.round(totalRunHours * 10) / 10,
      totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
      totalBreakdowns,
      totalDays: dateSet.size,
    };
  }, [filteredLogs]);

  // Group logs by machine for Client View
  const clientMachineGroups = useMemo(() => {
    if (logsViewMode !== 'client') return [];

    const logsByMachId = new Map<string, HourLogRecord[]>();
    filteredLogs.forEach((l) => {
      const mId = l.machine_id || (l.machine as any)?.id || 'unassigned';
      const existing = logsByMachId.get(mId);
      if (existing) {
        existing.push(l);
      } else {
        logsByMachId.set(mId, [l]);
      }
    });

    const targetMachineList: {
      machine: MachineWithAssignments;
      logs: HourLogRecord[];
      totalDays: number;
      totalRunHours: number;
      totalWorkingHours: number;
    }[] = [];

    // Prioritize selected machine if specific machine selected
    if (selectedClientMachineId && selectedClientMachineId !== 'all') {
      const mach = clientMachines.find((m) => m.id === selectedClientMachineId);
      const machLogs = logsByMachId.get(selectedClientMachineId) || [];
      if (mach) {
        const dates = new Set(machLogs.map((l) => l.log_date));
        const runH = machLogs.reduce((acc, cur) => acc + (Number(cur.running_hours) || 0), 0);
        const workH = machLogs.reduce(
          (acc, cur) =>
            acc + (Number(cur.normal_working_hours) || 8) + (Number(cur.overtime_hours) || 0),
          0
        );
        targetMachineList.push({
          machine: mach,
          logs: machLogs.sort((a, b) => b.log_date.localeCompare(a.log_date)),
          totalDays: dates.size,
          totalRunHours: Math.round(runH * 10) / 10,
          totalWorkingHours: Math.round(workH * 10) / 10,
        });
      }
      return targetMachineList;
    }

    // All machines that belong to client or have logs
    clientMachines.forEach((mach) => {
      const machLogs = logsByMachId.get(mach.id) || [];
      if (machLogs.length > 0) {
        const dates = new Set(machLogs.map((l) => l.log_date));
        const runH = machLogs.reduce((acc, cur) => acc + (Number(cur.running_hours) || 0), 0);
        const workH = machLogs.reduce(
          (acc, cur) =>
            acc + (Number(cur.normal_working_hours) || 8) + (Number(cur.overtime_hours) || 0),
          0
        );
        targetMachineList.push({
          machine: mach,
          logs: machLogs.sort((a, b) => b.log_date.localeCompare(a.log_date)),
          totalDays: dates.size,
          totalRunHours: Math.round(runH * 10) / 10,
          totalWorkingHours: Math.round(workH * 10) / 10,
        });
      }
    });

    return targetMachineList;
  }, [logsViewMode, filteredLogs, selectedClientMachineId, clientMachines]);

  // Machine / Operator sorted logs list
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => (b.log_date || '').localeCompare(a.log_date || ''));
  }, [filteredLogs]);

  // Header 3-dot Menu Actions
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

  const handleOpenConflictModal = useCallback((log: HourLogRecord) => {
    setSelectedConflictLog(log);
    setShowConflictModal(true);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setSelectedMonth(getCurrentMonthValue());
    setSelectedSiteLocation('');
    setSelectedClientMachineId('all');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Main Header with Back Arrow, Title, Search Icon, 3-Dot More Menu */}
      <MobileHeader
        title="Running logs"
        showBack={true}
        showQuickAccess={false}
        showMoreMenu={true}
        onPressBack={() => router.back()}
        actions={headerActions}
        onSearchPress={() => setIsSearchVisible((prev) => !prev)}
      />

      {/* Optional Search Input Bar (smooth toggle) */}
      {isSearchVisible && (
        <View
          style={[
            styles.searchBarWrapper,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderBottomColor: theme.colors.hairline,
            },
          ]}
        >
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by model, code, operator, remarks..."
            onClear={() => setSearch('')}
            autoFocus={true}
          />
        </View>
      )}

      {/* 2. Top Navbar: Segmented Mode Toggle (Clients | Machine | Operator) - 100% operations.tsx parity */}
      <View style={styles.segmentedToggleWrapper}>
        <SegmentedToggle<LogsViewMode>
          items={[
            { id: 'client', label: 'Clients' },
            { id: 'machine', label: 'Machine' },
            { id: 'operator', label: 'Operator' },
          ]}
          value={logsViewMode}
          onChange={(mode) => setLogsViewMode(mode)}
          size="md"
        />
      </View>

      {/* Main Scrollable Body */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.link}
          />
        }
      >
        {/* Reusable Filter Card */}
        <RunningLogFilterPanel
          viewMode={logsViewMode}
          onViewModeChange={(mode) => setLogsViewMode(mode)}
          showToggle={false}
          machines={machinesList}
          clients={clientsList}
          clientSites={clientSites}
          operators={activeOperators}
          clientMachines={clientMachines}
          selectedClientId={selectedClientId}
          onSelectClient={(id) => {
            setSelectedClientId(id);
            setSelectedSiteLocation('');
            setSelectedClientMachineId('all');
          }}
          selectedSite={selectedSiteLocation}
          onSelectSite={(site) => setSelectedSiteLocation(site)}
          selectedClientMachineId={selectedClientMachineId}
          onSelectClientMachine={(mId) => setSelectedClientMachineId(mId)}
          selectedMachineId={selectedMachineId}
          onSelectMachine={(id) => setSelectedMachineId(id)}
          selectedOperatorId={selectedOperatorId}
          onSelectOperator={(id) => setSelectedOperatorId(id)}
          selectedMonth={selectedMonth}
          onSelectMonth={(m) => setSelectedMonth(m)}
          customStartDate={customStartDate}
          onSelectCustomStartDate={(d) => setCustomStartDate(d)}
          customEndDate={customEndDate}
          onSelectCustomEndDate={(d) => setCustomEndDate(d)}
        />

        {/* View Mode Content Feeds */}
        {isLogsLoading && logs.length === 0 ? (
          <OperationLogListSkeleton count={4} />
        ) : (isLogsError || isMasterError) && logs.length === 0 ? (
          <ErrorState
            error={logsError || masterError}
            onRetry={onRefresh}
            actionLabel="Retry Loading Logs"
          />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No Running Logs Found"
            description="No running hour logs have been recorded in the platform."
          />
        ) : (
          <View style={styles.feedWrapper}>
            {/* 1. CLIENT VIEW: Summary Card + Machine Sub-Groups + Shift Cards */}
            {logsViewMode === 'client' && (
              <>
                <RunningLogSummaryCard
                  viewMode="client"
                  client={activeClient}
                  clientMachinesCount={clientMachines.length}
                  totalRunHours={summaryMetrics.totalRunHours}
                  totalWorkingHours={summaryMetrics.totalWorkingHours}
                  totalBreakdowns={summaryMetrics.totalBreakdowns}
                  totalDays={summaryMetrics.totalDays}
                />

                {clientMachineGroups.length === 0 ? (
                  <View
                    style={[
                      styles.quietEmptyCard,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center' }}>
                      {debouncedSearch.trim()
                        ? `No daily running hour logs matched "${debouncedSearch.trim()}".`
                        : 'No daily running hour logs found matching active filters.'}
                    </Text>
                  </View>
                ) : (
                  clientMachineGroups.map((group) => (
                    <View key={group.machine.id} style={styles.machineGroupBlock}>
                      <RunningLogMachineHeaderCard
                        model={group.machine.model || 'Equipment'}
                        serialNumber={group.machine.serial_number}
                        machineCode={group.machine.machine_id}
                        totalDays={group.totalDays}
                        totalRunHours={group.totalRunHours}
                        totalWorkingHours={group.totalWorkingHours}
                      />

                      {group.logs.map((log, idx) => (
                        <RunningLogShiftCard
                          key={log.id}
                          log={log}
                          logsViewMode="client"
                          searchTerm={debouncedSearch}
                          onOpenConflictModal={handleOpenConflictModal}
                          isLast={idx === group.logs.length - 1}
                        />
                      ))}
                    </View>
                  ))
                )}
              </>
            )}

            {/* 2. MACHINE VIEW: Summary Card + Shift Cards */}
            {logsViewMode === 'machine' && (
              <>
                <RunningLogSummaryCard
                  viewMode="machine"
                  machine={activeMachine}
                  totalRunHours={summaryMetrics.totalRunHours}
                  totalWorkingHours={summaryMetrics.totalWorkingHours}
                  totalBreakdowns={summaryMetrics.totalBreakdowns}
                  totalDays={summaryMetrics.totalDays}
                  onOpenHistoryModal={() => {
                    if (activeMachine?.id) {
                      router.push(`/machines?search=${activeMachine.machine_id || activeMachine.model}`);
                    }
                  }}
                />

                {sortedLogs.length === 0 ? (
                  <View
                    style={[
                      styles.quietEmptyCard,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center' }}>
                      {debouncedSearch.trim()
                        ? `No daily running hour logs matched "${debouncedSearch.trim()}".`
                        : 'No daily running hour logs found matching active filters.'}
                    </Text>
                  </View>
                ) : (
                  sortedLogs.map((log, idx) => (
                    <RunningLogShiftCard
                      key={log.id}
                      log={log}
                      logsViewMode="machine"
                      searchTerm={debouncedSearch}
                      onOpenConflictModal={handleOpenConflictModal}
                      isLast={idx === sortedLogs.length - 1}
                    />
                  ))
                )}
              </>
            )}

            {/* 3. OPERATOR VIEW: Summary Card + Shift Cards */}
            {logsViewMode === 'operator' && (
              <>
                <RunningLogSummaryCard
                  viewMode="operator"
                  operator={activeOperator}
                  totalRunHours={summaryMetrics.totalRunHours}
                  totalWorkingHours={summaryMetrics.totalWorkingHours}
                  totalBreakdowns={summaryMetrics.totalBreakdowns}
                  totalDays={summaryMetrics.totalDays}
                />

                {sortedLogs.length === 0 ? (
                  <View
                    style={[
                      styles.quietEmptyCard,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center' }}>
                      {debouncedSearch.trim()
                        ? `No daily running hour logs matched "${debouncedSearch.trim()}".`
                        : 'No daily running hour logs found matching active filters.'}
                    </Text>
                  </View>
                ) : (
                  sortedLogs.map((log, idx) => (
                    <RunningLogShiftCard
                      key={log.id}
                      log={log}
                      logsViewMode="operator"
                      searchTerm={debouncedSearch}
                      onOpenConflictModal={handleOpenConflictModal}
                      isLast={idx === sortedLogs.length - 1}
                    />
                  ))
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Conflict Resolution Modal */}
      {selectedConflictLog && (
        <MobileConflictResolutionModal
          visible={showConflictModal}
          log={selectedConflictLog as any}
          currentUserId={user?.id || ''}
          onClose={() => {
            setShowConflictModal(false);
            setSelectedConflictLog(null);
          }}
          onSuccess={() => {
            setShowConflictModal(false);
            setSelectedConflictLog(null);
            onRefresh();
          }}
        />
      )}

      {/* Export / Print Report Modal */}
      <OperationsExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        logs={filteredLogs}
        viewMode={logsViewMode}
        selectedEntityName={
          logsViewMode === 'client'
            ? activeClient?.company_name || 'All Clients'
            : logsViewMode === 'machine'
            ? activeMachine?.model || 'All Machines'
            : activeOperator?.full_name || 'All Operators'
        }
        selectedMonthLabel={
          selectedMonth === 'all'
            ? 'All Months'
            : selectedMonth === 'custom'
            ? `${customStartDate || 'Start'} to ${customEndDate || 'End'}`
            : 'Selected Month'
        }
        totalRunningHours={summaryMetrics.totalRunHours}
        totalBreakdowns={summaryMetrics.totalBreakdowns}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedToggleWrapper: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  searchBarWrapper: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacingNumeric.md,
    paddingBottom: 110,
  },
  feedWrapper: {
    gap: spacingNumeric.xs,
  },
  machineGroupBlock: {
    marginBottom: spacingNumeric.md,
  },
  quietEmptyCard: {
    padding: spacingNumeric.lg,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacingNumeric.sm,
  },
});
