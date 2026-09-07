import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { MobileAssignmentModal } from '../../components/operations/MobileAssignmentModal';
import { MobileConflictResolutionModal } from '../../components/operations/MobileConflictResolutionModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatShiftTimingRange, formatTo12Hour, formatExactTimestamp, splitExactTimestamp, formatDate, parseBreakdownString } from '@reachinternational/utils';
import {
  Clock,
  Gauge,
  UserCheck,
  AlertTriangle,
  Search,
  Plus,
  Building2,
  Calendar,
  Truck,
  Sun,
  Moon,
  Users,
  ShieldAlert,
  Check,
} from 'lucide-react-native';

export type OpsTab = 'logs' | 'assignments' | 'entry' | 'history';

export interface HourLogRecord {
  id: string;
  machine_id?: string;
  machine_code: string;
  log_date: string;
  shift?: string;
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
  machine?: { machine_id: string; model?: string; serial_number?: string } | null;
  operator?: { full_name: string } | null;
  client?: { name: string } | null;
}

export interface ActiveShiftAssignment {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_start_time: string;
  shift_end_time: string;
  crosses_midnight: boolean;
  assigned_at: string;
  operator?: { id: string; full_name: string; phone?: string } | null;
}

export interface MachineWithAssignments {
  id: string;
  machine_id: string;
  model?: string;
  serial_number?: string;
  status: string;
  hour_meter?: number;
  supervisor?: { full_name: string } | null;
  active_assignments: ActiveShiftAssignment[];
}

export default function OperationsScreen() {
  const { theme } = useTheme();
  const { role, user } = useAuth();

  const isOperator = (role || '').toLowerCase() === 'operator';
  const [activeTab, setActiveTab] = useState<OpsTab>(isOperator ? 'entry' : 'logs');
  const [logs, setLogs] = useState<HourLogRecord[]>([]);
  const [machinesList, setMachinesList] = useState<MachineWithAssignments[]>([]);
  const [activeOperators, setActiveOperators] = useState<{ id: string; full_name: string; phone?: string; shift_time?: string }[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned' | 'full'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'breakdowns'>('all');

  // Modal State: Log Entry
  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [selectedMachineForLog, setSelectedMachineForLog] = useState<{ id?: string; code: string; model?: string; serial?: string }>({ code: '' });

  // Modal State: Shift Assignment
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedMachineForAssign, setSelectedMachineForAssign] = useState<{ id: string; code: string; model?: string; count: number }>({ id: '', code: '', count: 0 });

  // Modal State: Conflict Resolution
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [selectedLogForConflict, setSelectedLogForConflict] = useState<HourLogRecord | null>(null);

  const fetchOperationsData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Hour Logs
      let query = supabase
        .from('machine_hour_logs')
        .select(`
          id,
          machine_id,
          log_date,
          shift,
          start_meter,
          end_meter,
          running_hours,
          start_time,
          end_time,
          overtime_hours,
          normal_working_hours,
          location,
          is_breakdown,
          remarks,
          operator_id,
          client_id,
          created_at,
          conflict_flag,
          conflict_reason,
          conflict_status,
          machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number),
          operator:users!machine_hour_logs_operator_id_fkey(id, full_name),
          client:clients!machine_hour_logs_client_id_fkey(id, company_name)
        `)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (isOperator && user?.id) {
        query = query.eq('operator_id', user.id);
      }

      const [logsRes, mchRes, assRes, opsRes] = await Promise.all([
        query,
        supabase
          .from('machines')
          .select(`
            id,
            machine_id,
            model,
            serial_number,
            status,
            hour_meter,
            current_supervisor_id,
            supervisor:users!machines_current_supervisor_id_fkey(id, full_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('operator_machine_assignments')
          .select(`
            id,
            machine_id,
            operator_id,
            shift_start_time,
            shift_end_time,
            crosses_midnight,
            assigned_at,
            is_active,
            operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone)
          `)
          .eq('is_active', true)
          .order('assigned_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, full_name, phone, shift_time')
          .eq('role', 'operator')
          .eq('status', 'active')
          .order('full_name'),
      ]);

      if (logsRes.error) {
        console.warn('Error fetching logs:', logsRes.error);
      } else if (logsRes.data) {
        const formatted = logsRes.data.map((l: any) => ({
          ...l,
          machine_code: l.machine?.machine_id || l.machine_id || 'Machine',
          client: l.client ? { name: l.client.company_name || l.client.client_name } : null,
        }));
        setLogs(formatted as any);
      }

      if (opsRes.data) {
        setActiveOperators(opsRes.data as any);
      }

      if (mchRes.data) {
        const activeAssList = (assRes.data || []) as unknown as ActiveShiftAssignment[];
        const machinesWithAss: MachineWithAssignments[] = mchRes.data.map((m: any) => ({
          ...m,
          active_assignments: activeAssList.filter((a) => a.machine_id === m.id),
        }));
        setMachinesList(machinesWithAss);
      }
    } catch (err) {
      console.error('Error fetching operations data:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isOperator, user?.id]);

  const handleEndAssignment = async (assId: string, opName: string, machCode: string) => {
    Alert.alert(
      'End Shift Assignment',
      `Are you sure you want to end ${opName}'s shift assignment on ${machCode}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Shift',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('end_operator_machine_assignment_atomic', {
                p_assignment_id: assId,
                p_ended_by: user?.id,
                p_end_reason: 'removed',
              });
              if (error) {
                Alert.alert('Error', error.message || 'Failed to end assignment.');
              } else {
                fetchOperationsData();
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to end assignment.');
            }
          },
        },
      ]
    );
  };

  const pendingConflicts = useMemo(() => {
    return logs.filter((l) => l.conflict_flag && (!l.conflict_status || l.conflict_status === 'pending'));
  }, [logs]);

  useEffect(() => {
    fetchOperationsData();
  }, [fetchOperationsData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOperationsData();
  }, [fetchOperationsData]);

  const parseBreakdownText = (log: HourLogRecord): string | null => {
    if (!log.is_breakdown) return null;
    if (log.remarks) {
      const match = log.remarks.match(/\[Breakdown Duration:\s*([^\]]+)\]/i);
      if (match && match[1]) return match[1].trim();
    }
    return '1h 30m';
  };

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      log.machine_code.toLowerCase().includes(q) ||
      (log.machine?.model && log.machine.model.toLowerCase().includes(q)) ||
      (log.machine?.serial_number && log.machine.serial_number.toLowerCase().includes(q)) ||
      (log.operator?.full_name && log.operator.full_name.toLowerCase().includes(q)) ||
      (log.client?.name && log.client.name.toLowerCase().includes(q)) ||
      (log.location && log.location.toLowerCase().includes(q));

    let matchesStatus = true;
    if (statusFilter === 'breakdowns') matchesStatus = log.is_breakdown === true;

    return matchesSearch && matchesStatus;
  });

  const openLogEntryModal = (mId?: string, mCode?: string, modelName?: string, serial?: string) => {
    setSelectedMachineForLog({
      id: mId || '',
      code: mCode || 'MCH-001',
      model: modelName || '',
      serial: serial || '',
    });
    setMeterModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Header */}
      <MobileHeader
        eyebrow="OPERATIONS HUB"
        title="Field Operations & Logs"
        subtitle={
          isOperator
            ? 'Record daily machine running hours & view your shift history'
            : 'Fleet running hours, shift logs & operator machine assignments'
        }
        rightAction={
          <TouchableOpacity
            onPress={() => openLogEntryModal()}
            style={[styles.addLogBtn, { backgroundColor: theme.colors.ink }]}
            activeOpacity={0.8}
          >
            <Plus size={14} color={theme.colors.canvas} />
            <Text style={[styles.addLogBtnText, { color: theme.colors.canvas }]}>Log</Text>
          </TouchableOpacity>
        }
      />

      {/* Segmented Mode Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        {isOperator ? (
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              onPress={() => setActiveTab('entry')}
              style={[
                styles.segmentBtn,
                activeTab === 'entry' && [styles.segmentActive, { backgroundColor: theme.colors.primary }],
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: activeTab === 'entry' ? theme.colors.onPrimary : theme.colors.body },
                  activeTab === 'entry' && { fontWeight: '700' },
                ]}
              >
                Log Entry
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('history')}
              style={[
                styles.segmentBtn,
                activeTab === 'history' && [styles.segmentActive, { backgroundColor: theme.colors.primary }],
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: activeTab === 'history' ? theme.colors.onPrimary : theme.colors.body },
                  activeTab === 'history' && { fontWeight: '700' },
                ]}
              >
                Log History ({logs.length})
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              onPress={() => setActiveTab('logs')}
              style={[
                styles.segmentBtn,
                activeTab === 'logs' && [styles.segmentActive, { backgroundColor: theme.colors.primary }],
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: activeTab === 'logs' ? theme.colors.onPrimary : theme.colors.body },
                  activeTab === 'logs' && { fontWeight: '700' },
                ]}
              >
                Running Hours
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('assignments')}
              style={[
                styles.segmentBtn,
                activeTab === 'assignments' && [styles.segmentActive, { backgroundColor: theme.colors.primary }],
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: activeTab === 'assignments' ? theme.colors.onPrimary : theme.colors.body },
                  activeTab === 'assignments' && { fontWeight: '700' },
                ]}
              >
                Assignments ({machinesList.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Operator Fast Entry Quick Banner */}
      {isOperator && activeTab === 'entry' && (
        <ScrollView contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator={false}>
          <Card variant="elevated" style={styles.entryBannerCard}>
            <View style={styles.entryHeaderRow}>
              <View style={[styles.entryIconWrap, { backgroundColor: theme.colors.link + '1a' }]}>
                <Gauge size={22} color={theme.colors.link} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryTitle, { color: theme.colors.ink }]}>Daily Running Hours Entry</Text>
                <Text style={[styles.entryDesc, { color: theme.colors.mute }]}>
                  Record today&apos;s start/end meter readings, shift timings, and customer location.
                </Text>
              </View>
            </View>

            <Button
              label="+ Open Daily Machine Log Form"
              onPress={() => openLogEntryModal()}
              variant="primary"
              shape="pill"
              fullWidth
              style={{ marginTop: spacingNumeric.sm }}
            />
          </Card>

          {/* Quick Assigned Machines list */}
          <Text style={[styles.subSectionTitle, { color: theme.colors.mute }]}>MY ASSIGNED MACHINES</Text>
          {machinesList
            .filter((m) => m.active_assignments.some((a) => a.operator_id === user?.id))
            .map((m) => (
            <Card key={m.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.codeText, { color: theme.colors.ink }]}>{m.machine_id}</Text>
                <Badge status={m.status === 'rented' ? 'in_transit' : 'available'} customLabel={m.status === 'rented' ? 'Rented' : 'Available'} />
              </View>

              <Text style={[styles.modelText, { color: theme.colors.ink }]}>Model: {m.model || '—'}</Text>
              <Text style={[styles.metaText, { color: theme.colors.mute }]}>S/N: {m.serial_number || '—'}</Text>

              <View style={styles.cardActions}>
                <Button
                  label="Log Shift Reading"
                  onPress={() => openLogEntryModal(m.id, m.machine_id, m.model, m.serial_number)}
                  size="sm"
                  variant="primary"
                />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* Running Hours / Log History Feed */}
      {(activeTab === 'logs' || activeTab === 'history') && (
        <>
          {/* Search and Filters */}
          <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
            <Input
              placeholder="Search by machine, model, operator, client, site..."
              value={search}
              onChangeText={setSearch}
              leftIcon={<Search size={16} color={theme.colors.mute} />}
              containerStyle={styles.searchInput}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {[
                { key: 'all', label: `All Logs (${logs.length})` },
                { key: 'breakdowns', label: 'Breakdowns' },
              ].map((f) => {
                const isActive = statusFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setStatusFilter(f.key as any)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                        borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.filterText, { color: isActive ? theme.colors.onPrimary : theme.colors.body }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Logs Feed */}
          <ScrollView
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
          >
            {/* OVERTIME CONFLICT ALERT BANNER (Mobile) */}
            {pendingConflicts.length > 0 && (
              <View
                style={{
                  backgroundColor: '#fffbeb',
                  borderColor: '#fde68a',
                  borderWidth: 1,
                  borderRadius: radiusNumeric.md,
                  padding: spacingNumeric.sm,
                  marginBottom: spacingNumeric.sm,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={16} color="#d97706" />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#b45309' }}>
                    {pendingConflicts.length} Overtime Conflict{pendingConflicts.length > 1 ? 's' : ''} Pending Review
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: '#92400e' }}>
                  Recorded hours exceeded the assigned shift window. Tap to review.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  {pendingConflicts.slice(0, 3).map((cLog) => (
                    <TouchableOpacity
                      key={cLog.id}
                      onPress={() => {
                        setSelectedLogForConflict(cLog);
                        setConflictModalVisible(true);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: '#fef3c7',
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: radiusNumeric.sm,
                        minHeight: 36,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309' }}>
                        {cLog.machine_code} ({cLog.log_date})
                      </Text>
                      <Text style={{ fontSize: 10, color: '#78350f', fontWeight: 'bold' }}>Review →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.link} />
                <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading running hours logs...</Text>
              </View>
            ) : filteredLogs.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                <Clock size={32} color={theme.colors.mute} />
                <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No hour logs found</Text>
                <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
                  No shift logs match your selected filter.
                </Text>
              </View>
            ) : (
              filteredLogs.map((log) => {
                const breakdownText = parseBreakdownText(log);
                return (
                  <Card key={log.id} style={styles.card}>
                    {/* Header Row */}
                    <View style={styles.cardHeader}>
                      <View style={styles.headerTitleWrap}>
                        <Text style={[styles.codeText, { color: theme.colors.ink }]}>
                          {log.machine?.model || log.machine_code}
                        </Text>
                        {log.machine?.serial_number && (
                          <Text style={[styles.serialText, { color: theme.colors.mute }]}>
                            • S/N: {log.machine.serial_number}
                          </Text>
                        )}
                      </View>

                      <View style={styles.badgeColumn}>
                        {log.is_breakdown ? (
                          <View style={[styles.breakdownBadge, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error, alignItems: 'flex-end', paddingHorizontal: 6, paddingVertical: 2 }]}>
                            {(() => {
                              const bkdParsed = parseBreakdownString((log as any).breakdown_duration || log.remarks);
                              const bkdStart = (log as any).breakdown_start_time || bkdParsed?.startTime;
                              const bkdEnd = (log as any).breakdown_end_time || bkdParsed?.endTime;
                              const bkdDur = bkdParsed?.durationFormatted || bkdParsed?.durationText || breakdownText;
                              return bkdStart && bkdEnd ? (
                                <>
                                  <Text style={{ fontSize: 9.5, fontFamily: 'GeistMono_700Bold', color: theme.colors.error }}>
                                    {bkdStart} - {bkdEnd}
                                  </Text>
                                  <Text style={{ fontSize: 8.5, fontFamily: 'GeistMono_700Bold', color: theme.colors.error, opacity: 0.85 }}>
                                    ({bkdDur})
                                  </Text>
                                </>
                              ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                  <AlertTriangle size={11} color={theme.colors.error} />
                                  <Text style={[styles.breakdownBadgeText, { color: theme.colors.error }]}>
                                    {breakdownText}
                                  </Text>
                                </View>
                              );
                            })()}
                          </View>
                        ) : (
                          <View style={[styles.breakdownBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                            <Text style={[styles.breakdownBadgeText, { color: theme.colors.ink, fontWeight: '700' }]}>
                              0
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Metadata Strip */}
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Calendar size={12} color={theme.colors.mute} />
                        <Text style={[styles.metaText, { color: theme.colors.mute }]}>{formatDate(log.log_date)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <UserCheck size={12} color={theme.colors.mute} />
                        <Text style={[styles.metaText, { color: theme.colors.ink, fontWeight: '600' }]}>
                          {log.operator?.full_name || 'Operator'}
                        </Text>
                      </View>
                      {log.created_at ? (
                        <View style={[styles.metaItem, { backgroundColor: theme.colors.link + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }]}>
                          <Text style={{ fontSize: 10, fontFamily: 'GeistMono_700Bold', color: theme.colors.link }}>
                            {formatExactTimestamp(log.created_at, true)}
                          </Text>
                        </View>
                      ) : null}

                      {log.conflict_flag ? (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedLogForConflict(log);
                            setConflictModalVisible(true);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            backgroundColor: '#fffbeb',
                            borderColor: '#fde68a',
                            borderWidth: 1,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <ShieldAlert size={10} color="#d97706" />
                          <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#b45309' }}>
                            {log.conflict_status === 'acknowledged'
                              ? 'OT Approved'
                              : log.conflict_status === 'adjusted'
                              ? 'OT Adjusted'
                              : 'OT Conflict'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Inset Metrics Grid */}
                    <View style={[styles.specsWell, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={styles.specsGrid}>
                        <View style={styles.specsItem}>
                          <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Start Meter</Text>
                          <Text style={[styles.specsValue, { color: theme.colors.ink }]}>{log.start_meter} hrs</Text>
                        </View>
                        <View style={styles.specsItem}>
                          <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>End Meter</Text>
                          <Text style={[styles.specsValue, { color: theme.colors.ink }]}>{log.end_meter} hrs</Text>
                        </View>
                        <View style={styles.specsItem}>
                          <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Running Meter</Text>
                          <Text style={[styles.specsValue, { color: theme.colors.link }]}>{log.running_hours} hrs</Text>
                        </View>
                      </View>

                      {/* Shift Timings & Normal Working Time */}
                      <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacingNumeric.xs, paddingVertical: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} color={theme.colors.mute} />
                          <Text style={{ fontSize: 11, fontFamily: 'GeistMono_700Bold', color: theme.colors.ink }}>
                            {formatShiftTimingRange(log.start_time, log.end_time)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontFamily: 'GeistMono_700Bold', color: theme.colors.link }}>
                          {log.normal_working_hours ?? 8}h normal
                        </Text>
                      </View>

                      {log.overtime_hours ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacingNumeric.xs }}>
                          <Text style={{ fontSize: 10, fontFamily: 'GeistMono_700Bold', color: '#d97706' }}>
                            +{log.overtime_hours}h Overtime
                          </Text>
                        </View>
                      ) : null}

                      {/* Exact Log Entry Timestamp Row */}
                      {log.created_at ? (
                        <>
                          <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacingNumeric.xs, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, color: theme.colors.mute, fontWeight: '600' }}>
                              Exact Entry Timestamp:
                            </Text>
                            {(() => {
                              const splitTs = splitExactTimestamp(log.created_at, true);
                              return splitTs ? (
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={{ fontSize: 10, fontFamily: 'GeistMono_700Bold', color: theme.colors.link }}>
                                    {splitTs.time}
                                  </Text>
                                  <Text style={{ fontSize: 9, fontFamily: 'GeistMono_500Medium', color: theme.colors.mute }}>
                                    {splitTs.date}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={{ fontSize: 10, fontFamily: 'GeistMono_700Bold', color: theme.colors.link }}>
                                  {formatExactTimestamp(log.created_at, true)}
                                </Text>
                              );
                            })()}
                          </View>
                        </>
                      ) : null}

                      {(log.client?.name || log.location) && (
                        <>
                          <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />
                          <View style={styles.clientLocRow}>
                            <Building2 size={12} color={theme.colors.mute} />
                            <Text style={[styles.clientLocText, { color: theme.colors.body }]} numberOfLines={1}>
                              {log.client?.name ? `${log.client.name}` : ''}
                              {log.client?.name && log.location ? ' • ' : ''}
                              {log.location || ''}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      {/* Operator Machine Assignments Tab */}
      {activeTab === 'assignments' && (
        <>
          {/* Search and Capacity Filters */}
          <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
            <Input
              placeholder="Search equipment, model, serial, or operator..."
              value={search}
              onChangeText={setSearch}
              leftIcon={<Search size={16} color={theme.colors.mute} />}
              containerStyle={styles.searchInput}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {[
                { key: 'all', label: `All (${machinesList.length})` },
                { key: 'assigned', label: `Assigned (${machinesList.filter(m => m.active_assignments.length > 0).length})` },
                { key: 'full', label: `Full 3/3 (${machinesList.filter(m => m.active_assignments.length >= 3).length})` },
                { key: 'unassigned', label: `Unassigned (${machinesList.filter(m => m.active_assignments.length === 0).length})` },
              ].map((f) => {
                const isActive = assignmentFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setAssignmentFilter(f.key as any)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                        borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.filterText, { color: isActive ? theme.colors.onPrimary : theme.colors.body }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
          >
            {(() => {
              const q = search.toLowerCase().trim();
              const filtered = machinesList.filter((m) => {
                if (assignmentFilter === 'assigned' && m.active_assignments.length === 0) return false;
                if (assignmentFilter === 'unassigned' && m.active_assignments.length > 0) return false;
                if (assignmentFilter === 'full' && m.active_assignments.length < 3) return false;

                if (!q) return true;
                const mCode = m.machine_id.toLowerCase();
                const model = (m.model || '').toLowerCase();
                const serial = (m.serial_number || '').toLowerCase();
                const opMatch = m.active_assignments.some((a) =>
                  (a.operator?.full_name || '').toLowerCase().includes(q)
                );
                return mCode.includes(q) || model.includes(q) || serial.includes(q) || opMatch;
              });

              if (filtered.length === 0) {
                return (
                  <View style={[styles.emptyContainer, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                    <Users size={32} color={theme.colors.mute} />
                    <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No equipment found</Text>
                    <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
                      No machines match your current assignment filter.
                    </Text>
                  </View>
                );
              }

              return filtered.map((item) => {
                const isFull = item.active_assignments.length >= 3;
                return (
                  <Card key={item.id} style={styles.card}>
                    {/* Header Row */}
                    <View style={styles.cardHeader}>
                      <View style={styles.headerTitleWrap}>
                        <Text style={[styles.codeText, { color: theme.colors.ink }]}>{item.machine_id}</Text>
                        {item.model && (
                          <Text style={[styles.serialText, { color: theme.colors.mute }]}>• {item.model}</Text>
                        )}
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: radiusNumeric.sm,
                          backgroundColor: isFull ? '#ecfdf5' : item.active_assignments.length > 0 ? '#e0f2fe' : theme.colors.canvas,
                          borderColor: isFull ? '#a7f3d0' : item.active_assignments.length > 0 ? '#bae6fd' : theme.colors.hairline,
                          borderWidth: 1,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: isFull ? '#059669' : item.active_assignments.length > 0 ? '#0284c7' : '#9ca3af',
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color: isFull ? '#047857' : item.active_assignments.length > 0 ? '#0369a1' : theme.colors.mute,
                          }}
                        >
                          {item.active_assignments.length} / 3 Operators
                        </Text>
                      </View>
                    </View>

                    {item.serial_number && (
                      <Text style={[styles.metaText, { color: theme.colors.mute, marginTop: -4 }]}>
                        Serial: {item.serial_number} {item.hour_meter !== undefined ? `• Meter: ${item.hour_meter}h` : ''}
                      </Text>
                    )}

                    {/* Active Shifts List */}
                    <View style={{ gap: 8, marginTop: spacingNumeric.xs }}>
                      {item.active_assignments.map((ass, aIdx) => {
                        const isOvernight = ass.crosses_midnight;
                        const opName = ass.operator?.full_name || 'Assigned Operator';
                        return (
                          <View
                            key={ass.id || aIdx}
                            style={[
                              styles.specsWell,
                              { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, padding: spacingNumeric.sm },
                            ]}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.mute, textTransform: 'uppercase' }}>
                                Shift #{aIdx + 1}
                              </Text>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  backgroundColor: isOvernight ? '#eef2ff' : '#fffbeb',
                                  borderColor: isOvernight ? '#c7d2fe' : '#fde68a',
                                  borderWidth: 1,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                {isOvernight ? (
                                  <Moon size={10} color="#4f46e5" />
                                ) : (
                                  <Sun size={10} color="#d97706" />
                                )}
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontFamily: 'GeistMono_700Bold',
                                    color: isOvernight ? '#4338ca' : '#b45309',
                                  }}
                                >
                                  {formatTo12Hour(ass.shift_start_time)} – {formatTo12Hour(ass.shift_end_time)}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.ink }}>{opName}</Text>
                                {ass.operator?.phone ? (
                                  <Text style={{ fontSize: 10, color: theme.colors.mute, fontFamily: 'GeistMono_500Medium' }}>
                                    📞 {ass.operator.phone}
                                  </Text>
                                ) : null}
                              </View>

                              {!isOperator && (
                                <TouchableOpacity
                                  onPress={() => handleEndAssignment(ass.id, opName, item.machine_id)}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: radiusNumeric.sm,
                                    backgroundColor: '#fee2e2',
                                    borderColor: '#fca5a5',
                                    borderWidth: 1,
                                    minHeight: 44,
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>End Shift</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}

                      {/* Add Operator Slot Button */}
                      {!isFull && !isOperator && (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedMachineForAssign({
                              id: item.id,
                              code: item.machine_id,
                              model: item.model,
                              count: item.active_assignments.length,
                            });
                            setAssignModalVisible(true);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 12,
                            borderRadius: radiusNumeric.md,
                            borderWidth: 1,
                            borderColor: theme.colors.link,
                            borderStyle: 'dashed',
                            backgroundColor: theme.colors.link + '08',
                            minHeight: 44,
                          }}
                        >
                          <Plus size={14} color={theme.colors.link} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.link }}>
                            + Assign Shift #{item.active_assignments.length + 1}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                );
              });
            })()}
          </ScrollView>
        </>
      )}

      {/* Meter Log Modal */}
      <MeterLogModal
        visible={meterModalVisible}
        onClose={() => setMeterModalVisible(false)}
        machineId={selectedMachineForLog.id}
        machineCode={selectedMachineForLog.code}
        model={selectedMachineForLog.model}
        serialNumber={selectedMachineForLog.serial}
        onSubmit={fetchOperationsData}
      />

      {/* Mobile Operator Assignment Modal */}
      <MobileAssignmentModal
        visible={assignModalVisible}
        onClose={() => setAssignModalVisible(false)}
        machineId={selectedMachineForAssign.id}
        machineCode={selectedMachineForAssign.code}
        machineModel={selectedMachineForAssign.model}
        activeAssignmentsCount={selectedMachineForAssign.count}
        activeOperators={activeOperators}
        currentUserId={user?.id || ''}
        onSuccess={fetchOperationsData}
      />

      {/* Mobile Conflict Resolution Modal */}
      <MobileConflictResolutionModal
        visible={conflictModalVisible}
        onClose={() => {
          setConflictModalVisible(false);
          setSelectedLogForConflict(null);
        }}
        log={selectedLogForConflict}
        currentUserId={user?.id || ''}
        onSuccess={fetchOperationsData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
  },
  addLogBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs,
    borderBottomWidth: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radiusNumeric.sm - 2,
  },
  segmentActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchFilterContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.xs,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
    gap: spacingNumeric.xs,
  },
  searchInput: { marginBottom: 0 },
  filterScroll: { gap: spacingNumeric.xs, paddingVertical: 2 },
  filterPill: {
    paddingHorizontal: spacingNumeric.sm + 2,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: '600' },
  feedContent: { padding: spacingNumeric.md, paddingBottom: 40, gap: spacingNumeric.md },
  entryBannerCard: { padding: spacingNumeric.md, gap: spacingNumeric.xs },
  entryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryIconWrap: { width: 44, height: 44, borderRadius: radiusNumeric.md, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 16, fontWeight: '700' },
  entryDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacingNumeric.xs,
  },
  loadingContainer: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13 },
  emptyContainer: { padding: 32, borderRadius: radiusNumeric.md, borderWidth: 1, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtext: { fontSize: 12, textAlign: 'center' },
  card: { gap: spacingNumeric.xs, padding: spacingNumeric.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, flex: 1 },
  codeText: { fontSize: 14, fontWeight: '800' },
  serialText: { fontSize: 12, fontFamily: 'monospace' },
  modelText: { fontSize: 14, fontWeight: '700' },
  badgeColumn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  breakdownBadgeText: { fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  specsWell: { padding: spacingNumeric.sm, borderRadius: radiusNumeric.sm, borderWidth: 1, marginTop: 4 },
  specsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  specsItem: { flex: 1 },
  specsLabel: { fontSize: 10, fontWeight: '500' },
  specsValue: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  specsDivider: { height: 1, marginVertical: 6 },
  clientLocRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clientLocText: { fontSize: 11, fontWeight: '500' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: spacingNumeric.xs, marginTop: 4 },
});
