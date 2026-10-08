import { supabase } from '../supabase';
import type { HourLogRecord } from '../hooks/useOperationsData';
import {
  resolveOperationsDateRange,
  getISTDateString,
  addDaysToDateStr,
} from '@reachinternational/utils';

export interface MobileExportLogsParams {
  viewMode: 'machine' | 'client' | 'operator';
  entityId?: string;
  clientId?: string;
  clientName?: string;
  machineId?: string;
  operatorId?: string;
  site?: string;
  clientMachineId?: string;
  month?: string; // 'all' | 'current' | 'today' | 'yesterday' | 'week' | 'month' | '01'..'12' | 'custom'
  customStartDate?: string;
  customEndDate?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  condition?: 'all' | 'normal' | 'breakdown';
  sort?: 'date-asc' | 'date-desc';
}

export interface MobileExportLogsResult {
  success: boolean;
  logs: HourLogRecord[];
  totalCount: number;
  summary: {
    totalRunningHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    totalWorkingHours: number;
    loggedDaysCount: number;
  };
  error?: string;
}

const EXPORT_RELATIONAL_PROJECTION = `
  id,
  machine_id,
  operator_id,
  supervisor_id,
  client_id,
  log_date,
  end_date,
  start_datetime,
  end_datetime,
  start_meter,
  end_meter,
  running_hours,
  start_time,
  end_time,
  overtime_hours,
  normal_working_hours,
  is_breakdown,
  shift,
  shift_code,
  location,
  remarks,
  breakdown_duration,
  breakdown_hours,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, hour_meter, status, manufacturer),
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, street, city, district, state, pincode, phone),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email)
`;

const EXPORT_FLAT_PROJECTION = `
  id,
  machine_id,
  operator_id,
  supervisor_id,
  client_id,
  log_date,
  start_meter,
  end_meter,
  running_hours,
  start_time,
  end_time,
  overtime_hours,
  normal_working_hours,
  is_breakdown,
  shift,
  shift_code,
  location,
  remarks,
  breakdown_duration,
  breakdown_hours,
  created_at
`;

/**
 * Calculates working hours for an individual shift log.
 */
function calculateShiftWorkHours(log: HourLogRecord): number {
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
}

/**
 * High-performance, unpaginated operational logs fetcher for mobile exports.
 * Mirrors the server-side export action with index-optimized scans.
 */
export async function fetchOperationsExportLogs(
  params: MobileExportLogsParams
): Promise<MobileExportLogsResult> {
  try {
    // 1. Resolve date boundaries
    let customStart = params.customStartDate || params.startDate;
    let customEnd = params.customEndDate || params.endDate;
    let resolvedMonth = params.month || 'all';

    if (params.month === 'today') {
      resolvedMonth = 'custom';
      customStart = getISTDateString();
      customEnd = getISTDateString();
    } else if (params.month === 'yesterday') {
      resolvedMonth = 'custom';
      customStart = addDaysToDateStr(getISTDateString(), -1);
      customEnd = addDaysToDateStr(getISTDateString(), -1);
    } else if (params.month === 'week') {
      resolvedMonth = 'custom';
      customStart = addDaysToDateStr(getISTDateString(), -7);
      customEnd = getISTDateString();
    } else if (params.month === 'month') {
      resolvedMonth = 'current';
    }

    const resolvedRange = resolveOperationsDateRange({
      month: resolvedMonth,
      customStart,
      customEnd,
      startDate: customStart,
      endDate: customEnd,
    });

    const sortAsc = params.sort !== 'date-desc';

    // 2. Query builder helper
    const buildExportQuery = (selectCols: string) => {
      let q = supabase
        .from('machine_hour_logs')
        .select(selectCols)
        .order('log_date', { ascending: sortAsc })
        .order('created_at', { ascending: sortAsc })
        .limit(5000);

      // Entity filter
      if (params.viewMode === 'operator') {
        const opId = params.operatorId || params.entityId;
        if (opId && opId !== 'all') {
          q = q.eq('operator_id', opId);
        }
      } else if (params.viewMode === 'machine') {
        const mId = params.machineId || params.entityId;
        if (mId && mId !== 'all') {
          q = q.eq('machine_id', mId);
        }
      } else if (params.viewMode === 'client') {
        const cId = params.clientId || params.entityId;
        if (cId && cId !== 'all') {
          q = q.eq('client_id', cId);
        }
        if (params.clientMachineId && params.clientMachineId !== 'all') {
          q = q.eq('machine_id', params.clientMachineId);
        }
        if (params.site && params.site !== 'all') {
          q = q.eq('location', params.site);
        }
      }

      // Condition filter
      if (params.condition === 'normal') {
        q = q.eq('is_breakdown', false);
      } else if (params.condition === 'breakdown') {
        q = q.eq('is_breakdown', true);
      }

      // Date range filter
      if (resolvedRange.startDate) {
        q = q.gte('log_date', resolvedRange.startDate);
      }
      if (resolvedRange.endDate) {
        if (resolvedRange.endOperator === 'lt') {
          q = q.lt('log_date', resolvedRange.endDate);
        } else {
          q = q.lte('log_date', resolvedRange.endDate);
        }
      }

      return q;
    };

    // 3. Execute Primary Relational Query
    let rawData: any[] = [];
    const primaryRes = await buildExportQuery(EXPORT_RELATIONAL_PROJECTION);

    if (!primaryRes.error && primaryRes.data) {
      rawData = primaryRes.data;
    } else {
      console.warn('[fetchOperationsExportLogs] Primary projection failed, using flat fallback:', primaryRes.error?.message);
      const fallbackRes = await buildExportQuery(EXPORT_FLAT_PROJECTION);
      if (!fallbackRes.error && fallbackRes.data) {
        rawData = fallbackRes.data;
      } else {
        throw fallbackRes.error || primaryRes.error;
      }
    }

    // 4. Format logs and apply search filter
    let formattedLogs: HourLogRecord[] = rawData.map((l: any) => {
      const clientData = Array.isArray(l.client) ? l.client[0] : l.client;
      return {
        ...l,
        machine_code: l.machine?.machine_id || l.machine_id || 'Equipment',
        client: clientData ? { ...clientData, name: clientData.company_name || clientData.client_name } : null,
      } as HourLogRecord;
    });

    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      formattedLogs = formattedLogs.filter((log) => {
        const mCode = (log.machine_code || '').toLowerCase();
        const mModel = (log.machine?.model || '').toLowerCase();
        const mSerial = (log.machine?.serial_number || '').toLowerCase();
        const opName = (log.operator?.full_name || '').toLowerCase();
        const cName = (log.client?.company_name || (log.client as any)?.name || '').toLowerCase();
        const loc = (log.location || '').toLowerCase();
        const rem = (log.remarks || '').toLowerCase();
        const dStr = (log.log_date || '').toLowerCase();

        return (
          mCode.includes(q) ||
          mModel.includes(q) ||
          mSerial.includes(q) ||
          opName.includes(q) ||
          cName.includes(q) ||
          loc.includes(q) ||
          rem.includes(q) ||
          dStr.includes(q)
        );
      });
    }

    // 5. Aggregate summary metrics
    let totalRunningHours = 0;
    let totalOtHours = 0;
    let totalBreakdowns = 0;
    let totalWorkingHours = 0;
    const loggedDates = new Set<string>();

    for (const log of formattedLogs) {
      const startMtr = Number(log.start_meter) || 0;
      const endMtr = Number(log.end_meter) || startMtr;
      const run = Number(log.running_hours) || Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
      totalRunningHours += run;
      totalOtHours += Number(log.overtime_hours) || 0;
      totalWorkingHours += calculateShiftWorkHours(log);
      if (log.is_breakdown) totalBreakdowns++;
      if (log.log_date) loggedDates.add(log.log_date.split('T')[0]);
    }

    return {
      success: true,
      logs: formattedLogs,
      totalCount: formattedLogs.length,
      summary: {
        totalRunningHours: Math.round(totalRunningHours * 10) / 10,
        totalOtHours: Math.round(totalOtHours * 10) / 10,
        totalBreakdowns,
        totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
        loggedDaysCount: loggedDates.size,
      },
    };
  } catch (err: any) {
    console.error('[fetchOperationsExportLogs] Query exception:', err);
    return {
      success: false,
      logs: [],
      totalCount: 0,
      summary: {
        totalRunningHours: 0,
        totalOtHours: 0,
        totalBreakdowns: 0,
        totalWorkingHours: 0,
        loggedDaysCount: 0,
      },
      error: err?.message || 'Failed to fetch operational export logs',
    };
  }
}
