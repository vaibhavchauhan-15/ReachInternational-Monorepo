/**
 * ServiceCentric Mobile — Finance & Billing Executive Suite (Phase 22)
 * KPI summaries, receivables, payables, tax invoices, 3-way matching status,
 * field expense claims, and manager approval queues.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Input, Button, useTheme } from '../../components/ui';
import { ExpenseClaimModal } from '../../components/finance/ExpenseClaimModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate, formatINR } from '@reachinternational/utils';
import { DollarSign, FileText, CheckCircle2, AlertTriangle, CreditCard } from 'lucide-react-native';

export type FinFilter = 'all' | 'invoices' | 'expenses' | 'approvals';

const INVOICES_DATA = [
  {
    id: 'inv-881',
    invoice_no: 'INV-2026-881',
    customer_name: 'Delhi Logistics Private Limited',
    amount: 145000,
    due_date: '2026-08-31',
    match_status: 'matched',
    status: 'pending',
  },
  {
    id: 'inv-872',
    invoice_no: 'INV-2026-872',
    customer_name: 'Gurgaon Auto Ancillaries',
    amount: 72000,
    due_date: '2026-08-15',
    match_status: 'matched',
    status: 'paid',
  },
];

const EXPENSES_DATA = [
  {
    id: 'exp-041',
    claim_no: 'EXP-041',
    claimant_name: 'Rahul Sharma (Technician)',
    category: 'Fuel & Transit',
    amount: 2450,
    machine_code: 'MCH-004',
    claim_date: '2026-08-19',
    status: 'pending_approval',
  },
];

export default function FinanceScreen() {
  const { theme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FinFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Fixed Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>Finance & Approvals</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              Receivables, 3-way matching, expense claims & approvals
            </Text>
          </View>

          <Button
            label="+ Log Claim"
            onPress={() => setExpenseModalVisible(true)}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Financial KPI Summary Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiBox, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Receivables</Text>
            <Text style={[styles.kpiVal, { color: theme.colors.link }]}>{formatINR(145000)}</Text>
          </View>
          <View style={[styles.kpiBox, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Monthly Collections</Text>
            <Text style={[styles.kpiVal, { color: theme.colors.success }]}>{formatINR(72000)}</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Financials' },
            { key: 'invoices', label: 'Invoices & Receivables' },
            { key: 'expenses', label: 'Expense Claims' },
            { key: 'approvals', label: 'Approval Queue (1)' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as FinFilter)}
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

      {/* Main Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* Invoices & Receivables */}
        {(activeFilter === 'all' || activeFilter === 'invoices') && (
          <>
            {INVOICES_DATA.map((inv) => (
              <Card key={inv.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.invNo, { color: theme.colors.link }]}>{inv.invoice_no}</Text>
                  <Badge status={inv.status} />
                </View>

                <Text style={[styles.customerName, { color: theme.colors.ink }]}>{inv.customer_name}</Text>

                <View style={styles.detailRow}>
                  <Text style={[styles.amountText, { color: theme.colors.ink }]}>
                    Amount: <Text style={{ color: theme.colors.link, fontWeight: '800' }}>{formatINR(inv.amount)}</Text>
                  </Text>
                  <Badge status="working" customLabel="3-Way Matched" />
                </View>

                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  Payment Due Date: {formatDate(inv.due_date)}
                </Text>
              </Card>
            ))}
          </>
        )}

        {/* Expense Claims & Approvals */}
        {(activeFilter === 'all' || activeFilter === 'expenses' || activeFilter === 'approvals') && (
          <>
            {EXPENSES_DATA.map((exp) => (
              <Card key={exp.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.invNo, { color: theme.colors.link }]}>{exp.claim_no}</Text>
                  <Badge status={exp.status} customLabel="Pending Approval" />
                </View>

                <Text style={[styles.customerName, { color: theme.colors.ink }]}>
                  Claimant: {exp.claimant_name}
                </Text>
                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  Category: {exp.category} • Machine: {exp.machine_code}
                </Text>

                <Text style={[styles.amountText, { color: theme.colors.ink }]}>
                  Claim Amount: <Text style={{ color: theme.colors.warning, fontWeight: '800' }}>{formatINR(exp.amount)}</Text>
                </Text>

                <View style={styles.actionRow}>
                  <Button label="Approve Claim" onPress={() => {}} size="sm" variant="primary" />
                  <Button label="Reject" onPress={() => {}} size="sm" variant="ghost" />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Expense Modal */}
      <ExpenseClaimModal
        visible={expenseModalVisible}
        onClose={() => setExpenseModalVisible(false)}
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
  kpiRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginVertical: spacingNumeric.xs,
  },
  kpiBox: {
    flex: 1,
    padding: spacingNumeric.xs,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
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
  invNo: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  amountText: {
    fontSize: 13,
  },
  metaText: {
    fontSize: 12,
    marginBottom: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
