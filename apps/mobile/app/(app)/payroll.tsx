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
  Platform,
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
  // Target payroll month YYYY-MM
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
  }>({
    storageKey: 'reach_filters_payroll',
    defaultSearch: '',
    defaultFilters: {
      selectedMonth: defaultMonth,
    },
    debounceMs: 250,
  });

  const selectedMonth = filters.selectedMonth;
  const setSelectedMonth = useCallback((m: string) => setFilter('selectedMonth', m), [setFilter]);

  const [payrollData, setPayrollData] = useState<HRPayrollSummary | null>(null);

  // Edit Rate Modal State
  const [editingOperator, setEditingOperator] = useState<HRPayrollOperator | null>(null);
  const [newDailyRate, setNewDailyRate] = useState('');
  const [newOtRate, setNewOtRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);

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
    const list = payrollData?.operators || [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (op) =>
        op.full_name.toLowerCase().includes(q) ||
        (op.phone && op.phone.includes(q)) ||
        (op.city && op.city.toLowerCase().includes(q)) ||
        (op.state && op.state.toLowerCase().includes(q))
    );
  }, [payrollData, searchQuery]);

  // Aggregated KPIs
  const summaryKpis = useMemo(() => {
    const list = payrollData?.operators || [];
    let totalWorkDays = 0;
    let totalOtHours = 0;
    let totalPay = 0;
    let activeCount = 0;

    list.forEach((op) => {
      totalWorkDays += op.work_days;
      totalOtHours += op.ot_hours;
      totalPay += op.total_pay;
      if (op.work_days > 0 || op.ot_hours > 0) {
        activeCount++;
      }
    });

    return {
      activeCount,
      totalCount: list.length,
      totalWorkDays,
      totalOtHours: Math.round(totalOtHours * 10) / 10,
      totalPay,
    };
  }, [payrollData]);

  // Open edit modal
  const handleOpenEdit = (op: HRPayrollOperator) => {
    setEditingOperator(op);
    setNewDailyRate(String(op.daily_rate || 0));
    setNewOtRate(String(op.ot_hourly_rate || 0));
  };

  // Save rates
  const handleSaveRates = async () => {
    if (!editingOperator) return;
    const daily = Math.max(0, Number(newDailyRate) || 0);
    const ot = Math.max(0, Number(newOtRate) || 0);

    try {
      setSavingRate(true);
      const { error } = await supabase.rpc('update_operator_payroll_rates', {
        p_operator_id: editingOperator.operator_id,
        p_daily_rate: daily,
        p_ot_hourly_rate: ot,
      });

      if (error) {
        Alert.alert('Update Failed', error.message);
      } else {
        // Update local state
        setPayrollData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            operators: prev.operators.map((op) => {
              if (op.operator_id === editingOperator.operator_id) {
                const regPay = op.work_days * daily;
                const otPay = op.ot_hours * ot;
                return {
                  ...op,
                  daily_rate: daily,
                  ot_hourly_rate: ot,
                  regular_pay: regPay,
                  ot_pay: otPay,
                  total_pay: regPay + otPay,
                };
              }
              return op;
            }),
          };
        });
        setEditingOperator(null);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save rate updates.');
    } finally {
      setSavingRate(false);
    }
  };

  if (!isAllowed) {
    return null;
  }

  // Month selector options (full year)
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
        title="Payroll"
        subtitle="Operator wages & split overtime"
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

        {/* Calculation Rule Card */}
        <View
          style={[
            styles.ruleCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.ruleHeader}>
            <Info size={16} color={theme.colors.mute} />
            <Text style={[styles.ruleTitle, { color: theme.colors.ink }]}>
              Split-Month OT Formula
            </Text>
          </View>
          <Text style={[styles.ruleText, { color: theme.colors.mute }]}>
            Regular pay covers previous month work days. Overtime pay is delayed
            1 month due to client site timesheet verification.
          </Text>
          {payrollData && (
            <View style={styles.periodRow}>
              <View
                style={[
                  styles.periodBadge,
                  { backgroundColor: `${theme.colors.ink}08` },
                ]}
              >
                <Briefcase size={12} color={theme.colors.ink} />
                <Text style={[styles.periodBadgeText, { color: theme.colors.ink }]}>
                  Regular: {payrollData.regularPeriod}
                </Text>
              </View>
              <View
                style={[
                  styles.periodBadge,
                  { backgroundColor: '#d9770615' },
                ]}
              >
                <Clock size={12} color="#d97706" />
                <Text style={[styles.periodBadgeText, { color: '#d97706' }]}>
                  OT: {payrollData.otPeriod}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* KPI Row */}
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
              Estimated Total
            </Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>
              ₹{summaryKpis.totalPay.toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.mute }]}>
              {summaryKpis.activeCount} active operators
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
              Days / OT Hours
            </Text>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
              {summaryKpis.totalWorkDays}d / {summaryKpis.totalOtHours}h
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.mute }]}>
              Total approved
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
            placeholder="Search operator by name, city..."
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
            operators.map((op) => (
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text
                        style={[styles.operatorName, { color: theme.colors.ink }]}
                        numberOfLines={1}
                      >
                        {op.full_name}
                      </Text>
                      <ExternalLink size={12} color={theme.colors.mute} />
                    </View>
                    <Text
                      style={[styles.operatorLocation, { color: theme.colors.mute }]}
                    >
                      {op.phone || 'No phone'}
                      {op.city ? ` • ${op.city}` : ''}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.headerRight}>
                    <Text
                      style={[styles.totalPayAmount, { color: '#059669' }]}
                    >
                      ₹{op.total_pay.toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.totalPayLabel, { color: theme.colors.mute }]}>
                      Total Pay
                    </Text>
                  </View>
                </View>

                {/* Breakdown Tiles */}
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
                      Regular: {op.work_days}d × ₹{op.daily_rate}
                    </Text>
                    <Text style={[styles.colMain, { color: theme.colors.ink }]}>
                      = ₹{op.regular_pay.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.breakdownCol}>
                    <Text style={[styles.colSub, { color: theme.colors.mute }]}>
                      OT: {op.ot_hours}h × ₹{op.ot_hourly_rate}
                    </Text>
                    <Text style={[styles.colMain, { color: theme.colors.ink }]}>
                      = ₹{op.ot_pay.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Edit Rates Action */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    onPress={() => handleOpenEdit(op)}
                    style={[
                      styles.editBtn,
                      { borderColor: theme.colors.hairline },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Edit2 size={13} color={theme.colors.mute} />
                    <Text style={[styles.editBtnText, { color: theme.colors.ink }]}>
                      Edit Rates (Daily ₹{op.daily_rate} / OT ₹{op.ot_hourly_rate})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Rates Modal */}
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
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                Edit Salary Rates
              </Text>
              <TouchableOpacity onPress={() => setEditingOperator(null)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
              {editingOperator?.full_name}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>
                Daily Rate (₹ per day)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.ink,
                    borderColor: theme.colors.hairline,
                    backgroundColor: theme.colors.canvas,
                  },
                ]}
                keyboardType="numeric"
                value={newDailyRate}
                onChangeText={setNewDailyRate}
                placeholder="e.g. 800"
                placeholderTextColor={theme.colors.mute}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.ink }]}>
                Overtime Hourly Rate (₹ per hour)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.ink,
                    borderColor: theme.colors.hairline,
                    backgroundColor: theme.colors.canvas,
                  },
                ]}
                keyboardType="numeric"
                value={newOtRate}
                onChangeText={setNewOtRate}
                placeholder="e.g. 150"
                placeholderTextColor={theme.colors.mute}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditingOperator(null)}
                style={[
                  styles.modalCancelBtn,
                  { borderColor: theme.colors.hairline },
                ]}
              >
                <Text style={{ color: theme.colors.ink, fontWeight: '500' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveRates}
                disabled={savingRate}
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: theme.colors.ink },
                ]}
              >
                <Text style={{ color: theme.colors.canvas, fontWeight: '600' }}>
                  {savingRate ? 'Saving...' : 'Save Rates'}
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
  ruleCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 8,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  ruleText: {
    fontSize: 12,
    lineHeight: 17,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
  },
  periodBadgeText: {
    fontSize: 11,
    fontWeight: '500',
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
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  operatorName: {
    fontSize: 15,
    fontWeight: '600',
  },
  operatorLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  totalPayAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalPayLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  breakdownRow: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  breakdownCol: {
    flex: 1,
  },
  colSub: {
    fontSize: 11,
  },
  colMain: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    padding: spacingNumeric.lg,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: spacingNumeric.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: -8,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
  },
});
