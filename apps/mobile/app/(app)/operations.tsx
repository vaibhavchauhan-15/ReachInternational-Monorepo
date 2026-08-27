import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
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
  location?: string;
  status: string;
  is_breakdown: boolean;
  remarks?: string;
  operator_id?: string;
  client_id?: string;
  machine?: { machine_id: string; model?: string; serial_number?: string } | null;
  operator?: { full_name: string } | null;
  client?: { name: string } | null;
}

export interface AssignmentRecord {
  id: string;
  machine_id: string;
  model?: string;
  serial_number?: string;
  status: string;
  supervisor?: { full_name: string } | null;
  operator?: { full_name: string } | null;
}

export default function OperationsScreen() {
  const { theme } = useTheme();
  const { role, user } = useAuth();

  const isOperator = (role || '').toLowerCase() === 'operator';
  const [activeTab, setActiveTab] = useState<OpsTab>(isOperator ? 'entry' : 'logs');
  const [logs, setLogs] = useState<HourLogRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'breakdowns'>('all');

  // Meter Log Modal
  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [selectedMachineForLog, setSelectedMachineForLog] = useState<{ id: string; code: string; model?: string; serial?: string }>({
    id: '',
    code: '',
  });

  const fetchOperationsData = useCallback(async () => {
    try {
      // 1. Fetch Hour Logs
      let query = supabase
        .from('machine_hour_logs')
        .select(`
          id,
          machine_id,
          machine_code,
          log_date,
          shift,
          start_meter,
          end_meter,
          running_hours,
          start_time,
          end_time,
          location,
          status,
          is_breakdown,
          remarks,
          operator_id,
          client_id,
          machine:machines!machine_hour_logs_machine_id_fkey(machine_id, model, serial_number),
          operator:users!machine_hour_logs_operator_id_fkey(full_name),
          client:clients!machine_hour_logs_client_id_fkey(name)
        `)
        .order('log_date', { ascending: false })
        .limit(60);

      if (isOperator && user?.id) {
        query = query.eq('operator_id', user.id);
      }

      const { data: logsData, error: logsError } = await query;
      if (logsError) {
        console.warn('Error fetching logs:', logsError);
      } else if (logsData) {
        setLogs(logsData as any);
      }

      // 2. Fetch Assignments
      const { data: mchData } = await supabase
        .from('machines')
        .select(`
          id,
          machine_id,
          model,
          serial_number,
          status,
          supervisor:users!machines_supervisor_id_fkey(full_name),
          operator:users!machines_operator_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (mchData) {
        setAssignments(mchData as any);
      }
    } catch (err) {
      console.error('Error fetching operations data:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isOperator, user?.id]);

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
    if (statusFilter === 'approved') matchesStatus = log.status === 'approved';
    if (statusFilter === 'pending') matchesStatus = log.status === 'pending';
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
                Assignments ({assignments.length})
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
          {assignments.map((m) => (
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
                { key: 'approved', label: 'Approved' },
                { key: 'pending', label: 'Pending' },
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
                        {log.is_breakdown && (
                          <View style={[styles.breakdownBadge, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
                            <AlertTriangle size={11} color={theme.colors.error} />
                            <Text style={[styles.breakdownBadgeText, { color: theme.colors.error }]}>
                              {breakdownText}
                            </Text>
                          </View>
                        )}
                        <Badge status={log.status === 'approved' ? 'success' : 'pending'} customLabel={log.status === 'approved' ? 'Approved' : 'Pending'} />
                      </View>
                    </View>

                    {/* Metadata Strip */}
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Calendar size={12} color={theme.colors.mute} />
                        <Text style={[styles.metaText, { color: theme.colors.mute }]}>{log.log_date}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <UserCheck size={12} color={theme.colors.mute} />
                        <Text style={[styles.metaText, { color: theme.colors.ink, fontWeight: '600' }]}>
                          {log.operator?.full_name || 'Operator'}
                        </Text>
                      </View>
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
                          <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Running (WT)</Text>
                          <Text style={[styles.specsValue, { color: theme.colors.link }]}>{log.running_hours} hrs</Text>
                        </View>
                      </View>

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
        <ScrollView
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        >
          {assignments.map((item) => (
            <Card key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.codeText, { color: theme.colors.ink }]}>{item.machine_id}</Text>
                <Badge status={item.status === 'rented' ? 'in_transit' : 'available'} customLabel={item.status === 'rented' ? 'Rented' : 'Available'} />
              </View>

              <Text style={[styles.modelText, { color: theme.colors.ink }]}>Model: {item.model || '—'}</Text>
              <Text style={[styles.metaText, { color: theme.colors.mute }]}>Serial No: {item.serial_number || '—'}</Text>

              <View style={[styles.specsWell, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <View style={styles.specsGrid}>
                  <View style={styles.specsItem}>
                    <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Assigned Supervisor</Text>
                    <Text style={[styles.specsValue, { color: theme.colors.ink }]}>
                      {item.supervisor?.full_name || 'Unassigned'}
                    </Text>
                  </View>
                  <View style={styles.specsItem}>
                    <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Assigned Operator</Text>
                    <Text style={[styles.specsValue, { color: theme.colors.ink }]}>
                      {item.operator?.full_name || 'Unassigned'}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
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
