/**
 * Canonical Payroll Calculations & Schema Definitions
 * Shared across Next.js Web and Expo Native Mobile.
 */

export interface OperatorSalaryInput {
  basic_salary?: number | string | null;
  daily_rate?: number | string | null;
  working_days?: number | string | null;
  attended_days?: number | string | null;
  work_days?: number | string | null;
  ot_days?: number | string | null;
  pl_adjusted?: number | string | null;
  night_travel_amount?: number | string | null;
  loan_deduction?: number | string | null;
  additional_balance_salary?: number | string | null;
  advance_deduction?: number | string | null;
  other_deductions?: number | string | null;
  pl_used_as_on_date?: number | string | null;
  paid_reach?: number | string | null;
  paid_ss?: number | string | null;
  paid_quess?: number | string | null;
  total_pl_quota?: number | string | null;
}

export interface OperatorSalaryComputed {
  totalDays: number;
  attendedAmount: number;
  plAmount: number;
  otAmount: number;
  totalEarned: number;
  grossPay: number;
  netPay: number;
  balancePay: number;
  plBalance: number;
  totalPay: number;
  regularPay: number;
  otPay: number;
  // Compatibility aliases
  attendedAmt: number;
  plAmt: number;
  otAmt: number;
  balance: number;
}

/**
 * Calculates complete operator salary breakdown according to industrial payroll rules.
 */
export function calculateOperatorSalary(data: OperatorSalaryInput): OperatorSalaryComputed {
  const basic = Number(data.basic_salary) || (Number(data.daily_rate) ? Number(data.daily_rate) * 30 : 28000);
  const wd = Math.max(1, Number(data.working_days) || 30);
  const ad = Number(data.attended_days) || Number(data.work_days) || 0;
  const otDays = Number(data.ot_days) || 0;
  const plAdj = Number(data.pl_adjusted) || 0;
  const ntAmt = Number(data.night_travel_amount) || 0;
  const loan = Number(data.loan_deduction) || 0;
  const addBal = Number(data.additional_balance_salary) || 0;
  const advDed = Number(data.advance_deduction) || 0;
  const otherDed = Number(data.other_deductions) || 0;
  const plUsed = Number(data.pl_used_as_on_date) || 0;
  const reach = Number(data.paid_reach) || 0;
  const ss = Number(data.paid_ss) || 0;
  const quess = Number(data.paid_quess) || 0;
  const totalPl = Number(data.total_pl_quota) || 12;

  const totalDays = Math.round((ad + plAdj + otDays) * 10) / 10;
  const attendedAmount = Math.round(((basic / wd) * ad) * 100) / 100;
  const plAmount = Math.round(((basic / wd) * plAdj) * 100) / 100;
  const otAmount = Math.round(((basic / wd) * otDays) * 100) / 100;
  const totalEarned = Math.round((attendedAmount + plAmount + ntAmt) * 100) / 100;
  const grossPay = Math.round((totalEarned + otAmount + addBal) * 100) / 100;
  const netPay = Math.round((grossPay - (loan + advDed + otherDed)) * 100) / 100;
  const balancePay = Math.round((netPay - (reach + ss + quess)) * 100) / 100;
  const plBalance = Math.max(0, totalPl - (plUsed + plAdj));

  return {
    totalDays,
    attendedAmount,
    plAmount,
    otAmount,
    totalEarned,
    grossPay,
    netPay,
    balancePay,
    plBalance,
    totalPay: grossPay,
    regularPay: attendedAmount + plAmount,
    otPay: otAmount,
    attendedAmt: attendedAmount,
    plAmt: plAmount,
    otAmt: otAmount,
    balance: balancePay,
  };
}

export interface PayrollSummaryKpis {
  operatorCount: number;
  totalGross: number;
  totalNet: number;
  totalPaid: number;
  totalBalance: number;
  totalAttendedDays: number;
  totalOtDays: number;
  totalPlAdjusted: number;
}

/**
 * Calculates aggregate summary KPIs across an array of operators.
 */
export function calculatePayrollKpis(operators: Array<Record<string, any>>): PayrollSummaryKpis {
  let totalGross = 0;
  let totalNet = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  let totalAttendedDays = 0;
  let totalOtDays = 0;
  let totalPlAdjusted = 0;

  for (const op of operators) {
    totalGross += Number(op.gross_pay) || Number(op.total_pay) || 0;
    totalNet += Number(op.net_pay) || Number(op.total_pay) || 0;
    totalPaid += (Number(op.paid_reach) || 0) + (Number(op.paid_ss) || 0) + (Number(op.paid_quess) || 0);
    totalBalance += Number(op.balance_pay) || 0;
    totalAttendedDays += Number(op.attended_days) || Number(op.work_days) || 0;
    totalOtDays += Number(op.ot_days) || 0;
    totalPlAdjusted += Number(op.pl_adjusted) || 0;
  }

  return {
    operatorCount: operators.length,
    totalGross: Math.round(totalGross),
    totalNet: Math.round(totalNet),
    totalPaid: Math.round(totalPaid),
    totalBalance: Math.round(totalBalance),
    totalAttendedDays: Math.round(totalAttendedDays * 10) / 10,
    totalOtDays: Math.round(totalOtDays * 10) / 10,
    totalPlAdjusted: Math.round(totalPlAdjusted * 10) / 10,
  };
}

/**
 * Exact 32 Excel Reference CSV Header definitions matching Reach International payroll sheets.
 */
export const PAYROLL_CSV_HEADERS = [
  "SL NO",
  "NAME",
  "DOJ",
  "BASIC",
  "EARNED",
  "W/D",
  "A/D",
  "OT days",
  "PL ADJUSTED",
  "Total Days",
  "AMOUNT",
  "PL AMT.",
  "N/T",
  "Amt",
  "TOTAL",
  "Loan",
  "Add Bal Salary",
  "ADV./Other Deduction",
  "ADV. BAL.",
  "Dedu",
  "PL Use as on date",
  "OT AMT",
  "Gross/Pay",
  "Net/Pay",
  "PAID REACH",
  "S&S",
  "QUESS",
  "BALANCE",
  "TOTAL PL",
  "PL BALANCE",
  "AC NO",
  "IFSC CODE",
] as const;

/**
 * Serializes a single operator row to CSV values matching PAYROLL_CSV_HEADERS.
 */
export function formatPayrollCsvRow(op: Record<string, any>, slNo: number): string[] {
  return [
    String(op.sl_no || slNo),
    `"${(op.full_name || "").replace(/"/g, '""')}"`,
    `"${op.doj || ""}"`,
    String(op.basic_salary || 0),
    String(op.earned_basic || op.basic_salary || 0),
    String(op.working_days || 30),
    String(op.attended_days || op.work_days || 0),
    String(op.ot_days || 0),
    String(op.pl_adjusted || 0),
    String(op.total_days || 0),
    String(op.attended_amount || 0),
    String(op.pl_amount || 0),
    String(op.night_travel_days || 0),
    String(op.night_travel_amount || 0),
    String(op.total_earned || 0),
    String(op.loan_deduction || 0),
    String(op.additional_balance_salary || 0),
    String(op.advance_deduction || 0),
    String(op.advance_balance || 0),
    String(op.other_deductions || 0),
    String(op.pl_used_as_on_date || 0),
    String(op.ot_amount || 0),
    String(op.gross_pay || op.total_pay || 0),
    String(op.net_pay || op.total_pay || 0),
    String(op.paid_reach || 0),
    String(op.paid_ss || 0),
    String(op.paid_quess || 0),
    String(op.balance_pay || 0),
    String(op.total_pl_quota || 12),
    String(op.pl_balance || 12),
    `"${op.bank_account_number || ""}"`,
    `"${op.bank_ifsc_code || ""}"`,
  ];
}
