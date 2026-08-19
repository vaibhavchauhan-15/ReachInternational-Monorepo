/**
 * ServiceCentric Mobile — Rental Management Suite (Phase 20)
 * Customer lookup, machine availability, active rental agreements, dispatches,
 * delivery challans, and machine return inspections.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Input, Button, useTheme } from '../../components/ui';
import { RentalReturnModal } from '../../components/rentals/RentalReturnModal';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { formatDate, formatINR, formatMachineCode } from '@servicecentric/utils';
import { Calendar, FileCheck, Truck, ShieldAlert } from 'lucide-react-native';

export type RentalFilter = 'all' | 'active' | 'pending_return' | 'challans';

const RENTAL_CONTRACTS = [
  {
    id: 'rnt-081',
    contract_no: 'RNT-2026-081',
    customer_name: 'Delhi Logistics Private Limited',
    machine_code: 'MCH-004',
    machine_name: 'Toyota 8FG 3.0T Forklift',
    monthly_rate: 65000,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    site_location: 'Delhi Hub',
    status: 'active',
  },
  {
    id: 'rnt-074',
    contract_no: 'RNT-2026-074',
    customer_name: 'Gurgaon Auto Ancillaries',
    machine_code: 'MCH-012',
    machine_name: 'Linde H30T Forklift',
    monthly_rate: 72000,
    start_date: '2026-03-15',
    end_date: '2026-08-31',
    site_location: 'Gurgaon Warehouse',
    status: 'pending_return',
  },
];

export default function RentalsScreen() {
  const { theme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<RentalFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState(RENTAL_CONTRACTS[0]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openReturnModal = (item: typeof RENTAL_CONTRACTS[0]) => {
    setSelectedContract(item);
    setReturnModalVisible(true);
  };

  const filteredContracts = RENTAL_CONTRACTS.filter((c) => {
    const matchesSearch =
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contract_no.toLowerCase().includes(search.toLowerCase()) ||
      c.machine_code.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = activeFilter === 'all' || c.status === activeFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>Rental Operations</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              Active agreements, dispatches, delivery challans & returns
            </Text>
          </View>

          <Button
            label="+ Dispatch"
            onPress={() => {}}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Search */}
        <Input
          placeholder="Search customer, contract #, machine..."
          value={search}
          onChangeText={setSearch}
          containerStyle={styles.searchInput}
        />

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Contracts' },
            { key: 'active', label: 'Active Deployments' },
            { key: 'pending_return', label: 'Pending Return' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as RentalFilter)}
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
        {filteredContracts.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.contractNo, { color: theme.colors.link }]}>{item.contract_no}</Text>
              <Badge status={item.status} />
            </View>

            <Text style={[styles.customerName, { color: theme.colors.ink }]}>{item.customer_name}</Text>
            <Text style={[styles.machineInfo, { color: theme.colors.body }]}>
              Machine: {formatMachineCode(item.machine_code)} • {item.machine_name}
            </Text>

            <View style={styles.metaRow}>
              <Calendar size={13} color={theme.colors.mute} />
              <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                Contract: {formatDate(item.start_date)} to {formatDate(item.end_date)}
              </Text>
            </View>

            <Text style={[styles.rateText, { color: theme.colors.ink }]}>
              Monthly Rate: <Text style={{ color: theme.colors.link, fontWeight: '700' }}>{formatINR(item.monthly_rate)} / mo</Text>
            </Text>

            <View style={styles.actionRow}>
              <Button label="Delivery Challan" onPress={() => {}} size="sm" variant="outline" />
              <Button label="Return Inspection" onPress={() => openReturnModal(item)} size="sm" variant="primary" />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Return Inspection Modal */}
      {selectedContract && (
        <RentalReturnModal
          visible={returnModalVisible}
          onClose={() => setReturnModalVisible(false)}
          contractNo={selectedContract.contract_no}
          machineCode={selectedContract.machine_code}
          onSubmit={() => {}}
        />
      )}
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
  searchInput: {
    marginVertical: spacingNumeric.xs,
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
  contractNo: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  machineInfo: {
    fontSize: 13,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
  },
  rateText: {
    fontSize: 13,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
