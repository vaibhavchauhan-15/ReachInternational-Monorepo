"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { CACHE_TAGS } from "@/lib/cache";
import type { HRPayrollSummary } from "@/lib/types/database";

const ALLOWED_ROLES = ["super_admin", "admin", "hr"] as const;

/**
 * Fetches the HR payroll summary for a given month.
 * Target date represents the payroll run month (e.g., '2026-09-01').
 * Payroll formula:
 *   - Regular work days: from previous month (e.g., Aug 1 - Aug 31)
 *   - Overtime hours: from 2 months prior (e.g., Jul 1 - Jul 31) due to client site confirmation lag.
 */
export async function getHRPayrollData(payrollMonth?: string): Promise<HRPayrollSummary> {
  await requireRole(...ALLOWED_ROLES);
  const supabase = await createSupabaseServerClient();

  // Standardize target date string to first of month (YYYY-MM-01)
  let targetDate: string;
  if (payrollMonth && /^\d{4}-\d{2}/.test(payrollMonth)) {
    const parts = payrollMonth.split("-");
    targetDate = `${parts[0]}-${parts[1].padStart(2, "0")}-01`;
  } else {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    targetDate = `${year}-${month}-01`;
  }

  const { data, error } = await supabase.rpc("get_hr_payroll_summary", {
    p_payroll_month: targetDate,
  });

  if (error) {
    console.error("[getHRPayrollData] Error calling get_hr_payroll_summary:", error);
    throw new Error(error.message || "Failed to load payroll data");
  }

  return (data as unknown as HRPayrollSummary) || {
    payrollMonth: targetDate.slice(0, 7),
    regularPeriod: "",
    otPeriod: "",
    operators: [],
  };
}

/**
 * Updates individual operator's salary rates (daily wage and OT hourly rate).
 */
export async function updateOperatorRates(
  operatorId: string,
  dailyRate: number,
  otHourlyRate: number
): Promise<{ success: boolean; error?: string }> {
  await requireRole(...ALLOWED_ROLES);

  if (!operatorId || typeof operatorId !== "string") {
    return { success: false, error: "Invalid operator ID" };
  }

  const cleanDailyRate = Math.max(0, Number(dailyRate) || 0);
  const cleanOtRate = Math.max(0, Number(otHourlyRate) || 0);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("update_operator_payroll_rates", {
    p_operator_id: operatorId,
    p_daily_rate: cleanDailyRate,
    p_ot_hourly_rate: cleanOtRate,
  });

  if (error) {
    console.error("[updateOperatorRates] Error updating rates:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/payroll");
  revalidatePath("/hr");
  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true };
}

/**
 * Bulk updates salary rates for multiple operators at once in a single atomic transaction.
 */
export async function bulkUpdateOperatorRates(
  updates: Array<{ operatorId: string; dailyRate: number; otHourlyRate: number }>
): Promise<{ success: boolean; count: number; error?: string }> {
  await requireRole(...ALLOWED_ROLES);

  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: false, count: 0, error: "No operator updates provided" };
  }

  const payload = updates.map((u) => ({
    operator_id: u.operatorId,
    daily_rate: Math.max(0, Number(u.dailyRate) || 0),
    ot_hourly_rate: Math.max(0, Number(u.otHourlyRate) || 0),
  }));

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("bulk_update_operator_payroll_rates", {
    p_updates: payload,
  });

  if (error) {
    console.error("[bulkUpdateOperatorRates] Error calling bulk_update_operator_payroll_rates:", error);
    return { success: false, count: 0, error: error.message };
  }

  const count = (data as { count?: number })?.count ?? updates.length;

  revalidatePath("/payroll");
  revalidatePath("/hr");
  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, count };
}
