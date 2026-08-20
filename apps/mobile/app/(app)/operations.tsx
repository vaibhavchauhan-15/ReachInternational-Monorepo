/**
 * ServiceCentric Mobile — Operations Suite (Phase 18)
 * Daily shift logs, start/end meter readings, fuel tracking, operator assignments,
 * loading/unloading, site relocation, and condition checks.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Button, useTheme } from '../../components/ui';
import { SiteMovementModal } from '../../components/operations/SiteMovementModal';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate, formatMachineCode } from '@reachinternational/utils';
import { Truck, Clock, Fuel, UserCheck, MapPin } from 'lucide-react-native';

export type OpsFilter = 'all' | 'shift_logs' | 'movements' | 'assignments';

const SHIFT_LOGS_DATA = [
  {
    id: 'log-101',
    machine_code: 'MCH-004',
    log_date: '2026-08-19',
    shift: 'Morning Shift',
    operator_name: 'Vikram Singh',
    start_meter: 1412,
    end_meter: 1420,
    running_hours: 8.0,
    fuel_consumed: 14.5,
    location: 'Delhi Logistics Hub',
    status: 'approved',
  },
  {
    id: 'log-102',
    machine_code: 'MCH-012',
    log_date: '2026-08-19',
    shift: 'Morning Shift',
    operator_name: 'Amit Kumar',
    start_meter: 884,
    end_meter: 890,
    running_hours: 6.0,
    fuel_consumed: 11.0,
    location: 'Gurgaon Warehouse',
    status: 'pending',
  },
];

const SITE_MOVEMENTS_DATA = [
  {
    id: 'mov-005',
    machine_code: 'MCH-009',
    from_location: 'Delhi Main Yard',
    to_location: 'Noida Container Depot',
    transporter: 'VRL Logistics Flatbed',
    dispatch_date: '2026-08-18',
    status: 'in_transit',
  },
];

export default function OperationsScreen() {
  const { theme } = useTheme();

  const [activeFilter, setActiveFilter] = useState<OpsFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [movementModalVisible, setMovementModalVisible] = useState(false);
  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [meterMachineCode, setMeterMachineCode] = useState('MCH-004');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openMeter = (code: string) => {
    setMeterMachineCode(code);
    setMeterModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Fixed Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>Field Operations</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              Shift meter logs, fuel, assignments & site movements
            </Text>
          </View>

          <Button
            label="+ Relocate"
            onPress={() => setMovementModalVisible(true)}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Operations' },
            { key: 'shift_logs', label: 'Daily Meter Logs' },
            { key: 'movements', label: 'Site Relocations' },
            { key: 'assignments', label: 'Operator Assignments' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as OpsFilter)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: isActive ? '#ffffff' : theme.colors.body }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* Daily Shift Logs */}
        {(activeFilter === 'all' || activeFilter === 'shift_logs') && (
          <>
            {SHIFT_LOGS_DATA.map((log) => (
              <Card key={log.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.code, { color: theme.colors.link }]}>
                    {formatMachineCode(log.machine_code)} — {log.shift}
                  </Text>
                  <Badge status={log.status} />
                </View>

                <Text style={[styles.title, { color: theme.colors.ink }]}>
                  Operator: {log.operator_name} • Date: {formatDate(log.log_date)}
                </Text>

                <View style={styles.metricsGrid}>
                  <View style={[styles.metricBox, { backgroundColor: theme.colors.hairlineSoft }]}>
                    <Clock size={14} color={theme.colors.link} />
                    <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>Run Hours</Text>
                    <Text style={[styles.metricVal, { color: theme.colors.ink }]}>{log.running_hours} hrs</Text>
                  </View>

                  <View style={[styles.metricBox, { backgroundColor: theme.colors.hairlineSoft }]}>
                    <Fuel size={14} color={theme.colors.warning} />
                    <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>Fuel Used</Text>
                    <Text style={[styles.metricVal, { color: theme.colors.ink }]}>{log.fuel_consumed} L</Text>
                  </View>
                </View>

                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  Start Meter: {log.start_meter} hrs → End Meter: {log.end_meter} hrs
                </Text>
                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  Location: {log.location}
                </Text>

                <View style={styles.actionRow}>
                  <Button label="Log New Shift" onPress={() => openMeter(log.machine_code)} size="sm" variant="outline" />
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Site Relocations */}
        {(activeFilter === 'all' || activeFilter === 'movements') && (
          <>
            {SITE_MOVEMENTS_DATA.map((mov) => (
              <Card key={mov.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.code, { color: theme.colors.link }]}>
                    {formatMachineCode(mov.machine_code)} — Relocation
                  </Text>
                  <Badge status="in_progress" customLabel="In Transit" />
                </View>

                <Text style={[styles.title, { color: theme.colors.ink }]}>
                  Transporter: {mov.transporter}
                </Text>

                <View style={styles.locationBox}>
                  <MapPin size={14} color={theme.colors.mute} />
                  <Text style={[styles.locText, { color: theme.colors.body }]}>
                    From: {mov.from_location} → To: {mov.to_location}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <Button label="Confirm Unloading" onPress={() => {}} size="sm" variant="primary" />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Site Movement Modal */}
      <SiteMovementModal
        visible={movementModalVisible}
        onClose={() => setMovementModalVisible(false)}
        onSubmit={() => {}}
      />

      {/* Meter Log Modal */}
      <MeterLogModal
        visible={meterModalVisible}
        onClose={() => setMeterModalVisible(false)}
        machineCode={meterMachineCode}
        onSubmit={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: 50,
    paddingBottom: spacingNumeric.xs,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  screenSubtitle: {
    fontSize: 13,
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: spacingNumeric.xs,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: spacingNumeric.sm,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    marginRight: spacingNumeric.xs,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedContent: {
    padding: spacingNumeric.md,
    paddingBottom: 40,
  },
  card: {
    marginVertical: spacingNumeric.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  code: {
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacingNumeric.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.xs,
  },
  metricBox: {
    flex: 1,
    padding: spacingNumeric.xs,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    marginBottom: 2,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  locText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
