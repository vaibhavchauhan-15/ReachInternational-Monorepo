import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { MachineDetailModal } from '../../components/machines/MachineDetailModal';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Search } from 'lucide-react-native';

export type StatusFilter = 'all' | 'available' | 'rented';

const FLEET_DATA = [
  {
    id: 'mch-001',
    machine_id: 'RI-MC-0001',
    model: '8FG30',
    serial_number: 'TY8FG-99214',
    year_of_mfg: '2025',
    manufacturer: 'Toyota',
    status: 'available',
    health_status: 'active',
    hour_meter: 1420,
    service_count: 3,
    supervisor_name: 'Rajesh Kumar',
    operator_name: 'Vikram Singh',
  },
  {
    id: 'mch-002',
    machine_id: 'RI-MC-0002',
    model: 'H30T-02',
    serial_number: 'LND-30T-4401',
    year_of_mfg: '2024',
    manufacturer: 'Linde',
    status: 'rented',
    health_status: 'under_maintenance',
    hour_meter: 890,
    service_count: 5,
    supervisor_name: 'Sunil Sharma',
    operator_name: 'Amit Kumar',
  },
  {
    id: 'mch-003',
    machine_id: 'RI-MC-0003',
    model: 'FD30-17',
    serial_number: 'KM-FD30-8812',
    year_of_mfg: '2025',
    manufacturer: 'Komatsu',
    status: 'rented',
    health_status: 'breakdown',
    hour_meter: 2150,
    service_count: 8,
    supervisor_name: 'Ramesh Verma',
    operator_name: 'Pankaj Patel',
  },
];

export default function MachinesScreen() {
  const { theme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [selectedMachine, setSelectedMachine] = useState<typeof FLEET_DATA[0] | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [meterMachineCode, setMeterMachineCode] = useState('RI-MC-0001');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openDetail = (item: typeof FLEET_DATA[0]) => {
    setSelectedMachine(item);
    setDetailModalVisible(true);
  };

  const openMeter = (code: string) => {
    setMeterMachineCode(code);
    setMeterModalVisible(true);
  };

  const filteredMachines = FLEET_DATA.filter((m) => {
    const matchesSearch =
      m.machine_id.toLowerCase().includes(search.toLowerCase()) ||
      m.model.toLowerCase().includes(search.toLowerCase()) ||
      m.serial_number.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = activeFilter === 'all' || m.status === activeFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <MobileHeader
        eyebrow="FLEET DIRECTORY"
        title="Machine Fleet Directory"
        subtitle="Industrial machinery assets, HMR meter readings & personnel assignments"
      />

      {/* Search & Filter Bar */}
      <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <Input
          placeholder="Search ID, model, serial no..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={theme.colors.mute} />}
          containerStyle={styles.searchInput}
        />

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Fleet (3)' },
            { key: 'available', label: 'Available' },
            { key: 'rented', label: 'Rented' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as StatusFilter)}
                activeOpacity={0.7}
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

      {/* Machine Card List Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {filteredMachines.map((m) => (
          <Card key={m.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.code, { color: theme.colors.link }]}>
                {m.machine_id}
              </Text>
              <Badge status={m.status} />
            </View>

            <Text style={[styles.model, { color: theme.colors.ink }]}>Model: {m.model}</Text>
            <Text style={[styles.meta, { color: theme.colors.mute }]}>
              Serial: {m.serial_number} • YUM: {m.year_of_mfg}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.mute }]}>
              HMR: <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{m.hour_meter} hrs</Text> • Services: {m.service_count}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.mute }]}>
              Supervisor: <Text style={{ color: theme.colors.ink }}>{m.supervisor_name}</Text>
            </Text>

            <View style={styles.cardActions}>
              <Button label="View Specs" onPress={() => openDetail(m)} size="sm" variant="secondary" />
              <Button label="Log Meter" onPress={() => openMeter(m.machine_id)} size="sm" variant="outline" />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Modals */}
      {selectedMachine && (
        <MachineDetailModal
          visible={detailModalVisible}
          onClose={() => setDetailModalVisible(false)}
          machineData={selectedMachine}
        />
      )}

      <MeterLogModal
        visible={meterModalVisible}
        onClose={() => setMeterModalVisible(false)}
        machineCode={meterMachineCode}
        onSubmit={() => setMeterModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchFilterContainer: {
    paddingHorizontal: spacingNumeric.lg,
    paddingTop: spacingNumeric.sm,
    paddingBottom: spacingNumeric.md,
    borderBottomWidth: 1,
    gap: spacingNumeric.xs,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterScroll: {
    gap: spacingNumeric.xs,
    paddingVertical: spacingNumeric.xs,
  },
  filterPill: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs + 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  card: {
    gap: spacingNumeric.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  code: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  model: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  meta: {
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.xs,
    paddingTop: spacingNumeric.xs,
  },
});
