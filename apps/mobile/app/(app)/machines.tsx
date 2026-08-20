import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { MachineDetailModal } from '../../components/machines/MachineDetailModal';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { formatMachineCode } from '@servicecentric/utils';
import { Search } from 'lucide-react-native';

export type StatusFilter = 'all' | 'active' | 'on_rent' | 'under_maintenance' | 'inactive';

const FLEET_DATA = [
  {
    id: 'mch-004',
    machine_code: 'MCH-004',
    machine_name: 'Toyota 8FG 3.0T Forklift',
    model: '8FG30',
    serial_number: 'TY8FG-99214',
    category: 'Forklift Counterbalance',
    status: 'active',
    hour_meter: 1420,
    customer_name: 'Delhi Logistics Private Limited',
    customer_mobile: '+91 98765 43210',
    city: 'Delhi',
    state: 'Delhi',
    insurance_policy_no: 'POL-ICICI-883219',
    insurance_expiry_date: '2026-12-31',
    third_party_certificate: 'TPC-2026-4412',
    next_service_due_date: '2026-09-15',
    operator_name: 'Vikram Singh',
  },
  {
    id: 'mch-012',
    machine_code: 'MCH-012',
    machine_name: 'Linde H30T Forklift',
    model: 'H30T-02',
    serial_number: 'LND-30T-4401',
    category: 'Forklift IC Engine',
    status: 'under_maintenance',
    hour_meter: 890,
    customer_name: 'Gurgaon Auto Ancillaries',
    customer_mobile: '+91 98111 22334',
    city: 'Gurgaon',
    state: 'Haryana',
    insurance_policy_no: 'POL-BAJAJ-771120',
    insurance_expiry_date: '2026-11-20',
    third_party_certificate: 'TPC-2026-8911',
    next_service_due_date: '2026-08-30',
    operator_name: 'Amit Kumar',
  },
  {
    id: 'mch-009',
    machine_code: 'MCH-009',
    machine_name: 'Komatsu FD30 Forklift',
    model: 'FD30-17',
    serial_number: 'KM-FD30-8812',
    category: 'Heavy Forklift',
    status: 'on_rent',
    hour_meter: 2150,
    customer_name: 'Noida Container Depot',
    customer_mobile: '+91 99000 55443',
    city: 'Noida',
    state: 'Uttar Pradesh',
    insurance_policy_no: 'POL-HDFC-991204',
    insurance_expiry_date: '2027-01-15',
    third_party_certificate: 'TPC-2026-1102',
    next_service_due_date: '2026-10-10',
    operator_name: 'Ramesh Verma',
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
  const [meterMachineCode, setMeterMachineCode] = useState('MCH-004');

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
      m.machine_code.toLowerCase().includes(search.toLowerCase()) ||
      m.machine_name.toLowerCase().includes(search.toLowerCase()) ||
      m.customer_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = activeFilter === 'all' || m.status === activeFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <MobileHeader
        eyebrow="FLEET DIRECTORY"
        title="Machine Fleet Directory"
        subtitle="Industrial machinery assets, spec sheets & site assignments"
      />

      {/* Search & Filter Bar */}
      <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <Input
          placeholder="Search code, model, customer..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={theme.colors.mute} />}
          containerStyle={styles.searchInput}
        />

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Fleet (3)' },
            { key: 'active', label: 'Active' },
            { key: 'on_rent', label: 'On Rent' },
            { key: 'under_maintenance', label: 'Under Service' },
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
                {formatMachineCode(m.machine_code)}
              </Text>
              <Badge status={m.status} />
            </View>

            <Text style={[styles.model, { color: theme.colors.ink }]}>{m.machine_name}</Text>
            <Text style={[styles.meta, { color: theme.colors.mute }]}>
              Hour Meter: <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{m.hour_meter} hrs</Text>
            </Text>
            <Text style={[styles.meta, { color: theme.colors.mute }]}>
              Customer / Site: {m.customer_name} ({m.city})
            </Text>

            <View style={styles.actionRow}>
              <Button label="View Details" onPress={() => openDetail(m)} size="sm" variant="primary" />
              <Button label="Log Meter" onPress={() => openMeter(m.machine_code)} size="sm" variant="outline" />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Detail Modal */}
      {selectedMachine && (
        <MachineDetailModal
          visible={detailModalVisible}
          onClose={() => setDetailModalVisible(false)}
          machineData={selectedMachine}
        />
      )}

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
  searchFilterContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.xs,
    paddingBottom: spacingNumeric.xs,
    borderBottomWidth: 1,
  },
  searchInput: {
    marginBottom: spacingNumeric.xs,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    paddingBottom: 4,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: spacingNumeric.sm,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    marginRight: spacingNumeric.xxs,
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
  model: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    marginBottom: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
