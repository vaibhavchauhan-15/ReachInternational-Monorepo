/**
 * Reach International Mobile — Payroll Workflows Automated Verification Suite
 * Verifies UI Standardization, Typography Hierarchy, Responsive Sizing & Web Parity:
 * - Viewport containment (maxWidth: 1200, width: 100%, alignSelf: center)
 * - 4-Column responsive KPI Grid (Gross Payroll, Net Payable, Disbursed vs Unpaid, Attended & OT Days)
 * - Dynamic Month selection pills with strict Geist typography
 * - Filter strip with strict typography tokens and touch target ergonomics
 * - Results count row indicator with filtered states
 * - OperatorPayrollCard typography (0 variant="small", bold names, mono badges, status pills)
 * - Payout Status Badge row parity with web PayrollMobileCard
 * - PayrollSkeleton alignment (responsive 4-col KPIGrid, 38px action button skeletons)
 * - Modal responsive containment (maxWidth: 560) and touch targets (minHeight: 44)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

console.log('\n--- 1. Testing payroll.tsx Responsive Containment & Layout ---');
const payrollPath = path.join(__dirname, 'app/(app)/payroll.tsx');
const payrollContent = fs.readFileSync(payrollPath, 'utf8');

assert(
  payrollContent.includes("maxWidth: 1200") &&
  payrollContent.includes("alignSelf: 'center'"),
  'payroll.tsx enforces maxWidth: 1200 and alignSelf: center for wide/desktop viewports (1536x695)'
);

assert(
  !payrollContent.includes("marginHorizontal: 16, marginBottom: 12"),
  'payroll.tsx eradicated marginHorizontal: 16 double-indentation bug on SearchInput'
);

assert(
  payrollContent.includes("searchContainer: {") &&
  payrollContent.includes("width: '100%'"),
  'payroll.tsx defines clean searchContainer matching content width'
);

console.log('\n--- 2. Testing KPIGrid 4-Col Strip & Web Parity ---');
assert(
  payrollContent.includes('<KPIGrid columns={4}>'),
  'payroll.tsx renders KPIGrid with columns={4} for responsive 4-card layout'
);

assert(
  payrollContent.includes('label="Gross Payroll"') &&
  payrollContent.includes('label="Net Payable"') &&
  payrollContent.includes('label="Disbursed vs Unpaid"') &&
  payrollContent.includes('label="Attended & OT Days"'),
  'payroll.tsx renders all 4 canonical payroll KPIs matching web PayrollKPIStrip'
);

assert(
  payrollContent.includes('labelVariant="caption"') &&
  payrollContent.includes('valueVariant="title"') &&
  payrollContent.includes('valueWeight="bold"'),
  'payroll.tsx standardizes KPICard typography tokens (caption label, title bold value)'
);

console.log('\n--- 3. Testing Month Selector & Filter Strip Typography ---');
assert(
  payrollContent.includes('variant="caption"') &&
  payrollContent.includes('weight={active ? \'semibold\' : \'medium\'}'),
  'payroll.tsx month pills use variant="caption" and weight="semibold"/"medium"'
);

assert(
  payrollContent.includes('hitSlopToMin48'),
  'payroll.tsx month pills and filter chips enforce hitSlopToMin48 touch ergonomics'
);

assert(
  payrollContent.includes('resultsCountRow') &&
  payrollContent.includes('Showing') &&
  payrollContent.includes('operators'),
  'payroll.tsx renders live results count indicator above operator cards list'
);

console.log('\n--- 4. Testing OperatorPayrollCard Typography & Web Parity ---');
const cardPath = path.join(__dirname, 'components/payroll/OperatorPayrollCard.tsx');
const cardContent = fs.readFileSync(cardPath, 'utf8');

assert(
  !cardContent.includes('variant="small"'),
  'OperatorPayrollCard completely eradicated invalid variant="small" instances'
);

assert(
  cardContent.includes('variant="subheading"') &&
  cardContent.includes('weight="bold"') &&
  cardContent.includes('operator.full_name'),
  'OperatorPayrollCard standardizes operator full name to variant="subheading" weight="bold"'
);

assert(
  cardContent.includes('variant="mono"') &&
  cardContent.includes('weight="bold"') &&
  cardContent.includes('operator.sl_no'),
  'OperatorPayrollCard standardizes serial badge to variant="mono" weight="bold"'
);

assert(
  cardContent.includes('variant="heading"') &&
  cardContent.includes('weight="bold"') &&
  cardContent.includes('operator.net_pay'),
  'OperatorPayrollCard displays Net Pay in variant="heading" weight="bold"'
);

assert(
  cardContent.includes('statusRow') &&
  cardContent.includes('Disbursement Status:') &&
  cardContent.includes('<Badge'),
  'OperatorPayrollCard renders Disbursement Status badge row matching web PayrollMobileCard'
);

assert(
  cardContent.includes('Paid in Full') &&
  cardContent.includes('Partial (bal') &&
  cardContent.includes('Pending ('),
  'OperatorPayrollCard handles all 3 disbursement badge states (Paid, Partial, Pending)'
);

assert(
  cardContent.includes('minHeight: 38') &&
  cardContent.includes('hitSlopToMin48'),
  'OperatorPayrollCard footer buttons enforce minHeight: 38 with hitSlopToMin48 (>=44px touch ergonomics)'
);

console.log('\n--- 5. Testing PayrollSkeleton Alignment ---');
const skeletonPath = path.join(__dirname, 'components/payroll/PayrollSkeleton.tsx');
const skeletonContent = fs.readFileSync(skeletonPath, 'utf8');

assert(
  skeletonContent.includes('maxWidth: 1200') &&
  skeletonContent.includes("alignSelf: 'center'"),
  'PayrollSkeleton enforces maxWidth: 1200 and alignSelf: center matching payroll screen'
);

assert(
  skeletonContent.includes('<KPIGrid columns={4}>'),
  'PayrollSkeleton renders 4-column KPIGrid skeleton matching 4 KPI cards'
);

assert(
  skeletonContent.includes('height={38}'),
  'PayrollSkeleton aligns card action button skeletons to height 38'
);

console.log('\n--- 6. Testing Salary Slip & Edit Statement Modal Responsive Sizing ---');
assert(
  payrollContent.includes('maxWidth: 560') &&
  payrollContent.includes("alignSelf: 'center'"),
  'payroll.tsx modals enforce maxWidth: 560 and alignSelf: center to prevent wide viewport blowout'
);

assert(
  payrollContent.includes('variant="heading"') &&
  payrollContent.includes('weight="bold"') &&
  payrollContent.includes('Salary Slip'),
  'Salary Slip modal title standardized to variant="heading" weight="bold"'
);

assert(
  payrollContent.includes('variant="heading"') &&
  payrollContent.includes('weight="bold"') &&
  payrollContent.includes('Edit Salary Statement'),
  'Edit Statement modal title standardized to variant="heading" weight="bold"'
);

assert(
  payrollContent.includes('minHeight: 44'),
  'payroll.tsx modal inputs and action buttons enforce minHeight: 44 touch target ergonomics'
);

console.log(`\n========================================`);
console.log(`Payroll Verification: ${passCount} passed, ${failCount} failed`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
}
