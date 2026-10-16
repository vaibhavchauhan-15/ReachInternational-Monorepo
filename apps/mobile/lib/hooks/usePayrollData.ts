/**
 * Native Mobile Payroll Server State & Business Logic Hook
 * Encapsulates TanStack Query caching, calculations, and mutations for HR Payroll.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import {
  calculateOperatorSalary,
  calculatePayrollKpis,
  type OperatorSalaryInput,
  type OperatorSalaryComputed,
  type PayrollSummaryKpis,
} from '@reachinternational/utils';
import type { HRPayrollSummary, HRPayrollOperator } from '@reachinternational/types';

export interface UsePayrollDataOptions {
  month: string; // "YYYY-MM"
  searchQuery?: string;
  payoutFilter?: string; // 'all' | 'pending' | 'disbursed' | 'with_ot' | 'with_deductions'
  enabled?: boolean;
}

export function usePayrollData({
  month,
  searchQuery = '',
  payoutFilter = 'all',
  enabled = true,
}: UsePayrollDataOptions) {
  const queryClient = useQueryClient();

  const targetDate = `${month}-01`;

  // 1. TanStack Query with caching & stale-while-revalidate
  const {
    data: payrollData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<HRPayrollSummary>({
    queryKey: ['payroll', month],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_hr_payroll_summary', {
        p_payroll_month: targetDate,
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Failed to fetch payroll data');
      }

      const rawOperators: HRPayrollOperator[] = Array.isArray(data)
        ? (data as unknown as HRPayrollOperator[])
        : data && Array.isArray((data as any).operators)
        ? (data as any).operators
        : [];

      return {
        payrollMonth: (!Array.isArray(data) && (data as any)?.payrollMonth) || month,
        regularPeriod: (!Array.isArray(data) && (data as any)?.regularPeriod) || '',
        otPeriod: (!Array.isArray(data) && (data as any)?.otPeriod) || '',
        operators: rawOperators,
      };
    },
  });

  const rawOperators = payrollData?.operators || [];

  // 2. Filtered & Sorted Operators (Delegated Business Logic)
  const filteredOperators = useMemo(() => {
    let list = rawOperators;
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      list = list.filter(
        (op) =>
          op.full_name.toLowerCase().includes(q) ||
          (op.phone && op.phone.includes(q)) ||
          (op.city && op.city.toLowerCase().includes(q)) ||
          (op.state && op.state.toLowerCase().includes(q)) ||
          (op.bank_ifsc_code && op.bank_ifsc_code.toLowerCase().includes(q)) ||
          (op.bank_account_number && op.bank_account_number.toLowerCase().includes(q))
      );
    }

    if (payoutFilter === 'pending') {
      list = list.filter((op) => (op.balance_pay || 0) > 0);
    } else if (payoutFilter === 'disbursed') {
      list = list.filter((op) => (op.balance_pay || 0) <= 0);
    } else if (payoutFilter === 'with_ot') {
      list = list.filter((op) => (op.ot_days || 0) > 0 || (op.ot_hours || 0) > 0);
    } else if (payoutFilter === 'with_deductions') {
      list = list.filter(
        (op) =>
          ((op.loan_deduction || 0) +
            (op.advance_deduction || 0) +
            (op.other_deductions || 0)) > 0
      );
    }

    return list;
  }, [rawOperators, searchQuery, payoutFilter]);

  // 3. Domain Calculation: Summary KPIs
  const summaryKpis: PayrollSummaryKpis = useMemo(() => {
    return calculatePayrollKpis(rawOperators);
  }, [rawOperators]);

  // 4. Mutation: Save Monthly Statement
  const saveStatementMutation = useMutation({
    mutationFn: async ({
      operatorId,
      payload,
    }: {
      operatorId: string;
      payload: Record<string, any>;
    }) => {
      const { data, error: updateError } = await supabase.rpc(
        'update_operator_monthly_salary_statement',
        {
          p_operator_id: operatorId,
          p_payroll_month: targetDate,
          p_basic_salary: payload.basic_salary,
          p_working_days: payload.working_days,
          p_attended_days: payload.attended_days,
          p_ot_days: payload.ot_days,
          p_pl_adjusted: payload.pl_adjusted,
          p_night_travel_days: payload.night_travel_days || 0,
          p_night_travel_amount: payload.night_travel_amount || 0,
          p_loan_deduction: payload.loan_deduction || 0,
          p_additional_balance_salary: payload.additional_balance_salary || 0,
          p_advance_deduction: payload.advance_deduction || 0,
          p_advance_balance: payload.advance_balance || 0,
          p_other_deductions: payload.other_deductions || 0,
          p_pl_used_as_on_date: payload.pl_used_as_on_date || 0,
          p_paid_reach: payload.paid_reach || 0,
          p_paid_ss: payload.paid_ss || 0,
          p_paid_quess: payload.paid_quess || 0,
          p_total_pl_quota: payload.total_pl_quota || 12,
          p_bank_account_number: payload.bank_account_number || '',
          p_bank_ifsc_code: payload.bank_ifsc_code || '',
          p_status: payload.status || 'draft',
          p_notes: payload.notes || '',
        }
      );

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update statement');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', month] });
    },
  });

  return {
    payrollData,
    operators: filteredOperators,
    rawOperators,
    summaryKpis,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    saveStatement: saveStatementMutation.mutateAsync,
    isSavingStatement: saveStatementMutation.isPending,
  };
}

export { calculateOperatorSalary };
export type { OperatorSalaryInput, OperatorSalaryComputed, PayrollSummaryKpis };
