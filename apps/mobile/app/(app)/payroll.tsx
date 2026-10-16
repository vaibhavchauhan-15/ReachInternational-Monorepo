import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/ThemeProvider';
import { MobileHeader, Card, EmptyState, ErrorState, PermissionDeniedView, FormError, KPICard, KPIGrid, HighlightText, type HeaderActionItem, Text, AppModal, Input, SearchInput, useToast } from '../../components/ui';
import { PayrollSkeleton, OperatorPayrollCard } from '../../components/payroll';
import { Pressable } from '../../components/ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { usePayrollData } from '../../lib/hooks/usePayrollData';
import { calculateOperatorSalary, sanitizeDatabaseError } from '@reachinternational/utils';
import { useAuth } from '../../lib/auth/useAuth';
import { supabase } from '../../lib/supabase';
import {
  Banknote,
  Search,
  RefreshCw,
  Edit2,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  CreditCard,
} from '../../components/ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { HRPayrollSummary, HRPayrollOperator } from '@reachinternational/types';

const ALLOWED_ROLES = ['super_admin', 'admin', 'hr'];

export default function PayrollScreen() {
  const { theme, isDark } = useTheme();
  const { role } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Guard access
  const normalizedRole = (role || '').toLowerCase();
  const isAllowed = ALLOWED_ROLES.includes(normalizedRole);

  const [statementError, setStatementError] = useState<string | null>(null);
  
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Persistent search and month filter state
  const {
    search: debouncedSearchQuery,
    inputValue: searchQuery,
    setSearch: setSearchQuery,
    filters,
    setFilter,
  } = usePersistentListState<{
    selectedMonth: string;
    payoutFilter: string;
  }>({
    storageKey: 'reach_filters_payroll',
    defaultSearch: '',
    defaultFilters: {
      selectedMonth: defaultMonth,
      payoutFilter: 'all',
    },
    debounceMs: 250,
  });

  const selectedMonth = filters.selectedMonth;
  const setSelectedMonth = useCallback((m: string) => setFilter('selectedMonth', m), [setFilter]);
  const payoutFilter = filters.payoutFilter || 'all';
  const setPayoutFilter = useCallback((p: string) => setFilter('payoutFilter', p), [setFilter]);

  // Delegated domain coordinator hook (TanStack Query + domain business logic)
  const {
    payrollData,
    operators,
    summaryKpis,
    isLoading: loading,
    error: fetchError,
    refetch,
    isFetching: refreshing,
    saveStatement,
    isSavingStatement: savingStatement,
  } = usePayrollData({
    month: selectedMonth,
    searchQuery: debouncedSearchQuery,
    payoutFilter,
    enabled: isAllowed,
  });

  // Expanded card tracking
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals state
  const [viewSlipOp, setViewSlipOp] = useState<HRPayrollOperator | null>(null);
  const [editingOperator, setEditingOperator] = useState<HRPayrollOperator | null>(null);

  // Edit form state
  const [editBasic, setEditBasic] = useState('');
  const [editAttendedDays, setEditAttendedDays] = useState('');
  const [editWorkingDays, setEditWorkingDays] = useState('30');
  const [editOtDays, setEditOtDays] = useState('');
  const [editPlAdj, setEditPlAdj] = useState('');
  const [editLoan, setEditLoan] = useState('');
  const [editAdvance, setEditAdvance] = useState('');
  const [editOtherDed, setEditOtherDed] = useState('');
  const [editPaidReach, setEditPaidReach] = useState('');
  const [editPaidSS, setEditPaidSS] = useState('');
  const [editPaidQuess, setEditPaidQuess] = useState('');

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Open edit modal
  const handleOpenEdit = (op: HRPayrollOperator) => {
    setEditingOperator(op);
    setStatementError(null);
    setEditBasic(String(op.basic_salary || op.daily_rate * 30 || 28000));
    setEditAttendedDays(String(op.attended_days || op.work_days || 0));
    setEditWorkingDays(String(op.working_days || 30));
    setEditOtDays(String(op.ot_days || 0));
    setEditPlAdj(String(op.pl_adjusted || 0));
    setEditLoan(String(op.loan_deduction || 0));
    setEditAdvance(String(op.advance_deduction || 0));
    setEditOtherDed(String(op.other_deductions || 0));
    setEditPaidReach(String(op.paid_reach || 0));
    setEditPaidSS(String(op.paid_ss || 0));
    setEditPaidQuess(String(op.paid_quess || 0));
  };

  // Live computed Net Pay for Edit Modal via canonical domain formula
  const editComputed = useMemo(() => {
    return calculateOperatorSalary({
      basic_salary: Number(editBasic) || 0,
      working_days: Number(editWorkingDays) || 30,
      attended_days: Number(editAttendedDays) || 0,
      ot_days: Number(editOtDays) || 0,
      pl_adjusted: Number(editPlAdj) || 0,
      loan_deduction: Number(editLoan) || 0,
      advance_deduction: Number(editAdvance) || 0,
      other_deductions: Number(editOtherDed) || 0,
      paid_reach: Number(editPaidReach) || 0,
      paid_ss: Number(editPaidSS) || 0,
      paid_quess: Number(editPaidQuess) || 0,
    });
  }, [
    editBasic,
    editWorkingDays,
    editAttendedDays,
    editOtDays,
    editPlAdj,
    editLoan,
    editAdvance,
    editOtherDed,
    editPaidReach,
    editPaidSS,
    editPaidQuess,
  ]);

  // Save statement updates via hook mutation
  const handleSaveStatement = async () => {
    if (!editingOperator) return;

    try {
      setStatementError(null);
      const targetDate = `${selectedMonth}-01`;
      const payload = {
        basic_salary: Number(editBasic) || 0,
        working_days: Number(editWorkingDays) || 30,
        attended_days: Number(editAttendedDays) || 0,
        ot_days: Number(editOtDays) || 0,
        pl_adjusted: Number(editPlAdj) || 0,
        loan_deduction: Number(editLoan) || 0,
        advance_deduction: Number(editAdvance) || 0,
        other_deductions: Number(editOtherDed) || 0,
        paid_reach: Number(editPaidReach) || 0,
        paid_ss: Number(editPaidSS) || 0,
        paid_quess: Number(editPaidQuess) || 0,
      };

      await saveStatement({
        operatorId: editingOperator.operator_id,
        payload,
      });

      haptics.confirm();
      setStatementError(null);
      toast('success', 'Salary Statement Updated', 'Changes have been saved successfully.');
      setEditingOperator(null);
    } catch (err: any) {
      haptics.reject();
      const sanitized = sanitizeDatabaseError(err, 'Failed to save salary statement.');
      setStatementError(sanitized.message || null);
      toast('error', 'Update Failed', sanitized.message);
    }
  };

  if (!isAllowed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader title="Salary Statement" showBack={false} />
        <PermissionDeniedView
          featureName="Workforce Payroll"
          currentRole={role}
          requiredRoles={ALLOWED_ROLES}
        />
      </View>
    );
  }

  // Month selector options
  const monthList = useMemo(() => {
    const list = [];
    const baseYear = 2026;
    for (let m = 1; m <= 12; m++) {
      const val = `${baseYear}-${String(m).padStart(2, '0')}`;
      const d = new Date(baseYear, m - 1, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      list.push({ label, value: val });
    }
    return list;
  }, []);

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    return [
      {
        id: 'refresh-payroll',
        label: 'Refresh Statement',
        icon: <RefreshCw size={15} color={theme.colors.ink} loading={refreshing} />,
        onPress: onRefresh,
      },
    ];
  }, [theme.colors.ink, onRefresh, refreshing]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="Salary Statement"
        showBack={false}
        actions={headerActions}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !payrollData ? (
          <PayrollSkeleton />
        ) : fetchError && !payrollData ? (
          <ErrorState
            error={fetchError}
            onRetry={() => {
              refetch();
            }}
            actionLabel="Retry Loading Statement"
          />
        ) : (
          <>
            {/* Month Selector Pills */}
            <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.monthScroll}
          contentContainerStyle={styles.monthScrollContent}
        >
          {monthList.map((m) => {
            const active = selectedMonth === m.value;
            return (
              <Pressable
                key={m.value}
                variant="chip"
                haptic="select"
                onPress={() => setSelectedMonth(m.value)}
                style={[
                  styles.monthPill,
                  {
                    backgroundColor: active
                      ? theme.colors.ink
                      : theme.colors.canvasElevated,
                    borderColor: active
                      ? theme.colors.ink
                      : theme.colors.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.monthPillText,
                    {
                      color: active ? theme.colors.canvas : theme.colors.ink,
                      },
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* KPI Strip */}
        <KPIGrid columns={2}>
          <KPICard
            label="Net Payable"
            value={`₹${summaryKpis.totalNet.toLocaleString('en-IN')}`}
            icon={Banknote}
            variant="success"
          />

          <KPICard
            label="Total Paid"
            value={`₹${summaryKpis.totalPaid.toLocaleString('en-IN')}`}
            icon={CreditCard}
            variant="info"
          />
        </KPIGrid>

        {/* Search Bar */}
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SearchInput
            placeholder="Search operator, phone, city, IFSC..."
            placeholderTextColor={theme.colors.mute}
            value={searchQuery}
            onChangeText={(t) => setSearchQuery(t)}
            onClear={() => setSearchQuery('', true)}
          />
        </View>

        {/* Payout Filter Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterStripContainer}
          contentContainerStyle={styles.filterStrip}
        >
          {([
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending Bal' },
            { id: 'disbursed', label: 'Disbursed' },
            { id: 'with_ot', label: 'With OT' },
            { id: 'with_deductions', label: 'With Deductions' },
          ] as const).map((filter) => {
            const active = payoutFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                variant="chip"
                haptic="select"
                onPress={() => setPayoutFilter(filter.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active
                      ? (isDark ? '#262626' : '#171717')
                      : theme.colors.canvasElevated,
                    borderColor: active
                      ? (isDark ? '#525252' : '#171717')
                      : theme.colors.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#ffffff' : theme.colors.ink },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Operators List */}
        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>
            OPERATORS ({operators.length})
          </Text>

          {operators.length === 0 ? (
            searchQuery.trim().length > 0 ? (
              <EmptyState
                variant="no-results"
                title="No Operators Found"
                description={`No operator records matched "${searchQuery.trim()}".`}
                actionLabel="Clear Search"
                onAction={() => setSearchQuery('', true)}
              />
            ) : payoutFilter !== 'all' ? (
              <EmptyState
                variant="filtered"
                title="No Matching Operators"
                description="No operator records match the selected payout filter."
                actionLabel="Show All Operators"
                onAction={() => setPayoutFilter('all')}
              />
            ) : (
              <EmptyState
                title="No Operators Found"
                description="No operator records found for this period."
              />
            )
          ) : (
            operators.map((op: HRPayrollOperator, idx: number) => (
              <OperatorPayrollCard
                key={op.operator_id}
                operator={op}
                index={idx}
                searchQuery={searchQuery}
                isExpanded={expandedId === op.operator_id}
                onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                onViewUser={(name) =>
                  router.push({
                    pathname: '/users',
                    params: { search: name },
                  })
                }
                onViewSlip={(operator) => setViewSlipOp(operator)}
                onEditStatement={(operator) => handleOpenEdit(operator)}
              />
            ))
          )}
        </View>
          </>
        )}
      </ScrollView>

      {/* Salary Slip Modal */}
      <AppModal
        visible={!!viewSlipOp}
        onClose={() => setViewSlipOp(null)}
        variant="bottom"
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
              maxHeight: '85%',
            },
          ]}
        >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                  Salary Slip
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
                  {viewSlipOp?.full_name} ({selectedMonth})
                </Text>
              </View>
              <Pressable variant="iconButton" hitSlopToMin48 onPress={() => setViewSlipOp(null)} accessibilityLabel="Close slip">
                <X size={20} color={theme.colors.mute} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {viewSlipOp && (
                <View style={{ gap: 12, paddingVertical: 8 }}>
                  {/* Company Box */}
                  <View style={[styles.slipBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <Text style={{ color: theme.colors.ink, textTransform: 'uppercase' }}>
                      REACH INTERNATIONAL
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Operator Salary Statement Slip
                    </Text>
                    <View style={{ marginTop: 6, gap: 4 }}>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>A/C: {viewSlipOp.bank_account_number || 'XXXXXXXX1234'}</Text>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>IFSC: {viewSlipOp.bank_ifsc_code || 'BANK0001234'}</Text>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>DOJ: {viewSlipOp.doj || '—'}</Text>
                    </View>
                  </View>

                  {/* Attendance Strip */}
                  <View style={[styles.slipBox, { backgroundColor: '#2563eb10', borderColor: '#2563eb25' }]}>
                    <Text variant="caption" style={{ color: '#2563eb', textTransform: 'uppercase', marginBottom: 6 }}>
                      Attendance & Days
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Working: {viewSlipOp.working_days || 30}d</Text>
                      <Text variant="caption" style={{ color: '#2563eb' }}>Attended: {viewSlipOp.attended_days || viewSlipOp.work_days || 0}d</Text>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>OT: {viewSlipOp.ot_days || 0}d</Text>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>Total: {viewSlipOp.total_days || 0}d</Text>
                    </View>
                  </View>

                  {/* Financial Breakdown */}
                  <View style={[styles.slipBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, gap: 6 }]}>
                    <Text variant="caption" style={{ color: theme.colors.ink, textTransform: 'uppercase' }}>
                      Earnings & Deductions
                    </Text>
                    <View style={styles.detailRow}>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Basic Salary:</Text>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>₹{(viewSlipOp.basic_salary || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Attended Amount:</Text>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>₹{(viewSlipOp.attended_amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Overtime Amount:</Text>
                      <Text variant="caption" style={{ color: '#d97706' }}>₹{(viewSlipOp.ot_amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Paid Leave (PL) Pay:</Text>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>₹{(viewSlipOp.pl_amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={[styles.detailRow, { paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>Gross Pay:</Text>
                      <Text variant="caption" style={{ color: theme.colors.ink }}>₹{(viewSlipOp.gross_pay || viewSlipOp.total_pay || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text variant="caption" style={{ color: '#dc2626' }}>Total Deductions (Loan/Adv):</Text>
                      <Text variant="caption" style={{ color: '#dc2626' }}>
                        -₹{((viewSlipOp.loan_deduction || 0) + (viewSlipOp.advance_deduction || 0) + (viewSlipOp.other_deductions || 0)).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  {/* Net Pay Banner */}
                  <View style={[styles.slipBox, { backgroundColor: '#05966915', borderColor: '#05966930', alignItems: 'center' }]}>
                    <Text variant="caption" style={{ color: '#059669', textTransform: 'uppercase' }}>
                      Net Salary Payable
                    </Text>
                    <Text variant="title" style={{ color: '#059669', marginTop: 2 }}>
                      ₹{(viewSlipOp.net_pay || viewSlipOp.total_pay || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <Pressable
              variant="buttonPrimary"
              onPress={() => setViewSlipOp(null)}
              style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink, marginTop: 8 }]}
            >
              <Text style={{ color: theme.colors.canvas, textAlign: 'center' }}>
                Close Slip
              </Text>
            </Pressable>
          </View>
      </AppModal>

      {/* Edit Statement Modal */}
      <AppModal
        visible={!!editingOperator}
        onClose={() => setEditingOperator(null)}
        variant="bottom"
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
              maxHeight: '90%',
            },
          ]}
        >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                  Edit Salary Statement
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
                  {editingOperator?.full_name}
                </Text>
              </View>
              <Pressable variant="iconButton" hitSlopToMin48 onPress={() => setEditingOperator(null)} accessibilityLabel="Close edit modal">
                <X size={20} color={theme.colors.mute} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12, paddingVertical: 8 }}>
                {statementError ? <FormError message={statementError} /> : null}
                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>
                    Basic Monthly Salary (₹)
                  </Text>
                  <Input
                    style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                    keyboardType="numeric"
                    value={editBasic}
                    onChangeText={setEditBasic}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Attended Days (A/D)</Text>
                    <Input
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editAttendedDays}
                      onChangeText={setEditAttendedDays}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Working Days (W/D)</Text>
                    <Input
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editWorkingDays}
                      onChangeText={setEditWorkingDays}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Overtime Days (OT)</Text>
                    <Input
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editOtDays}
                      onChangeText={setEditOtDays}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>PL Adjusted</Text>
                    <Input
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editPlAdj}
                      onChangeText={setEditPlAdj}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Loan Deduction (₹)</Text>
                    <Input
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editLoan}
                      onChangeText={setEditLoan}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Advance Deduction (₹)</Text>
                    <Input
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editAdvance}
                      onChangeText={setEditAdvance}
                    />
                  </View>
                </View>

                {/* Live Preview Strip */}
                <View style={[styles.slipBox, { backgroundColor: '#05966910', borderColor: '#05966925', gap: 4 }]}>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Gross Pay:</Text>
                    <Text style={{ color: theme.colors.ink }}>₹{editComputed.grossPay.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: '#059669' }}>Calculated Net Pay:</Text>
                    <Text variant="heading" style={{ color: '#059669' }}>₹{editComputed.netPay.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                variant="buttonSecondary"
                onPress={() => setEditingOperator(null)}
                style={[styles.modalCancelBtn, { borderColor: theme.colors.hairline }]}
              >
                <Text style={{ color: theme.colors.ink }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                variant="buttonPrimary"
                haptic="none"
                onPress={handleSaveStatement}
                disabled={savingStatement}
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink }]}>
                <Text style={{ color: theme.colors.canvas }}>
                  {savingStatement ? 'Saving...' : 'Save Statement'}
                </Text>
              </Pressable>
            </View>
          </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1 },
  content: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md },
  monthScroll: {
    maxHeight: 40 },
  monthScrollContent: {
    gap: 8 },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center' },
  monthPillText: {
    },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1 },
  searchInput: {
    flex: 1,
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none' } as any }) },
  filterStripContainer: {
    marginVertical: 2 },
  filterStrip: {
    gap: 8,
    paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center' },
  filterChipText: {
    },
  listSection: {
    gap: spacingNumeric.sm },
  sectionTitle: {
    marginLeft: 4 },
  operatorCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 10 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start' },
  headerLeft: {
    flex: 1,
    gap: 2 },
  headerRight: {
    alignItems: 'flex-end' },
  slBadge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4 },
  operatorName: {
    },
  operatorLocation: {
    },
  totalPayAmount: {
    },
  totalPayLabel: {
    textTransform: 'uppercase' },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1 },
  breakdownCol: {
    flex: 1 },
  colSub: {
    textTransform: 'uppercase' },
  colMain: {
    marginTop: 2 },
  detailsDrawer: {
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 5 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center' },
  detailKey: {
    },
  detailVal: {
    },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4 },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5 },
  actionBtnText: {
    },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacingNumeric.md },
  modalCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    gap: 12 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start' },
  modalTitle: {
    },
  modalSubtitle: {
    marginTop: 2 },
  formGroup: {
    gap: 4 },
  inputLabel: {
    },
  textInput: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: 12,
    paddingVertical: 8 },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingVertical: 10,
    alignItems: 'center' },
  modalSaveBtn: {
    flex: 1,
    borderRadius: radiusNumeric.md,
    paddingVertical: 10,
    alignItems: 'center' },
  slipBox: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1 } });
