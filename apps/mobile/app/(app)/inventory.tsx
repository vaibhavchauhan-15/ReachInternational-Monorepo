/**
 * ServiceCentric Mobile — Inventory & Store Suite (Phase 19)
 * Stock search, availability, part requisitions, issued parts, and material challans.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Input, Button, useTheme } from '../../components/ui';
import { PartRequestModal } from '../../components/inventory/PartRequestModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate, formatINR, formatMachineCode } from '@reachinternational/utils';
import { Package, Search, Truck, Layers, CheckCircle } from 'lucide-react-native';

export type InventoryFilter = 'all' | 'stock' | 'requests' | 'challans';

const INVENTORY_STOCK = [
  {
    id: 'prt-001',
    part_code: 'HSK-8812',
    part_name: 'Hydraulic Seal Kit (3.0T Forklift)',
    category: 'Hydraulics',
    stock_qty: 14,
    unit: 'Sets',
    bin_location: 'Aisle 3 • Bin B-12',
    unit_price: 3450,
    status: 'active',
  },
  {
    id: 'prt-002',
    part_code: 'BS-4401',
    part_name: 'Front Brake Shoe Set',
    category: 'Brake Mechanics',
    stock_qty: 6,
    unit: 'Sets',
    bin_location: 'Aisle 1 • Bin C-04',
    unit_price: 2100,
    status: 'active',
  },
  {
    id: 'prt-003',
    part_code: 'OF-1002',
    part_name: 'Engine Oil Filter (Komatsu FD30)',
    category: 'Filters',
    stock_qty: 28,
    unit: 'Pcs',
    bin_location: 'Aisle 2 • Bin A-08',
    unit_price: 650,
    status: 'active',
  },
];

const REQUISITIONS_DATA = [
  {
    id: 'req-014',
    req_no: 'REQ-014',
    part_name: 'Hydraulic Seal Kit (HSK-8812)',
    machine_code: 'MCH-004',
    qty: 1,
    request_date: '2026-08-19',
    urgency: 'high',
    status: 'approved',
  },
  {
    id: 'req-011',
    req_no: 'REQ-011',
    part_name: 'Front Brake Shoe Set (BS-4401)',
    machine_code: 'MCH-012',
    qty: 2,
    request_date: '2026-08-18',
    urgency: 'normal',
    status: 'issued',
  },
];

export default function InventoryScreen() {
  const { theme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<InventoryFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const filteredStock = INVENTORY_STOCK.filter((item) => {
    return (
      item.part_name.toLowerCase().includes(search.toLowerCase()) ||
      item.part_code.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>Inventory & Spare Parts</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              Stock availability, part requests & delivery challans
            </Text>
          </View>

          <Button
            label="+ Request Part"
            onPress={() => setRequestModalVisible(true)}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Search */}
        <Input
          placeholder="Search part name, P/N, category..."
          value={search}
          onChangeText={setSearch}
          containerStyle={styles.searchInput}
        />

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Inventory' },
            { key: 'stock', label: 'Stock Levels' },
            { key: 'requests', label: 'My Requisitions' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as InventoryFilter)}
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
        {/* Stock Items Section */}
        {(activeFilter === 'all' || activeFilter === 'stock') && (
          <>
            {filteredStock.map((item) => (
              <Card key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.partCode, { color: theme.colors.link }]}>{item.part_code}</Text>
                  <View style={[styles.qtyTag, { backgroundColor: theme.colors.success + '22', borderColor: theme.colors.success }]}>
                    <Text style={[styles.qtyText, { color: theme.colors.success }]}>
                      {item.stock_qty} {item.unit} Available
                    </Text>
                  </View>
                </View>

                <Text style={[styles.partName, { color: theme.colors.ink }]}>{item.part_name}</Text>

                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  Category: {item.category} • Location: {item.bin_location}
                </Text>

                <Text style={[styles.priceText, { color: theme.colors.body }]}>
                  Est. Unit Rate: <Text style={{ color: theme.colors.ink, fontWeight: '700' }}>{formatINR(item.unit_price)}</Text>
                </Text>

                <View style={styles.actionRow}>
                  <Button label="Request This Part" onPress={() => setRequestModalVisible(true)} size="sm" variant="outline" />
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Part Requisitions Section */}
        {(activeFilter === 'all' || activeFilter === 'requests') && (
          <>
            {REQUISITIONS_DATA.map((req) => (
              <Card key={req.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.reqNo, { color: theme.colors.link }]}>{req.req_no}</Text>
                  <Badge status={req.status} />
                </View>

                <Text style={[styles.partName, { color: theme.colors.ink }]}>{req.part_name}</Text>
                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  For Machine: {formatMachineCode(req.machine_code)} • Qty: {req.qty}
                </Text>
                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  Requested Date: {formatDate(req.request_date)}
                </Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Part Request Modal */}
      <PartRequestModal
        visible={requestModalVisible}
        onClose={() => setRequestModalVisible(false)}
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
  partCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  qtyTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  qtyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  partName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    marginBottom: 2,
  },
  priceText: {
    fontSize: 13,
    marginTop: 4,
  },
  reqNo: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
