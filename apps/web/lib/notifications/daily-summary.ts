import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AdminDailySummaryData,
  AdminSummaryMachine,
  AdminSummaryCompletedService,
  AdminSummaryNotificationStats,
  EngineerDailySummaryData,
  EngineerSummaryMachine,
  EngineerSummaryCompletedService,
} from "@/lib/notifications/email-templates";

/**
 * Daily Summary data fetchers.
 *
 * All queries use the admin (service-role) client because this module is
 * only ever invoked from server-side cron / server actions. Data is fetched
 * in a small number of batched queries to avoid N+1 patterns, then shaped
 * into the template data structures.
 */

export interface DailySummaryContext {
  today: string;
  tomorrow: string;
  dashboardUrl: string;
}

export function getDailySummaryContext(): DailySummaryContext {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
  return {
    today,
    tomorrow,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard`,
  };
}

// ---------------------------------------------------------------------------
// Super Admin Summary
// ---------------------------------------------------------------------------

interface AdminSummaryRow {
  id: string;
  machine_code: string;
  machine_name: string;
  customer_name: string;
  customer_mobile: string;
  customer_address: string | null;
  city: string;
  next_service_due_date: string;
  last_service_date: string | null;
  created_at: string;
  engineer: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

function toAdminMachine(row: AdminSummaryRow): AdminSummaryMachine {
  return {
    machineCode: row.machine_code,
    machineName: row.machine_name,
    customerName: row.customer_name,
    customerPhone: row.customer_mobile,
    customerCity: row.city,
    customerAddress: row.customer_address ?? undefined,
    engineerName: row.engineer?.full_name ?? undefined,
    engineerPhone: row.engineer?.phone ?? undefined,
    engineerEmail: row.engineer?.email ?? undefined,
    dueDate: row.next_service_due_date,
    lastServiceDate: row.last_service_date ?? undefined,
  };
}

function daysOverdue(dueDate: string, today: string): number {
  const diff = new Date(today).getTime() - new Date(dueDate).getTime();
  return Math.max(1, Math.ceil(diff / 86400000));
}

export async function fetchAdminDailySummaryData(
  recipientName: string,
  ctx: DailySummaryContext
): Promise<AdminDailySummaryData> {
  const supabase = createSupabaseAdminClient();

  // 1. Active machines (all) — used for KPI counts + due/overdue lists.
  const { data: activeMachines, error: machinesErr } = await supabase
    .from("machines")
    .select(
      `
      id,
      machine_code,
      machine_name,
      customer_name,
      customer_mobile,
      customer_address,
      city,
      next_service_due_date,
      last_service_date,
      created_at,
      engineer:users!machines_engineer_id_fkey(full_name, phone, email)
    `
    )
    .eq("status", "active");

  if (machinesErr) {
    throw new Error(`Failed to fetch active machines: ${machinesErr.message}`);
  }

  const rows = (activeMachines as unknown as AdminSummaryRow[]) ?? [];

  // 2. Machines added today (any status).
  const { data: newMachines, error: newErr } = await supabase
    .from("machines")
    .select(
      `
      id,
      machine_code,
      machine_name,
      customer_name,
      customer_mobile,
      customer_address,
      city,
      next_service_due_date,
      last_service_date,
      created_at,
      engineer:users!machines_engineer_id_fkey(full_name, phone, email)
    `
    )
    .gte("created_at", `${ctx.today}T00:00:00`)
    .lte("created_at", `${ctx.today}T23:59:59.999`);

  if (newErr) {
    throw new Error(`Failed to fetch new machines: ${newErr.message}`);
  }

  const newRows = (newMachines as unknown as AdminSummaryRow[]) ?? [];

  // 3. Services completed today (with machine + engineer details).
  const { data: completedServices, error: servicesErr } = await supabase
    .from("service_records")
    .select(
      `
      id,
      service_date,
      notes,
      next_service_due_date,
      created_at,
      machine:machines!service_records_machine_id_fkey(machine_code, machine_name),
      engineer:users!service_records_engineer_id_fkey(full_name)
    `
    )
    .eq("service_date", ctx.today)
    .order("created_at", { ascending: false });

  if (servicesErr) {
    throw new Error(`Failed to fetch completed services: ${servicesErr.message}`);
  }

  // 4. Notification stats for today (all channels).
  const { data: notifsToday, error: notifErr } = await supabase
    .from("notifications")
    .select("status, channel")
    .eq("alert_date", ctx.today);

  if (notifErr) {
    throw new Error(`Failed to fetch notification stats: ${notifErr.message}`);
  }

  const notifList = notifsToday ?? [];
  const notificationStats: AdminSummaryNotificationStats = {
    emailsSent: notifList.filter((n) => n.channel === "email" && n.status === "sent").length,
    emailsFailed: notifList.filter((n) => n.channel === "email" && n.status === "failed").length,
    whatsappSent: notifList.filter((n) => n.channel === "whatsapp" && n.status === "sent").length,
    whatsappFailed: notifList.filter((n) => n.channel === "whatsapp" && n.status === "failed").length,
    smsSent: notifList.filter((n) => n.channel === "sms" && n.status === "sent").length,
    smsFailed: notifList.filter((n) => n.channel === "sms" && n.status === "failed").length,
  };

  // 5. Shape the data.
  const dueToday = rows.filter((m) => m.next_service_due_date === ctx.today);
  const dueTomorrow = rows.filter((m) => m.next_service_due_date === ctx.tomorrow);
  const overdue = rows
    .filter((m) => m.next_service_due_date < ctx.today)
    .sort((a, b) => {
      const aDays = daysOverdue(a.next_service_due_date, ctx.today);
      const bDays = daysOverdue(b.next_service_due_date, ctx.today);
      return bDays - aDays; // longest overdue first
    });

  const completedServicesToday: AdminSummaryCompletedService[] = (completedServices as unknown as {
    service_date: string;
    notes: string | null;
    next_service_due_date: string | null;
    created_at: string;
    machine: { machine_code: string; machine_name: string } | null;
    engineer: { full_name: string | null } | null;
  }[])?.map((s) => ({
    machineCode: s.machine?.machine_code ?? "MCH-XXXX",
    machineName: s.machine?.machine_name ?? "",
    engineerName: s.engineer?.full_name ?? "Unassigned",
    completionTime: new Date(s.created_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    notes: s.notes ?? undefined,
    nextServiceDueDate: s.next_service_due_date ?? undefined,
  })) ?? [];

  return {
    date: ctx.today,
    recipientName,
    dashboardUrl: ctx.dashboardUrl,
    kpis: {
      totalActiveMachines: rows.length,
      machinesAddedToday: newRows.length,
      servicesCompletedToday: completedServicesToday.length,
      machinesDueToday: dueToday.length,
      machinesDueTomorrow: dueTomorrow.length,
      overdueMachines: overdue.length,
      failedNotificationsToday: notifList.filter((n) => n.status === "failed").length,
      successfulNotificationsToday: notifList.filter((n) => n.status === "sent").length,
    },
    newMachinesToday: newRows.map(toAdminMachine),
    dueTomorrowMachines: dueTomorrow.map(toAdminMachine),
    overdueMachines: overdue.map((m) => ({
      ...toAdminMachine(m),
      daysOverdue: daysOverdue(m.next_service_due_date, ctx.today),
    })),
    completedServicesToday,
    notificationStats,
  };
}

// ---------------------------------------------------------------------------
// Engineer Summary
// ---------------------------------------------------------------------------

interface EngineerSummaryRow {
  id: string;
  machine_code: string;
  machine_name: string;
  customer_name: string;
  customer_mobile: string;
  customer_address: string | null;
  city: string;
  next_service_due_date: string;
  last_service_date: string | null;
}

function toEngineerMachine(row: EngineerSummaryRow): EngineerSummaryMachine {
  return {
    machineCode: row.machine_code,
    machineName: row.machine_name,
    customerName: row.customer_name,
    customerPhone: row.customer_mobile,
    customerAddress: row.customer_address ?? undefined,
    customerCity: row.city,
    dueDate: row.next_service_due_date,
    lastServiceDate: row.last_service_date ?? undefined,
  };
}

export async function fetchEngineerDailySummaryData(
  engineerId: string,
  recipientName: string,
  ctx: DailySummaryContext
): Promise<EngineerDailySummaryData> {
  const supabase = createSupabaseAdminClient();

  // 1. Machines assigned to this engineer (active only).
  const { data: assignedMachines, error: machinesErr } = await supabase
    .from("machines")
    .select(
      `
      id,
      machine_code,
      machine_name,
      customer_name,
      customer_mobile,
      customer_address,
      city,
      next_service_due_date,
      last_service_date
    `
    )
    .eq("engineer_id", engineerId)
    .eq("status", "active");

  if (machinesErr) {
    throw new Error(`Failed to fetch engineer machines: ${machinesErr.message}`);
  }

  const rows = (assignedMachines as unknown as EngineerSummaryRow[]) ?? [];

  const dueTomorrow = rows.filter((m) => m.next_service_due_date === ctx.tomorrow);
  const overdue = rows
    .filter((m) => m.next_service_due_date < ctx.today)
    .sort((a, b) => {
      const aDays = daysOverdue(a.next_service_due_date, ctx.today);
      const bDays = daysOverdue(b.next_service_due_date, ctx.today);
      return bDays - aDays;
    });

  // 2. Services completed today by this engineer.
  const { data: completedServices, error: servicesErr } = await supabase
    .from("service_records")
    .select(
      `
      id,
      service_date,
      notes,
      next_service_due_date,
      created_at,
      machine:machines!service_records_machine_id_fkey(machine_code, machine_name)
    `
    )
    .eq("engineer_id", engineerId)
    .eq("service_date", ctx.today)
    .order("created_at", { ascending: false });

  if (servicesErr) {
    throw new Error(`Failed to fetch engineer completed services: ${servicesErr.message}`);
  }

  const completedServicesToday: EngineerSummaryCompletedService[] = (completedServices as unknown as {
    service_date: string;
    notes: string | null;
    next_service_due_date: string | null;
    created_at: string;
    machine: { machine_code: string; machine_name: string } | null;
  }[])?.map((s) => ({
    machineCode: s.machine?.machine_code ?? "MCH-XXXX",
    machineName: s.machine?.machine_name ?? "",
    completionTime: new Date(s.created_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    notes: s.notes ?? undefined,
    nextServiceDueDate: s.next_service_due_date ?? undefined,
  })) ?? [];

  return {
    date: ctx.today,
    recipientName,
    dashboardUrl: ctx.dashboardUrl,
    dueTomorrowMachines: dueTomorrow.map(toEngineerMachine),
    overdueMachines: overdue.map((m) => ({
      ...toEngineerMachine(m),
      daysOverdue: daysOverdue(m.next_service_due_date, ctx.today),
    })),
    completedServicesToday,
  };
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a summary notification already exists for the given
 * recipient + alert type + date + channel. Used to prevent duplicate
 * emails when the cron job is re-run.
 */
export async function hasSummaryNotification(
  recipientId: string,
  alertType: "daily_summary" | "engineer_summary",
  alertDate: string,
  channel: "email" = "email"
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("recipient_id", recipientId)
    .eq("alert_type", alertType)
    .eq("alert_date", alertDate)
    .eq("channel", channel)
    .is("machine_id", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to check summary notification idempotency:", error);
    return false;
  }
  return !!data;
}