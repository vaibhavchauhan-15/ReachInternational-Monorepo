import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Button } from '../ui/Button';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Printer, FileSpreadsheet, X, CheckCircle, Clock, ShieldAlert, SlidersHorizontal } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { formatDate, formatTo12Hour } from '@reachinternational/utils';
import { notifyMachineExported } from '../../lib/notifications';
import {
  buildPdfHtmlHeader,
  buildPdfHtmlKpiStrip,
  buildPdfHtmlSignatureBlock,
  buildPdfHtmlWrapper,
} from '../../lib/pdf-html-templates';

export interface MachineExportModalProps {
  visible: boolean;
  onClose: () => void;
  machines: any[];
}

const FILTER_TABS = [
  { value: 'all', label: 'All Fleet' },
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'On Rent' },
  { value: 'spare', label: 'Spare' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'under_maintenance', label: 'Maintenance' },
];

function formatRentalStatus(status?: string): string {
  switch (status) {
    case 'rented':
      return 'On Rent';
    case 'available':
      return 'Available';
    case 'maintenance':
    case 'under_maintenance':
      return 'Maintenance';
    case 'retired':
      return 'Retired';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Available';
  }
}

function formatHealthStatus(health?: string): string {
  switch (health) {
    case 'active':
      return 'Active';
    case 'spare':
      return 'Spare';
    case 'under_maintenance':
      return 'Maintenance';
    case 'breakdown':
      return 'Breakdown';
    default:
      return health ? health.charAt(0).toUpperCase() + health.slice(1).replace(/_/g, ' ') : 'Active';
  }
}

export const MachineExportModal: React.FC<MachineExportModalProps> = ({
  visible,
  onClose,
  machines,
}) => {
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Filtered dataset
  const filteredMachines = useMemo(() => {
    if (activeFilter === 'all') return machines;
    return machines.filter((m) => {
      const rental = (m.status || m.rental_status || '').toLowerCase();
      const health = (m.health_status || '').toLowerCase();
      if (activeFilter === 'available') return rental === 'available';
      if (activeFilter === 'rented') return rental === 'rented';
      if (activeFilter === 'spare') return health === 'spare';
      if (activeFilter === 'breakdown') return health === 'breakdown';
      if (activeFilter === 'under_maintenance') return health === 'under_maintenance' || rental === 'maintenance';
      return true;
    });
  }, [machines, activeFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let available = 0;
    let rented = 0;
    let breakdown = 0;
    let maintenance = 0;
    let totalHmr = 0;

    machines.forEach((m) => {
      const r = (m.status || m.rental_status || '').toLowerCase();
      const h = (m.health_status || '').toLowerCase();
      if (r === 'available') available++;
      if (r === 'rented') rented++;
      if (h === 'breakdown') breakdown++;
      if (h === 'under_maintenance' || r === 'maintenance') maintenance++;
      const hmr = Number(m.hour_meter ?? m.total_run_hours ?? m.hmr ?? 0);
      if (!isNaN(hmr)) totalHmr += hmr;
    });

    return {
      total: machines.length,
      available,
      rented,
      breakdown,
      maintenance,
      totalHmr: Math.round(totalHmr * 10) / 10,
    };
  }, [machines]);

  const generateReportHtml = (): string => {
    const now = new Date();
    const exportDateTime = `${formatDate(now.toISOString().split('T')[0])}, ${formatTo12Hour(
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    )}`;

    const tabObj = FILTER_TABS.find((t) => t.value === activeFilter);
    const filterLabel = tabObj ? tabObj.label : 'All Fleet';

    const rowsHtml = filteredMachines
      .map((m, idx) => {
        const mId = m.machine_id || `RI-MC-${String(idx + 1).padStart(4, '0')}`;
        const model = m.model || '—';
        const serial = m.serial_number || '—';
        const category = m.category?.name || m.category_name || 'Industrial';
        const clientName = m.client?.company_name || m.customer_name || 'In Yard / Depo';
        const site = [m.client?.street, m.client?.city, m.client?.district, m.client?.state, m.client?.pincode].filter(Boolean).join(', ') || m.client?.address || m.current_location || m.site_address || '—';
        const hmr = m.hour_meter ?? m.total_run_hours ?? m.hmr ?? 0;
        const rentalStatus = formatRentalStatus(m.status || m.rental_status);
        const healthStatus = formatHealthStatus(m.health_status);

        const statusColor =
          (m.status || m.rental_status) === 'rented'
            ? '#0284c7'
            : m.health_status === 'breakdown'
            ? '#dc2626'
            : m.health_status === 'under_maintenance'
            ? '#d97706'
            : '#16a34a';

        return `
          <tr style="border-bottom: 1px solid #e5e5e5; font-size: 11px;">
            <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #737373;">${idx + 1}</td>
            <td style="padding: 6px 8px; font-family: monospace; font-weight: 700; color: #0284c7;">${mId}</td>
            <td style="padding: 6px 8px; font-weight: bold;">${model}</td>
            <td style="padding: 6px 8px; font-family: monospace; color: #525252;">${serial}</td>
            <td style="padding: 6px 8px; color: #525252;">${category}</td>
            <td style="padding: 6px 8px;">
              <div style="font-weight: 600;">${clientName}</div>
              <div style="font-size: 10px; color: #737373;">${site}</div>
            </td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700;">${hmr} hrs</td>
            <td style="padding: 6px 8px; text-align: center;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; background: ${statusColor}18; color: ${statusColor};">
                ${rentalStatus}
              </span>
            </td>
            <td style="padding: 6px 8px; text-align: center; font-size: 10px; color: #525252;">${healthStatus}</td>
          </tr>
        `;
      })
      .join('');

    const headerHtml = buildPdfHtmlHeader({
      title: 'MACHINE FLEET DIRECTORY REPORT',
      subtitle: 'ReachInternational Enterprise Machinery Inventory & Telemetry',
      metaItems: [
        { label: 'Scope', value: `${filterLabel} (${filteredMachines.length} Units)` },
        { label: 'Export Date', value: exportDateTime },
        { label: 'Authorized', value: 'Operations Management' },
      ],
    });

    const kpiStripHtml = buildPdfHtmlKpiStrip([
      { label: 'Total Fleet', value: `${metrics.total} Units` },
      { label: 'Available', value: String(metrics.available), color: '#15803d' },
      { label: 'On Rent', value: String(metrics.rented), color: '#0369a1' },
      { label: 'Breakdown', value: String(metrics.breakdown), color: '#be123c' },
      { label: 'Maintenance', value: String(metrics.maintenance), color: '#b45309' },
      { label: 'Total Fleet Hours', value: `${metrics.totalHmr} hrs` },
    ]);

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 32px; text-align: center;">#</th>
            <th style="text-align: left;">Code</th>
            <th style="text-align: left;">Model</th>
            <th style="text-align: left;">Serial No</th>
            <th style="text-align: left;">Category</th>
            <th style="text-align: left;">Client & Location</th>
            <th style="text-align: center;">Meter (HMR)</th>
            <th style="text-align: center;">Rental</th>
            <th style="text-align: center;">Health</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="9" style="text-align:center; padding: 20px; color:#737373;">No machines found matching criteria.</td></tr>'}
        </tbody>
      </table>
    `;

    const signaturesHtml = buildPdfHtmlSignatureBlock([
      {
        title: 'Prepared By',
        name: 'FLEET SUPERVISOR',
        subtitle: '(Machine Fleet Management)',
      },
      {
        title: 'Inventory Scope',
        name: filterLabel.toUpperCase(),
        subtitle: `Total: ${filteredMachines.length} Machinery Units`,
      },
      {
        title: 'Verified &amp; Approved By',
        name: 'REACH INTERNATIONAL',
        subtitle: '(Operations / Service Manager)',
      },
    ]);

    return buildPdfHtmlWrapper({
      title: 'MACHINE FLEET DIRECTORY REPORT',
      bodyContent: `${headerHtml}\n${kpiStripHtml}\n${tableHtml}\n${signaturesHtml}`,
      orientation: 'landscape',
    });
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const html = generateReportHtml();
      const { uri } = await Print.printToFileAsync({
        html,
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
      });

      notifyMachineExported('pdf', filteredMachines.length);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Share Machine Fleet Directory Report',
        });
      } else {
        Alert.alert('PDF Generated', `Report saved to: ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to export PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const html = generateReportHtml();
      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to start print spooler.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const headers = [
        '#',
        'Machine Code',
        'Model',
        'Serial Number',
        'Category',
        'Rental Status',
        'Health Status',
        'Current Client',
        'Site / Location',
        'Total Run Hours (HMR)',
        'Manufacture Year',
      ];

      const rows = filteredMachines.map((m, idx) => [
        String(idx + 1),
        `"${(m.machine_id || '').replace(/"/g, '""')}"`,
        `"${(m.model || '').replace(/"/g, '""')}"`,
        `"${(m.serial_number || '').replace(/"/g, '""')}"`,
        `"${(m.category?.name || m.category_name || '').replace(/"/g, '""')}"`,
        `"${formatRentalStatus(m.status || m.rental_status)}"`,
        `"${formatHealthStatus(m.health_status)}"`,
        `"${(m.client?.company_name || m.customer_name || 'In Yard').replace(/"/g, '""')}"`,
        `"${([m.client?.street, m.client?.city, m.client?.district, m.client?.state, m.client?.pincode].filter(Boolean).join(', ') || m.client?.address || m.current_location || m.site_address || '').replace(/"/g, '""')}"`,
        String(m.hour_meter ?? m.total_run_hours ?? m.hmr ?? 0),
        String(m.year_of_mfg || m.manufacture_year || '—'),
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const fileName = `machine-directory-${activeFilter}-${Date.now()}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      notifyMachineExported('csv', filteredMachines.length);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          UTI: 'public.comma-separated-values-text',
          mimeType: 'text/csv',
          dialogTitle: 'Export Machine Directory Spreadsheet',
        });
      } else {
        Alert.alert('Exported', `Spreadsheet saved: ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to export CSV spreadsheet.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvas }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View>
              <Text style={[styles.title, { color: theme.colors.ink }]}>Export Fleet Directory</Text>
              <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                {filteredMachines.length} of {machines.length} machines selected
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Filter Pills Strip */}
          <View style={[styles.filterSection, { borderBottomColor: theme.colors.hairline }]}>
            <Text style={[styles.filterSectionLabel, { color: theme.colors.mute }]}>
              Scope Selection
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {FILTER_TABS.map((tab) => {
                const isActive = activeFilter === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[
                      styles.filterTab,
                      {
                        backgroundColor: isActive ? theme.colors.ink : theme.colors.canvasElevated,
                        borderColor: isActive ? theme.colors.ink : theme.colors.hairline,
                      },
                    ]}
                    onPress={() => setActiveFilter(tab.value)}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        { color: isActive ? theme.colors.canvas : theme.colors.ink },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* KPI Preview Strip */}
          <View style={styles.metricsStrip}>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>MATCHING</Text>
              <Text style={[styles.metricValue, { color: theme.colors.ink }]}>
                {filteredMachines.length}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>ON RENT</Text>
              <Text style={[styles.metricValue, { color: theme.colors.link }]}>
                {metrics.rented}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>BREAKDOWNS</Text>
              <Text style={[styles.metricValue, { color: '#dc2626' }]}>
                {metrics.breakdown}
              </Text>
            </View>
          </View>

          {/* Export Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              label={isExportingPdf ? 'Generating PDF...' : 'Export PDF Document'}
              onPress={handleExportPdf}
              variant="primary"
              size="md"
              icon={<Printer size={16} color="#ffffff" />}
              disabled={isExportingPdf || filteredMachines.length === 0}
              fullWidth
              style={{ marginBottom: 10 }}
            />

            <Button
              label={isPrinting ? 'Opening Print Spooler...' : 'Print Direct (AirPrint / Spooler)'}
              onPress={handlePrint}
              variant="outline"
              size="md"
              icon={<Printer size={16} color={theme.colors.ink} />}
              disabled={isPrinting || filteredMachines.length === 0}
              fullWidth
              style={{ marginBottom: 10 }}
            />

            <Button
              label={isExportingCsv ? 'Creating Spreadsheet...' : 'Export CSV Spreadsheet'}
              onPress={handleExportCsv}
              variant="outline"
              size="md"
              icon={<FileSpreadsheet size={16} color={theme.colors.link} />}
              disabled={isExportingCsv || filteredMachines.length === 0}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  filterSection: {
    paddingVertical: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  filterSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsStrip: {
    flexDirection: 'row',
    padding: spacingNumeric.md,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  actionsContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: spacingNumeric.md,
  },
});
