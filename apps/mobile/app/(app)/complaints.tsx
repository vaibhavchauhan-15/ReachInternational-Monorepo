/**
 * ServiceCentric Mobile — Breakdown Complaints Suite (Phase 16)
 * View complaints, create new breakdown report, update status, and attach photos.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Button, useTheme } from '../../components/ui';
import { CreateComplaintModal } from '../../components/complaints/CreateComplaintModal';
import { ComplaintStatusModal } from '../../components/work/ComplaintStatusModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate, formatMachineCode } from '@reachinternational/utils';
import { Plus, Camera, MapPin, Wrench } from 'lucide-react-native';

export type ComplaintFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

const COMPLAINT_DATA = [
  {
    id: 'cmp-008',
    complaint_no: 'CMP-008',
    machine_code: 'MCH-004',
    complaint_date: '2026-08-19',
    hour_meter: 1420,
    complaint: 'Hydraulic Pressure Loss & Oil Leakage near cylinder assembly.',
    location: 'Delhi Logistics Hub, Gate 2',
    city: 'Delhi',
    state_name: 'Delhi',
    required_part: 'Hydraulic Seal Kit',
    part_quantity: 1,
    status: 'open',
    images: ['photo1.jpg'],
  },
  {
    id: 'cmp-005',
    complaint_no: 'CMP-005',
    machine_code: 'MCH-012',
    complaint_date: '2026-08-18',
    hour_meter: 890,
    complaint: 'Brake Pad Wear & Squeal under heavy load operation.',
    location: 'Gurgaon Warehouse Bay 3',
    city: 'Gurgaon',
    state_name: 'Haryana',
    required_part: 'Brake Shoe Set',
    part_quantity: 2,
    status: 'in_progress',
    images: ['photo1.jpg', 'photo2.jpg'],
  },
  {
    id: 'cmp-002',
    complaint_no: 'CMP-002',
    machine_code: 'MCH-009',
    complaint_date: '2026-08-10',
    hour_meter: 2100,
    complaint: 'Battery Discharge & Starter Motor Click.',
    location: 'Noida Container Depot',
    city: 'Noida',
    state_name: 'Uttar Pradesh',
    required_part: '12V Heavy Duty Battery',
    part_quantity: 1,
    status: 'resolved',
    images: [],
  },
];

export default function ComplaintsScreen() {
  const { theme } = useTheme();

  const [activeFilter, setActiveFilter] = useState<ComplaintFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedComplaintNo, setSelectedComplaintNo] = useState('CMP-008');
  const [selectedStatus, setSelectedStatus] = useState('open');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openStatusUpdate = (no: string, currentStatus: string) => {
    setSelectedComplaintNo(no);
    setSelectedStatus(currentStatus);
    setStatusModalVisible(true);
  };

  const filteredComplaints = COMPLAINT_DATA.filter((c) => {
    return activeFilter === 'all' || c.status === activeFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Fixed Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>Breakdown Complaints</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              Field breakdown reports & status tracking
            </Text>
          </View>

          <Button
            label="+ Report"
            onPress={() => setCreateModalVisible(true)}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Complaints' },
            { key: 'open', label: 'Open' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'resolved', label: 'Resolved' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as ComplaintFilter)}
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

      {/* Complaints List Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {filteredComplaints.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.complaintNo, { color: theme.colors.link }]}>{item.complaint_no}</Text>
              <Badge status={item.status} />
            </View>

            <Text style={[styles.machineCode, { color: theme.colors.ink }]}>
              Machine: {formatMachineCode(item.machine_code)} • Meter: {item.hour_meter} hrs
            </Text>

            <Text style={[styles.complaintText, { color: theme.colors.body }]}>{item.complaint}</Text>

            <View style={styles.detailRow}>
              <MapPin size={14} color={theme.colors.mute} />
              <Text style={[styles.detailText, { color: theme.colors.mute }]}>
                {item.location} ({item.city})
              </Text>
            </View>

            {item.required_part ? (
              <View style={styles.detailRow}>
                <Wrench size={14} color={theme.colors.warning} />
                <Text style={[styles.detailText, { color: theme.colors.warning }]}>
                  Part Required: {item.required_part} (Qty: {item.part_quantity})
                </Text>
              </View>
            ) : null}

            {item.images.length > 0 ? (
              <View style={styles.detailRow}>
                <Camera size={14} color={theme.colors.link} />
                <Text style={[styles.detailText, { color: theme.colors.link }]}>
                  {item.images.length} Photo attached
                </Text>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <Button
                label="Update Status"
                onPress={() => openStatusUpdate(item.complaint_no, item.status)}
                size="sm"
                variant="primary"
              />
              <Button
                label="Create FSR"
                onPress={() => {}}
                size="sm"
                variant="outline"
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Create Modal */}
      <CreateComplaintModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={() => {}}
      />

      {/* Status Update Modal */}
      <ComplaintStatusModal
        visible={statusModalVisible}
        onClose={() => setStatusModalVisible(false)}
        complaintNo={selectedComplaintNo}
        currentStatus={selectedStatus}
        onUpdateStatus={() => {}}
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
  complaintNo: {
    fontSize: 15,
    fontWeight: '700',
  },
  machineCode: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  complaintText: {
    fontSize: 13,
    marginBottom: spacingNumeric.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  detailText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
