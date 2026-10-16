// packages/utils/src/payroll.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOperatorSalary,
  calculatePayrollKpis,
  PAYROLL_CSV_HEADERS,
  formatPayrollCsvRow,
} from './payroll.ts';

test('calculateOperatorSalary computes accurate attended, overtime, and net pay', () => {
  const result = calculateOperatorSalary({
    basic_salary: 30000,
    working_days: 30,
    attended_days: 26,
    ot_days: 2,
    pl_adjusted: 1,
    night_travel_amount: 500,
    loan_deduction: 1000,
    advance_deduction: 500,
    paid_reach: 20000,
    total_pl_quota: 12,
    pl_used_as_on_date: 2,
  });

  // basic / working_days = 30000 / 30 = 1000/day
  // attended: 26 * 1000 = 26000
  assert.equal(result.attendedAmount, 26000);
  // plAmount: 1 * 1000 = 1000
  assert.equal(result.plAmount, 1000);
  // otAmount: 2 * 1000 = 2000
  assert.equal(result.otAmount, 2000);
  // totalEarned: attended + pl + nightTravel = 26000 + 1000 + 500 = 27500
  assert.equal(result.totalEarned, 27500);
  // grossPay: totalEarned + ot = 27500 + 2000 = 29500
  assert.equal(result.grossPay, 29500);
  // netPay: gross - (1000 loan + 500 advance) = 29500 - 1500 = 28000
  assert.equal(result.netPay, 28000);
  // balancePay: netPay - 20000 paid = 8000
  assert.equal(result.balancePay, 8000);
  // plBalance: 12 - (2 used + 1 adj) = 9
  assert.equal(result.plBalance, 9);
});

test('calculatePayrollKpis aggregates totals correctly', () => {
  const operators = [
    { gross_pay: 30000, net_pay: 28000, paid_reach: 20000, balance_pay: 8000, attended_days: 26, ot_days: 2, pl_adjusted: 1 },
    { gross_pay: 25000, net_pay: 24000, paid_reach: 24000, balance_pay: 0, attended_days: 24, ot_days: 0, pl_adjusted: 0 },
  ];

  const kpis = calculatePayrollKpis(operators);
  assert.equal(kpis.operatorCount, 2);
  assert.equal(kpis.totalGross, 55000);
  assert.equal(kpis.totalNet, 52000);
  assert.equal(kpis.totalPaid, 44000);
  assert.equal(kpis.totalBalance, 8000);
  assert.equal(kpis.totalAttendedDays, 50);
  assert.equal(kpis.totalOtDays, 2);
  assert.equal(kpis.totalPlAdjusted, 1);
});

test('formatPayrollCsvRow produces matching 32-column row', () => {
  const op = {
    sl_no: 1,
    full_name: 'Ramesh Kumar',
    doj: '2024-01-15',
    basic_salary: 28000,
    attended_days: 26,
    bank_account_number: '1234567890',
    bank_ifsc_code: 'SBIN0001234',
  };
  const row = formatPayrollCsvRow(op, 1);
  assert.equal(row.length, PAYROLL_CSV_HEADERS.length);
  assert.equal(row.length, 32);
  assert.equal(row[1], '"Ramesh Kumar"');
});
