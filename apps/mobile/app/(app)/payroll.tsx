import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { MobileHeader, Card, Badge, EmptyState } from '../../components/ui';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { supabase } from '../../lib/supabase';
import {
  Banknote,
  Calendar,
  Search,
  Clock,
  Briefcase,
  Users,
  Edit2,
  X,
  Check,
  Info,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Shield,
} from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { HRPayrollSummary, HRPayrollOperator } from '@reachinternational/types';

const ALLOWED_ROLES = ['super_admin', 'admin', 'hr'];

export default function PayrollScreen() {
  const { theme, isDark } = useTheme();
  const { role } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Guard access
  const normalizedRole = (role || '').toLowerCase();
  const isAllowed = ALLOWED_ROLES.includes(normalizedRole);

  useEffect(() => {
    if (role && !isAllowed) {
      router.replace('/(app)/dashboard');
    }
  }, [role, isAllowed, router]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
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

  const [payrollData, setPayrollData] = useState<HRPayrollSummary | null>(null);

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
  const [savingStatement, setSavingStatement] = useState(false);

  const fetchPayroll = useCallback(async (monthStr: string) => {
    try {
      setLoading(true);
      const targetDate = `${monthStr}-01`;
      const { data, error } = await supabase.rpc('get_hr_payroll_summary', {
        p_payroll_month: targetDate,
      });

      if (error) {
        console.error('[HRPayrollScreen] Fetch error:', error);
        Alert.alert('Error', error.message || 'Failed to fetch payroll data');
      } else if (data) {
        setPayrollData(data as unknown as HRPayrollSummary);
      }
    } catch (err: any) {
      console.error('[HRPayrollScreen] Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) {
      fetchPayroll(selectedMonth);
    }
  }, [selectedMonth, isAllowed, fetchPayroll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPayroll(selectedMonth);
  }, [selectedMonth, fetchPayroll]);

  // Filtered operators
  const operators = useMemo(() => {
    let list = payrollData?.operators || [];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (op) =>
          op.full_name.toLowerCase().includes(q) ||
          (op.phone && op.phone.includes(q)) ||
          (op.city && op.city.toLowerCase().includes(q)) ||
          (op.state && op.state.toLowerCase().includes(q)) ||
          (op.bank_ifsc_code && op.bank_ifsc_code.toLowerCase().includes(q)) ||
          (op.bank_account_number && op.bank_account_number.toLowerCase().includes(q))
      );
    }
    if (payoutFilter === 'pending') {
      list = list.filter((op) => (op.balance_pay || 0) > 0);
    } else if (payoutFilter === 'disbursed') {
      list = list.filter((op) => (op.balance_pay || 0) <= 0);
    } else if (payoutFilter === 'with_ot') {
      list = list.filter((op) => (op.ot_days || 0) > 0 || (op.ot_hours || 0) > 0);
    } else if (payoutFilter === 'with_deductions') {
      list = list.filter(
        (op) =>
          ((op.loan_deduction || 0) +
            (op.advance_deduction || 0) +
            (op.other_deductions || 0)) > 0
      );
    }
    return list;
  }, [payrollData, searchQuery, payoutFilter]);

  // Summary KPIs
  const summaryKpis = useMemo(() => {
    const list = payrollData?.operators || [];
    let totalGross = 0;
    let totalNet = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let totalAttendedDays = 0;

    list.forEach((op) => {
      totalGross += op.gross_pay || op.total_pay || 0;
      totalNet += op.net_pay || op.total_pay || 0;
      totalPaid += (op.paid_reach || 0) + (op.paid_ss || 0) + (op.paid_quess || 0);
      totalBalance += op.balance_pay || 0;
      totalAttendedDays += op.attended_days || op.work_days || 0;
    });

    return {
      activeCount: list.length,
      totalGross: Math.round(totalGross),
      totalNet: Math.round(totalNet),
      totalPaid: Math.round(totalPaid),
      totalBalance: Math.round(totalBalance),
      totalAttendedDays: Math.round(totalAttendedDays * 10) / 10,
    };
  }, [payrollData]);

  // Open edit modal
  const handleOpenEdit = (op: HRPayrollOperator) => {
    setEditingOperator(op);
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

  // Live computed Net Pay for Edit Modal
  const editComputed = useMemo(() => {
    const basic = Number(editBasic) || 0;
    const wd = Math.max(1, Number(editWorkingDays) || 30);
    const ad = Number(editAttendedDays) || 0;
    const ot = Number(editOtDays) || 0;
    const pl = Number(editPlAdj) || 0;
    const loan = Number(editLoan) || 0;
    const adv = Number(editAdvance) || 0;
    const ded = Number(editOtherDed) || 0;
    const reach = Number(editPaidReach) || 0;
    const ss = Number(editPaidSS) || 0;
    const quess = Number(editPaidQuess) || 0;

    const attAmt = Math.round(((basic / wd) * ad) * 100) / 100;
    const plAmt = Math.round(((basic / wd) * pl) * 100) / 100;
    const otAmt = Math.round(((basic / wd) * ot) * 100) / 100;
    const gross = attAmt + plAmt + otAmt;
    const net = gross - (loan + adv + ded);
    const bal = net - (reach + ss + quess);

    return { gross, net, bal };
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

  // Save statement updates
  const handleSaveStatement = async () => {
    if (!editingOperator) return;

    try {
      setSavingStatement(true);
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

      const { error } = await supabase.rpc('update_operator_salary_statement', {
        p_operator_id: editingOperator.operator_id,
        p_payroll_month: targetDate,
        p_fields: payload,
      });

      if (error) {
        Alert.alert('Update Failed', error.message);
      } else {
        // Refresh payroll list
        fetchPayroll(selectedMonth);
        setEditingOperator(null);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save salary statement.');
    } finally {
      setSavingStatement(false);
    }
  };

  if (!isAllowed) {
    return null;
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="Salary Statement"
        showBack={false}
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
              <TouchableOpacity
                key={m.value}
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
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.monthPillText,
                    {
                      color: active ? theme.colors.canvas : theme.colors.ink,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* KPI Strip */}
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>
              Net Payable
            </Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>
              ₹{summaryKpis.totalNet.toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.mute }]}>
              Gross: ₹{summaryKpis.totalGross.toLocaleString('en-IN')}
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>
              Paid vs Unpaid
            </Text>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
              ₹{summaryKpis.totalPaid.toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.kpiSub, { color: '#d97706' }]}>
              Unpaid bal: ₹{summaryKpis.totalBalance.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Search size={16} color={theme.colors.mute} />
          <TextInput
            placeholder="Search operator, phone, city, IFSC..."
            placeholderTextColor={theme.colors.mute}
            value={searchQuery}
            onChangeText={(t) => setSearchQuery(t)}
            style={[styles.searchInput, { color: theme.colors.ink }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('', true)}>
              <X size={16} color={theme.colors.mute} />
            </TouchableOpacity>
          )}
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
              <TouchableOpacity
                key={filter.id}
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
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#ffffff' : theme.colors.ink },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Operators List */}
        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>
            OPERATORS ({operators.length})
          </Text>

          {operators.length === 0 ? (
            <EmptyState
              title="No Operators Found"
              description="No operator records match the search criteria for this period."
            />
          ) : (
            operators.map((op, idx) => {
              const isExpanded = expandedId === op.operator_id;

              return (
                <View
                  key={op.operator_id}
                  style={[
                    styles.operatorCard,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {/* Card Header Row */}
                  <View style={styles.cardHeader}>
                    <TouchableOpacity
                      style={styles.headerLeft}
                      activeOpacity={0.7}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/users',
                          params: { search: op.full_name },
                        })
                      }
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.slBadge, { color: theme.colors.mute, borderColor: theme.colors.hairline }]}>
                          #{op.sl_no || idx + 1}
                        </Text>
                        <Text
                          style={[styles.operatorName, { color: theme.colors.ink }]}
                          numberOfLines={1}
                        >
                          {op.full_name}
                        </Text>
                      </View>
                      <Text style={[styles.operatorLocation, { color: theme.colors.mute }]}>
                        {op.phone || 'No phone'} • {op.city || op.state || 'No location'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.headerRight}>
                      <Text style={[styles.totalPayAmount, { color: '#059669' }]}>
                        ₹{(op.net_pay || op.total_pay || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={[styles.totalPayLabel, { color: theme.colors.mute }]}>
                        Net Pay
                      </Text>
                    </View>
                  </View>

                  {/* Quick Stat Tiles */}
                  <View
                    style={[
                      styles.breakdownRow,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.breakdownCol}>
                      <Text style={[styles.colSub, { color: theme.colors.mute }]}>
                        Attended Days
                      </Text>
                      <Text style={[styles.colMain, { color: '#2563eb' }]}>
                        {op.attended_days || op.work_days || 0} / {op.working_days || 30} d
                      </Text>
                    </View>

                    <View style={styles.breakdownCol}>
                      <Text style={[styles.colSub, { color: theme.colors.mute }]}>
                        Gross Pay
                      </Text>
                      <Text style={[styles.colMain, { color: theme.colors.ink }]}>
                        ₹{(op.gross_pay || op.total_pay || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>

                    <View style={styles.breakdownCol}>
                      <Text style={[styles.colSub, { color: theme.colors.mute }]}>
                        Unpaid Bal
                      </Text>
                      <Text style={[styles.colMain, { color: '#d97706' }]}>
                        ₹{(op.balance_pay || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  {/* Expandable Accordion Breakdown */}
                  {isExpanded && (
                    <View style={[styles.detailsDrawer, { borderTopColor: theme.colors.hairline }]}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>Basic Monthly Salary:</Text>
                        <Text style={[styles.detailVal, { color: theme.colors.ink }]}>₹{(op.basic_salary || 0).toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>Attended Pay:</Text>
                        <Text style={[styles.detailVal, { color: theme.colors.ink }]}>₹{(op.attended_amount || 0).toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>Overtime (OT):</Text>
                        <Text style={[styles.detailVal, { color: '#d97706' }]}>{op.ot_days || 0}d (₹{(op.ot_amount || 0).toLocaleString('en-IN')})</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>PL Adjusted:</Text>
                        <Text style={[styles.detailVal, { color: theme.colors.ink }]}>{op.pl_adjusted || 0}d (₹{(op.pl_amount || 0).toLocaleString('en-IN')})</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>Deductions (Loan/Adv):</Text>
                        <Text style={[styles.detailVal, { color: '#dc2626' }]}>
                          -₹{((op.loan_deduction || 0) + (op.advance_deduction || 0) + (op.other_deductions || 0)).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>Agency Splits:</Text>
                        <Text style={[styles.detailVal, { color: theme.colors.ink }]}>
                          Reach ₹{op.paid_reach || 0} • S&S ₹{op.paid_ss || 0} • Quess ₹{op.paid_quess || 0}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>Leave Balance:</Text>
                        <Text style={[styles.detailVal, { color: '#4f46e5' }]}>{op.pl_balance || 0} days remaining</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailKey, { color: theme.colors.mute }]}>Bank Account:</Text>
                        <Text style={[styles.detailVal, { color: theme.colors.mute }]}>{op.bank_account_number || 'XXXXXXXX1234'} ({op.bank_ifsc_code || 'BANK0001234'})</Text>
                      </View>
                    </View>
                  )}

                  {/* Card Actions Row */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      onPress={() => setExpandedId(isExpanded ? null : op.operator_id)}
                      style={[styles.actionBtn, { borderColor: theme.colors.hairline }]}
                      activeOpacity={0.7}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={13} color={theme.colors.mute} />
                          <Text style={[styles.actionBtnText, { color: theme.colors.mute }]}>Less</Text>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} color={theme.colors.mute} />
                          <Text style={[styles.actionBtnText, { color: theme.colors.mute }]}>Details</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setViewSlipOp(op)}
                      style={[styles.actionBtn, { borderColor: theme.colors.hairline }]}
                      activeOpacity={0.7}
                    >
                      <FileText size={13} color="#2563eb" />
                      <Text style={[styles.actionBtnText, { color: '#2563eb' }]}>Slip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenEdit(op)}
                      style={[styles.actionBtn, { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink }]}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={13} color={theme.colors.canvas} />
                      <Text style={[styles.actionBtnText, { color: theme.colors.canvas, fontWeight: '600' }]}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Salary Slip Modal */}
      <Modal
        visible={!!viewSlipOp}
        transparent
        animationType="fade"
        onRequestClose={() => setViewSlipOp(null)}
      >
        <View style={styles.modalBackdrop}>
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
              <TouchableOpacity onPress={() => setViewSlipOp(null)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {viewSlipOp && (
                <View style={{ gap: 12, paddingVertical: 8 }}>
                  {/* Company Box */}
                  <View style={[styles.slipBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.ink, textTransform: 'uppercase' }}>
                      REACH INTERNATIONAL
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.colors.mute }}>
                      Operator Salary Statement Slip
                    </Text>
                    <View style={{ marginTop: 6, gap: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.ink }}>A/C: {viewSlipOp.bank_account_number || 'XXXXXXXX1234'}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.ink }}>IFSC: {viewSlipOp.bank_ifsc_code || 'BANK0001234'}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>DOJ: {viewSlipOp.doj || '—'}</Text>
                    </View>
                  </View>

                  {/* Attendance Strip */}
                  <View style={[styles.slipBox, { backgroundColor: '#2563eb10', borderColor: '#2563eb25' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', marginBottom: 6 }}>
                      Attendance & Days
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Working: {viewSlipOp.working_days || 30}d</Text>
                      <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '700' }}>Attended: {viewSlipOp.attended_days || viewSlipOp.work_days || 0}d</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>OT: {viewSlipOp.ot_days || 0}d</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '700' }}>Total: {viewSlipOp.total_days || 0}d</Text>
                    </View>
                  </View>

                  {/* Financial Breakdown */}
                  <View style={[styles.slipBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, gap: 6 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.ink, textTransform: 'uppercase' }}>
                      Earnings & Deductions
                    </Text>
                    <View style={styles.detailRow}>
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Basic Salary:</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '600' }}>₹{(viewSlipOp.basic_salary || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Attended Amount:</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '600' }}>₹{(viewSlipOp.attended_amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Overtime Amount:</Text>
                      <Text style={{ fontSize: 11, color: '#d97706', fontWeight: '600' }}>₹{(viewSlipOp.ot_amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Paid Leave (PL) Pay:</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '600' }}>₹{(viewSlipOp.pl_amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={[styles.detailRow, { paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.ink }}>Gross Pay:</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.ink }}>₹{(viewSlipOp.gross_pay || viewSlipOp.total_pay || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ fontSize: 11, color: '#dc2626' }}>Total Deductions (Loan/Adv):</Text>
                      <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>
                        -₹{((viewSlipOp.loan_deduction || 0) + (viewSlipOp.advance_deduction || 0) + (viewSlipOp.other_deductions || 0)).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  {/* Net Pay Banner */}
                  <View style={[styles.slipBox, { backgroundColor: '#05966915', borderColor: '#05966930', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
                      Net Salary Payable
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#059669', marginTop: 2 }}>
                      ₹{(viewSlipOp.net_pay || viewSlipOp.total_pay || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setViewSlipOp(null)}
              style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink, marginTop: 8 }]}
            >
              <Text style={{ color: theme.colors.canvas, fontWeight: '600', textAlign: 'center' }}>
                Close Slip
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Statement Modal */}
      <Modal
        visible={!!editingOperator}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingOperator(null)}
      >
        <View style={styles.modalBackdrop}>
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
              <TouchableOpacity onPress={() => setEditingOperator(null)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12, paddingVertical: 8 }}>
                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>
                    Basic Monthly Salary (₹)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                    keyboardType="numeric"
                    value={editBasic}
                    onChangeText={setEditBasic}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Attended Days (A/D)</Text>
                    <TextInput
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editAttendedDays}
                      onChangeText={setEditAttendedDays}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Working Days (W/D)</Text>
                    <TextInput
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
                    <TextInput
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editOtDays}
                      onChangeText={setEditOtDays}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>PL Adjusted</Text>
                    <TextInput
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
                    <TextInput
                      style={[styles.textInput, { color: theme.colors.ink, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}
                      keyboardType="numeric"
                      value={editLoan}
                      onChangeText={setEditLoan}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>Advance Deduction (₹)</Text>
                    <TextInput
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
                    <Text style={{ fontSize: 11, color: theme.colors.mute }}>Gross Pay:</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '700' }}>₹{editComputed.gross.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700' }}>Calculated Net Pay:</Text>
                    <Text style={{ fontSize: 13, color: '#059669', fontWeight: '800' }}>₹{editComputed.net.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditingOperator(null)}
                style={[styles.modalCancelBtn, { borderColor: theme.colors.hairline }]}
              >
                <Text style={{ color: theme.colors.ink, fontWeight: '500' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveStatement}
                disabled={savingStatement}
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink }]}
              >
                <Text style={{ color: theme.colors.canvas, fontWeight: '600' }}>
                  {savingStatement ? 'Saving...' : 'Save Statement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  monthScroll: {
    maxHeight: 40,
  },
  monthScrollContent: {
    gap: 8,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPillText: {
    fontSize: 13,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  kpiCard: {
    flex: 1,
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
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
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listSection: {
    gap: spacingNumeric.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  operatorCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  slBadge: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  operatorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  operatorLocation: {
    fontSize: 11,
  },
  totalPayAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  totalPayLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  breakdownCol: {
    flex: 1,
  },
  colSub: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  colMain: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  detailsDrawer: {
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 11,
  },
  detailVal: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionBtnText: {
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacingNumeric.md,
  },
  modalCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  formGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
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
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalSaveBtn: {
    flex: 1,
    borderRadius: radiusNumeric.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  slipBox: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
});
