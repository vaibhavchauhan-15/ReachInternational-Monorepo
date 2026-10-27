import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('🧪 Starting Running Logs Screen UI, Typography & Responsive Sizing Verification Suite...');

// 1. Verify RunningLogsScreen (running-logs.tsx)
const runningLogsPath = path.join(__dirname, 'app/(app)/running-logs.tsx');
const runningLogsContent = fs.readFileSync(runningLogsPath, 'utf8');

assert(
  runningLogsContent.includes('useWindowDimensions'),
  'running-logs.tsx imports and uses useWindowDimensions for responsive sizing'
);
assert(
  runningLogsContent.includes('const isWide = width > 640;'),
  'running-logs.tsx defines isWide responsive breakpoint'
);
assert(
  runningLogsContent.includes('segmentedToggleInnerWide'),
  'running-logs.tsx applies constrained width to SegmentedToggle on wide viewports'
);
assert(
  runningLogsContent.includes('resultsCountRow'),
  'running-logs.tsx renders resultsCountRow for clear results count feedback'
);
assert(
  runningLogsContent.includes("maxWidth: 1200"),
  'running-logs.tsx applies 1200px max content width for desktop/tablet viewports'
);
assert(
  runningLogsContent.includes("alignSelf: 'center'"),
  'running-logs.tsx centers content containers on wide viewports'
);

// 2. Verify RunningLogFilterPanel (RunningLogFilterPanel.tsx)
const filterPanelPath = path.join(__dirname, 'components/operations/RunningLogFilterPanel.tsx');
const filterPanelContent = fs.readFileSync(filterPanelPath, 'utf8');

assert(
  filterPanelContent.includes('useWindowDimensions'),
  'RunningLogFilterPanel.tsx uses useWindowDimensions for responsive column reflow'
);
assert(
  filterPanelContent.includes('isTablet') && filterPanelContent.includes('isDesktop'),
  'RunningLogFilterPanel.tsx calculates isTablet and isDesktop viewport tiers'
);
assert(
  filterPanelContent.includes('grid4Cols') && filterPanelContent.includes('grid2Cols'),
  'RunningLogFilterPanel.tsx defines 4-column desktop and 2-column tablet grid styles'
);
assert(
  filterPanelContent.includes('colQuarter') && filterPanelContent.includes('colHalf'),
  'RunningLogFilterPanel.tsx defines responsive column widths'
);
assert(
  filterPanelContent.includes('new Date().getFullYear()'),
  'RunningLogFilterPanel.tsx dynamically computes the current year label'
);

// 3. Verify RunningLogSummaryCard (RunningLogSummaryCard.tsx)
const summaryCardPath = path.join(__dirname, 'components/operations/RunningLogSummaryCard.tsx');
const summaryCardContent = fs.readFileSync(summaryCardPath, 'utf8');

assert(
  summaryCardContent.includes('useWindowDimensions'),
  'RunningLogSummaryCard.tsx uses useWindowDimensions for responsive KPI grid'
);
assert(
  summaryCardContent.includes('interpolate(progress.value, [0, 1], [0, 600])'),
  'RunningLogSummaryCard.tsx uses generous 600px maxHeight interpolation to prevent clipping'
);
assert(
  summaryCardContent.includes('UserCheck'),
  'RunningLogSummaryCard.tsx renders UserCheck icon for Work Hours metric'
);
assert(
  summaryCardContent.includes('RUN HOURS') && summaryCardContent.includes('WORK HOURS'),
  'RunningLogSummaryCard.tsx renders Run Hours and Work Hours metrics matching web'
);
assert(
  summaryCardContent.includes('LOGGED DAYS') && summaryCardContent.includes('BREAKDOWNS'),
  'RunningLogSummaryCard.tsx renders Logged Days and Breakdowns metrics matching web'
);
assert(
  summaryCardContent.includes('kpiCardHalf') && summaryCardContent.includes('kpiCardQuarter'),
  'RunningLogSummaryCard.tsx supports 2-col mobile and 4-col tablet/desktop KPI cards'
);
assert(
  summaryCardContent.includes('Linking.openURL'),
  'RunningLogSummaryCard.tsx supports direct phone call and email interactions'
);

// 4. Verify RunningLogMachineHeaderCard (RunningLogMachineHeaderCard.tsx)
const machineHeaderPath = path.join(__dirname, 'components/operations/RunningLogMachineHeaderCard.tsx');
const machineHeaderContent = fs.readFileSync(machineHeaderPath, 'utf8');

assert(
  machineHeaderContent.includes('variant="mono" weight="bold"'),
  'RunningLogMachineHeaderCard.tsx formats metrics with monospace bold telemetry text'
);
assert(
  machineHeaderContent.includes('DAYS:') && machineHeaderContent.includes('M/C RT:') && machineHeaderContent.includes('WH:'),
  'RunningLogMachineHeaderCard.tsx preserves DAYS, M/C RT, and WH metrics'
);
assert(
  machineHeaderContent.includes('Badge'),
  'RunningLogMachineHeaderCard.tsx renders equipment serial/code in a standardized Badge'
);

// 5. Verify RunningLogShiftCard (RunningLogShiftCard.tsx)
const shiftCardPath = path.join(__dirname, 'components/operations/RunningLogShiftCard.tsx');
const shiftCardContent = fs.readFileSync(shiftCardPath, 'utf8');

assert(
  shiftCardContent.includes('variant="mono" weight="bold"'),
  'RunningLogShiftCard.tsx formats M/C RT, WH, and B/D in monospace bold typography'
);
assert(
  shiftCardContent.includes('M/C RT') && shiftCardContent.includes('WH') && shiftCardContent.includes('B/D'),
  'RunningLogShiftCard.tsx preserves M/C RT, WH, and B/D metric containers'
);
assert(
  shiftCardContent.includes('hitSlop'),
  'RunningLogShiftCard.tsx enforces hitSlop for touch target ergonomics on interactive icons'
);
assert(
  shiftCardContent.includes('interpolate(remarksProgress.value, [0, 1], [0, 360])'),
  'RunningLogShiftCard.tsx expands remarks maxHeight to 360 to prevent clipping'
);

console.log('✅ All 24 assertions passed in Running Logs verification suite!');
