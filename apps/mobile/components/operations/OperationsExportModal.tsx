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
import { formatDate, formatExactTimestamp, formatTo12Hour, getISTDateString } from '@reachinternational/utils';
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

    const rowsHtml = logs
      .map((log, index) => {
        const startMtr = log.start_meter ?? 0;
        const endMtr = log.end_meter ?? startMtr;
        const runningHrs = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
        const otHrs = log.overtime_hours ?? 0;
        const mModel = log.machine?.model || log.machine_code || '—';
        const mSerial = log.machine?.serial_number || '—';
        const clientName = log.client?.name || 'Unassigned';
        const opName = log.operator?.full_name || 'Unassigned';
        const shiftTimes = log.start_time && log.end_time
          ? `${formatTo12Hour(log.start_time)} - ${formatTo12Hour(log.end_time)}`
          : '—';
        const breakdownText = log.is_breakdown ? 'Breakdown' : '0';
        const cleanRemarks = (log.remarks || '—').replace(/\[Breakdown Duration:[^\]]+\]/gi, '').trim();

        return `
          <tr style="border-bottom: 1px solid #e5e5e5; font-size: 11px;">
            <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #737373;">${index + 1}</td>
            <td style="padding: 6px 8px; white-space: nowrap; font-family: monospace; font-weight: 600;">${formatDate(log.log_date)}</td>
            <td style="padding: 6px 8px; font-weight: bold;">${mModel}</td>
            <td style="padding: 6px 8px; font-family: monospace; color: #525252;">${mSerial}</td>
            <td style="padding: 6px 8px;">
              <div style="font-weight: 600;">${clientName}</div>
              <div style="font-size: 10px; color: #737373;">${log.location || '—'}</div>
            </td>
            <td style="padding: 6px 8px;">${opName}</td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace;">${shiftTimes}</td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700; color: #0284c7;">${runningHrs} hrs</td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700; color: #d97706;">${otHrs > 0 ? `${otHrs} hrs` : '0h'}</td>
            <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: ${log.is_breakdown ? '#e11d48' : '#737373'};">${breakdownText}</td>
            <td style="padding: 6px 8px; font-style: italic; color: #737373; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cleanRemarks}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${reportTitle}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #171717;
              background-color: #ffffff;
              margin: 0;
              padding: 10px;
            }
            .header {
              border-bottom: 2px solid #171717;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              text-align: center;
              margin: 0 0 6px 0;
              letter-spacing: 0.5px;
            }
            .subtitle {
              font-size: 12px;
              font-weight: 700;
              text-align: center;
              color: #525252;
              margin-bottom: 8px;
            }
            .meta-grid {
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 8px;
              font-size: 10.5px;
              background: #f5f5f5;
              padding: 8px 12px;
              border-radius: 6px;
              margin-top: 8px;
            }
            .kpi-strip {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              background: #171717;
              color: #ffffff;
              padding: 10px;
              border-radius: 8px;
              margin: 12px 0;
              text-align: center;
            }
            .kpi-label {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 700;
              color: #a3a3a3;
              margin-bottom: 2px;
            }
            .kpi-value {
              font-size: 14px;
              font-weight: 800;
              font-family: monospace;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #f5f5f5;
              border-bottom: 2px solid #171717;
              padding: 8px 6px;
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 800;
              text-align: left;
              color: #171717;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e5e5e5;
              font-size: 9px;
              color: #737373;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${reportTitle}</h1>
            <div class="subtitle">
              ${viewMode === 'client' ? `CLIENT: ${selectedEntityName}` : viewMode === 'machine' ? `EQUIPMENT: ${selectedEntityName}` : `OPERATOR: ${selectedEntityName}`}
              ${selectedLocationLabel && selectedLocationLabel !== 'all' ? ` | LOCATION: ${selectedLocationLabel}` : ''}
              ${selectedMachineLabel && selectedMachineLabel !== 'all' ? ` | MACHINE: ${selectedMachineLabel}` : ''}
            </div>
            <div class="meta-grid">
              <div><strong>Period:</strong> ${selectedMonthLabel}</div>
              <div><strong>Supervisor:</strong> ${supervisorName}</div>
              <div><strong>Export Date:</strong> ${exportDateTime}</div>
              <div><strong>Total Records:</strong> ${logs.length}</div>
            </div>
          </div>

          <div class="kpi-strip">
            <div>
              <div class="kpi-label">Total Logs</div>
              <div class="kpi-value">${logs.length}</div>
            </div>
            <div>
              <div class="kpi-label">Operating Hours</div>
              <div class="kpi-value" style="color: #38bdf8;">${Math.round(totalRunningHours * 10) / 10} hrs</div>
            </div>
            <div>
              <div class="kpi-label">Overtime Hours</div>
              <div class="kpi-value" style="color: #fbbf24;">${Math.round(totalOtHours * 10) / 10} hrs</div>
            </div>
            <div>
              <div class="kpi-label">Breakdown Events</div>
              <div class="kpi-value" style="color: #fb7185;">${totalBreakdowns}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center;">#</th>
                <th>Date</th>
                <th>Model</th>
                <th>Serial No</th>
                <th>Client / Site</th>
                <th>Operator</th>
                <th style="text-align: center;">Shift Timings</th>
                <th style="text-align: center;">Run Hrs</th>
                <th style="text-align: center;">OT</th>
                <th style="text-align: center;">Breakdown</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="11" style="text-align:center; padding: 20px; color:#737373;">No daily running hour logs found.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <div>Reach International · Industrial Fleet Operations Management</div>
            <div>Generated securely via Reach Mobile Application</div>
          </div>
        </body>
      </html>
    `;
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
          `"${log.client?.name || ''}"`,
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
