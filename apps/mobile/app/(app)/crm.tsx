/**
 * ServiceCentric Mobile — CRM & Sales Suite (Phase 21)
 * Lead management, pipeline tracking, customer activity logs, deal opportunities,
 * and quotation visibility using mobile cards and forms.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Input, Button, useTheme } from '../../components/ui';
import { CreateLeadModal } from '../../components/crm/CreateLeadModal';
import { LogInteractionModal } from '../../components/crm/LogInteractionModal';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { formatDate, formatINR } from '@servicecentric/utils';
import { PhoneCall, MapPin, DollarSign, Calendar, TrendingUp } from 'lucide-react-native';

export type CrmFilter = 'all' | 'leads' | 'opportunities' | 'interactions';

const LEADS_DATA = [
  {
    id: 'opp-101',
    company_name: 'Reliance Retail Logistics',
    contact_name: 'Rajesh Mehta',
    phone: '+91 98765 43210',
    city: 'Mumbai',
    estimated_value: 360000,
    requirement: '3.0T Electric Forklift (3 Units, 1 Year Rental)',
    stage: 'proposal',
    updated_at: '2026-08-19',
  },
  {
    id: 'opp-104',
    company_name: 'Adani Logistics Park',
    contact_name: 'Suresh Patel',
    phone: '+91 98220 11990',
    city: 'Mundra',
    estimated_value: 850000,
    requirement: 'Heavy Diesel Forklift (5.0T, Long-term Contract)',
    stage: 'in_progress',
    updated_at: '2026-08-18',
  },
];

const INTERACTIONS_DATA = [
  {
    id: 'act-042',
    customer_name: 'Delhi Logistics Pvt Ltd',
    type: 'Site Visit',
    notes: 'Met VP Operations regarding fleet expansion. Requested quotation for 2 additional reach trucks.',
    date: '2026-08-19',
    follow_up: '2026-08-25',
  },
];

export default function CrmScreen() {
  const { theme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<CrmFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [leadModalVisible, setLeadModalVisible] = useState(false);
  const [interactionModalVisible, setInteractionModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('Delhi Logistics Pvt Ltd');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openLogActivity = (name: string) => {
    setSelectedCustomer(name);
    setInteractionModalVisible(true);
  };

  const filteredLeads = LEADS_DATA.filter((l) => {
    const matchesSearch =
      l.company_name.toLowerCase().includes(search.toLowerCase()) ||
      l.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      l.city.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      activeFilter === 'all' ||
      (activeFilter === 'leads' && l.stage === 'qualified') ||
      (activeFilter === 'opportunities' && (l.stage === 'proposal' || l.stage === 'in_progress'));

    return matchesSearch && matchesStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>CRM & Sales Pipeline</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              Lead tracking, deal opportunities & activity logs
            </Text>
          </View>

          <Button
            label="+ New Lead"
            onPress={() => setLeadModalVisible(true)}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Pipeline Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>Pipeline Value</Text>
            <Text style={[styles.summaryVal, { color: theme.colors.link }]}>{formatINR(1210000)}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>Active Opportunities</Text>
            <Text style={[styles.summaryVal, { color: theme.colors.ink }]}>2 Deals</Text>
          </View>
        </View>

        {/* Search */}
        <Input
          placeholder="Search company, contact, city..."
          value={search}
          onChangeText={setSearch}
          containerStyle={styles.searchInput}
        />

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Deals' },
            { key: 'opportunities', label: 'Active Opportunities' },
            { key: 'interactions', label: 'Activity Logs' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as CrmFilter)}
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
        {/* Deals & Opportunities Section */}
        {(activeFilter === 'all' || activeFilter === 'leads' || activeFilter === 'opportunities') && (
          <>
            {filteredLeads.map((item) => (
              <Card key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.companyName, { color: theme.colors.ink }]}>{item.company_name}</Text>
                  <Badge status={item.stage} />
                </View>

                <Text style={[styles.contactInfo, { color: theme.colors.mute }]}>
                  Contact: {item.contact_name} ({item.phone}) • {item.city}
                </Text>

                <Text style={[styles.requirementText, { color: theme.colors.body }]}>
                  Requirement: {item.requirement}
                </Text>

                <Text style={[styles.valueText, { color: theme.colors.link }]}>
                  Est. Deal Value: <Text style={{ fontWeight: '800' }}>{formatINR(item.estimated_value)}</Text>
                </Text>

                <View style={styles.actionRow}>
                  <Button label="Log Activity" onPress={() => openLogActivity(item.company_name)} size="sm" variant="primary" />
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Customer Interaction Logs Section */}
        {(activeFilter === 'all' || activeFilter === 'interactions') && (
          <>
            {INTERACTIONS_DATA.map((act) => (
              <Card key={act.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.companyName, { color: theme.colors.link }]}>{act.customer_name}</Text>
                  <Badge status="working" customLabel={act.type} />
                </View>

                <Text style={[styles.requirementText, { color: theme.colors.body }]}>{act.notes}</Text>

                <View style={styles.metaRow}>
                  <Calendar size={13} color={theme.colors.mute} />
                  <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                    Date: {formatDate(act.date)} • Follow-Up Due: {formatDate(act.follow_up)}
                  </Text>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Create Lead Modal */}
      <CreateLeadModal
        visible={leadModalVisible}
        onClose={() => setLeadModalVisible(false)}
        onSubmit={() => {}}
      />

      {/* Log Interaction Modal */}
      <LogInteractionModal
        visible={interactionModalVisible}
        onClose={() => setInteractionModalVisible(false)}
        customerName={selectedCustomer}
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
  summaryCard: {
    flexDirection: 'row',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginVertical: spacingNumeric.xs,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: '100%',
  },
  searchInput: {
    marginBottom: spacingNumeric.xs,
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
  companyName: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactInfo: {
    fontSize: 12,
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 13,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacingNumeric.xs,
  },
  metaText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
