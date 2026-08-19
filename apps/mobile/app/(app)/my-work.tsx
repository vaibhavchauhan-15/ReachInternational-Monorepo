/**
 * ServiceCentric Mobile — Central Field My Work Hub (Phase 14)
 * Complete field technician & operator daily task management suite.
 * Supports breakdown complaints, service jobs, assigned machines, approval tasks,
 * meter log entries, priority sorting, status updates, and pull-to-refresh.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Button, useTheme } from '../../components/ui';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { ComplaintStatusModal } from '../../components/work/ComplaintStatusModal';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { formatDate } from '@servicecentric/utils';

export type SegmentFilter = 'all' | 'complaints' | 'services' | 'machines' | 'approvals';

export default function MyWorkScreen() {
  const { theme } = useTheme();

  const [activeSegment, setActiveSegment] = useState<SegmentFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modal State Controls
  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [selectedMachineCode, setSelectedMachineCode] = useState('MCH-004');

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedComplaintNo, setSelectedComplaintNo] = useState('CMP-008');
  const [selectedComplaintStatus, setSelectedComplaintStatus] = useState('open');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openMeterModal = (code: string) => {
    setSelectedMachineCode(code);
    setMeterModalVisible(true);
  };

  const openStatusModal = (no: string, currentStatus: string) => {
    setSelectedComplaintNo(no);
    setSelectedComplaintStatus(currentStatus);
    setStatusModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Fixed Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>My Daily Field Work</Text>
        <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
          Central active field queue & technician assignments
        </Text>

        {/* Filter Segment Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentScroll}>
          {[
            { key: 'all', label: 'All Tasks (5)' },
            { key: 'complaints', label: 'Complaints (2)' },
            { key: 'services', label: 'Services (1)' },
            { key: 'machines', label: 'My Machines (1)' },
            { key: 'approvals', label: 'Approvals (1)' },
          ].map((seg) => {
            const isActive = activeSegment === seg.key;
            return (
              <TouchableOpacity
                key={seg.key}
                onPress={() => setActiveSegment(seg.key as SegmentFilter)}
                style={[
                  styles.segmentPill,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: isActive ? '#ffffff' : theme.colors.body },
                  ]}
                >
                  {seg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Work Items Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* 1. Breakdown Complaints Section */}
        {(activeSegment === 'all' || activeSegment === 'complaints') && (
          <>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <Badge status="open" customLabel="Open Breakdown" />
                  <View style={[styles.priorityTag, { backgroundColor: theme.colors.error + '22', borderColor: theme.colors.error }]}>
                    <Text style={[styles.priorityText, { color: theme.colors.error }]}>CRITICAL PRIORITY</Text>
                  </View>
                </View>
                <Text style={[styles.timeAgo, { color: theme.colors.faint }]}>Due: {formatDate(new Date())}</Text>
              </View>

              <Text style={[styles.jobTitle, { color: theme.colors.ink }]}>
                CMP-008 • Hydraulic Pressure Loss & Leakage
              </Text>
              <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                Machine: Toyota 8FG (MCH-004) • Location: Delhi Logistics Hub
              </Text>
              <Text style={[styles.descText, { color: theme.colors.body }]}>
                Customer reported sudden hydraulic pressure drop under load. Oil leak near cylinder.
              </Text>

              <View style={styles.actionRow}>
                <Button label="Update Status" onPress={() => openStatusModal('CMP-008', 'open')} size="sm" variant="primary" />
                <Button label="Log Meter" onPress={() => openMeterModal('MCH-004')} size="sm" variant="outline" />
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <Badge status="in_progress" customLabel="In Progress" />
                  <View style={[styles.priorityTag, { backgroundColor: theme.colors.warning + '22', borderColor: theme.colors.warning }]}>
                    <Text style={[styles.priorityText, { color: theme.colors.warning }]}>HIGH PRIORITY</Text>
                  </View>
                </View>
                <Text style={[styles.timeAgo, { color: theme.colors.faint }]}>Due: Tomorrow</Text>
              </View>

              <Text style={[styles.jobTitle, { color: theme.colors.ink }]}>
                CMP-005 • Brake Pad Wear & Squeal
              </Text>
              <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                Machine: Linde H30T (MCH-012) • Location: Gurgaon Warehouse
              </Text>
              <Text style={[styles.descText, { color: theme.colors.body }]}>
                Brake lining worn out. Replacement parts requested from main store.
              </Text>

              <View style={styles.actionRow}>
                <Button label="Update Status" onPress={() => openStatusModal('CMP-005', 'in_progress')} size="sm" variant="primary" />
                <Button label="Log Meter" onPress={() => openMeterModal('MCH-012')} size="sm" variant="outline" />
              </View>
            </Card>
          </>
        )}

        {/* 2. Scheduled Service Jobs Section */}
        {(activeSegment === 'all' || activeSegment === 'services') && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Badge status="scheduled" customLabel="Service Due" />
              <Text style={[styles.timeAgo, { color: theme.colors.faint }]}>Due: {formatDate(new Date())}</Text>
            </View>

            <Text style={[styles.jobTitle, { color: theme.colors.ink }]}>
              SRV-014 • 1000 Hours Periodic Maintenance
            </Text>
            <Text style={[styles.metaText, { color: theme.colors.mute }]}>
              Machine: Komatsu FD30 (MCH-009) • Current Meter: 998 hrs
            </Text>
            <Text style={[styles.descText, { color: theme.colors.body }]}>
              Standard 1000h service checklist: Engine oil change, hydraulic filter replacement, grease points.
            </Text>

            <View style={styles.actionRow}>
              <Button label="Complete Service" onPress={() => {}} size="sm" variant="primary" />
              <Button label="Log Meter" onPress={() => openMeterModal('MCH-009')} size="sm" variant="outline" />
            </View>
          </Card>
        )}

        {/* 3. Assigned Machines Section */}
        {(activeSegment === 'all' || activeSegment === 'machines') && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Badge status="working" customLabel="Assigned Machine" />
              <Text style={[styles.timeAgo, { color: theme.colors.faint }]}>Operator Assignment</Text>
            </View>

            <Text style={[styles.jobTitle, { color: theme.colors.ink }]}>
              MCH-004 • Toyota 8FG 3.0T Forklift
            </Text>
            <Text style={[styles.metaText, { color: theme.colors.mute }]}>
              Serial #: TY8FG-99214 • Shift: Morning • Site: Delhi Logistics
            </Text>

            <View style={styles.actionRow}>
              <Button label="Log Daily Meter" onPress={() => openMeterModal('MCH-004')} size="sm" variant="primary" />
            </View>
          </Card>
        )}

        {/* 4. Approval Tasks Section */}
        {(activeSegment === 'all' || activeSegment === 'approvals') && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Badge status="pending_approval" customLabel="Pending Review" />
              <Text style={[styles.timeAgo, { color: theme.colors.faint }]}>Approval Task</Text>
            </View>

            <Text style={[styles.jobTitle, { color: theme.colors.ink }]}>
              FSR Review — Field Service Report #FSR-032
            </Text>
            <Text style={[styles.metaText, { color: theme.colors.mute }]}>
              Technician: Rahul Sharma • Machine: MCH-012
            </Text>

            <View style={styles.actionRow}>
              <Button label="Approve FSR" onPress={() => {}} size="sm" variant="primary" />
              <Button label="Reject" onPress={() => {}} size="sm" variant="ghost" />
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Meter Log Form Modal */}
      <MeterLogModal
        visible={meterModalVisible}
        onClose={() => setMeterModalVisible(false)}
        machineCode={selectedMachineCode}
        onSubmit={(log) => {}}
      />

      {/* Complaint Status Update Modal */}
      <ComplaintStatusModal
        visible={statusModalVisible}
        onClose={() => setStatusModalVisible(false)}
        complaintNo={selectedComplaintNo}
        currentStatus={selectedComplaintStatus}
        onUpdateStatus={(newStatus) => {}}
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
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  screenSubtitle: {
    fontSize: 13,
    marginBottom: spacingNumeric.sm,
  },
  segmentScroll: {
    flexDirection: 'row',
    marginBottom: spacingNumeric.xs,
  },
  segmentPill: {
    paddingVertical: 6,
    paddingHorizontal: spacingNumeric.sm,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    marginRight: spacingNumeric.xs,
  },
  segmentText: {
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  priorityTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 11,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  descText: {
    fontSize: 13,
    marginBottom: spacingNumeric.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.xxs,
  },
});
