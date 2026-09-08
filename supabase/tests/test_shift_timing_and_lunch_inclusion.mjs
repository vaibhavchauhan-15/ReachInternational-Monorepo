import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeShiftTiming,
  parseProfileShiftTime,
  formatTo12Hour,
  getISTDateString,
} from '../../packages/utils/src/date.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTestSuite() {
  console.log('=================================================================');
  console.log('🚀 RUNNING AUTOMATED TEST SUITE: SHIFT TIMING & LUNCH INCLUSION');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extraInfo}`);
      failed++;
    }
  }

  // --- SUITE 1: 6:00 AM to 2:00 PM Standard 8-Hour Shift (Zero Lunch Deduction) ---
  console.log('--- SUITE 1: Standard 8-Hour Shift (06:00 AM - 02:00 PM) ---');
  const stdResult = computeShiftTiming({
    startDate: '2026-09-08',
    startTime: '06:00 AM',
    endDate: '2026-09-08',
    endTime: '02:00 PM',
  });

  assert(stdResult.isValid === true, 'Shift is marked valid');
  assert(stdResult.durationHours === 8.0, 'Shift total duration is 8.0 hours (was 8.0)', `actual: ${stdResult.durationHours}`);
  assert(stdResult.durationFormatted === '8h 00m', 'Formatted duration is 8h 00m', `actual: ${stdResult.durationFormatted}`);
  assert(stdResult.breakHours === 0.0, 'Break hours is 0.0 (no -1h lunch deduction)', `actual: ${stdResult.breakHours}`);
  assert(
    stdResult.normalWorkingHours === 8.0,
    'Normal working hours is exactly 8.0 hours (previously 7.0h with -1h lunch deduction)',
    `actual: ${stdResult.normalWorkingHours}`
  );
  assert(stdResult.overtimeHours === 0.0, 'Overtime hours is 0.0 hours', `actual: ${stdResult.overtimeHours}`);
  assert(stdResult.isOvernight === false, 'Shift is correctly flagged as day shift');

  // --- SUITE 2: 10-Hour Extended Shift with Auto-Overtime ---
  console.log('\n--- SUITE 2: 10-Hour Extended Shift (06:00 AM - 04:00 PM) ---');
  const extResult = computeShiftTiming({
    startDate: '2026-09-08',
    startTime: '06:00 AM',
    endDate: '2026-09-08',
    endTime: '04:00 PM',
  });

  assert(extResult.isValid === true, '10h shift is valid');
  assert(extResult.durationHours === 10.0, 'Duration is 10.0 hours', `actual: ${extResult.durationHours}`);
  assert(extResult.overtimeHours === 2.0, 'Auto overtime starts after 8.0h (10h - 8h = 2.0h)', `actual: ${extResult.overtimeHours}`);
  assert(extResult.normalWorkingHours === 8.0, 'Normal working hours is capped at 8.0h', `actual: ${extResult.normalWorkingHours}`);

  // --- SUITE 3: Short Shift (06:00 AM - 12:00 PM, 6 hours) ---
  console.log('\n--- SUITE 3: Short Shift (06:00 AM - 12:00 PM, 6 hours) ---');
  const shortResult = computeShiftTiming({
    startDate: '2026-09-08',
    startTime: '06:00 AM',
    endDate: '2026-09-08',
    endTime: '12:00 PM',
  });

  assert(shortResult.isValid === true, '6h shift is valid');
  assert(shortResult.durationHours === 6.0, 'Duration is 6.0 hours', `actual: ${shortResult.durationHours}`);
  assert(shortResult.normalWorkingHours === 6.0, 'Normal working hours is 6.0h (no -1h deduction to 5h)', `actual: ${shortResult.normalWorkingHours}`);
  assert(shortResult.overtimeHours === 0.0, 'Overtime is 0.0h');

  // --- SUITE 4: Overnight Shift (10:00 PM - 06:00 AM, 8 hours) ---
  console.log('\n--- SUITE 4: Overnight Shift (10:00 PM - 06:00 AM) ---');
  const nightResult = computeShiftTiming({
    startDate: '2026-09-08',
    startTime: '10:00 PM',
    endTime: '06:00 AM',
  });

  assert(nightResult.isValid === true, 'Night shift is valid');
  assert(nightResult.isOvernight === true, 'Auto-detected overnight shift');
  assert(nightResult.resolvedEndDate === '2026-09-09', 'Auto-derived next day endDate');
  assert(nightResult.durationHours === 8.0, 'Duration is 8.0 hours');
  assert(nightResult.normalWorkingHours === 8.0, 'Normal working hours is 8.0 hours (no -1h lunch deduction)');
  assert(nightResult.overtimeHours === 0.0, 'Overtime is 0.0 hours');

  // --- SUITE 5: Manual Overtime Setting ---
  console.log('\n--- SUITE 5: Manual Overtime (06:00 AM - 02:00 PM with 1.5h OT) ---');
  const manualOtResult = computeShiftTiming({
    startDate: '2026-09-08',
    startTime: '06:00 AM',
    endDate: '2026-09-08',
    endTime: '02:00 PM',
    manualOvertime: 1.5,
  });

  assert(manualOtResult.overtimeHours === 1.5, 'Manual overtime preserved as 1.5h');
  assert(manualOtResult.normalWorkingHours === 6.5, 'Normal working hours is duration (8.0h) - manual OT (1.5h) = 6.5h', `actual: ${manualOtResult.normalWorkingHours}`);

  // --- SUITE 6: Supabase User Profile Shift Time Resolution ---
  console.log('\n--- SUITE 6: Supabase User Profile Shift Time Resolution ---');
  
  // Case A: User with shift_start_time and shift_end_time
  const userA = {
    id: 'user-1',
    shift_start_time: '08:00:00',
    shift_end_time: '17:00:00',
    shift_time: null,
  };
  const resolvedStartA = formatTo12Hour(userA.shift_start_time);
  const resolvedEndA = formatTo12Hour(userA.shift_end_time);
  assert(resolvedStartA === '08:00 AM', 'User with shift_start_time resolves 08:00 AM', `actual: ${resolvedStartA}`);
  assert(resolvedEndA === '05:00 PM', 'User with shift_end_time resolves 05:00 PM', `actual: ${resolvedEndA}`);

  // Case B: User with shift_time text (e.g. "08:00 AM - 08:00 PM")
  const userB = {
    id: 'user-2',
    shift_time: '08:00 AM - 08:00 PM',
  };
  const parsedB = parseProfileShiftTime(userB.shift_time);
  assert(parsedB !== null, 'Profile shift_time parsed successfully');
  assert(formatTo12Hour(parsedB?.startTime) === '08:00 AM', 'Parsed start time is 08:00 AM', `actual: ${formatTo12Hour(parsedB?.startTime)}`);
  assert(formatTo12Hour(parsedB?.endTime) === '08:00 PM', 'Parsed end time is 08:00 PM', `actual: ${formatTo12Hour(parsedB?.endTime)}`);

  // Case C: User with 24-hour shift_time (e.g. "06:00:00 - 14:00:00")
  const userC = {
    id: 'user-3',
    shift_time: '06:00:00 - 14:00:00',
  };
  const parsedC = parseProfileShiftTime(userC.shift_time);
  assert(parsedC !== null, '24-hour profile shift_time parsed successfully');
  assert(formatTo12Hour(parsedC?.startTime) === '06:00 AM', 'Parsed start time is 06:00 AM');
  assert(formatTo12Hour(parsedC?.endTime) === '02:00 PM', 'Parsed end time is 02:00 PM');

  console.log('\n=================================================================');
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
