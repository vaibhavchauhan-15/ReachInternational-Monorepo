import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatBreakdownMinutes,
  parseBreakdownDetails,
  computeBreakdownDuration,
  parseBreakdownString,
} from '../../packages/utils/src/index.ts';

test('formatBreakdownMinutes formats duration accurately', () => {
  assert.equal(formatBreakdownMinutes(0), '0h');
  assert.equal(formatBreakdownMinutes(15), '15m');
  assert.equal(formatBreakdownMinutes(36), '36m');
  assert.equal(formatBreakdownMinutes(60), '1h');
  assert.equal(formatBreakdownMinutes(90), '1h 30m');
  assert.equal(formatBreakdownMinutes(125), '2h 5m');
  assert.equal(formatBreakdownMinutes(-5), '0h');
});

test('parseBreakdownDetails resolves bulk-imported log with dedicated columns and clean remarks', () => {
  const bulkImportedLog = {
    id: '1cf9368a-e119-4128-94f0-a294aac5adf5',
    log_date: '2026-11-24',
    shift: 'Shift B',
    shift_code: 'B',
    is_breakdown: true,
    breakdown_start_time: '18:48:00',
    breakdown_end_time: '19:24:00',
    breakdown_duration: '0h 36m',
    breakdown_hours: 0.6,
    breakdown_minutes: 36,
    remarks: 'Electrical fault caused downtime; checked and restarted.',
  };

  const details = parseBreakdownDetails(bulkImportedLog);
  assert.equal(details.timingRange, '06:48PM-07:24PM');
  assert.equal(details.durationRaw, '36m');
  assert.equal(details.duration, '(36m)');
  assert.equal(details.displayText, '06:48PM-07:24PM (36m)');
});

test('parseBreakdownDetails resolves manual entry with legacy bracketed remarks', () => {
  const manualLegacyLog = {
    id: 'legacy-log-1',
    log_date: '2026-09-28',
    shift: 'Shift A',
    shift_code: 'A',
    is_breakdown: true,
    breakdown_start_time: null,
    breakdown_end_time: null,
    breakdown_duration: null,
    breakdown_hours: 1,
    breakdown_minutes: null,
    remarks: '[Breakdown Duration: 11:00 AM - 12:00 PM (60min)] Bucket cylinder seal replacement.',
  };

  const details = parseBreakdownDetails(manualLegacyLog);
  assert.equal(details.timingRange, '11:00AM-12:00PM');
  assert.equal(details.durationRaw, '60min');
  assert.equal(details.duration, '(60min)');
  assert.equal(details.displayText, '11:00AM-12:00PM (60min)');
});

test('computeBreakdownDuration handles 18:48:00 to 19:24:00 cleanly', () => {
  const stats = computeBreakdownDuration('18:48:00', '19:24:00');
  assert.equal(stats.isValid, true);
  assert.equal(stats.totalMinutes, 36);
  assert.equal(stats.durationDecimalHours, 0.6);
  assert.equal(formatBreakdownMinutes(stats.totalMinutes), '36m');
});
