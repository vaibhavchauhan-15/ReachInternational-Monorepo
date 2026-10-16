// packages/utils/src/shift-overlap.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shiftToMinuteRanges,
  doRangesOverlap,
  checkShiftIntervalOverlap,
} from './shift-overlap.ts';

test('shiftToMinuteRanges normal day shift', () => {
  const ranges = shiftToMinuteRanges('08:00', '16:00');
  assert.deepEqual(ranges, [[480, 960]]);
});

test('shiftToMinuteRanges overnight shift crosses midnight', () => {
  const ranges = shiftToMinuteRanges('20:00', '06:00');
  // 20:00 is 1200 mins; 06:00 is 360 mins
  assert.deepEqual(ranges, [[1200, 1440], [0, 360]]);
});

test('doRangesOverlap detects disjoint non-overlapping shifts', () => {
  const shiftA = shiftToMinuteRanges('08:00', '16:00');
  const shiftB = shiftToMinuteRanges('16:00', '23:00');
  assert.equal(doRangesOverlap(shiftA, shiftB), false);
});

test('doRangesOverlap detects partial overlapping shifts', () => {
  const shiftA = shiftToMinuteRanges('08:00', '16:00');
  const shiftB = shiftToMinuteRanges('14:00', '22:00');
  assert.equal(doRangesOverlap(shiftA, shiftB), true);
});

test('checkShiftIntervalOverlap detects overnight collision', () => {
  const nightShift = { start: '22:00', end: '06:00' };
  const morningShift = { start: '05:00', end: '13:00' };
  assert.equal(checkShiftIntervalOverlap(nightShift, morningShift), true);
});

test('checkShiftIntervalOverlap returns false for safe shifts', () => {
  const morning = { start: '06:00', end: '14:00' };
  const evening = { start: '14:00', end: '22:00' };
  assert.equal(checkShiftIntervalOverlap(morning, evening), false);
});
