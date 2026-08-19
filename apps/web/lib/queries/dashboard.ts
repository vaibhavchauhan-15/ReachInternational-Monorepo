import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type {
  DashboardSummary,
  MonthlyServiceData,
  OverdueTrendData,
  MachineWithEngineer,
  AuditLogWithUser,
  UserRole,
} from "@/lib/types/database";

interface DashboardPayload {
  kpis: DashboardSummary;
  monthly_services: MonthlyServiceData[];
  overdue_trend: OverdueTrendData[];
  due_today: { id: string; machine_code: string; customer_name: string }[];
  due_tomorrow: { id: string; machine_code: string; customer_name: string }[];
  overdue_machines: { id: string; machine_code: string; customer_name: string }[];
  recent_activity: AuditLogWithUser[];
}

const DEFAULT_KPIS: DashboardSummary = {
  total_machines: 0,
  active_machines: 0,
  today_due: 0,
  tomorrow_due: 0,
  overdue: 0,
  completed_today: 0,
  notifications_sent_today: 0,
  notifications_failed_today: 0,
};

// Top-level cached fetchers using stateless admin client (avoids cookies() inside cache).
// NOTE: unstable_cache automatically includes function arguments in the cache key,
// so passing (userId, role) scopes each cache entry per user — no cross-user leakage.
const getCachedDashboardKpis = unstable_cache(
  async (userId: string, role: UserRole, branchId?: string | null) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_dashboard_kpis", {
      p_user_id: userId,
      p_role: role,
    });
    if (!error && data) {
      return data as DashboardSummary;
    }

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    let mQuery = supabase.from("machines").select("status, next_service_due_date, engineer_id, branch_id");
    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      mQuery = mQuery.eq("engineer_id", userId);
    } else if ((role === "branch_manager" || role === "supervisor") && branchId) {
      mQuery = mQuery.eq("branch_id", branchId);
    }
    const { data: machines } = await mQuery;
    const allMachines = machines ?? [];

    let srQuery = supabase.from("service_records").select("id").eq("service_date", today);
    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      srQuery = srQuery.eq("engineer_id", userId);
    }
    const { data: srToday } = await srQuery;

    let nQuery = supabase.from("notifications").select("status").eq("alert_date", today);
    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      nQuery = nQuery.eq("recipient_id", userId);
    }
    const { data: notifsToday } = await nQuery;

    const activeMachines = allMachines.filter((m) => m.status === "active");

    return {
      total_machines: allMachines.length,
      active_machines: activeMachines.length,
      today_due: activeMachines.filter((m) => m.next_service_due_date === today).length,
      tomorrow_due: activeMachines.filter((m) => m.next_service_due_date === tomorrow).length,
      overdue: activeMachines.filter((m) => m.next_service_due_date < today).length,
      completed_today: srToday?.length ?? 0,
      notifications_sent_today: notifsToday?.filter((n) => n.status === "sent").length ?? 0,
      notifications_failed_today: notifsToday?.filter((n) => n.status === "failed").length ?? 0,
    };
  },
  ["dashboard-kpis-v3"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.dashboardKpis] }
);

const getCachedDashboardCharts = unstable_cache(
  async (userId: string, role: UserRole, branchId?: string | null) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_dashboard_charts", {
      p_user_id: userId,
      p_role: role,
    });
    if (!error && data) {
      return data as { monthly_services: MonthlyServiceData[]; overdue_trend: OverdueTrendData[] };
    }

    let srQuery = supabase.from("service_records").select("service_date");
    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      srQuery = srQuery.eq("engineer_id", userId);
    }
    const { data: records } = await srQuery;

    const monthsMap: Record<string, number> = {};
    const now = new Date();
    const monthsList: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString("en-US", { month: "short" });
      monthsList.push(monthLabel);
      monthsMap[monthLabel] = 0;
    }
    (records ?? []).forEach((r) => {
      if (r.service_date) {
        const d = new Date(r.service_date);
        const label = d.toLocaleString("en-US", { month: "short" });
        if (label in monthsMap) {
          monthsMap[label] = (monthsMap[label] || 0) + 1;
        }
      }
    });

    const monthly_services: MonthlyServiceData[] = monthsList.map((m) => ({
      month: m,
      count: monthsMap[m] || 0,
    }));

    let mQuery = supabase.from("machines").select("next_service_due_date, branch_id").eq("status", "active");
    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      mQuery = mQuery.eq("engineer_id", userId);
    } else if ((role === "branch_manager" || role === "supervisor") && branchId) {
      mQuery = mQuery.eq("branch_id", branchId);
    }
    const { data: machines } = await mQuery;

    const overdue_trend: OverdueTrendData[] = [];
    for (let i = 29; i >= 0; i--) {
      const targetDate = new Date(Date.now() - i * 86400000);
      const dateStr = targetDate.toISOString().split("T")[0];
      const dateLabel = targetDate.toLocaleString("en-US", { month: "short", day: "2-digit" });
      const count = (machines ?? []).filter(
        (m) => m.next_service_due_date && m.next_service_due_date < dateStr
      ).length;
      overdue_trend.push({ date: dateLabel, count });
    }

    return { monthly_services, overdue_trend };
  },
  ["dashboard-charts-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_CATALOG, tags: [TAGS.dashboardCharts] }
);

const getCachedDashboardDueLists = unstable_cache(
  async (userId: string, role: UserRole, branchId?: string | null) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_dashboard_due_lists", {
      p_user_id: userId,
      p_role: role,
    });
    if (!error && data) {
      return data as {
        due_today: { id: string; machine_code: string; customer_name: string }[];
        due_tomorrow: { id: string; machine_code: string; customer_name: string }[];
        overdue_machines: { id: string; machine_code: string; customer_name: string }[];
      };
    }

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    let mQuery = supabase
      .from("machines")
      .select("id, machine_code, customer_name, next_service_due_date, branch_id")
      .eq("status", "active");
    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      mQuery = mQuery.eq("engineer_id", userId);
    } else if ((role === "branch_manager" || role === "supervisor") && branchId) {
      mQuery = mQuery.eq("branch_id", branchId);
    }
    const { data: machines } = await mQuery;
    const all = machines ?? [];

    return {
      due_today: all.filter((m) => m.next_service_due_date === today).slice(0, 5),
      due_tomorrow: all.filter((m) => m.next_service_due_date === tomorrow).slice(0, 5),
      overdue_machines: all.filter((m) => m.next_service_due_date < today).slice(0, 5),
    };
  },
  ["dashboard-due-lists-v3"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.dashboardDueLists] }
);

const getCachedRecentActivity = unstable_cache(
  async (userId: string, role: UserRole) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_recent_activity_slim", {
      p_user_id: userId,
      p_role: role,
    });
    if (!error && data) {
      return (data as AuditLogWithUser[]).slice(0, 10);
    }

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") return [];

    const { data: logs } = await supabase
      .from("audit_logs")
      .select("id, action, created_at, user:users(full_name, role)")
      .order("created_at", { ascending: false })
      .limit(10);

    return (logs as unknown as AuditLogWithUser[]) ?? [];
  },
  ["dashboard-recent-activity-v2"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.dashboardActivity] }
);

export const getDashboardSummary = cache(async (): Promise<DashboardSummary> => {
  const user = await getCurrentUser();
  if (!user) return DEFAULT_KPIS;
  const res = await getCachedDashboardKpis(user.id, user.role, user.branch_id);
  return res ?? DEFAULT_KPIS;
});

export const getDashboardCharts = cache(async (): Promise<{
  monthly_services: MonthlyServiceData[];
  overdue_trend: OverdueTrendData[];
}> => {
  const user = await getCurrentUser();
  if (!user) return { monthly_services: [], overdue_trend: [] };
  return getCachedDashboardCharts(user.id, user.role, user.branch_id);
});

export async function getMonthlyServices(): Promise<MonthlyServiceData[]> {
  const charts = await getDashboardCharts();
  return charts.monthly_services;
}

export async function getOverdueTrend(): Promise<OverdueTrendData[]> {
  const charts = await getDashboardCharts();
  return charts.overdue_trend;
}

export const getDashboardDueLists = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return { due_today: [], due_tomorrow: [], overdue_machines: [] };
  return getCachedDashboardDueLists(user.id, user.role, user.branch_id);
});

export async function getDueMachines(
  bucket: "today" | "tomorrow" | "overdue"
): Promise<MachineWithEngineer[]> {
  const dueLists = await getDashboardDueLists();
  const list =
    bucket === "today"
      ? dueLists.due_today
      : bucket === "tomorrow"
        ? dueLists.due_tomorrow
        : dueLists.overdue_machines;

  return (list ?? []) as unknown as MachineWithEngineer[];
}

export const getRecentActivity = cache(async (): Promise<AuditLogWithUser[]> => {
  const user = await getCurrentUser();
  if (!user || user.role === "engineer" || user.role === "service_engineer" || user.role === "mechanic") return [];
  return getCachedRecentActivity(user.id, user.role);
});

export const getDashboardPayload = cache(async (): Promise<DashboardPayload | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const [kpis, charts, dueLists, recent_activity] = await Promise.all([
    getDashboardSummary(),
    getDashboardCharts(),
    getDashboardDueLists(),
    getRecentActivity(),
  ]);

  return {
    kpis,
    monthly_services: charts.monthly_services,
    overdue_trend: charts.overdue_trend,
    due_today: dueLists.due_today,
    due_tomorrow: dueLists.due_tomorrow,
    overdue_machines: dueLists.overdue_machines,
    recent_activity,
  };
});