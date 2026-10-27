import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/ThemeProvider';
import {
  MobileHeader,
  EmptyState,
  ErrorState,
  PermissionDeniedView,
  FormError,
  KPICard,
  KPIGrid,
  type HeaderActionItem,
  Text,
  AppModal,
  Input,
  SearchInput,
  useToast,
} from '../../components/ui';
import { PayrollSkeleton, OperatorPayrollCard } from '../../components/payroll';
import { Pressable } from '../../components/ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { usePayrollData } from '../../lib/hooks/usePayrollData';
import { calculateOperatorSalary, sanitizeDatabaseError } from '@reachinternational/utils';
import { useAuth } from '../../lib/auth/useAuth';
import {
  Banknote,
  RefreshCw,
  X,
  CreditCard,
  Clock,
  Calendar,
} from '../../components/ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { HRPayrollOperator } from '@reachinternational/types';

const ALLOWED_ROLES = ['super_admin', 'admin', 'hr'];

export default function PayrollScreen() {
  const { theme } = useTheme();
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
    rawOperators,
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

  // Month selector options dynamically adapted to selected month/year
  const monthList = useMemo(() => {
    const list = [];
    const yearPart = selectedMonth ? parseInt(selectedMonth.split('-')[0], 10) : now.getFullYear();
    const targetYear = isNaN(yearPart) ? 2026 : yearPart;
    for (let m = 1; m <= 12; m++) {
      const val = `${targetYear}-${String(m).padStart(2, '0')}`;
      const d = new Date(targetYear, m - 1, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      list.push({ label, value: val });
    }
    return list;
  }, [selectedMonth]);

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

  if (!isAllowed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader
          title="Salary Statement"
          showBack={true}
          backRoute="/dashboard"
        />
        <PermissionDeniedView
          featureName="Workforce Payroll"
          currentRole={role}
          requiredRoles={ALLOWED_ROLES}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="Salary Statement"
        showBack={true}
        backRoute="/dashboard"
        actions={headerActions}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.ink}
          />
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
            {/* Month Selector Horizontal Strip */}
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
                    hitSlopToMin48
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
                      variant="caption"
                      weight={active ? 'semibold' : 'medium'}
                      style={{
                        color: active ? theme.colors.canvas : theme.colors.ink,
                      }}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* KPI Grid Strip (4-Col Responsive Parity with Web PayrollKPIStrip) */}
            <KPIGrid columns={4}>
              <KPICard
                label="Gross Payroll"
                value={`₹${summaryKpis.totalGross.toLocaleString('en-IN')}`}
                icon={CreditCard}
                variant="default"
                labelVariant="caption"
                labelWeight="medium"
                valueVariant="title"
                valueWeight="bold"
              />

              <KPICard
                label="Net Payable"
                value={`₹${summaryKpis.totalNet.toLocaleString('en-IN')}`}
                icon={Banknote}
                variant="success"
                labelVariant="caption"
                labelWeight="medium"
                valueVariant="title"
                valueWeight="bold"
              />

              <KPICard
                label="Disbursed vs Unpaid"
                value={`₹${summaryKpis.totalPaid.toLocaleString('en-IN')}`}
                subtitle={`Bal: ₹${summaryKpis.totalBalance.toLocaleString('en-IN')}`}
                icon={Clock}
                variant="warning"
                labelVariant="caption"
                labelWeight="medium"
                valueVariant="title"
                valueWeight="bold"
              />

              <KPICard
                label="Attended & OT Days"
                value={`${summaryKpis.totalAttendedDays}d`}
                subtitle={`OT: ${summaryKpis.totalOtDays}d`}
                icon={Calendar}
                variant="info"
                labelVariant="caption"
                labelWeight="medium"
                valueVariant="title"
                valueWeight="bold"
              />
            </KPIGrid>

            {/* Search Bar Container */}
            <View style={styles.searchContainer}>
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
                    hitSlopToMin48
                    onPress={() => setPayoutFilter(filter.id)}
                    style={[
                      styles.filterChip,
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
                      variant="caption"
                      weight={active ? 'semibold' : 'medium'}
                      style={{
                        color: active ? theme.colors.canvas : theme.colors.ink,
                      }}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Results Count Row */}
            <View style={styles.resultsCountRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Showing{' '}
                <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                  {operators.length}
                </Text>{' '}
                of{' '}
                <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                  {rawOperators.length}
                </Text>{' '}
                operators
                {debouncedSearchQuery.trim() || payoutFilter !== 'all' ? ' (filtered)' : ''}
              </Text>
            </View>

            {/* Operators List */}
            <View style={styles.listSection}>
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
              <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                Salary Slip
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                {viewSlipOp?.full_name} ({selectedMonth})
              </Text>
            </View>
            <Pressable
              variant="iconButton"
              hitSlopToMin48
              onPress={() => setViewSlipOp(null)}
              accessibilityLabel="Close slip"
            >
              <X size={20} color={theme.colors.mute} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {viewSlipOp && (
              <View style={{ gap: 12, paddingVertical: 8 }}>
                {/* Company Box */}
                <View
                  style={[
                    styles.slipBox,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                  ]}
                >
                  <Text
                    variant="caption"
                    weight="bold"
                    style={{
                      color: theme.colors.ink,
                      textTransform: 'uppercase',
                    }}
                  >
                    REACH INTERNATIONAL
                  </Text>
                  <Text variant="micro" style={{ color: theme.colors.mute, marginTop: 1 }}>
                    Operator Salary Statement Slip
                  </Text>
                  <View style={{ marginTop: 6, gap: 4 }}>
                    <Text variant="mono" weight="medium" style={{ color: theme.colors.ink }}>
                      A/C: {viewSlipOp.bank_account_number || 'XXXXXXXX1234'}
                    </Text>
                    <Text variant="mono" weight="medium" style={{ color: theme.colors.ink }}>
                      IFSC: {viewSlipOp.bank_ifsc_code || 'BANK0001234'}
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      DOJ: {viewSlipOp.doj || '—'}
                    </Text>
                  </View>
                </View>

                {/* Attendance Strip */}
                <View
                  style={[
                    styles.slipBox,
                    { backgroundColor: '#2563eb10', borderColor: '#2563eb25' },
                  ]}
                >
                  <Text
                    variant="micro"
                    weight="bold"
                    style={{
                      color: '#2563eb',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Attendance & Days
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Working:{' '}
                      <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                        {viewSlipOp.working_days || 30}d
                      </Text>
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Attended:{' '}
                      <Text variant="mono" weight="bold" style={{ color: '#2563eb' }}>
                        {viewSlipOp.attended_days || viewSlipOp.work_days || 0}d
                      </Text>
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      OT:{' '}
                      <Text variant="mono" weight="bold" style={{ color: '#d97706' }}>
                        {viewSlipOp.ot_days || 0}d
                      </Text>
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Total:{' '}
                      <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                        {viewSlipOp.total_days || 0}d
                      </Text>
                    </Text>
                  </View>
                </View>

                {/* Financial Breakdown */}
                <View
                  style={[
                    styles.slipBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      gap: 6,
                    },
                  ]}
                >
                  <Text
                    variant="micro"
                    weight="bold"
                    style={{
                      color: theme.colors.ink,
                      textTransform: 'uppercase',
                      marginBottom: 2,
                    }}
                  >
                    Earnings & Deductions
                  </Text>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Basic Salary:
                    </Text>
                    <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                      ₹{(viewSlipOp.basic_salary || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Attended Amount:
                    </Text>
                    <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                      ₹{(viewSlipOp.attended_amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Overtime Amount:
                    </Text>
                    <Text variant="caption" weight="medium" style={{ color: '#d97706' }}>
                      ₹{(viewSlipOp.ot_amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Paid Leave (PL) Pay:
                    </Text>
                    <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                      ₹{(viewSlipOp.pl_amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.detailRow,
                      {
                        paddingTop: 4,
                        borderTopWidth: 1,
                        borderTopColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                      Gross Pay:
                    </Text>
                    <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                      ₹{(viewSlipOp.gross_pay || viewSlipOp.total_pay || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: '#dc2626' }}>
                      Total Deductions (Loan/Adv):
                    </Text>
                    <Text variant="caption" weight="medium" style={{ color: '#dc2626' }}>
                      -₹
                      {(
                        (viewSlipOp.loan_deduction || 0) +
                        (viewSlipOp.advance_deduction || 0) +
                        (viewSlipOp.other_deductions || 0)
                      ).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Net Pay Banner */}
                <View
                  style={[
                    styles.slipBox,
                    {
                      backgroundColor: '#05966915',
                      borderColor: '#05966930',
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text
                    variant="micro"
                    weight="bold"
                    style={{ color: '#059669', textTransform: 'uppercase' }}
                  >
                    Net Salary Payable
                  </Text>
                  <Text variant="title" weight="bold" style={{ color: '#059669', marginTop: 2 }}>
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
            <Text variant="caption" weight="semibold" style={{ color: theme.colors.canvas }}>
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
              <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                Edit Salary Statement
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                {editingOperator?.full_name}
              </Text>
            </View>
            <Pressable
              variant="iconButton"
              hitSlopToMin48
              onPress={() => setEditingOperator(null)}
              accessibilityLabel="Close edit modal"
            >
              <X size={20} color={theme.colors.mute} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: 12, paddingVertical: 8 }}>
              {statementError ? <FormError message={statementError} /> : null}

              <View style={styles.formGroup}>
                <Text
                  variant="caption"
                  weight="medium"
                  style={[styles.inputLabel, { color: theme.colors.ink }]}
                >
                  Basic Monthly Salary (₹)
                </Text>
                <Input
                  style={[
                    styles.textInput,
                    {
                      color: theme.colors.ink,
                      borderColor: theme.colors.hairline,
                      backgroundColor: theme.colors.canvas,
                    },
                  ]}
                  keyboardType="numeric"
                  value={editBasic}
                  onChangeText={setEditBasic}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text
                    variant="caption"
                    weight="medium"
                    style={[styles.inputLabel, { color: theme.colors.ink }]}
                  >
                    Attended Days (A/D)
                  </Text>
                  <Input
                    style={[
                      styles.textInput,
                      {
                        color: theme.colors.ink,
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                    keyboardType="numeric"
                    value={editAttendedDays}
                    onChangeText={setEditAttendedDays}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text
                    variant="caption"
                    weight="medium"
                    style={[styles.inputLabel, { color: theme.colors.ink }]}
                  >
                    Working Days (W/D)
                  </Text>
                  <Input
                    style={[
                      styles.textInput,
                      {
                        color: theme.colors.ink,
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                    keyboardType="numeric"
                    value={editWorkingDays}
                    onChangeText={setEditWorkingDays}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text
                    variant="caption"
                    weight="medium"
                    style={[styles.inputLabel, { color: theme.colors.ink }]}
                  >
                    Overtime Days (OT)
                  </Text>
                  <Input
                    style={[
                      styles.textInput,
                      {
                        color: theme.colors.ink,
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                    keyboardType="numeric"
                    value={editOtDays}
                    onChangeText={setEditOtDays}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text
                    variant="caption"
                    weight="medium"
                    style={[styles.inputLabel, { color: theme.colors.ink }]}
                  >
                    PL Adjusted
                  </Text>
                  <Input
                    style={[
                      styles.textInput,
                      {
                        color: theme.colors.ink,
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                    keyboardType="numeric"
                    value={editPlAdj}
                    onChangeText={setEditPlAdj}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text
                    variant="caption"
                    weight="medium"
                    style={[styles.inputLabel, { color: theme.colors.ink }]}
                  >
                    Loan Deduction (₹)
                  </Text>
                  <Input
                    style={[
                      styles.textInput,
                      {
                        color: theme.colors.ink,
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                    keyboardType="numeric"
                    value={editLoan}
                    onChangeText={setEditLoan}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text
                    variant="caption"
                    weight="medium"
                    style={[styles.inputLabel, { color: theme.colors.ink }]}
                  >
                    Advance Deduction (₹)
                  </Text>
                  <Input
                    style={[
                      styles.textInput,
                      {
                        color: theme.colors.ink,
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                    keyboardType="numeric"
                    value={editAdvance}
                    onChangeText={setEditAdvance}
                  />
                </View>
              </View>

              {/* Live Preview Strip */}
              <View
                style={[
                  styles.slipBox,
                  { backgroundColor: '#05966910', borderColor: '#05966925', gap: 4 },
                ]}
              >
                <View style={styles.detailRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    Gross Pay:
                  </Text>
                  <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                    ₹{editComputed.grossPay.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="caption" weight="medium" style={{ color: '#059669' }}>
                    Calculated Net Pay:
                  </Text>
                  <Text variant="heading" weight="bold" style={{ color: '#059669' }}>
                    ₹{editComputed.netPay.toLocaleString('en-IN')}
                  </Text>
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
              <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              variant="buttonPrimary"
              haptic="none"
              onPress={handleSaveStatement}
              disabled={savingStatement}
              style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink }]}
            >
              <Text variant="caption" weight="semibold" style={{ color: theme.colors.canvas }}>
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
    flex: 1,
  },
  content: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  monthScroll: {
    maxHeight: 40,
  },
  monthScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  monthPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    width: '100%',
  },
  filterStripContainer: {
    marginVertical: 2,
  },
  filterStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsCountRow: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  listSection: {
    gap: spacingNumeric.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    gap: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  formGroup: {
    gap: 4,
  },
  inputLabel: {
    marginBottom: 2,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtn: {
    flex: 1,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slipBox: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
});
