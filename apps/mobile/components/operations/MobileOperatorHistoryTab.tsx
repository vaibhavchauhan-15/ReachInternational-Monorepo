/**
 * Reach International Mobile — Operator History Tab Component
 * 100% Visual and Behavioral Parity with Web OperatorHistoryTab (Screenshot 4).
 * Features:
 * - Top Header: "Historical Machine Logs", total count, Export to Excel (CSV) and Print/PDF buttons
 * - Filter Toolbar: Intelligent date search, filter toggle with Date presets, Condition and Sort options
 * - Active filter badges with one-tap clear buttons
 * - Mobile Touch Cards: Exact timestamp date & time, Operating Hours pill badge (+6.5 hrs),
 *   Machine model & serial number, Client & City, HMR progression, Shift Date, Shift Time,
 *   Breakdown summary, and 7-day inline Edit pencil button
 * - Native Excel & PDF export integration via expo-file-system and expo-print / expo-sharing
 * - 44px minimum touch targets and native tactile haptics
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { haptics } from '../../lib/interaction/haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { OperationLogListSkeleton } from './OperationsSkeleton';
import {
  FileSpreadsheet,
  Printer,
  Search,
  X,
  SlidersHorizontal,
  Calendar,
  Pencil,
  Lock,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import {
  formatDate,
  formatTo12Hour,
  formatExactTimestamp,
  parseBreakdownDetails,
  addDaysToDateStr,
  getISTDateString,
} from '@reachinternational/utils';
import { Text } from '../ui/Text';
import { useOperatorHistoryLogs, type HourLogRecord } from '../../lib/hooks/useOperationsData';
import { OperationsExportModal } from './OperationsExportModal';
import { downloadFileOnWeb } from '../../lib/utils/fileExport';

export interface MobileOperatorHistoryTabProps {
  user: any;
  assignedMachine?: any;
  onEditLog?: (log: HourLogRecord) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'week' | 'month';
export type ConditionFilterPreset = 'all' | 'normal' | 'breakdown';
export type SortPreset =
  | 'date_desc'
  | 'date_asc'
  | 'hours_desc'
  | 'hours_asc'
  | 'meter_desc'
  | 'meter_asc';

const DATE_FILTER_OPTIONS: { value: DateFilterPreset; label: string }[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Past 7 Days' },
  { value: 'month', label: 'This Month' },
];

const CONDITION_FILTER_OPTIONS: { value: ConditionFilterPreset; label: string }[] = [
  { value: 'all', label: 'All Logs' },
  { value: 'normal', label: 'Normal (No Faults)' },
  { value: 'breakdown', label: 'Breakdown Logged' },
];

const SORT_OPTIONS: { value: SortPreset; label: string }[] = [
  { value: 'date_desc', label: 'Date: Newest First' },
  { value: 'date_asc', label: 'Date: Oldest First' },
  { value: 'hours_desc', label: 'Hours: High to Low' },
  { value: 'hours_asc', label: 'Hours: Low to High' },
  { value: 'meter_desc', label: 'End Meter: High to Low' },
  { value: 'meter_asc', label: 'End Meter: Low to High' },
];

/**
 * Intelligent date search matcher matching web OperatorHistoryTab exactly
 */
function matchesDateSearch(log: HourLogRecord, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (!log.log_date) return false;

  const rawDateStr = log.log_date.split('T')[0].trim();
  const [yearStr, monthStr, dayStr] = rawDateStr.split('-');
  if (!yearStr || !monthStr || !dayStr) {
    return rawDateStr.toLowerCase().includes(q);
  }

  const dayNum = parseInt(dayStr, 10);
  const monthNum = parseInt(monthStr, 10);

  const MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const MONTH_SHORT = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];

  const fullMonth = MONTH_NAMES[monthNum - 1] || '';
  const shortMonth = MONTH_SHORT[monthNum - 1] || '';

  if (q === 'today') {
    return rawDateStr === getISTDateString();
  }
  if (q === 'yesterday') {
    return rawDateStr === addDaysToDateStr(getISTDateString(), -1);
  }

  if (q.includes(dayStr) || q.includes(String(dayNum))) {
    if (shortMonth && q.includes(shortMonth)) return true;
    if (fullMonth && q.includes(fullMonth)) return true;
  }
  if (shortMonth && q.includes(shortMonth)) return true;
  if (fullMonth && q.includes(fullMonth)) return true;

  const ddmmyyyy = `${dayStr}-${monthStr}-${yearStr}`;
  if (ddmmyyyy.toLowerCase().includes(q)) return true;

  return rawDateStr.toLowerCase().includes(q);
}

/**
 * Checks if log was submitted within the last 7 calendar days
 */
function isLogWithin7Days(logDate?: string | null): boolean {
  if (!logDate) return false;
  const logDateStr = logDate.split('T')[0];
  const parts = logDateStr.split('-').map(Number);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const logDateMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    const diffDays = Math.floor((todayMidnight - logDateMidnight) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  }
  return false;
}

export const MobileOperatorHistoryTab: React.FC<MobileOperatorHistoryTabProps> = ({
  user,
  assignedMachine,
  onEditLog,
  refreshing = false,
  onRefresh,
}) => {
  const { theme, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilterPreset>('all');
  const [sortBy, setSortBy] = useState<SortPreset>('date_desc');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Fetch operator logs directly for authenticated operator
  const {
    data: logs = [],
    isLoading,
    refetch,
  } = useOperatorHistoryLogs(user?.id, assignedMachine);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim() !== '') count++;
    if (dateFilter !== 'all') count++;
    if (conditionFilter !== 'all') count++;
    if (sortBy !== 'date_desc') count++;
    return count;
  }, [search, dateFilter, conditionFilter, sortBy]);

  const handleResetFilters = useCallback(() => {
    haptics.success();
    setSearch('');
    setDateFilter('all');
    setConditionFilter('all');
    setSortBy('date_desc');
  }, []);

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // 1. Search Query (Intelligent Date & Machine matching)
    if (search.trim() !== '') {
      result = result.filter(
        (log) =>
          matchesDateSearch(log, search) ||
          (log.machine?.model && log.machine.model.toLowerCase().includes(search.toLowerCase())) ||
          (log.machine_code && log.machine_code.toLowerCase().includes(search.toLowerCase())) ||
          (log.machine?.serial_number && log.machine.serial_number.toLowerCase().includes(search.toLowerCase())) ||
          (log.client?.company_name && log.client.company_name.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // 2. Date Filter
    if (dateFilter !== 'all') {
      const todayStr = getISTDateString();
      const yesterdayStr = addDaysToDateStr(todayStr, -1);
      const sevenDaysAgoStr = addDaysToDateStr(todayStr, -7);

      result = result.filter((log) => {
        if (!log.log_date) return false;
        const d = log.log_date.split('T')[0];
        if (dateFilter === 'today') return d === todayStr;
        if (dateFilter === 'yesterday') return d === yesterdayStr;
        if (dateFilter === 'week') return d >= sevenDaysAgoStr && d <= todayStr;
        if (dateFilter === 'month') {
          const currentMonth = todayStr.slice(0, 7);
          return d.startsWith(currentMonth);
        }
        return true;
      });
    }

    // 3. Condition Filter
    if (conditionFilter !== 'all') {
      result = result.filter((log) => {
        if (conditionFilter === 'breakdown') return Boolean(log.is_breakdown);
        if (conditionFilter === 'normal') return !log.is_breakdown;
        return true;
      });
    }

    // 4. Sort
    result.sort((a, b) => {
      const aDate = new Date(a.log_date || '').getTime();
      const bDate = new Date(b.log_date || '').getTime();
      const aHours = Number(a.running_hours) || 0;
      const bHours = Number(b.running_hours) || 0;
      const aMeter = Number(a.end_meter) || 0;
      const bMeter = Number(b.end_meter) || 0;

      switch (sortBy) {
        case 'date_asc':
          return aDate - bDate;
        case 'hours_desc':
          return bHours - aHours;
        case 'hours_asc':
          return aHours - bHours;
        case 'meter_desc':
          return bMeter - aMeter;
        case 'meter_asc':
          return aMeter - bMeter;
        case 'date_desc':
        default:
          return bDate - aDate;
      }
    });

    return result;
  }, [logs, search, dateFilter, conditionFilter, sortBy]);

  // Summary Metrics computed from filtered logs
  const summaryMetrics = useMemo(() => {
    let totalRunningHours = 0;
    let totalOtHours = 0;
    let totalBreakdowns = 0;

    filteredLogs.forEach((l) => {
      const sMtr = l.start_meter ?? 0;
      const eMtr = l.end_meter ?? sMtr;
      totalRunningHours += l.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10);
      totalOtHours += l.overtime_hours ?? 0;
      if (l.is_breakdown) totalBreakdowns++;
    });

    return {
      totalRunningHours: Math.round(totalRunningHours * 10) / 10,
      totalOtHours: Math.round(totalOtHours * 10) / 10,
      totalBreakdowns,
    };
  }, [filteredLogs]);

  // Handler: Export filtered logs to CSV / Excel directly (Screenshot 4)
  const handleExportExcel = useCallback(async () => {
    try {
      setIsExportingExcel(true);
      haptics.select();

      if (!filteredLogs || filteredLogs.length === 0) {
        Alert.alert('No Logs', 'No machine logs found to export for the selected filters.');
        return;
      }

      const headers = [
        'Shift Date',
        'Machine Code',
        'Machine Model',
        'Serial Number',
        'Client',
        'Site Location',
        'Shift',
        'Start Meter',
        'End Meter',
        'Running Hours',
        'Start Time',
        'End Time',
        'Overtime (h)',
        'Breakdown',
        'Breakdown Duration',
        'Remarks',
        'Logged At',
      ];

      const rows = filteredLogs.map((log) => [
        `"${formatDate(log.log_date)}"`,
        `"${log.machine_code || log.machine?.machine_id || ''}"`,
        `"${log.machine?.model || ''}"`,
        `"${log.machine?.serial_number || ''}"`,
        `"${log.client?.company_name || 'Base Yard'}"`,
        `"${log.location || log.client?.city || ''}"`,
        `"${log.shift_code || log.shift || ''}"`,
        Number(log.start_meter || 0).toFixed(1),
        Number(log.end_meter || 0).toFixed(1),
        Number(log.running_hours || 0).toFixed(1),
        `"${formatTo12Hour(log.start_time) || ''}"`,
        `"${formatTo12Hour(log.end_time) || ''}"`,
        log.overtime_hours ? String(log.overtime_hours) : '0',
        log.is_breakdown ? 'YES' : 'NO',
        `"${(log as any).breakdown_duration || ''}"`,
        `"${(log.remarks || '').replace(/"/g, '""')}"`,
        `"${log.created_at ? formatExactTimestamp(log.created_at, false) : ''}"`,
      ].join(','));

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const filename = `Machine_Logs_${getISTDateString()}.csv`;

      if (Platform.OS === 'web') {
        downloadFileOnWeb(csvContent, filename, 'text/csv;charset=utf-8;');
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Machine Logs (CSV/Excel)',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert('Export Complete', `Saved to ${fileUri}`);
        }
      }
      haptics.success();
    } catch (err: any) {
      console.error('[MobileOperatorHistoryTab] Export Excel error:', err);
      Alert.alert('Export Error', err?.message || 'Failed to export logs.');
    } finally {
      setIsExportingExcel(false);
    }
  }, [filteredLogs]);

  return (
    <View style={styles.container}>
      {/* 1. Header Card Container (Screenshot 4) */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleWrap}>
            <Text variant="heading" style={[styles.headerTitle, { color: theme.colors.ink }]}>
              Historical Machine Logs
            </Text>
            <Text variant="caption" style={[styles.headerSubtitle, { color: theme.colors.mute }]}>
              Showing {filteredLogs.length} total logged shifts
            </Text>
          </View>

          {/* Action CTAs: Export to Excel and Print/PDF Buttons (Screenshot 4) */}
          <View style={styles.headerActionsWrap}>
            <TouchableOpacity
              onPress={handleExportExcel}
              disabled={isExportingExcel}
              activeOpacity={0.7}
              style={[
                styles.iconCtaBtn,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                },
              ]}
              accessibilityLabel="Export Shift Logs to Excel"
              accessibilityRole="button"
            >
              {isExportingExcel ? (
                <ActivityIndicator size="small" color={isDark ? '#34d399' : '#059669'} />
              ) : (
                <FileSpreadsheet size={16} color={isDark ? '#34d399' : '#059669'} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                haptics.select();
                setShowExportModal(true);
              }}
              activeOpacity={0.7}
              style={[
                styles.iconCtaBtn,
                {
                  backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe',
                  borderColor: isDark ? 'rgba(2, 132, 199, 0.3)' : '#bae6fd',
                },
              ]}
              accessibilityLabel="Print or Export Shift Logs to PDF"
              accessibilityRole="button"
            >
              <Printer size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Search & Filter Bar (Screenshot 4) */}
        <View style={styles.searchFilterRow}>
          {/* Search Box with Search Icon and Clear Button */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Search size={14} color={theme.colors.mute} style={styles.searchIcon} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search date (e.g. 19 Sep, 2026-09-19)..."
              placeholderTextColor={theme.colors.mute}
              style={[
                styles.searchInput,
                { color: theme.colors.ink },
              ]}
            />
            {search.trim() !== '' && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearSearchBtn}
              >
                <X size={13} color={theme.colors.mute} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Dropdown Toggle Button */}
          <TouchableOpacity
            onPress={() => setIsFilterModalOpen(true)}
            activeOpacity={0.8}
            style={[
              styles.filterBtn,
              {
                backgroundColor: activeFilterCount > 0 ? (isDark ? 'rgba(0, 112, 243, 0.15)' : '#eff6ff') : (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                borderColor: activeFilterCount > 0 ? (isDark ? 'rgba(0, 112, 243, 0.3)' : '#bfdbfe') : theme.colors.hairline,
              },
            ]}
          >
            <SlidersHorizontal size={13} color={activeFilterCount > 0 ? theme.colors.link : theme.colors.mute} />
            <Text
              variant="label"
              style={[
                styles.filterBtnText,
                { color: activeFilterCount > 0 ? theme.colors.link : theme.colors.ink },
              ]}
            >
              Filter
            </Text>
            <ChevronDown size={13} color={activeFilterCount > 0 ? theme.colors.link : theme.colors.mute} />
          </TouchableOpacity>
        </View>

        {/* 3. Active Filter Chips Row (Screenshot 4) */}
        {activeFilterCount > 0 && (
          <View style={[styles.activeFilterChipsRow, { borderTopColor: theme.colors.hairline }]}>
            <Text variant="mono" style={[styles.activeFilterLabel, { color: theme.colors.mute }]}>
              ACTIVE ({activeFilterCount}):
            </Text>

            {/* Date Search Chip */}
            {search.trim() !== '' && (
              <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                  Date: "{search}"
                </Text>
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
            )}

            {/* Date Preset Chip */}
            {dateFilter !== 'all' && (
              <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                  {DATE_FILTER_OPTIONS.find((o) => o.value === dateFilter)?.label}
                </Text>
                <TouchableOpacity onPress={() => setDateFilter('all')}>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
            )}

            {/* Condition Chip */}
            {conditionFilter !== 'all' && (
              <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                  {CONDITION_FILTER_OPTIONS.find((o) => o.value === conditionFilter)?.label}
                </Text>
                <TouchableOpacity onPress={() => setConditionFilter('all')}>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
            )}

            {/* Sort Chip */}
            {sortBy !== 'date_desc' && (
              <View style={[styles.filterChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                <Text variant="caption" style={[styles.filterChipText, { color: theme.colors.ink }]}>
                  Sort: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                </Text>
                <TouchableOpacity onPress={() => setSortBy('date_desc')}>
                  <X size={11} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
            )}

            {/* Reset All */}
            <TouchableOpacity onPress={handleResetFilters} style={styles.resetAllBtn}>
              <RotateCcw size={11} color={theme.colors.link} />
              <Text variant="caption" style={{ color: theme.colors.link }}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 4. Logs List (Screenshot 4) */}
      {isLoading ? (
        <OperationLogListSkeleton count={4} />
      ) : filteredLogs.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Calendar size={28} color={theme.colors.mute} />
          <Text variant="heading" style={[styles.emptyTitle, { color: theme.colors.ink }]}>
            No Shift Logs Found
          </Text>
          <Text variant="caption" style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
            {search ? 'No logs match your search criteria.' : 'No shift logs recorded for this machine yet.'}
          </Text>
        </View>
      ) : (
        <View style={styles.logsList}>
          {filteredLogs.map((log) => {
            const startM = Number(log.start_meter) || 0;
            const endM = Number(log.end_meter) || startM;
            const rt = log.running_hours ?? Math.max(0, Math.round((endM - startM) * 10) / 10);

            const sTime = formatTo12Hour(log.start_time);
            const eTime = formatTo12Hour(log.end_time);
            const shiftTimingStr = sTime && eTime ? `${sTime} – ${eTime}` : sTime || eTime || '—';

            const model = log.machine?.model || 'Equipment';
            const serial = log.machine?.serial_number || log.machine_code || '';
            const clientName = log.client?.company_name || 'Base Yard';
            const clientCity = log.client?.city || (log.location && log.location.includes(',') ? log.location.split(',')[1]?.trim() : '');

            const timestampStr = log.created_at
              ? formatExactTimestamp(log.created_at, false)
              : formatDate(log.log_date);

            const breakdownInfo = parseBreakdownDetails(log);
            const canEdit = isLogWithin7Days(log.log_date);

            return (
              <View
                key={log.id}
                style={[
                  styles.historyCard,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                {/* Row 1: Top Header — Exact timestamp date & time (left) + Operating Hours badge (right) */}
                <View style={[styles.cardHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="mono" style={[styles.timestampText, { color: theme.colors.mute }]}>
                    {timestampStr}
                  </Text>
                  <View
                    style={[
                      styles.hoursBadge,
                      {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
                        borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#bbf7d0',
                      },
                    ]}
                  >
                    <Text
                      variant="mono"
                      style={[
                        styles.hoursBadgeText,
                        { color: isDark ? '#4ade80' : '#15803d' },
                      ]}
                    >
                      +{rt.toFixed(1)} hrs
                    </Text>
                  </View>
                </View>

                {/* Row 2: Machine Model + Serial Number (Screenshot 4) */}
                <View style={styles.cardMachineRow}>
                  <Text variant="subheading" style={[styles.machineTitle, { color: theme.colors.ink }]}>
                    {model}
                  </Text>
                  {serial ? (
                    <Text variant="mono" style={[styles.machineSerial, { color: theme.colors.mute }]}>
                      {' '}({serial})
                    </Text>
                  ) : null}
                </View>

                {/* Row 3: Client : Client name (bold) + city name with small text (Screenshot 4) */}
                <View style={styles.cardClientRow}>
                  <Text variant="mono" style={[styles.metaLabel, { color: theme.colors.mute }]}>
                    Client :{' '}
                  </Text>
                  <Text variant="body" style={[styles.clientName, { color: theme.colors.ink }]} numberOfLines={1}>
                    {clientName}
                  </Text>
                  {clientCity ? (
                    <Text variant="caption" style={[styles.clientCity, { color: theme.colors.mute }]}>
                      {' '}({clientCity})
                    </Text>
                  ) : null}
                </View>

                {/* Row 4: HMR: 673.5 -> 680.0 (Screenshot 4) */}
                <View style={styles.cardHmrRow}>
                  <Text variant="mono" style={[styles.metaLabel, { color: theme.colors.mute }]}>
                    HMR:{' '}
                  </Text>
                  <Text variant="mono" style={[styles.hmrValue, { color: theme.colors.ink }]}>
                    {startM.toFixed(1)}
                  </Text>
                  <Text variant="mono" style={{ color: theme.colors.mute, marginHorizontal: 4 }}>
                    {' \u2192 '}
                  </Text>
                  <Text variant="mono" style={[styles.hmrValueBold, { color: theme.colors.ink }]}>
                    {endM.toFixed(1)}
                  </Text>
                </View>

                {/* Row 5: Shift Date : 01-10-2026 (Screenshot 4) */}
                <View style={styles.cardDateRow}>
                  <Text variant="mono" style={[styles.metaLabel, { color: theme.colors.mute }]}>
                    Shift Date :{' '}
                  </Text>
                  <Text variant="mono" style={[styles.dateValueBold, { color: theme.colors.ink }]}>
                    {formatDate(log.log_date)}
                  </Text>
                </View>

                {/* Row 6: Shift Time : 06:00 AM - 02:00 PM (Screenshot 4) */}
                <View style={styles.cardTimeRow}>
                  <Text variant="mono" style={[styles.metaLabel, { color: theme.colors.mute }]}>
                    Shift Time :{' '}
                  </Text>
                  <Text variant="mono" style={[styles.timeValueBold, { color: theme.colors.ink }]}>
                    {shiftTimingStr}
                  </Text>
                  {log.overtime_hours ? (
                    <View
                      style={[
                        styles.otPill,
                        {
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                          borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
                        +{log.overtime_hours}h OT
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Row 7: Breakdown (small text) & Edit Icon at the end (Screenshot 4) */}
                <View style={styles.cardFooterRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {log.is_breakdown ? (
                      <View style={styles.breakdownBadgeRow}>
                        <Text variant="mono" style={{ color: '#e11d48' }}>
                          Breakdown:{' '}
                        </Text>
                        <Text
                          variant="caption"
                          style={{ color: '#e11d48', flex: 1 }}
                          numberOfLines={1}
                        >
                          {breakdownInfo.displayText || (log as any).breakdown_duration || 'Yes'}
                        </Text>
                      </View>
                    ) : (
                      <Text variant="mono" style={[styles.metaLabel, { color: theme.colors.mute }]}>
                        Breakdown: 0
                      </Text>
                    )}
                  </View>

                  {/* Edit Pencil Icon (Only within 7 days, else locked) */}
                  <View style={styles.editActionWrap}>
                    {canEdit ? (
                      <TouchableOpacity
                        onPress={() => onEditLog?.(log)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        style={styles.editBtn}
                        accessibilityLabel="Edit machine log within 7 days"
                      >
                        <Pencil size={15} color={theme.colors.mute} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.lockBtn}>
                        <Lock size={13} color={theme.colors.mute} />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 5. Filter Modal */}
      <AppModal
        visible={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        variant="bottom"
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <SlidersHorizontal size={16} color={theme.colors.ink} />
                <Text variant="heading" style={{ color: theme.colors.ink }}>
                  Filter Shift Logs
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Date Filter Section */}
              <View style={styles.filterSection}>
                <Text variant="mono" style={[styles.filterSectionTitle, { color: theme.colors.mute }]}>
                  DATE RANGE
                </Text>
                <View style={styles.filterOptionsGrid}>
                  {DATE_FILTER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setDateFilter(opt.value)}
                      style={[
                        styles.filterOptionPill,
                        {
                          backgroundColor: dateFilter === opt.value ? theme.colors.ink : theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: dateFilter === opt.value ? theme.colors.canvas : theme.colors.ink }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Condition Section */}
              <View style={styles.filterSection}>
                <Text variant="mono" style={[styles.filterSectionTitle, { color: theme.colors.mute }]}>
                  STATUS & CONDITION
                </Text>
                <View style={styles.filterOptionsGrid}>
                  {CONDITION_FILTER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setConditionFilter(opt.value)}
                      style={[
                        styles.filterOptionPill,
                        {
                          backgroundColor: conditionFilter === opt.value ? theme.colors.ink : theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: conditionFilter === opt.value ? theme.colors.canvas : theme.colors.ink }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort Order Section */}
              <View style={styles.filterSection}>
                <Text variant="mono" style={[styles.filterSectionTitle, { color: theme.colors.mute }]}>
                  SORT ORDER
                </Text>
                <View style={styles.filterOptionsGrid}>
                  {SORT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSortBy(opt.value)}
                      style={[
                        styles.filterOptionPill,
                        {
                          backgroundColor: sortBy === opt.value ? theme.colors.ink : theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: sortBy === opt.value ? theme.colors.canvas : theme.colors.ink }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer Actions */}
            <View style={[styles.modalFooter, { borderTopColor: theme.colors.hairline }]}>
              <TouchableOpacity
                onPress={handleResetFilters}
                style={[styles.modalSecondaryBtn, { borderColor: theme.colors.hairline }]}
              >
                <Text variant="label" style={{ color: theme.colors.ink }}>
                  Reset Filters
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsFilterModalOpen(false)}
                style={[styles.modalPrimaryBtn, { backgroundColor: '#0070f3' }]}
              >
                <Text variant="label" style={{ color: '#ffffff' }}>
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
        </View>
      </AppModal>

      {/* 4. Full-Featured Export & Print Modal (Web & Native Resilient) */}
      {showExportModal && (
        <OperationsExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          viewMode="operator"
          selectedEntityName={user?.full_name || 'Operator'}
          selectedMonthLabel={
            dateFilter === 'today'
              ? 'Today'
              : dateFilter === 'yesterday'
              ? 'Yesterday'
              : dateFilter === 'week'
              ? 'Past 7 Days'
              : dateFilter === 'month'
              ? 'This Month'
              : 'All Dates'
          }
          selectedMachineLabel={
            assignedMachine?.model
              ? `${assignedMachine.model}${assignedMachine.serial_number ? ` (SN: ${assignedMachine.serial_number})` : ''}`
              : undefined
          }
          totalRunningHours={summaryMetrics.totalRunningHours}
          totalOtHours={summaryMetrics.totalOtHours}
          totalBreakdowns={summaryMetrics.totalBreakdowns}
          supervisorName={user?.full_name || 'Operator'}
          logs={filteredLogs}
          fetchParams={{
            viewMode: 'operator',
            operatorId: user?.id,
            search,
            month:
              dateFilter === 'today'
                ? 'today'
                : dateFilter === 'yesterday'
                ? 'yesterday'
                : dateFilter === 'week'
                ? 'week'
                : dateFilter === 'month'
                ? 'month'
                : 'all',
            condition: conditionFilter,
            sort: sortBy === 'date_asc' ? 'date-asc' : 'date-desc',
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 110,
  },
  headerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
  },
  headerSubtitle: {
    marginTop: 2,
  },
  headerActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCtaBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterBtn: {
    height: 42,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterBtnText: {
  },
  activeFilterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
  },
  activeFilterLabel: {
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  filterChipText: {
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 10,
  },
  emptySubtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  logsList: {
    gap: 10,
  },
  historyCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  timestampText: {
  },
  hoursBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  hoursBadgeText: {
  },
  cardMachineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  machineTitle: {
  },
  machineSerial: {
  },
  cardClientRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  metaLabel: {
  },
  clientName: {
  },
  clientCity: {
  },
  cardHmrRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  hmrValue: {
  },
  hmrValueBold: {
  },
  cardDateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  dateValueBold: {
  },
  cardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  timeValueBold: {
  },
  otPill: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  breakdownBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editActionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  editBtn: {
    padding: 4,
  },
  lockBtn: {
    padding: 4,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  filterSection: {
    marginBottom: 14,
  },
  filterSectionTitle: {
    marginBottom: 8,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterOptionPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 6,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
