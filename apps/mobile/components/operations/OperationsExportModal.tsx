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

const formatCompactTiming = (startStr?: string | null, endStr?: string | null): string => {
  const formattedStart = formatTo12Hour(startStr) || '06:00 AM';
  const formattedEnd = formatTo12Hour(endStr) || '02:00 PM';
  return `${formattedStart.replace(/\s+/g, '')}-${formattedEnd.replace(/\s+/g, '')}`;
};

const formatExcelDate = (dateStr: string): string => {
  try {
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const day = parts[2] < 10 ? `0${parts[2]}` : `${parts[2]}`;
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const mon = monthNames[parts[1] - 1] || '';
      const yearStr = String(parts[0]).slice(-2);
      return `${day}-${mon}-${yearStr}`;
    }
  } catch {}
  return dateStr;
};

const formatHoursWithUnit = (val: number): string => {
  if (val == null || isNaN(val)) return '0h';
  const rounded = Math.abs(val - Math.round(val)) < 0.05 ? Math.round(val) : Math.round(val * 10) / 10;
  return `${rounded}h`;
};

const calculateShiftWorkHours = (log: HourLogRecord): number => {
  if (log.normal_working_hours != null && Number(log.normal_working_hours) > 0) {
    return Number(log.normal_working_hours) + Number(log.overtime_hours || 0);
  }
  if (log.start_time && log.end_time) {
    const sParts = log.start_time.split(':').map(Number);
    const eParts = log.end_time.split(':').map(Number);
    if (!isNaN(sParts[0]) && !isNaN(eParts[0])) {
      const sMin = sParts[0] * 60 + (sParts[1] || 0);
      let eMin = eParts[0] * 60 + (eParts[1] || 0);
      if (eMin <= sMin) {
        if (eParts[0] === 23 && (eParts[1] || 0) === 59) {
          eMin = 1440;
        } else {
          eMin += 1440;
        }
      }
      return (eMin - sMin) / 60;
    }
  }
  return Number(log.running_hours || 0);
};

const calculateShiftBreakdownHours = (log: HourLogRecord): number => {
  if (!log.is_breakdown) return 0;
  if ((log as any).breakdown_hours != null && Number((log as any).breakdown_hours) > 0) {
    return Number((log as any).breakdown_hours);
  }
  const parsed = parseBreakdownString((log as any).breakdown_duration || log.remarks);
  if (parsed?.durationFormatted) {
    const matchH = parsed.durationFormatted.match(/(\d+(?:\.\d+)?)\s*h/i);
    const matchM = parsed.durationFormatted.match(/(\d+)\s*m/i);
    const h = matchH ? parseFloat(matchH[1]) : 0;
    const m = matchM ? parseInt(matchM[1], 10) : 0;
    if (h > 0 || m > 0) return h + m / 60;
  }
  return 0;
};

const getShiftOrderWeight = (log: HourLogRecord): number => {
  const s = (log.shift_code || log.shift || '').toLowerCase();
  if (s.includes('s1') || s.includes('morning') || s.includes('day')) return 1;
  if (s.includes('s2') || s.includes('afternoon')) return 2;
  if (s.includes('s3') || s.includes('evening')) return 3;
  if (s.includes('s4') || s.includes('night')) return 4;
  return 5;
};

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

    // Sort logs chronologically by date and shift
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = a.log_date ? new Date(a.log_date).getTime() : 0;
      const dateB = b.log_date ? new Date(b.log_date).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return getShiftOrderWeight(a) - getShiftOrderWeight(b);
    });

        // Group logs by date
    const dateGroupsMap = new Map<string, HourLogRecord[]>();
    sortedLogs.forEach((log) => {
      const key = log.log_date ? log.log_date.split('T')[0] : 'unknown';
      if (!dateGroupsMap.has(key)) {
        dateGroupsMap.set(key, []);
      }
      dateGroupsMap.get(key)!.push(log);
    });

    let sumDayRT = 0;
    let sumWorkingHours = 0;
    let sumBreakdownHours = 0;

    const tbodyRowsHtml = Array.from(dateGroupsMap.entries()).map(([dateKey, groupLogs]) => {
      const formattedDate = formatExcelDate(dateKey);

      let dayRT = 0;
      let dayWork = 0;
      let dayBkd = 0;

      groupLogs.forEach((l) => {
        const sMtr = l.start_meter ?? 0;
        const eMtr = l.end_meter ?? sMtr;
        const rt = l.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10);
        dayRT += rt;
        dayWork += calculateShiftWorkHours(l);
        dayBkd += calculateShiftBreakdownHours(l);
      });

      dayRT = Math.round(dayRT * 10) / 10;
      dayWork = Math.abs(dayWork - Math.round(dayWork)) < 0.05 ? Math.round(dayWork) : Math.round(dayWork * 10) / 10;
      dayBkd = Math.abs(dayBkd - Math.round(dayBkd)) < 0.05 ? Math.round(dayBkd) : Math.round(dayBkd * 10) / 10;

      sumDayRT += dayRT;
      sumWorkingHours += dayWork;
      sumBreakdownHours += dayBkd;

      const firstLog = groupLogs[0];
      const clientOrMachine =
        viewMode === 'client' || viewMode === 'operator'
          ? (firstLog?.machine?.model ? `${firstLog.machine.model}${firstLog.machine.serial_number || firstLog.machine_code ? ` (${firstLog.machine.serial_number || firstLog.machine_code})` : ''}` : firstLog?.machine_code || 'Machine')
          : (firstLog?.client?.company_name || firstLog?.client?.client_name || firstLog?.client?.name || cleanClientName || 'Unassigned');

      const shiftsStr = groupLogs
        .map((l) => {
          const c = l.shift_code || (l.shift?.toLowerCase().includes('night') ? 'S4' : l.shift?.toLowerCase().includes('morning') ? 'S1' : l.shift?.toLowerCase().includes('afternoon') ? 'S2' : 'S3');
          return c.toUpperCase().startsWith('S') ? c : `S${c}`;
        })
        .join('/');

      const operatorsStr = groupLogs
        .map((l) => l.operator?.full_name || 'Unassigned')
        .join('/');

      const cleanRemarksList = groupLogs
        .map((l) => (l.remarks || '').replace(/\[Breakdown Duration:[^\]]+\]/gi, '').trim())
        .filter((r) => r.length > 0 && r.toLowerCase() !== 'breakdown' && r !== '—');
      const cleanRemarks = Array.from(new Set(cleanRemarksList)).join('; ') || '—';

      let dayMaintMin = 0;
      groupLogs.forEach((l) => {
        dayMaintMin += Number((l as any).maintenance_minutes || 0);
      });

      const totalBdMin = Math.round(dayBkd * 60);
      const netBdMin = Math.max(0, totalBdMin - dayMaintMin);
      const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };
      let bdCellHtml: string;
      if (totalBdMin === 0) bdCellHtml = `<span style="color:#737373">0h</span>`;
      else if (dayMaintMin >= totalBdMin && dayMaintMin > 0) bdCellHtml = `<span style="color:#b45309;font-weight:bold">MT ${fmtMin(dayMaintMin)}</span>`;
      else if (dayMaintMin > 0 && netBdMin > 0) bdCellHtml = `<span style="color:#b45309">MT ${fmtMin(dayMaintMin)}</span> / <span style="color:#be123c">${fmtMin(netBdMin)}</span>`;
      else bdCellHtml = `<span style="color:#be123c">${fmtMin(totalBdMin)}</span>`;

      return `
        <tr style="border-bottom: 1px solid #ebebeb; font-size: 8px; line-height: 1.2;">
          <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: bold; word-break: break-word;">${formattedDate}</td>
          <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-weight: 600; word-break: break-word;">${clientOrMachine}</td>
          <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700; color: #0369a1; word-break: break-word;">${shiftsStr}</td>
          <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-weight: 500; word-break: break-word;">${operatorsStr}</td>
          <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700; color: #0284c7; white-space: nowrap;">${formatHoursWithUnit(dayRT)}</td>
          <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700; white-space: nowrap;">${formatHoursWithUnit(dayWork)}</td>
          <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700; white-space: nowrap;">${bdCellHtml}</td>
        </tr>
      `;
    }).join('');

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

    const kpiStripHtml = viewMode === 'client'
      ? buildPdfHtmlKpiStrip([
          { label: 'Total Shifts', value: `${logs.length} ${logs.length === 1 ? 'Shift' : 'Shifts'}` },
          { label: 'Operating Hours', value: `${Math.round(totalRunningHours * 10) / 10} hrs`, color: '#0369a1' },
          { label: 'Breakdown Events', value: String(totalBreakdowns), color: '#be123c' },
        ])
      : buildPdfHtmlKpiStrip([
          { label: 'Total Logs', value: String(logs.length) },
          { label: 'Operating Hours', value: `${Math.round(totalRunningHours * 10) / 10} hrs`, color: '#0369a1' },
          { label: 'Overtime Hours', value: `${Math.round(totalOtHours * 10) / 10} hrs`, color: '#b45309' },
          { label: 'Breakdown Events', value: String(totalBreakdowns), color: '#be123c' },
        ]);

    const entityHeader = viewMode === 'client' || viewMode === 'operator' ? 'Machine' : 'Client';

    const tableHtml = `
      <table>
        <thead>
          <tr style="background-color: #f5f5f5; font-size: 8.5px; text-transform: uppercase; font-weight: 800; border-bottom: 2px solid #171717;">
            <th style="width: 12%; text-align: center; vertical-align: middle; padding: 4px 2px;">Date</th>
            <th style="width: 18%; text-align: center; vertical-align: middle; padding: 4px 2px;">${entityHeader}</th>
            <th style="width: 9%; text-align: center; vertical-align: middle; padding: 4px 2px;">Shift</th>
            <th style="width: 35%; text-align: center; vertical-align: middle; padding: 4px 2px;">OPERATOR NAME</th>
            <th style="width: 9%; text-align: center; vertical-align: middle; padding: 4px 2px;">M/C RT</th>
            <th style="width: 9%; text-align: center; vertical-align: middle; padding: 4px 2px;">WH</th>
            <th style="width: 8%; text-align: center; vertical-align: middle; padding: 4px 2px;">B/D</th>
          </tr>
        </thead>
        <tbody>
          ${tbodyRowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 12px; color:#737373;">No daily running hour logs found.</td></tr>'}
        </tbody>
        ${dateGroupsMap.size > 0 ? `
        <tfoot>
          <tr style="border-top: 2px solid #171717; font-weight: 800; font-size: 8px;">
            <td colspan="7" style="padding: 4px 2px; text-align: center; vertical-align: middle;">Total</td>
          </tr>
          <tr style="border-bottom: 2px solid #171717; font-family: monospace; font-weight: 700; font-size: 8px;">
            <td style="padding: 4px 2px; text-align: center; vertical-align: middle;">${dateGroupsMap.size} ${dateGroupsMap.size === 1 ? 'day' : 'days'}</td>
            <td></td>
            <td></td>
            <td></td>
            <td style="padding: 4px 2px; text-align: center; vertical-align: middle; color: #0369a1;">${formatHoursWithUnit(sumDayRT)}</td>
            <td style="padding: 4px 2px; text-align: center; vertical-align: middle;">${formatHoursWithUnit(sumWorkingHours)}</td>
            <td style="padding: 4px 2px; text-align: center; vertical-align: middle;">${formatHoursWithUnit(sumBreakdownHours)}</td>
          </tr>
        </tfoot>
        ` : ''}
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

      const sortedLogsForCsv = [...logs].sort((a, b) => {
        const dateA = a.log_date ? new Date(a.log_date).getTime() : 0;
        const dateB = b.log_date ? new Date(b.log_date).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return getShiftOrderWeight(a) - getShiftOrderWeight(b);
      });

      const dateGroupsMap = new Map<string, HourLogRecord[]>();
      sortedLogsForCsv.forEach((l) => {
        const key = l.log_date ? l.log_date.split('T')[0] : 'unknown';
        if (!dateGroupsMap.has(key)) {
          dateGroupsMap.set(key, []);
        }
        dateGroupsMap.get(key)!.push(l);
      });

      const headers = [
        'Date',
        viewMode === 'client' || viewMode === 'operator' ? 'Machine' : 'Client',
        'Shift',
        'OPERATOR NAME',
        'M/C RT',
        'WH',
        'B/D',
      ];

      const rows: string[] = [];
      let totalDayRT = 0;
      let totalWorkHours = 0;
      let totalBkdHours = 0;

      dateGroupsMap.forEach((groupLogs, dateKey) => {
        const formattedDate = formatExcelDate(dateKey);
        let dayRT = 0;
        let dayWork = 0;
        let dayBkd = 0;

        groupLogs.forEach((l) => {
          const sMtr = l.start_meter ?? 0;
          const eMtr = l.end_meter ?? sMtr;
          const rt = l.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10);
          dayRT += rt;
          dayWork += calculateShiftWorkHours(l);
          dayBkd += calculateShiftBreakdownHours(l);
        });

        dayRT = Math.round(dayRT * 10) / 10;
        dayWork = Math.abs(dayWork - Math.round(dayWork)) < 0.05 ? Math.round(dayWork) : Math.round(dayWork * 10) / 10;
        dayBkd = Math.abs(dayBkd - Math.round(dayBkd)) < 0.05 ? Math.round(dayBkd) : Math.round(dayBkd * 10) / 10;

        totalDayRT += dayRT;
        totalWorkHours += dayWork;
        totalBkdHours += dayBkd;

        const firstLog = groupLogs[0];
        const clientOrMachine =
          viewMode === 'client' || viewMode === 'operator'
            ? (firstLog?.machine?.model ? `${firstLog.machine.model}${firstLog.machine.serial_number || firstLog.machine_code ? ` (${firstLog.machine.serial_number || firstLog.machine_code})` : ''}` : firstLog?.machine_code || 'Machine')
            : (firstLog?.client?.company_name || firstLog?.client?.client_name || firstLog?.client?.name || selectedEntityName || 'Unassigned');

        const shiftsStr = groupLogs
          .map((l) => {
            const c = l.shift_code || (l.shift?.toLowerCase().includes('night') ? 'S4' : l.shift?.toLowerCase().includes('morning') ? 'S1' : l.shift?.toLowerCase().includes('afternoon') ? 'S2' : 'S3');
            return c.toUpperCase().startsWith('S') ? c : `S${c}`;
          })
          .join('/');

        const operatorsStr = groupLogs
          .map((l) => l.operator?.full_name || 'Unassigned')
          .join('/');

        let dayMaintMin2 = 0;
        groupLogs.forEach((l) => { dayMaintMin2 += Number((l as any).maintenance_minutes || 0); });
        const totalBdMin2 = Math.round(dayBkd * 60);
        const netBdMin2 = Math.max(0, totalBdMin2 - dayMaintMin2);
        const fmtMin2 = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };
        let bdCsv: string;
        if (totalBdMin2 === 0) bdCsv = '0h';
        else if (dayMaintMin2 >= totalBdMin2 && dayMaintMin2 > 0) bdCsv = `MT ${fmtMin2(dayMaintMin2)}`;
        else if (dayMaintMin2 > 0 && netBdMin2 > 0) bdCsv = `MT ${fmtMin2(dayMaintMin2)} / ${fmtMin2(netBdMin2)}`;
        else bdCsv = fmtMin2(totalBdMin2);

        rows.push([
          `"${formattedDate}"`,
          `"${clientOrMachine}"`,
          `"${shiftsStr}"`,
          `"${operatorsStr}"`,
          `"${formatHoursWithUnit(dayRT)}"`,
          `"${formatHoursWithUnit(dayWork)}"`,
          `"${bdCsv}"`,
        ].join(','));
      });

      const totalRow1 = ['"Total"', '""', '""', '""', '""', '""', '""'].join(',');
      const totalRow2 = [
        `"${dateGroupsMap.size} days"`,
        '""',
        '""',
        '""',
        `"${formatHoursWithUnit(totalDayRT)}"`,
        `"${formatHoursWithUnit(totalWorkHours)}"`,
        `"${formatHoursWithUnit(totalBkdHours)}"`,
      ].join(',');

      const titleRow = [`"selected machine summery"`, '""', '""', '""', '""', '""', '""'].join(',');
      const csvContent = [titleRow, headers.join(','), ...rows, totalRow1, totalRow2].join('\r\n');
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
                  <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>
                    {viewMode === 'client' ? 'TOTAL SHIFTS' : 'MATCHING LOGS'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.ink }]}>
                    {viewMode === 'client' ? `${logs.length} ${logs.length === 1 ? 'Shift' : 'Shifts'}` : logs.length}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>OPERATING RUN</Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.link }]}>
                    {Math.round(totalRunningHours * 10) / 10} hrs
                  </Text>
                </View>
                {viewMode !== 'client' && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>TOTAL OVERTIME</Text>
                    <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
                      {Math.round(totalOtHours * 10) / 10} hrs
                    </Text>
                  </View>
                )}
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
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
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
