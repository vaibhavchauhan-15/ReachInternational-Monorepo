"use server";

import {
  getHRPayrollData as getPayrollData,
  updateOperatorRates as updateRates,
  bulkUpdateOperatorRates as bulkUpdateRates,
} from "./payroll";
import type { HRPayrollSummary } from "@/lib/types/database";

/**
 * @deprecated Use `getHRPayrollData` from `@/app/actions/payroll` instead.
 */
export async function getHRPayrollData(payrollMonth?: string): Promise<HRPayrollSummary> {
  return getPayrollData(payrollMonth);
}

/**
 * @deprecated Use `updateOperatorRates` from `@/app/actions/payroll` instead.
 */
export async function updateOperatorRates(
  operatorId: string,
  dailyRate: number,
  otHourlyRate: number
): Promise<{ success: boolean; error?: string }> {
  return updateRates(operatorId, dailyRate, otHourlyRate);
}

/**
 * @deprecated Use `bulkUpdateOperatorRates` from `@/app/actions/payroll` instead.
 */
export async function bulkUpdateOperatorRates(
  updates: Array<{ operatorId: string; dailyRate: number; otHourlyRate: number }>
): Promise<{ success: boolean; count: number; error?: string }> {
  return bulkUpdateRates(updates);
}
