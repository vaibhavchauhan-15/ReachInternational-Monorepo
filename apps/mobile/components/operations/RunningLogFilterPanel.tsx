import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  SearchableSelect,
  SegmentedToggle,
  Badge,
  useTheme,
  CustomDatePicker,
  Text,
} from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type {
  MachineWithAssignments,
  ClientRecord,
  OperatorRecord,
  ClientSiteRecord,
} from '../../lib/hooks/useOperationsData';

export type LogsViewMode = 'machine' | 'client' | 'operator';

export interface RunningLogFilterPanelProps {
  viewMode: LogsViewMode;
  onViewModeChange: (mode: LogsViewMode) => void;
  // Master data
  machines: MachineWithAssignments[];
  clients: ClientRecord[];
  clientSites?: ClientSiteRecord[];
  operators: OperatorRecord[];
  clientMachines?: MachineWithAssignments[];
  // Selected filter states
  selectedClientId: string;
  onSelectClient: (id: string) => void;
  selectedSite: string;
  onSelectSite: (site: string) => void;
  selectedClientMachineId: string;
  onSelectClientMachine: (id: string) => void;
  selectedMachineId: string;
  onSelectMachine: (id: string) => void;
  selectedOperatorId: string;
  onSelectOperator: (id: string) => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  // Custom Date Range
  customStartDate?: string;
  onSelectCustomStartDate?: (date: string) => void;
  customEndDate?: string;
  onSelectCustomEndDate?: (date: string) => void;
}

export const MONTH_OPTIONS = [
  { value: 'all', label: 'All Months' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
  { value: 'custom', label: 'Custom Range' },
];

export const RunningLogFilterPanel = React.memo<RunningLogFilterPanelProps>(
  function RunningLogFilterPanel({
    viewMode,
    onViewModeChange,
    machines = [],
    clients = [],
    clientSites = [],
    operators = [],
    clientMachines = [],
    selectedClientId,
    onSelectClient,
    selectedSite,
    onSelectSite,
    selectedClientMachineId,
    onSelectClientMachine,
    selectedMachineId,
    onSelectMachine,
    selectedOperatorId,
    onSelectOperator,
    selectedMonth,
    onSelectMonth,
    customStartDate,
    onSelectCustomStartDate,
    customEndDate,
    onSelectCustomEndDate,
  }) {
    const { theme, isDark } = useTheme();

    // Client select options
    const clientOptions = useMemo(() => {
      return clients.map((c) => {
        const address = [c.street, c.city, c.district, c.state, c.pincode]
          .filter(Boolean)
          .join(', ');
        return {
          value: c.id,
          label: c.company_name,
          code: c.code || undefined,
          description: address || undefined,
        };
      });
    }, [clients]);

    // Filter sites for selected client
    const currentClientSites = useMemo(() => {
      if (!selectedClientId) return [];
      return clientSites.filter((s) => s.client_id === selectedClientId);
    }, [clientSites, selectedClientId]);

    const siteOptions = useMemo(() => {
      const base = [{ value: 'all', label: 'All Sites & Locations' }];
      const dynamicSites = currentClientSites.map((s) => ({
        value: s.id || s.site_name,
        label: s.site_name + (s.site_code ? ` (${s.site_code})` : ''),
        description: s.city || undefined,
      }));
      return [...base, ...dynamicSites];
    }, [currentClientSites]);

    // Client machine options (with "All Machines" first)
    const clientMachineOptions = useMemo(() => {
      const base = [
        {
          value: 'all',
          label: 'All Machines',
          badge: `${clientMachines.length} Total`,
          badgeVariant: 'neutral' as const,
        },
      ];
      const machs = clientMachines.map((m) => ({
        value: m.id,
        label: m.model || 'Equipment',
        code: m.machine_id || undefined,
        description: m.serial_number ? `S/N: ${m.serial_number}` : undefined,
      }));
      return [...base, ...machs];
    }, [clientMachines]);

    // All machines options for Machine View
    const machineOptions = useMemo(() => {
      return machines.map((m) => ({
        value: m.id,
        label: m.model || 'Equipment',
        code: m.machine_id || undefined,
        description: m.serial_number ? `(S/N: ${m.serial_number})` : undefined,
      }));
    }, [machines]);

    // Operator options for Operator View
    const operatorOptions = useMemo(() => {
      return operators.map((o) => ({
        value: o.id,
        label: o.full_name,
        code: 'OP',
        description: o.phone || undefined,
      }));
    }, [operators]);

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Top View Mode Switcher */}
        <View style={styles.topRow}>
          <SegmentedToggle<LogsViewMode>
            items={[
              { id: 'machine', label: 'Machine' },
              { id: 'client', label: 'Clients' },
              { id: 'operator', label: 'Operator' },
            ]}
            value={viewMode}
            onChange={onViewModeChange}
            fullWidth={false}
            size="sm"
            activeColor={isDark ? '#fafafa' : '#171717'}
          />
        </View>

        {/* Filter Dropdowns Section */}
        <View style={[styles.filterBody, { borderTopColor: theme.colors.hairline }]}>
          {viewMode === 'client' && (
            <View style={styles.filterStack}>
              {/* Select Client */}
              <SearchableSelect
                label="Select Client"
                rightElement={
                  <Badge
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    label={`${clients.length} Total`}
                  />
                }
                value={selectedClientId}
                onChange={(val) => onSelectClient(val)}
                options={clientOptions}
                placeholder="Search or select client..."
                searchPlaceholder="Search by Client Name, Location..."
                inlineDescription={true}
              />

              {/* Select Location */}
              <SearchableSelect
                label="Select Location"
                rightElement={
                  <Badge
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    label={`${Math.max(1, currentClientSites.length || 1)} Total`}
                  />
                }
                value={selectedSite || 'all'}
                onChange={(val) => onSelectSite(val === 'all' ? '' : val)}
                options={siteOptions}
                placeholder="All Sites & Locations"
                searchPlaceholder="Search site or location..."
                inlineDescription={true}
              />

              {/* Select Machine */}
              <SearchableSelect
                label="Select Machine"
                rightElement={
                  <Badge
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    label={`${clientMachines.length} Total`}
                  />
                }
                value={selectedClientMachineId || 'all'}
                onChange={(val) => onSelectClientMachine(val)}
                options={clientMachineOptions}
                placeholder="All Machines"
                searchPlaceholder="Search by Model, Code, S/N..."
                inlineDescription={true}
              />

              {/* Select Month */}
              <SearchableSelect
                label="Select Month"
                value={selectedMonth}
                onChange={(val) => onSelectMonth(val)}
                options={MONTH_OPTIONS}
                placeholder="Select Month"
                searchable={true}
                searchPlaceholder="Search..."
              />
            </View>
          )}

          {viewMode === 'machine' && (
            <View style={styles.filterStack}>
              {/* Select Machine */}
              <SearchableSelect
                label="Select Machine"
                rightElement={
                  <Badge
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    label={`${machines.length} Total`}
                  />
                }
                value={selectedMachineId}
                onChange={(val) => onSelectMachine(val)}
                options={machineOptions}
                placeholder="Search or select machine..."
                searchPlaceholder="Search by Model, Code, S/N..."
                inlineDescription={true}
              />

              {/* Select Month */}
              <SearchableSelect
                label="Select Month"
                value={selectedMonth}
                onChange={(val) => onSelectMonth(val)}
                options={MONTH_OPTIONS}
                placeholder="Select Month"
                searchable={true}
                searchPlaceholder="Search..."
              />
            </View>
          )}

          {viewMode === 'operator' && (
            <View style={styles.filterStack}>
              {/* Select Operator */}
              <SearchableSelect
                label="Select Operator"
                rightElement={
                  <Badge
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    label={`${operators.length} Total`}
                  />
                }
                value={selectedOperatorId}
                onChange={(val) => onSelectOperator(val)}
                options={operatorOptions}
                placeholder="Search or select operator..."
                searchPlaceholder="Search by Operator Name, Phone..."
                inlineDescription={true}
              />

              {/* Select Month */}
              <SearchableSelect
                label="Select Month"
                value={selectedMonth}
                onChange={(val) => onSelectMonth(val)}
                options={MONTH_OPTIONS}
                placeholder="Select Month"
                searchable={true}
                searchPlaceholder="Search..."
              />
            </View>
          )}

          {/* Custom Date Range Pickers (when "Custom Range" is selected) */}
          {selectedMonth === 'custom' && (
            <View style={[styles.customRangeRow, { borderTopColor: theme.colors.hairline }]}>
              <View style={styles.datePickerCol}>
                <CustomDatePicker
                  label="Start Date"
                  value={customStartDate || ''}
                  onChange={(date) => onSelectCustomStartDate?.(date)}
                  placeholder="DD-MM-YYYY"
                />
              </View>
              <View style={styles.datePickerCol}>
                <CustomDatePicker
                  label="End Date"
                  value={customEndDate || ''}
                  onChange={(date) => onSelectCustomEndDate?.(date)}
                  placeholder="DD-MM-YYYY"
                />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  filterBody: {
    borderTopWidth: 1,
    paddingTop: spacingNumeric.md,
    marginTop: spacingNumeric.sm + 2,
  },
  filterStack: {
    gap: spacingNumeric.md,
  },
  customRangeRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
    borderTopWidth: 1,
    paddingTop: spacingNumeric.sm + 2,
    marginTop: spacingNumeric.sm,
  },
  datePickerCol: {
    flex: 1,
  },
});
