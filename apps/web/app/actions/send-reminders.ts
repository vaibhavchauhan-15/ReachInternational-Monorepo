"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { getServiceReminderMessage, ServiceReminderData } from "@/lib/notifications/templates";
import { sendEmailWithTracking } from "@/lib/email";
import { CACHE_TAGS } from "@/lib/cache";
import {
  fetchAdminDailySummaryData,
  fetchEngineerDailySummaryData,
  getDailySummaryContext,
  hasSummaryNotification,
} from "@/lib/notifications/daily-summary";
import {
  getAdminDailySummaryEmailHtml,
  getAdminDailySummaryEmailText,
  getEngineerDailySummaryEmailHtml,
  getEngineerDailySummaryEmailText,
} from "@/lib/notifications/email-templates";

// Concurrency limit for external sends (SendGrid email API rate limits)
const SEND_CONCURRENCY = 20;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Super Admin Daily Summary
// ---------------------------------------------------------------------------

interface AdminSummaryPayload {
  subject: string;
  html: string;
  text: string;
}

async function sendAdminDailySummaries(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  ctx: ReturnType<typeof getDailySummaryContext>
): Promise<{ sent: number; failed: number; skipped: number }> {
  // All admin roles (super_admin + admin)
  const { data: admins, error: adminsErr } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("role", ["super_admin", "admin"])
    .eq("status", "active");

  if (adminsErr) {
    console.error("Failed to fetch super admins:", adminsErr.message);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  if (!admins || admins.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const ops = admins
    .filter((admin) => admin.email && admin.id)
    .map((admin) => async () => {
      // Idempotency: skip if already sent today
      const alreadySent = await hasSummaryNotification(admin.id, "daily_summary", ctx.today);
      if (alreadySent) {
        skipped++;
        return;
      }

      // Build the summary data (fetched fresh per admin to avoid sharing mutable state)
      const summaryData = await fetchAdminDailySummaryData(
        admin.full_name || "Admin",
        ctx
      );

      const html = getAdminDailySummaryEmailHtml(summaryData);
      const text = getAdminDailySummaryEmailText(summaryData);
      const subject = `REACH INTERNATIONAL — Daily Operations Summary (${ctx.today})`;

      const payload: AdminSummaryPayload = { subject, html, text };

      const result = await sendEmailWithTracking({
        to: admin.email,
        subject,
        html,
        text,
      });

      await supabase.from("notifications").insert({
        recipient_id: admin.id,
        machine_id: null,
        alert_type: "daily_summary",
        alert_date: ctx.today,
        channel: "email",
        status: result.success ? "sent" : "failed",
        email_message_id: result.messageId || null,
        provider_response: result.providerResponse ?? null,
        payload,
        retry_count: Math.max(0, (result.attempts ?? 1) - 1),
        error_message: result.error || null,
        sent_at: result.success ? new Date().toISOString() : null,
      });

      if (result.success) sent++;
      else failed++;
    });

  await mapWithConcurrency(ops, SEND_CONCURRENCY, (fn) => fn());
  return { sent, failed, skipped };
}

// ---------------------------------------------------------------------------
// Engineer Daily Summary
// ---------------------------------------------------------------------------

async function sendEngineerDailySummaries(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  ctx: ReturnType<typeof getDailySummaryContext>
): Promise<{ sent: number; failed: number; skipped: number }> {
  const { data: engineers, error: engErr } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("role", "engineer")
    .eq("status", "active");

  if (engErr) {
    console.error("Failed to fetch engineers:", engErr.message);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  if (!engineers || engineers.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const ops = engineers
    .filter((eng) => eng.email && eng.id)
    .map((eng) => async () => {
      // Idempotency: skip if already sent today
      const alreadySent = await hasSummaryNotification(eng.id, "engineer_summary", ctx.today);
      if (alreadySent) {
        skipped++;
        return;
      }

      const summaryData = await fetchEngineerDailySummaryData(
        eng.id,
        eng.full_name || "Engineer",
        ctx
      );

      // Only send if the engineer has relevant data (due tomorrow / overdue / completed today)
      const hasRelevantData =
        summaryData.dueTomorrowMachines.length > 0 ||
        summaryData.overdueMachines.length > 0 ||
        summaryData.completedServicesToday.length > 0;

      if (!hasRelevantData) {
        skipped++;
        return;
      }

      const html = getEngineerDailySummaryEmailHtml(summaryData);
      const text = getEngineerDailySummaryEmailText(summaryData);
      const subject = `REACH INTERNATIONAL — Your Daily Service Summary (${ctx.today})`;

      const result = await sendEmailWithTracking({
        to: eng.email,
        subject,
        html,
        text,
      });

      await supabase.from("notifications").insert({
        recipient_id: eng.id,
        machine_id: null,
        alert_type: "engineer_summary",
        alert_date: ctx.today,
        channel: "email",
        status: result.success ? "sent" : "failed",
        email_message_id: result.messageId || null,
        provider_response: result.providerResponse ?? null,
        payload: { subject, html, text },
        retry_count: Math.max(0, (result.attempts ?? 1) - 1),
        error_message: result.error || null,
        sent_at: result.success ? new Date().toISOString() : null,
      });

      if (result.success) sent++;
      else failed++;
    });

  await mapWithConcurrency(ops, SEND_CONCURRENCY, (fn) => fn());
  return { sent, failed, skipped };
}

// ---------------------------------------------------------------------------
// Main entry: sendDailyReminders
// ---------------------------------------------------------------------------

export async function sendDailyReminders(): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  error?: string;
}> {
  try {
    const supabase = createSupabaseAdminClient();
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    // ------------------------------------------------------------------
    // PART 1: Per-machine service reminders (engineer + customer + all admins)
    // ------------------------------------------------------------------
    const { data: machines, error: fetchError } = await supabase
      .from("machines")
      .select(`
        id,
        machine_code,
        machine_name,
        customer_name,
        customer_mobile,
        customer_email,
        next_service_due_date,
        engineer_id,
        users!engineer_id(full_name, phone, role, email)
      `)
      .eq("status", "active")
      .not("next_service_due_date", "is", null)
      .lte("next_service_due_date", tomorrow);

    if (fetchError) {
      return { success: false, sent: 0, failed: 0, error: fetchError.message };
    }

    // Fetch all active admins once (super_admin + admin roles)
    const { data: allAdmins } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("role", ["super_admin", "admin"])
      .eq("status", "active");

    const admins = allAdmins ?? [];

    let sentCount = 0;
    let failedCount = 0;

    if (machines && machines.length > 0) {
      const sendOps: Array<() => Promise<{ success: boolean; messageId?: string; error?: string }>> = [];
      const notificationInserts: Array<Record<string, unknown>> = [];

      for (const machine of machines) {
        const dueDate = machine.next_service_due_date;
        const diffTime = new Date(dueDate).getTime() - new Date(today).getTime();
        const diffDays = Math.ceil(diffTime / 86400000);

        let alertType: "today" | "tomorrow" | "overdue" | null = null;

        if (diffDays < 0) alertType = "overdue";
        else if (diffDays === 0) alertType = "today";
        else if (diffDays === 1) alertType = "tomorrow";

        if (!alertType) continue;

        const engineer = machine.users as { full_name?: string; phone?: string; role?: string; email?: string } | null;
        const engineerName = engineer?.full_name;
        const daysOverdue = alertType === "overdue" ? Math.abs(diffDays) : undefined;

        const reminderInfo: ServiceReminderData = {
          machineCode: machine.machine_code,
          machineName: machine.machine_name,
          customerName: machine.customer_name,
          customerMobile: machine.customer_mobile,
          dueDate,
          alertType,
          engineerName,
          daysOverdue,
        };

        const message = getServiceReminderMessage(reminderInfo);
        const subject = `Service ${alertType === "today" ? "Due Today" : alertType === "tomorrow" ? "Due Tomorrow" : "Overdue"} — ${machine.machine_code}`;

        // Engineer email
        if (engineer?.email && engineer.role === "engineer") {
          sendOps.push(async () => {
            const result = await sendNotification({
              to: engineer.email!,
              channel: "email",
              message,
              subject,
              recipientName: engineer.full_name || "Engineer",
              metadata: {
                machine_id: machine.id,
                machine_code: machine.machine_code,
                alert_type: alertType,
                due_date: dueDate,
                customer_name: machine.customer_name,
                recipient_type: "engineer",
              },
            });
            notificationInserts.push({
              machine_id: machine.id,
              recipient_id: machine.engineer_id,
              alert_type: alertType,
              alert_date: today,
              channel: "email",
              status: result.success ? "sent" : "failed",
              email_message_id: result.messageId || null,
              provider_response: result.providerResponse ?? null,
              error_message: result.error || null,
              retry_count: Math.max(0, (result.attempts ?? 1) - 1),
              sent_at: result.success ? new Date().toISOString() : null,
            });
            return result;
          });
        }

        // Customer email
        if (machine.customer_email) {
          sendOps.push(async () => {
            const result = await sendNotification({
              to: machine.customer_email,
              channel: "email",
              message,
              subject,
              recipientName: machine.customer_name,
              metadata: {
                machine_id: machine.id,
                machine_code: machine.machine_code,
                alert_type: alertType,
                due_date: dueDate,
                customer_name: machine.customer_name,
                recipient_type: "customer",
              },
            });
            notificationInserts.push({
              machine_id: machine.id,
              recipient_id: null,
              alert_type: alertType,
              alert_date: today,
              channel: "email",
              status: result.success ? "sent" : "failed",
              email_message_id: result.messageId || null,
              provider_response: result.providerResponse ?? null,
              error_message: result.error || null,
              retry_count: Math.max(0, (result.attempts ?? 1) - 1),
              sent_at: result.success ? new Date().toISOString() : null,
            });
            return result;
          });
        }

        // All admins (super_admin + admin roles) — individual machine due notifications
        for (const admin of admins) {
          if (!admin.email || !admin.id) continue;

          sendOps.push(async () => {
            const result = await sendNotification({
              to: admin.email,
              channel: "email",
              message,
              subject,
              recipientName: admin.full_name || "Admin",
              metadata: {
                machine_id: machine.id,
                machine_code: machine.machine_code,
                alert_type: alertType,
                due_date: dueDate,
                customer_name: machine.customer_name,
                recipient_type: "admin",
              },
            });
            notificationInserts.push({
              machine_id: machine.id,
              recipient_id: admin.id,
              alert_type: alertType,
              alert_date: today,
              channel: "email",
              status: result.success ? "sent" : "failed",
              email_message_id: result.messageId || null,
              provider_response: result.providerResponse ?? null,
              error_message: result.error || null,
              retry_count: Math.max(0, (result.attempts ?? 1) - 1),
              sent_at: result.success ? new Date().toISOString() : null,
            });
            return result;
          });
        }
      }

      const results = await mapWithConcurrency(sendOps, SEND_CONCURRENCY, (fn) => fn());
      for (const r of results) {
        if (r.success) sentCount++;
        else failedCount++;
      }

      if (notificationInserts.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < notificationInserts.length; i += CHUNK) {
          const chunk = notificationInserts.slice(i, i + CHUNK);
          await supabase.from("notifications").insert(chunk);
        }
      }
    }

    // ------------------------------------------------------------------
    // PART 2: Super Admin consolidated daily summary
    // ------------------------------------------------------------------
    const ctx = getDailySummaryContext();
    const adminSummary = await sendAdminDailySummaries(supabase, ctx);
    sentCount += adminSummary.sent;
    failedCount += adminSummary.failed;

    // ------------------------------------------------------------------
    // PART 3: Engineer individualized daily summary
    // ------------------------------------------------------------------
    const engineerSummary = await sendEngineerDailySummaries(supabase, ctx);
    sentCount += engineerSummary.sent;
    failedCount += engineerSummary.failed;

    // ------------------------------------------------------------------
    // PART 4: Audit trail
    // ------------------------------------------------------------------
    await logAudit({
      action: "reminders.sent",
      entity_type: "system",
      metadata: {
        sent: sentCount,
        failed: failedCount,
        date: today,
        admin_summary_sent: adminSummary.sent,
        admin_summary_failed: adminSummary.failed,
        admin_summary_skipped: adminSummary.skipped,
        engineer_summary_sent: engineerSummary.sent,
        engineer_summary_failed: engineerSummary.failed,
        engineer_summary_skipped: engineerSummary.skipped,
      },
    });

    // Invalidate caches
    revalidateTag(CACHE_TAGS.dashboard, "max");
    revalidateTag(CACHE_TAGS.notifications, "max");
    revalidatePath("/dashboard");

    return { success: true, sent: sentCount, failed: failedCount };
  } catch (error) {
    console.error("Failed to send daily reminders:", error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}