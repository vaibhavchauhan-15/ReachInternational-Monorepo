/**
 * ServiceCentric Mobile — HR & Employee Directory Suite (Phase 23)
 * Staff directory, onboarding status, document verification vault, and HR support requests.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Input, Button, useTheme } from '../../components/ui';
import { EmployeeDetailModal } from '../../components/hr/EmployeeDetailModal';
import { AccountRequestModal } from '../../components/hr/AccountRequestModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import { User, Phone, Mail, ShieldCheck, MapPin, Wrench } from 'lucide-react-native';

export type HrFilter = 'all' | 'technicians' | 'operators' | 'onboarding';

const EMPLOYEES_DATA = [
  {
    id: 'emp-104',
    full_name: 'Rahul Sharma',
    designation: 'Senior Field Service Engineer',
    role: 'service_engineer',
    phone: '+91 98765 43210',
    email: 'rahul.sharma@reachinternation.com',
    branch_name: 'Delhi Branch',
    joining_date: '2024-03-15',
    onboarding_status: 'completed',
    assigned_machine: 'Toyota 8FG (MCH-004)',
    license_status: 'Verified (Heavy Forklift Cert #HFC-9912)',
  },
  {
    id: 'emp-109',
    full_name: 'Vikram Singh',
    designation: 'Heavy Equipment Operator',
    role: 'operator',
    phone: '+91 98111 22334',
    email: 'vikram.singh@reachinternation.com',
    branch_name: 'Gurgaon Branch',
    joining_date: '2025-01-10',
    onboarding_status: 'completed',
    assigned_machine: 'Linde H30T (MCH-012)',
    license_status: 'Verified (Driving License #DL-042011)',
  },
  {
    id: 'emp-115',
    full_name: 'Anand Kumar',
    designation: 'Junior Trainee Technician',
    role: 'technician',
    phone: '+91 99000 88776',
    email: 'anand.kumar@reachinternation.com',
    branch_name: 'Delhi Branch',
    joining_date: '2026-08-01',
    onboarding_status: 'in_progress',
    assigned_machine: 'Unassigned',
    license_status: 'Under Verification',
  },
];

export default function HrScreen() {
  const { theme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<HrFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [selectedEmployee, setSelectedEmployee] = useState(EMPLOYEES_DATA[0]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openDetail = (emp: typeof EMPLOYEES_DATA[0]) => {
    setSelectedEmployee(emp);
    setDetailModalVisible(true);
  };

  const filteredEmployees = EMPLOYEES_DATA.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation.toLowerCase().includes(search.toLowerCase()) ||
      emp.branch_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      activeFilter === 'all' ||
      (activeFilter === 'technicians' && (emp.role === 'service_engineer' || emp.role === 'technician')) ||
      (activeFilter === 'operators' && emp.role === 'operator') ||
      (activeFilter === 'onboarding' && emp.onboarding_status === 'in_progress');

    return matchesSearch && matchesStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>HR & Staff Directory</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              Employee search, onboarding & support requests
            </Text>
          </View>

          <Button
            label="+ Request"
            onPress={() => setRequestModalVisible(true)}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Search */}
        <Input
          placeholder="Search staff name, role, branch..."
          value={search}
          onChangeText={setSearch}
          containerStyle={styles.searchInput}
        />

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Staff' },
            { key: 'technicians', label: 'Field Engineers' },
            { key: 'operators', label: 'Operators' },
            { key: 'onboarding', label: 'Onboarding (1)' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as HrFilter)}
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

      {/* Main Directory Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {filteredEmployees.map((emp) => (
          <Card key={emp.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <Text style={[styles.empName, { color: theme.colors.ink }]}>{emp.full_name}</Text>
                <Text style={[styles.empDesig, { color: theme.colors.mute }]}>{emp.designation}</Text>
              </View>
              <Badge status={emp.role} customLabel={emp.role.replace('_', ' ')} />
            </View>

            <View style={styles.metaRow}>
              <MapPin size={13} color={theme.colors.mute} />
              <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                {emp.branch_name} • Phone: {emp.phone}
              </Text>
            </View>

            <Text style={[styles.machineText, { color: theme.colors.body }]}>
              Assigned Equipment: <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{emp.assigned_machine}</Text>
            </Text>

            <View style={styles.actionRow}>
              <Button label="View Full Profile" onPress={() => openDetail(emp)} size="sm" variant="outline" />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          visible={detailModalVisible}
          onClose={() => setDetailModalVisible(false)}
          employeeData={selectedEmployee}
        />
      )}

      {/* Account / Support Request Modal */}
      <AccountRequestModal
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
    alignItems: 'flex-start',
    marginBottom: spacingNumeric.xs,
  },
  nameRow: {
    flex: 1,
    marginRight: 6,
  },
  empName: {
    fontSize: 16,
    fontWeight: '700',
  },
  empDesig: {
    fontSize: 12,
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
  machineText: {
    fontSize: 13,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
