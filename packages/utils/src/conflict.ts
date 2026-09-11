/**
 * ServiceCentric Shared Utilities — Overtime Shift Conflict Parser & Warning Generator
 * Converts raw database conflict reason codes (e.g. "overtime_overlaps_assignment:RI-MC-0012")
 * into human-readable titles, severity ratings, compliance risk advisories, and supervisor resolution guidance.
 */

import { formatShiftTimingRange, parseTimeToMinutes } from './date';

export interface ConflictLogMeta {
  machineCode?: string;
  machineModel?: string;
  operatorName?: string;
  startTime?: string | null;
  endTime?: string | null;
  runningHours?: number | null;
  overtimeHours?: number | null;
  logDate?: string | null;
}

export interface DetailedConflictWarning {
  /** Concise, high-contrast title (e.g. "Shift Overlap with RI-MC-0012") */
  title: string;
  /** High-impact badge tag (e.g. "DUAL MACHINE CUSTODY CONFLICT") */
  badgeText: string;
  /** Severity rating */
  severity: 'high' | 'medium';
  /** Primary human-readable narrative explanation */
  description: string;
  /** Extracted conflicting machine code, if present */
  conflictingEntity: string | null;
  /** Formatted overtime string, e.g. "+2.5 hrs OT" */
  overtimeHoursText: string | null;
  /** Specific operational and compliance risk warnings */
  bulletWarnings: string[];
  /** Concrete guidance on resolving the conflict */
  resolutionGuidance: {
    acknowledgeAdvice: string;
    adjustAdvice: string;
  };
}

/**
 * Parses raw conflict reasons into structured, detailed warning objects.
 */
export function parseConflictReason(
  reason?: string | null,
  meta?: ConflictLogMeta
): DetailedConflictWarning {
  const raw = (reason || '').trim();
  const ot = meta?.overtimeHours ?? 0;
  const otText = ot > 0 ? `+${ot} hrs OT` : null;
  const timings = meta?.startTime && meta?.endTime
    ? formatShiftTimingRange(meta.startTime, meta.endTime)
    : null;

  // 1. Check for "overtime_overlaps_assignment:<machine_code>" (from submit_operator_hour_log_atomic)
  const overlapMatch = raw.match(/^overtime_overlaps_assignment:(.+)$/i);
  if (overlapMatch) {
    const conflictingMachine = overlapMatch[1].trim();
    return {
      title: `Shift Overlap with ${conflictingMachine}`,
      badgeText: 'DUAL MACHINE CUSTODY CONFLICT',
      severity: 'high',
      conflictingEntity: conflictingMachine,
      overtimeHoursText: otText,
      description: `Operator logged ${otText ? `${otText} ` : ''}hours${
        timings ? ` (${timings})` : ''
      } that extend past their scheduled shift and collide with active roster operations on equipment ${conflictingMachine}.`,
      bulletWarnings: [
        `Dual Equipment Custody: Operator cannot operate multiple industrial machines simultaneously.`,
        `Billing Concurrency: Overlapping active hours risk double-charging clients across both machines.`,
        `Shift Handover Violation: Extended overtime intrudes into the operational window of ${conflictingMachine}.`,
      ],
      resolutionGuidance: {
        acknowledgeAdvice: `If the operator verified they were physically operating this equipment during authorized emergency field work, choose "Acknowledge" to approve the recorded hours.`,
        adjustAdvice: `If the operator entered an incorrect departure time or forgot to clock out, choose "Adjust Time" to trim the end time to the scheduled shift boundary.`,
      },
    };
  }

  // 2. Check for exclusion / assignment collisions ("already assigned to ... during an overlapping shift window")
  if (
    raw.includes('already assigned to') ||
    raw.includes('SHIFT_OVERLAP_CONFLICT') ||
    raw.includes('overlapping shift window')
  ) {
    // Attempt to extract machine code if present
    const mMatch = raw.match(/assigned to ([A-Z0-9_\-]+)/i);
    const conflictingMachine = mMatch ? mMatch[1] : null;

    return {
      title: conflictingMachine
        ? `Roster Collision with ${conflictingMachine}`
        : 'Operator Schedule Overlap Conflict',
      badgeText: 'SCHEDULE COLLISION',
      severity: 'high',
      conflictingEntity: conflictingMachine,
      overtimeHoursText: otText,
      description: `This operator already has an active shift assignment${
        conflictingMachine ? ` on ${conflictingMachine}` : ''
      } during an overlapping time window.`,
      bulletWarnings: [
        `Schedule Collision: The requested shift overlaps with another active machine assignment.`,
        `Single-Operator Exclusivity: Industrial safety policy requires one operator per active machine.`,
      ],
      resolutionGuidance: {
        acknowledgeAdvice: `Relieve the operator from the other machine assignment before assigning them here.`,
        adjustAdvice: `Adjust the shift start and end times so they do not overlap with existing roster hours.`,
      },
    };
  }

  // 3. Check for maximum operators reached
  if (raw.includes('MAX_OPERATORS_REACHED') || raw.includes('maximum capacity of 3')) {
    return {
      title: 'Maximum Shift Capacity Reached (3/3)',
      badgeText: 'CAPACITY LIMIT EXCEEDED',
      severity: 'medium',
      conflictingEntity: meta?.machineCode || null,
      overtimeHoursText: null,
      description: `This machine already has the maximum allowable capacity of 3 active operators assigned to its shift roster.`,
      bulletWarnings: [
        `Capacity Cap: Machine shift roster supports a maximum of 3 active operators (one per 8-hour shift slot).`,
        `Over-assignment: Additional assignments cannot be added without relieving an existing active operator.`,
      ],
      resolutionGuidance: {
        acknowledgeAdvice: `End an inactive or completed operator assignment in the roster before adding a new one.`,
        adjustAdvice: `Reassign an existing operator slot rather than creating a new concurrent assignment.`,
      },
    };
  }

  // 4. General overtime overrun fallback
  return {
    title: 'Overtime Shift Window Conflict',
    badgeText: 'SHIFT OVERRUN CONFLICT',
    severity: 'medium',
    conflictingEntity: null,
    overtimeHoursText: otText,
    description: `Operator recorded hours${timings ? ` (${timings})` : ''} that exceeded the scheduled shift window${
      ot > 0 ? ` by ${ot} hours of overtime` : ''
    } and overlapped with subsequent machine shift operations.`,
    bulletWarnings: [
      `Operational Overrun: Operating hours extended past the scheduled shift handover time.`,
      `Shift Boundary Collision: Overtime hours intrude into the following shift slot.`,
    ],
    resolutionGuidance: {
      acknowledgeAdvice: `Acknowledge if the overtime was authorized field work to keep recorded hours intact for billing and payroll.`,
      adjustAdvice: `Adjust end time to trim unauthorized overtime and align with the approved shift window.`,
    },
  };
}

/**
 * Live recalculation helper for adjusted shift end times.
 * Computes the newly adjusted operating hours and overtime hours.
 */
export function calculateAdjustedHours(
  startTimeStr?: string | null,
  adjustedEndTimeStr?: string | null,
  standardShiftDurationHours: number = 8.0
): {
  valid: boolean;
  runningHours: number;
  overtimeHours: number;
  normalHours: number;
  message: string;
} {
  if (!startTimeStr || !adjustedEndTimeStr) {
    return {
      valid: false,
      runningHours: 0,
      overtimeHours: 0,
      normalHours: 0,
      message: 'Start time and adjusted end time are required.',
    };
  }

  const sMin = parseTimeToMinutes(startTimeStr);
  const eMin = parseTimeToMinutes(adjustedEndTimeStr);

  if (sMin === null || eMin === null) {
    return {
      valid: false,
      runningHours: 0,
      overtimeHours: 0,
      normalHours: 0,
      message: 'Invalid time format. Use 12-hour format (e.g. 04:00 PM).',
    };
  }

  let durationMinutes = eMin - sMin;
  if (durationMinutes <= 0) {
    // Crosses midnight
    durationMinutes += 1440;
  }

  const runningHours = Math.round((durationMinutes / 60) * 10) / 10;
  const normalHours = Math.min(runningHours, standardShiftDurationHours);
  const overtimeHours = Math.max(0, Math.round((runningHours - normalHours) * 10) / 10);

  return {
    valid: true,
    runningHours,
    overtimeHours,
    normalHours,
    message: `New operating duration: ${runningHours} hrs (${overtimeHours > 0 ? `+${overtimeHours} hrs OT` : 'No overtime'})`,
  };
}
