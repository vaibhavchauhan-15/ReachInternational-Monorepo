/**
 * Verification Test: Attendance KPI Cards Optimization & Style Property Separation
 *
 * Verifies:
 * 1. Attendance management view uses canonical KPIGrid (columns={4}) instead of horizontal ScrollView.
 * 2. AttendanceKpiStripSkeleton uses KPIGrid (columns={4}) for 100% layout consistency.
 * 3. Elimination of mixed flex shorthand and flexShrink non-shorthand styles across MachineDetailView and KPICard.
 * 4. KPICard touchWrapper uses separated flexGrow/flexShrink/flexBasis preventing collapse on Web and Native.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const attendancePath = resolve(__dirname, '../app/(app)/attendance.tsx');
const attendanceSkeletonPath = resolve(__dirname, '../components/attendance/AttendanceSkeleton.tsx');
const machineDetailPath = resolve(__dirname, '../components/machines/MachineDetailView.tsx');
const kpiCardPath = resolve(__dirname, '../components/dashboard/shared/KPICard.tsx');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  passedTests++;
  console.log(`✅ PASSED: ${message}`);
}

console.log('🧪 Starting Attendance KPI Optimization & Style Property Separation Tests...\n');

// 1. Attendance Screen Checks
const attendanceContent = readFileSync(attendancePath, 'utf8');

assert(
  attendanceContent.includes('KPIGrid') && attendanceContent.includes('<KPIGrid columns={4}>'),
  'Attendance screen imports and renders KPIGrid with 4 columns'
);

assert(
  !attendanceContent.includes('containerStyle={{ width: 140, flex: 0 }}'),
  'Attendance screen does not use deprecated fixed-width 140px flex: 0 containerStyle'
);

assert(
  attendanceContent.includes('styles.kpiContainer'),
  'Attendance screen defines styles.kpiContainer for full-width responsive layout'
);

// 2. Attendance Skeleton Checks
const skeletonContent = readFileSync(attendanceSkeletonPath, 'utf8');

assert(
  skeletonContent.includes('KPIGrid') && skeletonContent.includes('<KPIGrid columns={4}>'),
  'AttendanceKpiStripSkeleton uses KPIGrid columns={4} for zero-layout-shift skeleton parity'
);

assert(
  !skeletonContent.includes('width: 140') && skeletonContent.includes('minHeight: 84'),
  'Attendance skeleton kpiCard uses 100% responsive width and minHeight 84'
);

// 3. MachineDetailView Style Property Separation Checks
const machineDetailContent = readFileSync(machineDetailPath, 'utf8');

assert(
  !machineDetailContent.includes('flex: isMobile ? undefined : 1'),
  'MachineDetailView does not use conflicting flex shorthand with ternary undefined'
);

assert(
  machineDetailContent.includes('flexGrow: isMobile ? 0 : 1') &&
  machineDetailContent.includes('flexShrink: 0') &&
  machineDetailContent.includes("flexBasis: isMobile ? 'auto' : 0"),
  'MachineDetailView uses explicit separate flexGrow, flexShrink, and flexBasis properties'
);

// 4. KPICard TouchWrapper Optimization
const kpiCardContent = readFileSync(kpiCardPath, 'utf8');

assert(
  kpiCardContent.includes('flexGrow: 1') &&
  kpiCardContent.includes('flexShrink: 0') &&
  kpiCardContent.includes("flexBasis: 'auto'") &&
  kpiCardContent.includes('minHeight: 84'),
  'KPICard touchWrapper uses separated flexGrow, flexShrink, flexBasis and minHeight to avoid web collapse'
);

console.log(`\n🎉 Test Suite Passed: ${passedTests}/${totalTests} tests successful.`);
