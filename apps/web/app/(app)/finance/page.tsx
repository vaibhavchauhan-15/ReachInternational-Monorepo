import { redirect } from "next/navigation";
import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { roleHasPermission } from "@/lib/auth/rbac";
import {
  getFinanceDashboardMetrics,
  getFinanceInvoices,
  getFinancePayments,
  getFinanceExpenses,
  getFinanceExpenseCategories,
  getFinance3WayMatches,
  getFinanceVendorPayments,
  getReceivablesAgingReport,
  getFinanceSettings,
} from "@/lib/queries/finance";
import { FinanceClient } from "@/components/finance/FinanceClient";

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  protectDisabledRoute(user.role);

  if (!roleHasPermission(user.role, "finance.view")) {
    redirect("/dashboard");
  }

  const [
    metrics,
    invoices,
    payments,
    expenses,
    expenseCategories,
    threeWayMatches,
    vendorPayments,
    receivablesAging,
    financeSettings,
  ] = await Promise.all([
    getFinanceDashboardMetrics(),
    getFinanceInvoices(),
    getFinancePayments(),
    getFinanceExpenses(),
    getFinanceExpenseCategories(),
    getFinance3WayMatches(),
    getFinanceVendorPayments(),
    getReceivablesAgingReport(),
    getFinanceSettings(),
  ]);

  return (
    <FinanceClient
      user={user}
      metrics={metrics}
      invoices={invoices}
      payments={payments}
      expenses={expenses}
      expenseCategories={expenseCategories}
      threeWayMatches={threeWayMatches}
      vendorPayments={vendorPayments}
      receivablesAging={receivablesAging}
      financeSettings={financeSettings}
    />
  );
}
