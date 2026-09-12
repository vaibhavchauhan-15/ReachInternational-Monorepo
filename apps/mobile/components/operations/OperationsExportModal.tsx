import React, { useState } from 'react';
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
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Printer, FileSpreadsheet, X, CheckCircle, ShieldAlert, Clock, Sparkles } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { formatDate, formatExactTimestamp, formatTo12Hour, parseBreakdownString, getISTDateString } from '@reachinternational/utils';
import { notifyLogsPdfExported, notifyLogsCsvExported } from '../../lib/notifications';
import {
  buildPdfHtmlHeader,
  buildPdfHtmlKpiStrip,
  buildPdfHtmlSignatureBlock,
  buildPdfHtmlWrapper,
} from '../../lib/pdf-html-templates';
import type { HourLogRecord } from '../../app/(app)/operations';

export interface OperationsExportModalProps {
  visible: boolean;
  onClose: () => void;
  logs: HourLogRecord[];
  viewMode: 'machine' | 'client' | 'operator';
  selectedEntityName: string;
  selectedMonthLabel: string;
  selectedLocationLabel?: string;
  selectedMachineLabel?: string;
  totalRunningHours: number;
  totalOtHours: number;
  totalBreakdowns: number;
  supervisorName?: string;
}

export const OperationsExportModal: React.FC<OperationsExportModalProps> = ({
  visible,
  onClose,
  logs,
  viewMode,
  selectedEntityName,
  selectedMonthLabel,
  selectedLocationLabel,
  selectedMachineLabel,
  totalRunningHours,
  totalOtHours,
  totalBreakdowns,
  supervisorName = 'Operations Supervisor',
}) => {
  const { theme, isDark } = useTheme();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Generate Base HTML matching PrintableSupervisorLogsModal.tsx
  const generateReportHtml = (): string => {
    const reportTitle =
      viewMode === 'operator'
        ? 'OPERATOR DAILY MACHINE LOG REPORT'
        : viewMode === 'client'
        ? 'SITE MACHINE RUNNING HOURS REPORT'
        : 'MACHINE RUNNING HOURS REPORT';

    const now = new Date();
    const exportDateTime = `${formatDate(now.toISOString().split('T')[0])}, ${formatTo12Hour(
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    )}`;

    const isUuid = (val?: string | null): boolean =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));

    // Resolve client name cleanly (never a UUID)
    let cleanClientName = !isUuid(selectedEntityName) ? selectedEntityName : '';
    if (!cleanClientName) {
      const logWithClient = logs.find(
        (l) =>
          (l.client?.company_name && !isUuid(l.client.company_name)) ||
          (l.client?.client_name && !isUuid(l.client.client_name)) ||
          (l.client?.name && !isUuid(l.client.name))
      );
      cleanClientName =
        logWithClient?.client?.company_name ||
        logWithClient?.client?.client_name ||
        logWithClient?.client?.name ||
        'Client Representative';
    }

    cleanClientName = cleanClientName.trim().replace(/^['":\s]+|['":\s]+$/g, '');
    const cleanLocationLabel = (selectedLocationLabel || '')
      .trim()
      .replace(/[,:\s]+$/, '');

    const formatCompactTiming = (startStr?: string | null, endStr?: string | null): string => {
      const formattedStart = formatTo12Hour(startStr) || '06:00 AM';
      const formattedEnd = formatTo12Hour(endStr) || '02:00 PM';
      return `${formattedStart.replace(/\s+/g, '')}-${formattedEnd.replace(/\s+/g, '')}`;
    };

    const rowsHtml = logs
      .map((log, index) => {
        const startMtr = log.start_meter ?? 0;
        const endMtr = log.end_meter ?? startMtr;
        const runningHrs = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
        const otHrs = log.overtime_hours ?? 0;
        const mModel = log.machine?.model || log.machine_code || '—';
        const mSerial = log.machine?.serial_number || '—';
        const logClientName = log.client?.company_name || log.client?.client_name || log.client?.name || 'Unassigned';
        const opName = log.operator?.full_name || 'Unassigned';
        const shiftTimes = formatCompactTiming(log.start_time, log.end_time);

        const isBkd = log.is_breakdown;
        const bkdMatch = (log.remarks || '').match(/\[Breakdown Duration:\s*([^\]]+)\]/i) || (log.remarks || '').match(/Breakdown\s*(?:Duration)?:?\s*(\d+h?\s*\d*m?)/i);
        const bkdRaw = (log as any).breakdown_duration || (bkdMatch ? bkdMatch[1].trim() : null);
        const bkdParsed = parseBreakdownString(bkdRaw || log.remarks);
        const bkdStartTime = (log as any).breakdown_start_time || bkdParsed?.startTime || null;
        const bkdEndTime = (log as any).breakdown_end_time || bkdParsed?.endTime || null;
        const bkdDurationOnly = bkdParsed?.durationFormatted || bkdParsed?.durationText || bkdRaw || (isBkd ? 'Breakdown' : null);

        let cleanRemarks = (log.remarks || '—').replace(/\[Breakdown Duration:[^\]]+\]/gi, '').trim();
        if (cleanRemarks.toLowerCase() === 'breakdown' || cleanRemarks.toLowerCase() === 'machine breakdown') {
          cleanRemarks = '—';
        }
        cleanRemarks = cleanRemarks || '—';

        let breakdownCellHtml = '<span style="font-weight: 700; color: #525252; font-family: monospace;">0</span>';
        if (isBkd) {
          if (bkdStartTime && bkdEndTime) {
            breakdownCellHtml = `
              <div style="color: #be123c; font-family: monospace; text-align: center; line-height: 1.2;">
                <div style="font-weight: 800; font-size: 9px; white-space: nowrap;">${formatCompactTiming(bkdStartTime, bkdEndTime)}</div>
                <div style="font-weight: 700; font-size: 8.5px;">(${bkdDurationOnly})</div>
              </div>
            `;
          } else {
            breakdownCellHtml = `
              <div style="color: #be123c; font-family: monospace; text-align: center; line-height: 1.2; word-break: break-word;">
                <span style="font-weight: 800; font-size: 9px;">${bkdDurationOnly && bkdDurationOnly.toLowerCase() !== 'breakdown' ? bkdDurationOnly : 'Breakdown'}</span>
              </div>
            `;
          }
        }

        return `
          <tr style="border-bottom: 1px solid #e5e5e5; font-size: 10px;">
            <td style="padding: 5px 4px; text-align: center; font-weight: bold; color: #171717;">${index + 1}</td>
            <td style="padding: 5px 4px; text-align: center; white-space: nowrap; font-family: monospace; font-weight: 600;">${formatDate(log.log_date)}</td>
            <td style="padding: 5px 4px; text-align: center; font-weight: bold; font-family: monospace;">${mModel}</td>
            <td style="padding: 5px 4px; text-align: center; font-family: monospace; color: #171717; font-weight: bold;">${mSerial}</td>
            <td style="padding: 5px 4px; text-align: center;">
              <div style="font-weight: 700; font-size: 9.5px; text-align: center;">${logClientName}</div>
              <div style="font-size: 8.5px; color: #737373; text-align: center;">${log.location || '—'}</div>
            </td>
            <td style="padding: 5px 4px; text-align: center; font-weight: 600;">
              <div style="text-align: center;">${opName}</div>
            </td>
            <td style="padding: 5px 4px; text-align: center; font-family: monospace; font-size: 9px; white-space: nowrap;">${shiftTimes}</td>
            <td style="padding: 5px 4px; text-align: center; font-family: monospace; font-weight: 800; color: #0284c7;">${runningHrs}h</td>
            <td style="padding: 5px 4px; text-align: center; font-family: monospace; font-weight: 800; color: #d97706;">${otHrs > 0 ? `${otHrs}h` : '0h'}</td>
            <td style="padding: 5px 4px; text-align: center;">${breakdownCellHtml}</td>
            <td style="padding: 5px 4px; text-align: center; font-style: italic; color: #525252; word-break: break-word;">${cleanRemarks}</td>
          </tr>
        `;
      })
      .join('');

    const headerHtml = buildPdfHtmlHeader({
      title: reportTitle,
      subtitle:
        viewMode === 'client'
          ? `<span style="display: inline-block;">CLIENT: <strong>${cleanClientName.toUpperCase()}</strong></span>${cleanLocationLabel && cleanLocationLabel !== 'all' ? ` <span style="color:#a3a3a3; font-weight: normal; margin: 0 4px;">|</span> <span style="display: inline;">LOCATION: <strong>${cleanLocationLabel.toUpperCase()}</strong></span>` : ''}`
          : viewMode === 'machine'
          ? `<span style="display: inline-block;">EQUIPMENT: <strong>${selectedEntityName.toUpperCase()}</strong></span>${cleanLocationLabel && cleanLocationLabel !== 'all' ? ` <span style="color:#a3a3a3; font-weight: normal; margin: 0 4px;">|</span> <span style="display: inline;">LOCATION: <strong>${cleanLocationLabel.toUpperCase()}</strong></span>` : ''}`
          : `<span style="display: inline-block;">OPERATOR: <strong>${selectedEntityName.toUpperCase()}</strong></span>${cleanLocationLabel && cleanLocationLabel !== 'all' ? ` <span style="color:#a3a3a3; font-weight: normal; margin: 0 4px;">|</span> <span style="display: inline;">LOCATION: <strong>${cleanLocationLabel.toUpperCase()}</strong></span>` : ''}`,
      metaItems: [
        { label: 'Period', value: selectedMonthLabel },
        { label: 'Supervisor', value: supervisorName },
        { label: 'Export Date', value: exportDateTime },
        { label: 'Total Records', value: String(logs.length) },
      ],
    });

    const kpiStripHtml = buildPdfHtmlKpiStrip([
      { label: 'Total Logs', value: String(logs.length) },
      { label: 'Operating Hours', value: `${Math.round(totalRunningHours * 10) / 10} hrs`, color: '#0369a1' },
      { label: 'Overtime Hours', value: `${Math.round(totalOtHours * 10) / 10} hrs`, color: '#b45309' },
      { label: 'Breakdown Events', value: String(totalBreakdowns), color: '#be123c' },
    ]);

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 4%;">#</th>
            <th style="width: 9%;">DATE</th>
            <th style="width: 10%;">MODEL</th>
            <th style="width: 11%;">SERIAL NO</th>
            <th style="width: 17%;">CLIENT / SITE</th>
            <th style="width: 14%;">OPERATOR</th>
            <th style="width: 12%;">TIMINGS</th>
            <th style="width: 6%;">WT (H)</th>
            <th style="width: 5%;">OT</th>
            <th style="width: 12%;">BREAKDOWN</th>
            <th style="width: 14%;">REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="11" style="text-align:center; padding: 20px; color:#737373;">No daily running hour logs found.</td></tr>'}
        </tbody>
      </table>
    `;

    const signaturesHtml = buildPdfHtmlSignatureBlock([
      {
        title: 'Prepared By',
        name: `<span style="font-style: italic; font-weight: bold;">${viewMode === 'operator' ? selectedEntityName : supervisorName}</span>`,
        subtitle: viewMode === 'operator' ? '(Machine Operator)' : '(Operations Supervisor)',
      },
      {
        title: 'Client Details &amp; Sign-off',
        name: cleanClientName,
        subtitle: cleanLocationLabel && cleanLocationLabel !== 'all' ? `Site: ${cleanLocationLabel}` : 'Site Representative',
      },
      {
        title: 'Verified &amp; Approved By',
        name: 'REACH INTERNATIONAL',
        subtitle: '(Operations / Service Manager)',
      },
    ]);

    return buildPdfHtmlWrapper({
      title: reportTitle,
      bodyContent: `${headerHtml}\n${kpiStripHtml}\n${tableHtml}\n${signaturesHtml}`,
    });
  };

  const getExportFilename = (extension: 'pdf' | 'csv'): string => {
    const cleanEntity = selectedEntityName.replace(/[^a-zA-Z0-9]/g, '_') || 'Operations';
    const cleanMonth = selectedMonthLabel.replace(/[^a-zA-Z0-9]/g, '_') || 'Logs';
    const dateStamp = getISTDateString();
    return `FleetOps_${viewMode}_${cleanEntity}_${cleanMonth}_${dateStamp}.${extension}`;
  };

  // Handler 1: Export PDF & Share
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const html = generateReportHtml();
      const { uri } = await Print.printToFileAsync({ html });
      const filename = getExportFilename('pdf');
      const targetUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.copyAsync({ from: uri, to: targetUri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(targetUri, {
          mimeType: 'application/pdf',
          dialogTitle: filename,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Created', `Report saved to device cache:\n${targetUri}`);
      }
      notifyLogsPdfExported(logs.length, new Set(logs.map((l) => l.machine_id || l.machine_code)).size);
      onClose();
    } catch (err: any) {
      console.error('Error generating PDF report:', err);
      Alert.alert('Export Error', err?.message || 'Failed to generate PDF report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handler 2: Direct Print
  const handlePrintDirect = async () => {
    try {
      setIsPrinting(true);
      const html = generateReportHtml();
      await Print.printAsync({ html });
      onClose();
    } catch (err: any) {
      console.error('Error printing report:', err);
      Alert.alert('Print Error', err?.message || 'Failed to open system print dialog.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Handler 3: Export CSV Spreadsheet
  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);

      const headers = [
        'S.No',
        'Date',
        'Exact Timestamp',
        'Model',
        'Serial Number',
        'Machine Code',
        'Client Name',
        'Site Location',
        'Operator Name',
        'Shift Timings',
        'Start Meter (HMR)',
        'End Meter (HMR)',
        'Operating Run Hours',
        'Overtime Hours',
        'Is Breakdown',
        'Remarks',
      ];

      const rows = logs.map((log, index) => {
        const startMtr = log.start_meter ?? 0;
        const endMtr = log.end_meter ?? startMtr;
        const runningHrs = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
        const otHrs = log.overtime_hours ?? 0;
        const exactTime = log.created_at ? formatExactTimestamp(log.created_at, true) : '—';
        const shiftTimes = log.start_time && log.end_time
          ? `${formatTo12Hour(log.start_time)} - ${formatTo12Hour(log.end_time)}`
          : '—';
        const cleanRemarks = (log.remarks || '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""');

        return [
          index + 1,
          `"${formatDate(log.log_date)}"`,
          `"${exactTime}"`,
          `"${log.machine?.model || ''}"`,
          `"${log.machine?.serial_number || ''}"`,
          `"${log.machine_code || ''}"`,
          `"${log.client?.company_name || log.client?.client_name || log.client?.name || ''}"`,
          `"${log.location || ''}"`,
          `"${log.operator?.full_name || ''}"`,
          `"${shiftTimes}"`,
          startMtr,
          endMtr,
          runningHrs,
          otHrs,
          log.is_breakdown ? 'YES' : 'NO',
          `"${cleanRemarks}"`,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      const filename = getExportFilename('csv');
      const targetUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(targetUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(targetUri, {
          mimeType: 'text/csv',
          dialogTitle: filename,
        });
      } else {
        Alert.alert('CSV Created', `Spreadsheet saved to device cache:\n${targetUri}`);
      }
      notifyLogsCsvExported(logs.length);
      onClose();
    } catch (err: any) {
      console.error('Error generating CSV report:', err);
      Alert.alert('Export Error', err?.message || 'Failed to generate spreadsheet file.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Header */}
              <View style={[styles.headerRow, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.headerTitleWrap}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.colors.link + '1a' }]}>
                    <Printer size={18} color={theme.colors.link} />
                  </View>
                  <View>
                    <Text style={[styles.title, { color: theme.colors.ink }]}>Export & Print Logs</Text>
                    <Text style={[styles.subTitle, { color: theme.colors.mute }]}>
                      Scope: {viewMode.toUpperCase()} · {selectedMonthLabel}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>

              {/* Summary Stats Box */}
              <View style={[styles.summaryBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>MATCHING LOGS</Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.ink }]}>{logs.length}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>OPERATING RUN</Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.link }]}>
                    {Math.round(totalRunningHours * 10) / 10} hrs
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>TOTAL OVERTIME</Text>
                  <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
                    {Math.round(totalOtHours * 10) / 10} hrs
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>BREAKDOWNS</Text>
                  <Text style={[styles.summaryValue, { color: '#f43f5e' }]}>{totalBreakdowns}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsWrap}>
                {/* 1. PDF Document Export */}
                <TouchableOpacity
                  onPress={handleExportPdf}
                  disabled={isExportingPdf || isPrinting || isExportingCsv}
                  activeOpacity={0.7}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  {isExportingPdf ? (
                    <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                  ) : (
                    <>
                      <Printer size={16} color={theme.colors.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={[styles.actionBtnText, { color: theme.colors.onPrimary }]}>
                        Share / Save PDF Document
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* 2. Direct AirPrint / Mopria Print */}
                <TouchableOpacity
                  onPress={handlePrintDirect}
                  disabled={isExportingPdf || isPrinting || isExportingCsv}
                  activeOpacity={0.7}
                  style={[
                    styles.actionBtnSecondary,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color={theme.colors.ink} />
                  ) : (
                    <>
                      <Printer size={16} color={theme.colors.ink} style={{ marginRight: 8 }} />
                      <Text style={[styles.actionBtnSecondaryText, { color: theme.colors.ink }]}>
                        Send to Wireless Printer
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* 3. CSV Spreadsheet Export */}
                <TouchableOpacity
                  onPress={handleExportCsv}
                  disabled={isExportingPdf || isPrinting || isExportingCsv}
                  activeOpacity={0.7}
                  style={[
                    styles.actionBtnSecondary,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {isExportingCsv ? (
                    <ActivityIndicator size="small" color={theme.colors.ink} />
                  ) : (
                    <>
                      <FileSpreadsheet size={16} color="#10b981" style={{ marginRight: 8 }} />
                      <Text style={[styles.actionBtnSecondaryText, { color: theme.colors.ink }]}>
                        Export Excel / CSV File
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    marginVertical: spacingNumeric.md,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsWrap: {
    gap: 10,
    marginTop: spacingNumeric.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
