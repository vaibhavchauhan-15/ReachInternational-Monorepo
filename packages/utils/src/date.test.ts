// packages/utils/src/date.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateStr,
  getAssignmentDateKind,
  getAssignmentDateWindow,
  getISTDateString,
  isValidAssignmentDate,
  resolveAssignmentDate,
  ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS,
  ASSIGNMENT_DATE_WINDOW_PAST_DAYS,
} from './date.ts';

test('assignment window exposes exactly 9 calendar dates (7 past + today + tomorrow)', () => {
  const ref = '2026-11-21T10:00:00Z';
  const window = getAssignmentDateWindow(ref);
  assert.equal(ASSIGNMENT_DATE_WINDOW_PAST_DAYS, 7);
  assert.equal(ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS, 1);
  assert.equal(window.today, '2026-11-21');
  assert.equal(window.minDate, '2026-11-14');
  assert.equal(window.maxDate, '2026-11-22');
  assert.equal(window.pastDays, 7);
  assert.equal(window.futureDays, 1);
  assert.equal(window.dates.length, 9);
  assert.deepEqual(window.dates, [
    '2026-11-14',
    '2026-11-15',
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
    '2026-11-22',
  ]);
});

test('assignment window is IST-safe around the UTC/IST midnight boundary', () => {
  // 2026-11-21T19:00Z === 2026-11-22 00:30 IST -> today must be the 22nd
  assert.equal(getISTDateString('2026-11-21T19:00:00Z'), '2026-11-22');
  assert.equal(getAssignmentDateWindow('2026-11-21T19:00:00Z').today, '2026-11-22');
});

test('isValidAssignmentDate accepts the 7-past..tomorrow window and rejects the rest', () => {
  const ref = '2026-11-21T10:00:00Z';
  assert.equal(isValidAssignmentDate('2026-11-21', ref), true, 'today');
  assert.equal(isValidAssignmentDate('2026-11-20', ref), true, 'yesterday');
  assert.equal(isValidAssignmentDate('2026-11-14', ref), true, 'today-7');
  assert.equal(isValidAssignmentDate('2026-11-22', ref), true, 'tomorrow');
  assert.equal(isValidAssignmentDate('2026-11-13', ref), false, 'today-8 must be rejected');
  assert.equal(isValidAssignmentDate('2026-11-23', ref), false, 'today+2 must be rejected');
  assert.equal(isValidAssignmentDate('2026-11-28', ref), false, 'the old today+7 window is gone');
  assert.equal(isValidAssignmentDate('', ref), false);
  assert.equal(isValidAssignmentDate(null, ref), false);
  assert.equal(isValidAssignmentDate('not-a-date', ref), false);
  assert.equal(isValidAssignmentDate('2026-02-31', ref), false, 'impossible calendar date');
});

test('resolveAssignmentDate keeps in-window dates and falls back to today otherwise', () => {
  const ref = '2026-11-21T10:00:00Z';
  assert.equal(resolveAssignmentDate('2026-11-22', ref), '2026-11-22');
  assert.equal(resolveAssignmentDate('2026-11-19', ref), '2026-11-19');
  assert.equal(resolveAssignmentDate('2026-11-23', ref), '2026-11-21');
  assert.equal(resolveAssignmentDate('2026-11-13', ref), '2026-11-21');
  assert.equal(resolveAssignmentDate(undefined, ref), '2026-11-21');
});

test('getAssignmentDateKind classifies past / today / tomorrow', () => {
  const ref = '2026-11-21T10:00:00Z';
  assert.equal(getAssignmentDateKind('2026-11-21', ref), 'today');
  assert.equal(getAssignmentDateKind('2026-11-22', ref), 'tomorrow');
  assert.equal(getAssignmentDateKind('2026-11-20', ref), 'past');
  assert.equal(getAssignmentDateKind('2026-11-14', ref), 'past');
  assert.equal(getAssignmentDateKind('2026-11-23', ref), null, 'beyond tomorrow is not a plan slot');
  assert.equal(getAssignmentDateKind('2026-02-31', ref), null);
  assert.equal(getAssignmentDateKind(null, ref), null);
});

test('addDaysToDateStr crosses month and year boundaries safely', () => {
  assert.equal(addDaysToDateStr('2026-12-30', 3), '2027-01-02');
  assert.equal(addDaysToDateStr('2026-11-30', 1), '2026-12-01');
  assert.equal(addDaysToDateStr('2026-11-01', -1), '2026-10-31');
});
