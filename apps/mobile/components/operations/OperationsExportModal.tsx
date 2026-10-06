import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { Touchable } from '../ui/Touchable';
import { AppModal } from '../ui/AppModal';
import { haptics } from '@/lib/interaction/haptics';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Printer, FileSpreadsheet, X, Loader2 } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  formatDate,
  formatTo12Hour,
  parseBreakdownString,
  getISTDateString,
} from '@reachinternational/utils';
import { notifyLogsPdfExported, notifyLogsCsvExported } from '../../lib/notifications';
import {
  buildPdfHtmlHeader,
  buildPdfHtmlKpiStrip,
  buildPdfHtmlSignatureBlock,
  buildPdfHtmlWrapper,
} from '../../lib/pdf-html-templates';
import type { HourLogRecord } from '../../app/(app)/operations';
import {
  fetchOperationsExportLogs,
  type MobileExportLogsParams,
} from '../../lib/queries/operationsExport';
import { downloadFileOnWeb, sanitizeExportFilename } from '../../lib/utils/fileExport';

export interface OperationsExportModalProps {
  visible: boolean;
  onClose: () => void;
  logs?: HourLogRecord[];
  fetchParams?: MobileExportLogsParams;
  viewMode: 'machine' | 'client' | 'operator';
  selectedEntityName: string;
  selectedMonthLabel: string;
  selectedLocationLabel?: string;
  selectedMachineLabel?: string;
  totalRunningHours?: number;
  totalOtHours?: number;
  totalBreakdowns?: number;
  supervisorName?: string;
}

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
  logs: initialLogs = [],
  fetchParams,
  viewMode,
  selectedEntityName,
  selectedMonthLabel,
  selectedLocationLabel,
  selectedMachineLabel,
  totalRunningHours: initialRunHours,
  totalOtHours: initialOtHours,
  totalBreakdowns: initialBreakdowns,
  supervisorName = 'Operations Supervisor',
}) => {
  const { theme } = useTheme();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Dynamic logs state (if fetchParams provided, fetches complete unpaginated dataset)
  const [fetchedLogs, setFetchedLogs] = useState<HourLogRecord[]>(initialLogs);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(Boolean(fetchParams));
  const [fetchedMetrics, setFetchedMetrics] = useState<{
    totalRunningHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    totalWorkingHours: number;
  }>({
    totalRunningHours: initialRunHours || 0,
    totalOtHours: initialOtHours || 0,
    totalBreakdowns: initialBreakdowns || 0,
    totalWorkingHours: 0,
  });

  useEffect(() => {
    if (!visible) return;

    if (fetchParams) {
      let isCancelled = false;
      setIsLoadingLogs(true);

      fetchOperationsExportLogs(fetchParams)
        .then((res) => {
          if (!isCancelled) {
            if (res.success && res.logs) {
              setFetchedLogs(res.logs);
              setFetchedMetrics({
                totalRunningHours: res.summary.totalRunningHours,
                totalOtHours: res.summary.totalOtHours,
                totalBreakdowns: res.summary.totalBreakdowns,
                totalWorkingHours: res.summary.totalWorkingHours,
              });
            } else {
              setFetchedLogs(initialLogs);
            }
          }
        })
        .catch((err) => {
          console.error('[OperationsExportModal] Fetch export logs error:', err);
          if (!isCancelled) {
            setFetchedLogs(initialLogs);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsLoadingLogs(false);
          }
        });

      return () => {
        isCancelled = true;
      };
    } else {
      setFetchedLogs(initialLogs);
      setIsLoadingLogs(false);
    }
  }, [visible, fetchParams, initialLogs]);

  const activeLogs = fetchedLogs;

  // Aggregate Metrics
  const activeMetrics = useMemo(() => {
    if (fetchParams && !isLoadingLogs) {
      return fetchedMetrics;
    }

    let runHours = 0;
    let otHours = 0;
    let breakdowns = 0;
    let workHours = 0;

    activeLogs.forEach((l) => {
      const sMtr = l.start_meter ?? 0;
      const eMtr = l.end_meter ?? sMtr;
      runHours += l.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10);
      otHours += l.overtime_hours ?? 0;
      workHours += calculateShiftWorkHours(l);
      if (l.is_breakdown) breakdowns += 1;
    });

    return {
      totalRunningHours: Math.round(runHours * 10) / 10,
      totalOtHours: Math.round(otHours * 10) / 10,
      totalBreakdowns: breakdowns,
      totalWorkingHours: Math.round(workHours * 10) / 10,
    };
  }, [activeLogs, fetchParams, isLoadingLogs, fetchedMetrics]);

  // Generate Base HTML matching PrintableSupervisorLogsModal.tsx & pdf-html-templates.ts
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

    // Resolve client name cleanly
    let cleanClientName = !isUuid(selectedEntityName) ? selectedEntityName : '';
    if (!cleanClientName) {
      const logWithClient = activeLogs.find(
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
    const cleanLocationLabel = (selectedLocationLabel || '').trim().replace(/[,:\s]+$/, '');

    // Sort logs chronologically by date and shift
    const sortedLogs = [...activeLogs].sort((a, b) => {
      const dateA = a.log_date ? new Date(a.log_date).getTime() : 0;
      const dateB = b.log_date ? new Date(b.log_date).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return getShiftOrderWeight(a) - getShiftOrderWeight(b);
    });

    let tbodyRowsHtml = '';
    let sumTotalRT = 0;
    let sumTotalWork = 0;
    let sumTotalBkd = 0;

    if (viewMode === 'operator') {
      // Operator Mode: Full individual shift log rows for precise meter & timing transparency
      tbodyRowsHtml = sortedLogs
        .map((log, idx) => {
          const formattedDate = formatExcelDate(log.log_date || '');
          const sMtr = Number(log.start_meter ?? 0);
          const eMtr = Number(log.end_meter ?? sMtr);
          const rt = Number(log.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10));
          const wh = calculateShiftWorkHours(log);
          const bkd = calculateShiftBreakdownHours(log);

          sumTotalRT += rt;
          sumTotalWork += wh;
          sumTotalBkd += bkd;

          const machInfo = log.machine?.model
            ? `${log.machine.model}${log.machine.serial_number ? ` (SN: ${log.machine.serial_number})` : ''}`
            : log.machine_code || 'Machine';

          const clientInfo = log.client?.company_name || log.client?.client_name || log.client?.name || 'Base Yard';
          const shiftStr = log.shift_code || log.shift || 'Shift';
          const timingStr = log.start_time && log.end_time
            ? `${formatTo12Hour(log.start_time)} – ${formatTo12Hour(log.end_time)}`
            : '—';

          const bkdMin = Math.round(bkd * 60);
          const bdCell = bkdMin > 0
            ? `<span style="color:#be123c; font-weight:bold;">${Math.floor(bkdMin / 60)}h ${bkdMin % 60}m</span>`
            : `<span style="color:#737373;">0h</span>`;

          return `
            <tr style="border-bottom: 1px solid #ebebeb; font-size: 8px; line-height: 1.25;">
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: bold;">${formattedDate}</td>
              <td style="padding: 4px 2px; text-align: left; vertical-align: middle; font-weight: 600;">${machInfo}</td>
              <td style="padding: 4px 2px; text-align: left; vertical-align: middle; color: #525252;">${clientInfo}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700; color: #0369a1;">${shiftStr}</td>
              <td style="padding: 4px 2px; text-align: right; vertical-align: middle; font-family: monospace;">${sMtr.toFixed(1)}</td>
              <td style="padding: 4px 2px; text-align: right; vertical-align: middle; font-family: monospace; font-weight: bold;">${eMtr.toFixed(1)}</td>
              <td style="padding: 4px 2px; text-align: right; vertical-align: middle; font-family: monospace; font-weight: 700; color: #0284c7;">+${rt.toFixed(1)}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace;">${timingStr}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace;">${bdCell}</td>
            </tr>
          `;
        })
        .join('');
    } else {
      // Machine & Client Mode: Date-grouped rows with aggregated RT / WH / BD
      const dateGroupsMap = new Map<string, HourLogRecord[]>();
      sortedLogs.forEach((log) => {
        const key = log.log_date ? log.log_date.split('T')[0] : 'unknown';
        if (!dateGroupsMap.has(key)) {
          dateGroupsMap.set(key, []);
        }
        dateGroupsMap.get(key)!.push(log);
      });

      tbodyRowsHtml = Array.from(dateGroupsMap.entries())
        .map(([dateKey, groupLogs]) => {
          const formattedDate = formatExcelDate(dateKey);
          let dayRT = 0;
          let dayWork = 0;
          let dayBkd = 0;

          groupLogs.forEach((l) => {
            const sMtr = l.start_meter ?? 0;
            const eMtr = l.end_meter ?? sMtr;
            dayRT += l.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10);
            dayWork += calculateShiftWorkHours(l);
            dayBkd += calculateShiftBreakdownHours(l);
          });

          dayRT = Math.round(dayRT * 10) / 10;
          dayWork = Math.round(dayWork * 10) / 10;
          dayBkd = Math.round(dayBkd * 10) / 10;

          sumTotalRT += dayRT;
          sumTotalWork += dayWork;
          sumTotalBkd += dayBkd;

          const firstLog = groupLogs[0];
          const clientOrMachine =
            viewMode === 'client'
              ? (firstLog?.machine?.model ? `${firstLog.machine.model}${firstLog.machine.serial_number ? ` (${firstLog.machine.serial_number})` : ''}` : firstLog?.machine_code || 'Machine')
              : (firstLog?.client?.company_name || cleanClientName || 'Client');

          const shiftsStr = groupLogs
            .map((l) => l.shift_code || l.shift || 'S1')
            .join('/');

          const operatorsStr = groupLogs
            .map((l) => l.operator?.full_name || 'Unassigned')
            .join('/');

          const totalBdMin = Math.round(dayBkd * 60);
          const bdCellHtml = totalBdMin > 0
            ? `<span style="color:#be123c; font-weight:bold;">${Math.floor(totalBdMin / 60)}h ${totalBdMin % 60}m</span>`
            : `<span style="color:#737373;">0h</span>`;

          return `
            <tr style="border-bottom: 1px solid #ebebeb; font-size: 8px; line-height: 1.25;">
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: bold;">${formattedDate}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-weight: 600;">${clientOrMachine}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700; color: #0369a1;">${shiftsStr}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-weight: 500;">${operatorsStr}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700; color: #0284c7;">${formatHoursWithUnit(dayRT)}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700;">${formatHoursWithUnit(dayWork)}</td>
              <td style="padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 700;">${bdCellHtml}</td>
            </tr>
          `;
        })
        .join('');
    }

    const headerHtml = buildPdfHtmlHeader({
      title: reportTitle,
      subtitle:
        viewMode === 'operator'
          ? `<span style="display: inline-block;">OPERATOR: <strong>${selectedEntityName.toUpperCase()}</strong></span>${selectedMachineLabel ? ` <span style="color:#a3a3a3; margin: 0 4px;">|</span> <span>EQUIPMENT: <strong>${selectedMachineLabel.toUpperCase()}</strong></span>` : ''}`
          : viewMode === 'client'
          ? `<span style="display: inline-block;">CLIENT: <strong>${cleanClientName.toUpperCase()}</strong></span>${cleanLocationLabel && cleanLocationLabel !== 'all' ? ` <span style="color:#a3a3a3; margin: 0 4px;">|</span> <span>LOCATION: <strong>${cleanLocationLabel.toUpperCase()}</strong></span>` : ''}`
          : `<span style="display: inline-block;">EQUIPMENT: <strong>${selectedEntityName.toUpperCase()}</strong></span>${cleanLocationLabel && cleanLocationLabel !== 'all' ? ` <span style="color:#a3a3a3; margin: 0 4px;">|</span> <span>LOCATION: <strong>${cleanLocationLabel.toUpperCase()}</strong></span>` : ''}`,
      metaItems: [
        { label: 'Period', value: selectedMonthLabel },
        { label: viewMode === 'operator' ? 'Operator' : 'Supervisor', value: viewMode === 'operator' ? selectedEntityName : supervisorName },
        { label: 'Export Date', value: exportDateTime },
        { label: 'Total Records', value: `${activeLogs.length} Shifts` },
      ],
    });

    const kpiStripHtml = buildPdfHtmlKpiStrip([
      { label: 'Total Logs', value: `${activeLogs.length} Shifts` },
      { label: 'Operating Run', value: `${activeMetrics.totalRunningHours} hrs`, color: '#0369a1' },
      { label: 'Total Overtime', value: `${activeMetrics.totalOtHours} hrs`, color: '#b45309' },
      { label: 'Breakdown Events', value: String(activeMetrics.totalBreakdowns), color: '#be123c' },
    ]);

    const tableHeaderHtml =
      viewMode === 'operator'
        ? `
          <tr style="background-color: #f5f5f5; font-size: 8.5px; text-transform: uppercase; font-weight: 800; border-bottom: 2px solid #171717;">
            <th style="width: 11%; text-align: center; padding: 4px 2px;">Date</th>
            <th style="width: 18%; text-align: left; padding: 4px 2px;">Machine</th>
            <th style="width: 17%; text-align: left; padding: 4px 2px;">Client / Site</th>
            <th style="width: 8%; text-align: center; padding: 4px 2px;">Shift</th>
            <th style="width: 8%; text-align: right; padding: 4px 2px;">Start</th>
            <th style="width: 8%; text-align: right; padding: 4px 2px;">End</th>
            <th style="width: 9%; text-align: right; padding: 4px 2px;">RT (hrs)</th>
            <th style="width: 13%; text-align: center; padding: 4px 2px;">Timing</th>
            <th style="width: 8%; text-align: center; padding: 4px 2px;">Fault</th>
          </tr>
        `
        : `
          <tr style="background-color: #f5f5f5; font-size: 8.5px; text-transform: uppercase; font-weight: 800; border-bottom: 2px solid #171717;">
            <th style="width: 12%; text-align: center; padding: 4px 2px;">Date</th>
            <th style="width: 18%; text-align: center; padding: 4px 2px;">${viewMode === 'client' ? 'Machine' : 'Client'}</th>
            <th style="width: 9%; text-align: center; padding: 4px 2px;">Shift</th>
            <th style="width: 35%; text-align: center; padding: 4px 2px;">OPERATOR NAME</th>
            <th style="width: 9%; text-align: center; padding: 4px 2px;">M/C RT</th>
            <th style="width: 9%; text-align: center; padding: 4px 2px;">WH</th>
            <th style="width: 8%; text-align: center; padding: 4px 2px;">B/D</th>
          </tr>
        `;

    const colspan = viewMode === 'operator' ? 9 : 7;

    const tableHtml = `
      <table>
        <thead>
          ${tableHeaderHtml}
        </thead>
        <tbody>
          ${tbodyRowsHtml || `<tr><td colspan="${colspan}" style="text-align:center; padding: 16px; color:#737373;">No machine shift logs found for active filters.</td></tr>`}
        </tbody>
        ${activeLogs.length > 0 ? `
        <tfoot>
          <tr style="border-top: 2px solid #171717; font-weight: 800; font-size: 8px;">
            <td colspan="${colspan}" style="padding: 4px 2px; text-align: center; vertical-align: middle;">Total Operational Summary</td>
          </tr>
          <tr style="border-bottom: 2px solid #171717; font-family: monospace; font-weight: 700; font-size: 8px;">
            <td style="padding: 4px 2px; text-align: center;">${activeLogs.length} shifts</td>
            <td></td>
            <td></td>
            <td></td>
            ${viewMode === 'operator' ? '<td></td><td></td>' : ''}
            <td style="padding: 4px 2px; text-align: right; color: #0369a1;">${formatHoursWithUnit(sumTotalRT)}</td>
            <td style="padding: 4px 2px; text-align: center;">${formatHoursWithUnit(sumTotalWork)}</td>
            <td style="padding: 4px 2px; text-align: center;">${formatHoursWithUnit(sumTotalBkd)}</td>
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
    const rawName = `ReachInternational_${viewMode}_${selectedEntityName}_${selectedMonthLabel}_${getISTDateString()}`;
    return sanitizeExportFilename(rawName, extension);
  };

  // Handler 1: Export PDF & Share (Web & Native Resilient)
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      haptics.select();
      const html = generateReportHtml();

      if (Platform.OS === 'web') {
        // On Web: launch the print dialog directly with "Save as PDF" capability
        await Print.printAsync({ html });
        notifyLogsPdfExported(activeLogs.length, new Set(activeLogs.map((l) => l.machine_id || l.machine_code)).size);
        await haptics.success();
        onClose();
      } else {
        // On Native (iOS / Android): compile PDF file, copy to cache, and open system Share sheet
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
          Alert.alert('PDF Ready', `Report file created:\n${targetUri}`);
        }
        notifyLogsPdfExported(activeLogs.length, new Set(activeLogs.map((l) => l.machine_id || l.machine_code)).size);
        await haptics.success();
        onClose();
      }
    } catch (err: any) {
      await haptics.error();
      console.error('[OperationsExportModal] PDF export error:', err);
      Alert.alert('Export Error', err?.message || 'Failed to generate PDF document.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handler 2: Direct Print
  const handlePrintDirect = async () => {
    try {
      setIsPrinting(true);
      haptics.select();
      const html = generateReportHtml();
      await Print.printAsync({ html });
      await haptics.success();
      onClose();
    } catch (err: any) {
      await haptics.error();
      console.error('[OperationsExportModal] Direct print error:', err);
      Alert.alert('Print Error', err?.message || 'Failed to launch system print spooler.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Handler 3: Export CSV / Excel Spreadsheet (Web & Native Resilient)
  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);
      haptics.select();

      const sortedLogsForCsv = [...activeLogs].sort((a, b) => {
        const dateA = a.log_date ? new Date(a.log_date).getTime() : 0;
        const dateB = b.log_date ? new Date(b.log_date).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return getShiftOrderWeight(a) - getShiftOrderWeight(b);
      });

      let headers: string[];
      let rows: string[];

      if (viewMode === 'operator') {
        headers = [
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

        rows = sortedLogsForCsv.map((log) => [
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
          `"${log.created_at ? formatDate(log.created_at) : ''}"`,
        ].join(','));
      } else {
        headers = [
          'Date',
          viewMode === 'client' ? 'Machine' : 'Client',
          'Shift',
          'OPERATOR NAME',
          'M/C RT',
          'WH',
          'B/D',
        ];

        const dateGroupsMap = new Map<string, HourLogRecord[]>();
        sortedLogsForCsv.forEach((l) => {
          const key = l.log_date ? l.log_date.split('T')[0] : 'unknown';
          if (!dateGroupsMap.has(key)) {
            dateGroupsMap.set(key, []);
          }
          dateGroupsMap.get(key)!.push(l);
        });

        rows = [];
        dateGroupsMap.forEach((groupLogs, dateKey) => {
          const formattedDate = formatExcelDate(dateKey);
          let dayRT = 0;
          let dayWork = 0;
          let dayBkd = 0;

          groupLogs.forEach((l) => {
            const sMtr = l.start_meter ?? 0;
            const eMtr = l.end_meter ?? sMtr;
            dayRT += l.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10);
            dayWork += calculateShiftWorkHours(l);
            dayBkd += calculateShiftBreakdownHours(l);
          });

          const firstLog = groupLogs[0];
          const clientOrMachine =
            viewMode === 'client'
              ? (firstLog?.machine?.model ? `${firstLog.machine.model}${firstLog.machine.serial_number ? ` (${firstLog.machine.serial_number})` : ''}` : firstLog?.machine_code || 'Machine')
              : (firstLog?.client?.company_name || selectedEntityName || 'Client');

          const shiftsStr = groupLogs
            .map((l) => l.shift_code || l.shift || 'S1')
            .join('/');

          const operatorsStr = groupLogs
            .map((l) => l.operator?.full_name || 'Unassigned')
            .join('/');

          const totalBdMin = Math.round(dayBkd * 60);
          const bdCsv = totalBdMin > 0 ? `${Math.floor(totalBdMin / 60)}h ${totalBdMin % 60}m` : '0h';

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
      }

      const filename = getExportFilename('csv');
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

      if (Platform.OS === 'web') {
        // Universal web download
        const downloaded = downloadFileOnWeb(csvContent, filename, 'text/csv;charset=utf-8;');
        if (!downloaded) {
          Alert.alert('Export Failed', 'Unable to initiate file download in browser.');
        } else {
          notifyLogsCsvExported(activeLogs.length);
          await haptics.success();
          onClose();
        }
      } else {
        // Native iOS / Android file share
        const targetUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(targetUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(targetUri, {
            mimeType: 'text/csv',
            dialogTitle: filename,
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert('CSV Created', `Spreadsheet saved to:\n${targetUri}`);
        }
        notifyLogsCsvExported(activeLogs.length);
        await haptics.success();
        onClose();
      }
    } catch (err: any) {
      await haptics.error();
      console.error('[OperationsExportModal] CSV export error:', err);
      Alert.alert('Export Error', err?.message || 'Failed to generate spreadsheet file.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={onClose} variant="center">
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
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Export & Print Logs
              </Text>
              <Text variant="caption" style={[styles.subTitle, { color: theme.colors.mute }]}>
                {selectedEntityName} · {selectedMonthLabel}
              </Text>
            </View>
          </View>
          <Touchable
            preset="icon"
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
            accessibilityLabel="Close"
          >
            <X size={16} color={theme.colors.mute} />
          </Touchable>
        </View>

        {/* Loading Indicator when fetching unpaginated full dataset */}
        {isLoadingLogs ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.colors.link} />
            <Text variant="caption" style={[styles.loadingText, { color: theme.colors.mute }]}>
              Preparing complete operational export data...
            </Text>
          </View>
        ) : (
          <>
            {/* Summary Stats Box */}
            <View
              style={[
                styles.summaryBox,
                { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
              ]}
            >
              <View style={styles.summaryItem}>
                <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>
                  SHIFTS
                </Text>
                <Text variant="mono" style={{ color: theme.colors.ink }}>
                  {activeLogs.length}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>
                  RUN TIME
                </Text>
                <Text variant="mono" style={{ color: theme.colors.link }}>
                  {activeMetrics.totalRunningHours}h
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>
                  OVERTIME
                </Text>
                <Text variant="mono" style={{ color: '#f59e0b' }}>
                  {activeMetrics.totalOtHours}h
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>
                  FAULTS
                </Text>
                <Text variant="mono" style={{ color: '#f43f5e' }}>
                  {activeMetrics.totalBreakdowns}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsWrap}>
              {/* 1. PDF Document Export */}
              <Touchable
                preset="button"
                onPress={handleExportPdf}
                disabled={isExportingPdf || isPrinting || isExportingCsv || activeLogs.length === 0}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                    opacity: activeLogs.length === 0 ? 0.5 : 1,
                  },
                ]}
                accessibilityLabel="Share or Save PDF Document"
              >
                {isExportingPdf ? (
                  <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                ) : (
                  <>
                    <Printer size={16} color={theme.colors.onPrimary} style={{ marginRight: 8 }} />
                    <Text variant="label" style={{ color: theme.colors.onPrimary }}>
                      {Platform.OS === 'web' ? 'Save as PDF Document' : 'Share / Save PDF Document'}
                    </Text>
                  </>
                )}
              </Touchable>

              {/* 2. Direct AirPrint / Mopria / Browser Print */}
              <Touchable
                preset="button"
                onPress={handlePrintDirect}
                disabled={isExportingPdf || isPrinting || isExportingCsv || activeLogs.length === 0}
                style={[
                  styles.actionBtnSecondary,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                    opacity: activeLogs.length === 0 ? 0.5 : 1,
                  },
                ]}
                accessibilityLabel="Send to Wireless Printer"
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color={theme.colors.ink} />
                ) : (
                  <>
                    <Printer size={16} color={theme.colors.ink} style={{ marginRight: 8 }} />
                    <Text variant="label" style={{ color: theme.colors.ink }}>
                      Send to Wireless Printer
                    </Text>
                  </>
                )}
              </Touchable>

              {/* 3. CSV Spreadsheet Export */}
              <Touchable
                preset="button"
                onPress={handleExportCsv}
                disabled={isExportingPdf || isPrinting || isExportingCsv || activeLogs.length === 0}
                style={[
                  styles.actionBtnSecondary,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                    opacity: activeLogs.length === 0 ? 0.5 : 1,
                  },
                ]}
                accessibilityLabel="Export Excel or CSV File"
              >
                {isExportingCsv ? (
                  <ActivityIndicator size="small" color={theme.colors.ink} />
                ) : (
                  <>
                    <FileSpreadsheet size={16} color="#10b981" style={{ marginRight: 8 }} />
                    <Text variant="label" style={{ color: theme.colors.ink }}>
                      Export Excel (.xlsx / CSV)
                    </Text>
                  </>
                )}
              </Touchable>
            </View>
          </>
        )}
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
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
  subTitle: {
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    paddingVertical: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    marginTop: 4,
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
    marginBottom: 4,
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
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
});
