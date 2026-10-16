import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTheme,
  MobileHeader,
  HeaderActionItem,
  SegmentedToggle,
  useToast,
  ConfirmDialog,
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
} from '../../lib/hooks/useOperationsData';
import { MobileOperatorEntryCard } from '../../components/operations/MobileOperatorEntryCard';
import { MobileOperatorHistoryTab } from '../../components/operations/MobileOperatorHistoryTab';
import { MobileTodayShiftMonitorTab } from '../../components/operations/MobileTodayShiftMonitorTab';
import { MobileAssignPersonnelModal } from '../../components/operations/MobileAssignPersonnelModal';
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
} from '../../components/ui/icon';
import { isManagerOrAbove } from '@reachinternational/permissions';

export type OpsTab = 'entry' | 'history' | 'today';
export type LogsViewMode = 'machine' | 'client' | 'operator';

export type { HourLogRecord };

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
  const { data: operatorHistoryCount } = useOperatorHistoryCount(isOperator ? user?.id : undefined);

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

  const handleDataRefresh = useCallback(async () => {
    await Promise.all([
      refetchEntryContext(),
      queryClient.invalidateQueries({ queryKey: ['operator', 'entry-context'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-infinite'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-count'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-monitor'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }, [refetchEntryContext, queryClient]);

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
    try {
      const { error } = await supabase
        .from('machine_hour_logs')
        .delete()
        .eq('id', log.id);
      if (error) {
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
      toast('error', 'Delete Failed', sanitizeDatabaseError(err, 'Failed to delete log.').message);
    } finally {
      setIsDeletingLog(false);
    }
  }, [logToDelete, handleDataRefresh, toast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await handleDataRefresh();
    setRefreshing(false);
  }, [handleDataRefresh]);

  const pendingConflicts: HourLogRecord[] = [];

  const handleOpenConflictModal = (log: HourLogRecord) => {
    setSelectedConflictLog(log);
    setShowConflictModal(true);
  };

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    if (!isOperator) {
      list.push({
        id: 'assign-operator',
        label: 'Assign Operator',
        icon: <UserPlus size={16} color={theme.colors.link} />,
        onPress: () => setIsAssignModalOpen(true),
      });
    }

    list.push({
      id: 'export-print',
      label: 'Export / Print Report',
      icon: <Printer size={16} color={theme.colors.ink} />,
      onPress: () => setShowExportModal(true),
    });

    return list;
  }, [theme.colors.ink, theme.colors.link, isOperator]);

  // Lazy loading state: History tab is only mounted on first user visit, then preserved in memory
  const [hasLoadedHistory, setHasLoadedHistory] = useState(() => activeTab === 'history');

  const segmentedItems = useMemo(
    () => [
      { id: 'entry' as const, label: 'Shift' },
      {
        id: 'history' as const,
        label: 'Log History',
        count: isOperator && operatorHistoryCount && operatorHistoryCount > 0 ? operatorHistoryCount : undefined,
      },
    ],
    [isOperator, operatorHistoryCount]
  );

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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 1. TOP STANDARDIZED MOBILE HEADER: [Logo] + [Page Title] + [Quick Access] + [3-Dot Actions] */}
      <MobileHeader
        title="Operations"
        showBack={true}
        onPressBack={() => router.back()}
        actions={headerActions}
      />

      {/* 2. TOP NAVBAR (SEGMENTED CONTROL: LOG ENTRY VS LOG HISTORY - 100% Webapp Parity) */}
      {(isOperator || activeTab === 'entry' || activeTab === 'history') && (
        <View style={styles.segmentedToggleWrapper}>
          <SegmentedToggle<'entry' | 'history'>
            items={segmentedItems}
            value={activeTab === 'history' ? 'history' : 'entry'}
            onChange={handleTabChange}
            size="md"
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
        <Animated.View key="today-tab" entering={FadeIn.duration(200)} style={styles.todayContainer}>
          <MobileTodayShiftMonitorTab
            actorId={user?.id}
            userRole={role || userProfile?.role}
            onEnterLog={(row) => {
              if (isManagerTier) {
                setAssistedRow(row);
              }
            }}
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
          onClose={() => setEditingLogRecord(null)}
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
        onClose={() => setShowConflictModal(false)}
        log={selectedConflictLog}
        currentUserId={user?.id || ''}
        onSuccess={handleDataRefresh}
      />

      {/* Export / Print Modal (Loaded strictly on demand with server-side fetch) */}
      {showExportModal && (
        <OperationsExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
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

      {/* Assisted Shift Entry Modal for Managers & Admins (Strictly above supervisor) */}
      {assistedRow && isManagerTier && (
        <MeterLogModal
          visible={Boolean(assistedRow && isManagerTier)}
          onClose={() => setAssistedRow(null)}
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
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-monitor'] });
          handleDataRefresh();
        }}
      />

      {/* Delete Daily Running Hour Log Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(logToDelete)}
        onClose={() => setLogToDelete(null)}
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
  segmentedToggleWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
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
