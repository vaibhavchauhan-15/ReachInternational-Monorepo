import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
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

import { OperatorDashboard } from "@/components/dashboard/OperatorDashboard";
import type { Machine, User, MachineWithEngineer, InventoryProduct, Branch } from "@/lib/types/database";
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
  if (!user) return null;

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  if (user.role === "operator") {
    const supabase = createSupabaseAdminClient();
    const [
      { data: assignedMachine },
      { data: recentLogs },
      complaintsRes,
      { data: myPartRequests },
      { data: engineers },
      { data: products },
      { data: branches },
      { data: managers },
    ] = await Promise.all([
      supabase
        .from("machines")
        .select("*, current_operator:users!current_operator_id(id, full_name, phone, email)")
        .eq("current_operator_id", user.id)
        .maybeSingle(),
      supabase
        .from("machine_hour_logs")
        .select("*")
        .eq("operator_id", user.id)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      getMachineComplaints({ pageSize: 30 }),
      supabase
        .from("inventory_purchase_requests")
        .select("id, request_no, priority, reason, status, created_at")
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("users")
        .select("id, full_name, phone, email, role")
        .in("role", ["engineer", "service_engineer", "mechanic"])
        .eq("status", "active"),
      supabase
        .from("inventory_products")
        .select("id, part_number, name, category, unit_cost, reorder_quantity")
        .order("name", { ascending: true })
        .limit(100),
      supabase
        .from("branches")
        .select("id, code, name, city"),
      supabase
        .from("users")
        .select("id, full_name, email, role")
        .in("role", ["branch_manager", "service_manager", "store_manager", "supervisor"])
        .eq("status", "active"),
    ]);

    return (
      <OperatorDashboard
        user={user}
        assignedMachine={(assignedMachine as unknown as Machine) || null}
        recentLogs={recentLogs || []}
        myComplaints={complaintsRes.complaints || []}
        myPartRequests={myPartRequests || []}
        engineers={(engineers as unknown as User[]) || []}
        allMachines={assignedMachine ? [(assignedMachine as unknown as MachineWithEngineer)] : []}
        products={(products as unknown as InventoryProduct[]) || []}
        branches={(branches as unknown as Branch[]) || []}
        managers={(managers as unknown as User[]) || []}
      />
    );
  }

  if (user.role === "mechanic") {
    const complaintsRes = await getMachineComplaints({ pageSize: 50 });
    return <MechanicDashboard user={user} assignedComplaints={complaintsRes.complaints} />;
  }

  if (user.role === "store_manager") {
    const [
      stocks,
      transactions,
      transfers,
      branches,
      products,
      purchaseRequests,
      purchaseOrders,
      goodsReceipts,
      partIssues,
      partReturns,
      deliveryChallans,
      storageLocations,
      managers,
      machines,
    ] = await Promise.all([
      getInventoryStock(),
      getInventoryTransactions(undefined, 200),
      getStockTransfers(),
      getBranches(),
      getInventoryProducts(),
      getPurchaseRequests(),
      getPurchaseOrders(),
      getGoodsReceipts(),
      getPartIssues(),
      getPartReturns(),
      getDeliveryChallans(),
      getStorageLocations(),
      getManagersList(),
      getMachines().then((res) => res.machines || []),
    ]);

    return (
      <div className="p-2 sm:p-4">
        <StockLedgerClient
          stocks={stocks}
          transactions={transactions}
          transfers={transfers}
          branches={branches}
          products={products}
          purchaseRequests={purchaseRequests}
          purchaseOrders={purchaseOrders}
          goodsReceipts={goodsReceipts}
          partIssues={partIssues}
          partReturns={partReturns}
          deliveryChallans={deliveryChallans}
          storageLocations={storageLocations}
          managers={managers}
          machines={machines}
        />
      </div>
    );
  }

  if (user.role === "hr_manager") {
    const supabase = createSupabaseAdminClient();
    const [
      employees, 
      branches, 
      { data: users },
      departments,
      designations,
      salaryHistory,
      documents,
      userRequests,
      metrics
    ] = await Promise.all([
      getEmployeeDirectory(),
      getBranches(),
      supabase.from("users").select("*").eq("status", "active"),
      getDepartments(),
      getDesignations(),
      getEmployeeSalaryHistory(),
      getEmployeeDocuments(),
      getUserAccountRequests(),
      getHRDashboardData(),
    ]);

    return (
      <div className="p-2 sm:p-4">
        <HRClient
          employees={employees}
          branches={branches}
          users={(users as User[]) || []}
          departments={departments}
          designations={designations}
          salaryHistory={salaryHistory}
          documents={documents}
          userRequests={userRequests}
          metrics={metrics}
          canViewSalary={true}
          initialTab="dashboard"
        />
      </div>
    );
  }

  const summary = await getDashboardSummary();

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Mobile Dynamic Header Bar */}
      <MobileDashboardHeader
        userName={user.full_name}
        userRole={user.role}
        todayDueCount={summary.today_due}
        overdueCount={summary.overdue}
      />

      {/* Desktop Top Action Bar */}
      <div className="hidden sm:flex justify-end items-center -mb-2">
        <RefreshButton path="/dashboard" tag="dashboard" />
      </div>

      <Suspense
        fallback={
          <div className={`grid ${isAdmin ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"} gap-3 sm:gap-4`}>
            <SkeletonKPI count={isAdmin ? 8 : 6} />
          </div>
        }
      >
        <DashboardKPIsSection isAdmin={isAdmin} />
      </Suspense>

      {/* Analytics Charts */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonChartCard />
            <SkeletonChartCard />
          </div>
        }
      >
        <DashboardChartsSection />
      </Suspense>

      {/* Service Bucket Lists */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonKPI key={i} count={1} />
            ))}
          </div>
        }
      >
        <DashboardDueListsSection isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}