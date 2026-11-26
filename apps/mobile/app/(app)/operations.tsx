import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTheme,
  MobileHeader,
  HeaderActionItem,
  Button,
  Text,
  useToast,
  ConfirmDialog,
  SegmentedToggle,
} from '../../components/ui';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { MobileConflictResolutionModal } from '../../components/operations/MobileConflictResolutionModal';
import { OperationsExportModal } from '../../components/operations/OperationsExportModal';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  useOperatorEntryContext,
  useOperatorHistoryCount,
  type HourLogRecord,
  type OperatorHistoryPageChunk,
} from '../../lib/hooks/useOperationsData';
import { MobileOperatorEntryCard } from '../../components/operations/MobileOperatorEntryCard';
import { MobileOperatorHistoryTab } from '../../components/operations/MobileOperatorHistoryTab';
import { MobileTodayShiftMonitorTab } from '../../components/operations/MobileTodayShiftMonitorTab';
import { MobileAssignPersonnelModal } from '../../components/operations/MobileAssignPersonnelModal';
import { LogsheetImportModal } from '../../components/operations/LogsheetImportModal';
import type { TodayShiftMonitorRow } from '@reachinternational/types';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric } from '@reachinternational/design-tokens';
import {
  formatDate,
  sanitizeDatabaseError,
} from '@reachinternational/utils';
import { useScreenSync } from '../../lib/offline';
import {
  AlertTriangle,
  Printer,
  UserPlus,
  FileSpreadsheet,
} from '../../components/ui/icon';
import {
  isManagerOrAbove,
  isSupervisorOrAbove,
  MACHINE_CAPABILITIES,
  hasMachineCapability,
} from '@reachinternational/permissions';

export type OpsTab = 'entry' | 'history' | 'today';
export type LogsViewMode = 'machine' | 'client' | 'operator';

export type { HourLogRecord };

/**
 * Module-level constant: an inline `[]` in the render body produces a new identity on every
 * render, which silently defeats React.memo on the memoized child tabs.
 */
const EMPTY_CONFLICTS: HourLogRecord[] = [];

export default function OperationsScreen() {
  const { theme, isDark } = useTheme();
  const { role, user, userProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isOperator = (role || '').toLowerCase() === 'operator';
  const userRoleLower = (role || '').toLowerCase();
  const isSuperAdmin = userRoleLower === 'super_admin';
  const isManagerTier = isManagerOrAbove(userRoleLower);
  const canFillShiftEntry = isSupervisorOrAbove(userRoleLower);
  const params = useLocalSearchParams<{ tab?: string; shift?: string }>();

  const [activeTab, setActiveTab] = useState<OpsTab>(() => {
    if (params.tab === 'entry' || params.tab === 'history' || params.tab === 'today') {
      return params.tab as OpsTab;
    }
    return isOperator ? 'entry' : 'today';
  });

  const {
    data: entryContext,
    isLoading: isEntryLoading,
    isError: isEntryError,
    error: entryError,
    refetch: refetchEntryContext,
  } = useOperatorEntryContext(isOperator ? user?.id : undefined);

  // Ultra-lightweight HEAD count query for tab badge (transfers ZERO row payload, ~10ms)
  const { data: operatorHistoryCount, isLoading: isHistoryCountLoading } = useOperatorHistoryCount(isOperator ? user?.id : undefined);

  const lastParamTabRef = useRef(params.tab);
  const lastParamShiftRef = useRef(params.shift);

  useEffect(() => {
    const tabChanged = params.tab !== lastParamTabRef.current;
    const shiftChanged = params.shift !== lastParamShiftRef.current;

    lastParamTabRef.current = params.tab;
    lastParamShiftRef.current = params.shift;

    if (!tabChanged && !shiftChanged) return;

    if (params.tab && (params.tab === 'entry' || params.tab === 'history' || params.tab === 'today')) {
      setActiveTab(params.tab as OpsTab);
      if (params.tab === 'history') {
        setHasLoadedHistory(true);
      }
    } else if (params.shift && isOperator) {
      setActiveTab('entry');
    }
  }, [params.tab, params.shift, isOperator]);

  // Assisted Shift Entry state for Supervisors/Managers/Admins
  const [assistedRow, setAssistedRow] = useState<TodayShiftMonitorRow | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Refreshing State
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals States
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [selectedConflictLog, setSelectedConflictLog] = useState<HourLogRecord | null>(null);
  const [showAllConflicts, setShowAllConflicts] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Deletion state
  const [logToDelete, setLogToDelete] = useState<HourLogRecord | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  // Edit Log state
  const [editingLogRecord, setEditingLogRecord] = useState<HourLogRecord | null>(null);

  // Single canonical refresh cascade.
  // Note: invalidateQueries already refetches active queries, so the entry-context query is
  // NOT additionally refetched imperatively — that duplicated the RPC on every refresh.
  const handleDataRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['operator', 'entry-context'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-infinite'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-count'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-monitor'] }),
      queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }, [queryClient]);

  useScreenSync({
    screen: 'operations',
    onRefresh: handleDataRefresh,
  });

  const handleEditLog = useCallback((log: HourLogRecord) => {
    setEditingLogRecord(log);
  }, []);

  const handleDeleteLog = useCallback(
    (log: HourLogRecord) => {
      if (!isSuperAdmin) {
        toast('error', 'Permission Denied', 'Only Super Admin is authorized to delete daily running hour logs.');
        return;
      }
      setLogToDelete(log);
    },
    [isSuperAdmin, toast]
  );

  const handleConfirmDeleteLog = useCallback(async () => {
    if (!logToDelete) return;
    const log = logToDelete;
    setIsDeletingLog(true);

    // Optimistic removal: drop the row from every cached history surface before the network
    // call so the list responds immediately, then roll back on failure / reconcile on success.
    const historyInfiniteSnapshot = queryClient.getQueriesData<OperatorHistoryPageChunk>({
      queryKey: ['operator', 'history-infinite'],
    });
    const historyListSnapshot = queryClient.getQueriesData<HourLogRecord[]>({
      queryKey: ['operator', 'history-logs'],
    });
    const historyCountSnapshot = queryClient.getQueriesData<number>({
      queryKey: ['operator', 'history-count'],
    });

    const rollback = () => {
      historyInfiniteSnapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      historyListSnapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      historyCountSnapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    };

    queryClient.setQueriesData<OperatorHistoryPageChunk>(
      { queryKey: ['operator', 'history-infinite'] },
      (page) =>
        page
          ? {
              ...page,
              logs: page.logs.filter((l) => l.id !== log.id),
              totalCount: Math.max(0, page.totalCount - 1),
            }
          : page
    );
    queryClient.setQueriesData<HourLogRecord[]>(
      { queryKey: ['operator', 'history-logs'] },
      (logs) => (Array.isArray(logs) ? logs.filter((l) => l.id !== log.id) : logs)
    );
    queryClient.setQueriesData<number>({ queryKey: ['operator', 'history-count'] }, (count) =>
      typeof count === 'number' ? Math.max(0, count - 1) : count
    );

    try {
      const { error } = await supabase
        .from('machine_hour_logs')
        .delete()
        .eq('id', log.id);
      if (error) {
        rollback();
        toast('error', 'Delete Failed', sanitizeDatabaseError(error, 'Failed to delete log.').message);
        return;
      }
      if (log.machine_id) {
        const { data: latest } = await supabase
          .from('machine_hour_logs')
          .select('end_meter')
          .eq('machine_id', log.machine_id)
          .order('log_date', { ascending: false })
          .order('end_meter', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest && typeof latest.end_meter === 'number') {
          await supabase
            .from('machines')
            .update({ hour_meter: latest.end_meter, updated_at: new Date().toISOString() })
            .eq('id', log.machine_id);
        }
      }
      toast('success', 'Daily Log Deleted', `The running hour log for ${log.machine?.model || log.machine_code || 'equipment'} has been deleted.`);
      setLogToDelete(null);
      await handleDataRefresh();
    } catch (err: any) {
      rollback();
      toast('error', 'Delete Failed', sanitizeDatabaseError(err, 'Failed to delete log.').message);
    } finally {
      setIsDeletingLog(false);
    }
  }, [logToDelete, handleDataRefresh, toast, queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await handleDataRefresh();
    setRefreshing(false);
  }, [handleDataRefresh]);

  const pendingConflicts = EMPTY_CONFLICTS;

  const handleOpenConflictModal = useCallback((log: HourLogRecord) => {
    setSelectedConflictLog(log);
    setShowConflictModal(true);
  }, []);

  // Stable close handlers: these are passed to always-mounted, memoized modals, so an inline
  // arrow here would re-render the whole modal tree on every Operations render.
  const handleCloseEditLog = useCallback(() => setEditingLogRecord(null), []);
  const handleCloseConflictModal = useCallback(() => setShowConflictModal(false), []);
  const handleCloseExportModal = useCallback(() => setShowExportModal(false), []);
  const handleCloseAssistedRow = useCallback(() => setAssistedRow(null), []);
  const handleCloseDeleteDialog = useCallback(() => setLogToDelete(null), []);

  const handleAssignModalSuccess = useCallback(() => {
    // Prefix invalidation also covers the paginated `today-shift-monitor-infinite` roster
    queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-monitor'] });
    queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-summary'] });
  }, [queryClient]);

  const handleMonitorEnterLog = useCallback(
    (row: TodayShiftMonitorRow) => {
      if (canFillShiftEntry) {
        setAssistedRow(row);
      }
    },
    [canFillShiftEntry]
  );

  const handleOpenAssignModal = useCallback(() => setIsAssignModalOpen(true), []);
  const handleCloseAssignModal = useCallback(() => setIsAssignModalOpen(false), []);

  // Admin-only bulk logsheet import entry (Excel upload runs on the web portal)
  const canImportLogsheets = hasMachineCapability(
    (role || userProfile?.role || '').toLowerCase(),
    MACHINE_CAPABILITIES.LOGS_IMPORT
  );
  const [importModalOpen, setImportModalOpen] = useState(false);

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    if (!isOperator) {
      list.push({
        id: 'assign-operator',
        label: 'Assign Operator',
        icon: <UserPlus size={16} color={theme.colors.link} />,
        onPress: handleOpenAssignModal,
      });
    }

    list.push({
      id: 'export-print',
      label: 'Export / Print Report',
      icon: <Printer size={16} color={theme.colors.ink} />,
      onPress: () => setShowExportModal(true),
    });

    if (canImportLogsheets) {
      list.push({
        id: 'import-logsheet',
        label: 'Import Logsheet (Excel)',
        icon: <FileSpreadsheet size={16} color={theme.colors.ink} />,
        onPress: () => setImportModalOpen(true),
      });
    }

    return list;
  }, [theme.colors.ink, theme.colors.link, isOperator, handleOpenAssignModal, canImportLogsheets]);

  // Lazy loading state: History tab is only mounted on first user visit, then preserved in memory
  const [hasLoadedHistory, setHasLoadedHistory] = useState(() => activeTab === 'history');

  const toggleOptions = useMemo(
    () => [
      { id: 'entry' as const, label: 'Shift' },
      {
        id: 'history' as const,
        label: 'Log History',
        count: isOperator && !isHistoryCountLoading && operatorHistoryCount && operatorHistoryCount > 0 ? operatorHistoryCount : undefined,
      },
    ],
    [isOperator, isHistoryCountLoading, operatorHistoryCount]
  );
  const segmentedItems = toggleOptions;

  const handleTabChange = useCallback(
    (tab: 'entry' | 'history') => {
      setActiveTab(tab);
      if (tab === 'history') {
        setHasLoadedHistory(true);
      }
      lastParamTabRef.current = tab;
      router.setParams({ tab });
    },
    [router]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>

      {/* 1. TOP STANDARDIZED MOBILE HEADER: [Logo] + [Page Title] + [Quick Access] + [3-Dot Actions] */}
      <MobileHeader
        title={isOperator ? 'Operations' : "Today's Shift Logs"}
        showBack={true}
        backRoute="/dashboard"
        actions={headerActions}
      />

      {/* 2. TOP NAVBAR (SEGMENTED SLIDING TOGGLE: SHIFT VS LOG HISTORY) */}
      {(isOperator || activeTab === 'entry' || activeTab === 'history') && activeTab !== 'today' && (
        <View style={styles.segmentedToggleWrapper}>
          <SegmentedToggle
            value={activeTab === 'history' ? 'history' : 'entry'}
            onChange={(val) => handleTabChange(val as 'entry' | 'history')}
            options={segmentedItems}
            size="md"
            fullWidth
          />
        </View>
      )}

      {/* 2. TAB: OPERATOR LOG ENTRY (Zero-unmount persistent viewport for 0ms instant toggle) */}
      {(isOperator || activeTab === 'entry' || activeTab === 'history') && activeTab !== 'today' && (
        <View
          key="entry-tab"
          style={[
            styles.tabContainer,
            { display: activeTab === 'entry' ? 'flex' : 'none' },
          ]}
        >
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[styles.contentContainer, { paddingHorizontal: 0, paddingTop: 4 }]}
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}
            indicatorStyle={isDark ? 'white' : 'black'}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
          >
            <MobileOperatorEntryCard
              entryContext={entryContext}
              isLoading={isEntryLoading}
              isError={isEntryError}
              error={entryError}
              onRetry={refetchEntryContext}
              onSuccess={handleDataRefresh}
              initialShift={typeof params.shift === 'string' ? params.shift : undefined}
            />
          </ScrollView>
        </View>
      )}

      {/* 2.5. TODAY'S SHIFT MONITOR (SUPERVISORS / MANAGERS / ADMINS) */}
      {!isOperator && activeTab === 'today' && (
        <Animated.View
          key="today-tab"
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          style={styles.todayContainer}
        >
          <MobileTodayShiftMonitorTab
            actorId={user?.id}
            userRole={role || userProfile?.role}
            onEnterLog={handleMonitorEnterLog}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </Animated.View>
      )}

      {/* 3. TAB: OPERATOR LOG HISTORY (Lazy loaded on first click, kept alive with 0ms instant display toggle) */}
      {(isOperator || activeTab === 'history') && hasLoadedHistory && (
        <View
          key="history-tab"
          style={[
            styles.historyContainer,
            { display: activeTab === 'history' ? 'flex' : 'none' },
          ]}
        >
          <MobileOperatorHistoryTab
            user={user}
            assignedMachine={entryContext?.machine}
            onEditLog={handleEditLog}
            refreshing={refreshing}
            onRefresh={onRefresh}
            pendingConflicts={pendingConflicts}
            showAllConflicts={showAllConflicts}
            setShowAllConflicts={setShowAllConflicts}
            onOpenConflictModal={handleOpenConflictModal}
          />
        </View>
      )}

      {/* Edit Machine Hour Log Modal */}
      {editingLogRecord && (
        <MeterLogModal
          visible={Boolean(editingLogRecord)}
          onClose={handleCloseEditLog}
          existingLog={editingLogRecord}
          machineId={editingLogRecord.machine_id}
          machineCode={editingLogRecord.machine?.machine_id || editingLogRecord.machine_code}
          model={editingLogRecord.machine?.model}
          serialNumber={editingLogRecord.machine?.serial_number}
          onSubmit={async () => {
            setEditingLogRecord(null);
            await handleDataRefresh();
          }}
        />
      )}

      {/* Review Overtime Conflict Modal */}
      <MobileConflictResolutionModal
        visible={showConflictModal}
        onClose={handleCloseConflictModal}
        log={selectedConflictLog}
        currentUserId={user?.id || ''}
        onSuccess={handleDataRefresh}
      />

      {/* Export / Print Modal (Loaded strictly on demand with server-side fetch) */}
      {showExportModal && (
        <OperationsExportModal
          visible={showExportModal}
          onClose={handleCloseExportModal}
          fetchParams={{
            viewMode: isOperator ? 'operator' : 'machine',
            operatorId: isOperator ? user?.id : undefined,
          }}
          viewMode={isOperator ? 'operator' : 'machine'}
          selectedEntityName={isOperator ? (userProfile?.full_name || 'Operator') : 'All Equipment'}
          selectedMonthLabel="All Months"
          supervisorName={userProfile?.full_name || 'Supervisor'}
        />
      )}

      {/* Admin-only Bulk Machine Logsheet Import guide (Excel upload runs on the web portal) */}
      {canImportLogsheets && (
        <LogsheetImportModal
          visible={importModalOpen}
          onClose={() => setImportModalOpen(false)}
        />
      )}

      {/* Assisted Shift Entry Modal for Supervisors, Managers & Admins */}
      {assistedRow && canFillShiftEntry && (
        <MeterLogModal
          visible={Boolean(assistedRow && canFillShiftEntry)}
          onClose={handleCloseAssistedRow}
          machineId={assistedRow.machine_id}
          machineCode={assistedRow.machine_code}
          model={assistedRow.machine_model || undefined}
          serialNumber={assistedRow.machine_serial_number || undefined}
          targetOperatorId={assistedRow.operator_id || undefined}
          targetOperatorName={assistedRow.operator_name || undefined}
          currentUserId={user?.id || userProfile?.id}
          currentUserRole={role || userProfile?.role}
          currentUserName={userProfile?.full_name}
          initialClientId={assistedRow.client_id || undefined}
          initialShiftCode={assistedRow.shift_code || undefined}
          initialAssignedShiftCodes={assistedRow.shift_code ? [assistedRow.shift_code] : undefined}
          initialStartMeter={assistedRow.status === 'entered' && assistedRow.start_meter != null ? assistedRow.start_meter : (assistedRow.current_meter != null ? assistedRow.current_meter : (assistedRow.start_meter ?? undefined))}
          initialLogDate={assistedRow.log_date || undefined}
          existingLog={assistedRow.log_id ? {
            id: assistedRow.log_id,
            machine_id: assistedRow.machine_id,
            machine_code: assistedRow.machine_code,
            log_date: assistedRow.log_date,
            start_meter: assistedRow.start_meter,
            end_meter: assistedRow.end_meter,
            running_hours: assistedRow.running_hours,
            shift_code: assistedRow.shift_code,
            operator_id: assistedRow.operator_id,
            client_id: assistedRow.client_id,
          } : undefined}
          onSubmit={(submittedLog?: any) => {
            const targetAssisted = assistedRow;
            setAssistedRow(null);
            if (targetAssisted) {
              queryClient.setQueriesData<TodayShiftMonitorRow[]>(
                { queryKey: ['operations', 'today-shift-monitor'] },
                (oldRows) => {
                  if (!oldRows) return oldRows;
                  return oldRows.map((r) => {
                    const isMatch =
                      (r.machine_id === targetAssisted.machine_id && r.operator_id === targetAssisted.operator_id) ||
                      (r.machine_id === targetAssisted.machine_id && r.shift_code === targetAssisted.shift_code);
                    if (isMatch) {
                      return {
                        ...r,
                        status: 'entered' as const,
                        end_meter: submittedLog?.end_meter ?? r.end_meter,
                        running_hours: submittedLog?.running_hours ?? r.running_hours,
                      };
                    }
                    return r;
                  });
                }
              );
            }
            handleDataRefresh();
          }}
        />
      )}

      {/* 5. GLOBAL ASSIGN PERSONNEL MODAL (ACCESSIBLE FROM 3-DOT MENU ACROSS ALL TABS) */}
      <MobileAssignPersonnelModal
        visible={isAssignModalOpen}
        onClose={handleCloseAssignModal}
        onSuccess={handleAssignModalSuccess}
      />

      {/* Delete Daily Running Hour Log Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(logToDelete)}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDeleteLog}
        title="Delete Daily Running Hour Log"
        message={
          logToDelete
            ? `Are you sure you want to permanently delete the ${formatDate(logToDelete.log_date)} running hour log for ${
                logToDelete.machine?.model || logToDelete.machine_code || 'equipment'
              }? The machine hour meter will be recalculated.`
            : ''
        }
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingLog}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  historyContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  todayContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  tabButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    width: '100%',
  },
  tabOptionBtn: {
    flex: 1,
    minHeight: 44,
  },
  tabBadge: {
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSwitchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    width: '100%',
  },
  segmentedToggleWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    width: '100%',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacingNumeric.md,
    paddingBottom: 110,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
});
