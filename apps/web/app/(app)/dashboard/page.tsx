import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import {
  getDashboardSummary,
  getDashboardCharts,
  getDashboardDueLists,
} from "@/lib/queries/dashboard";
import {
  SkeletonKPI,
  SkeletonChartCard,
  MetricCard,
  RefreshButton,
} from "@/components/ui";
import { MobileDashboardHeader } from "@/components/dashboard/MobileDashboardHeader";
import { MobileDueBuckets } from "@/components/dashboard/MobileDueBuckets";
import { MobileChartsWrapper } from "@/components/dashboard/MobileChartsWrapper";

import type { User } from "@/lib/types/database";
import { MechanicDashboard } from "@/components/dashboard/MechanicDashboard";
import { StockLedgerClient } from "@/components/inventory/StockLedgerClient";
import { HRClient } from "@/components/hr/HRClient";
import { getMachineComplaints } from "@/lib/queries/complaints";
import {
  getInventoryStock,
  getInventoryTransactions,
  getStockTransfers,
  getInventoryProducts,
  getPurchaseRequests,
  getGoodsReceipts,
  getPartIssues,
  getPartReturns,
  getStorageLocations,
  getManagersList,
} from "@/lib/queries/inventory";
import { getBranches } from "@/lib/queries/branches";
import { getPurchaseOrders } from "@/lib/queries/purchase-orders";
import { getDeliveryChallans } from "@/lib/queries/challans";
import { getMachines } from "@/lib/queries/machines";
import { 
  getEmployeeDirectory, 
  getHRDashboardData, 
  getDepartments, 
  getDesignations, 
  getEmployeeSalaryHistory, 
  getEmployeeDocuments, 
  getUserAccountRequests 
} from "@/lib/queries/hr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function DashboardKPIsSection({ isAdmin }: { isAdmin: boolean }) {
  const [summary, charts] = await Promise.all([
    getDashboardSummary(),
    getDashboardCharts(),
  ]);

  const monthlyServices = charts.monthly_services ?? [];
  const currMonthCount = monthlyServices.length > 0 ? monthlyServices[monthlyServices.length - 1]?.count ?? 0 : 0;
  const prevMonthCount = monthlyServices.length > 1 ? monthlyServices[monthlyServices.length - 2]?.count ?? 0 : 0;

  let completedTrend: { value: string; isUp: boolean };
  if (prevMonthCount > 0) {
    const pct = ((currMonthCount - prevMonthCount) / prevMonthCount) * 100;
    completedTrend = {
      value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% MoM`,
      isUp: pct >= 0,
    };
  } else if (currMonthCount > 0) {
    completedTrend = { value: "+100% MoM", isUp: true };
  } else {
    completedTrend = { value: "0% MoM", isUp: true };
  }

  const overdueTrend = charts.overdue_trend ?? [];
  const startOverdue = overdueTrend.length > 0 ? overdueTrend[0]?.count ?? 0 : 0;
  let overdueTrendObj: { value: string; isUp: boolean };
  if (startOverdue > 0) {
    const diffPct = ((summary.overdue - startOverdue) / startOverdue) * 100;
    overdueTrendObj = {
      value: `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}% 30d`,
      isUp: diffPct <= 0,
    };
  } else {
    overdueTrendObj = {
      value: summary.overdue === 0 ? "0 overdue" : `+${summary.overdue} new`,
      isUp: summary.overdue === 0,
    };
  }

  const activePct = summary.total_machines > 0
    ? ((summary.active_machines / summary.total_machines) * 100).toFixed(0)
    : "0";

  const totalAlerts = summary.notifications_sent_today + summary.notifications_failed_today;
  const notifRate = totalAlerts > 0
    ? ((summary.notifications_sent_today / totalAlerts) * 100).toFixed(0)
    : "100";

  const gridColsClass = isAdmin
    ? "grid-cols-2 md:grid-cols-4"
    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";

  const monthlySparkline = monthlyServices.map((d) => d.count);
  const overdueSparkline = overdueTrend.map((d) => d.count);

  return (
    <div className={`grid ${gridColsClass} gap-3 sm:gap-4 items-stretch`}>
      <div className="min-w-0 w-full h-full">
        <MetricCard
          label="Total Fleet"
          value={summary.total_machines}
          icon="Wrench"
          href={isAdmin ? "/machines" : "/services"}
          tooltipText="Total registered machine fleet"
          trend={{ value: `${activePct}% active`, isUp: true }}
          sparklineData={monthlySparkline}
          index={0}
        />
      </div>
      <div className="min-w-0 w-full h-full">
        <MetricCard
          label="Active"
          value={summary.active_machines}
          icon="CheckCircle"
          variant="success"
          tooltipText="Operating active hardware"
          trend={{ value: summary.active_machines > 0 ? "+Operational" : "Offline", isUp: summary.active_machines > 0 }}
          sparklineData={monthlySparkline}
          index={1}
        />
      </div>
      <div className="min-w-0 w-full h-full">
        <MetricCard
          label="Due Today"
          value={summary.today_due}
          icon="CalendarClock"
          variant={summary.today_due > 0 ? "warning" : "default"}
          tooltipText="Maintenance due today"
          href={isAdmin ? "/machines?bucket=today" : "/services"}
          trend={{ value: summary.today_due > 0 ? `+${summary.today_due} pending` : "0 pending", isUp: summary.today_due === 0 }}
          sparklineData={overdueSparkline}
          index={2}
        />
      </div>
      <div className="min-w-0 w-full h-full">
        <MetricCard
          label="Due Tomorrow"
          value={summary.tomorrow_due}
          icon="CalendarDays"
          tooltipText="Maintenance due tomorrow"
          href={isAdmin ? "/machines?bucket=tomorrow" : "/services"}
          trend={{ value: `${summary.tomorrow_due} upcoming`, isUp: true }}
          sparklineData={overdueSparkline}
          index={3}
        />
      </div>
      <div className="min-w-0 w-full h-full">
        <MetricCard
          label="Overdue"
          value={summary.overdue}
          icon="AlertTriangle"
          variant={summary.overdue > 0 ? "error" : "default"}
          tooltipText="Service past scheduled date"
          href={isAdmin ? "/machines?bucket=overdue" : "/services"}
          trend={overdueTrendObj}
          sparklineData={overdueSparkline}
          index={4}
        />
      </div>
      <div className="min-w-0 w-full h-full">
        <MetricCard
          label="Completed"
          value={summary.completed_today}
          icon="CheckCircle"
          variant="success"
          tooltipText="Resolved services today"
          trend={completedTrend}
          sparklineData={monthlySparkline}
          index={5}
        />
      </div>
      {isAdmin && (
        <>
          <div className="min-w-0 w-full h-full">
            <MetricCard
              label="Alerts Sent"
              value={summary.notifications_sent_today}
              icon="BellRing"
              variant="success"
              tooltipText="Notifications delivered today"
              trend={{ value: `${notifRate}% rate`, isUp: true }}
              sparklineData={monthlySparkline}
              index={6}
            />
          </div>
          <div className="min-w-0 w-full h-full">
            <MetricCard
              label="Alerts Failed"
              value={summary.notifications_failed_today}
              icon="Bell"
              variant={summary.notifications_failed_today > 0 ? "error" : "default"}
              tooltipText="Failed notification attempts"
              trend={{
                value: summary.notifications_failed_today > 0 ? `-${summary.notifications_failed_today} errors` : "0 errors",
                isUp: summary.notifications_failed_today === 0,
              }}
              sparklineData={overdueSparkline}
              index={7}
            />
          </div>
        </>
      )}
    </div>
  );
}

async function DashboardChartsSection() {
  const charts = await getDashboardCharts();

  return (
    <MobileChartsWrapper
      monthlyServices={charts.monthly_services}
      overdueTrend={charts.overdue_trend}
    />
  );
}

async function DashboardDueListsSection({ isAdmin }: { isAdmin: boolean }) {
  const dueLists = await getDashboardDueLists();

  return (
    <MobileDueBuckets
      isAdmin={isAdmin}
      todayDue={dueLists.due_today}
      tomorrowDue={dueLists.due_tomorrow}
      overdueMachines={dueLists.overdue_machines}
    />
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  protectDisabledRoute(user.role);
}