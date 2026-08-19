"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { getServiceReminderMessage, ServiceReminderData } from "@/lib/notifications/templates";

export async function sendManualReminder(
  machineId: string,
  alertType: "today" | "tomorrow" | "overdue"
): Promise<{ success: boolean; sent: number; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, sent: 0, error: "Unauthorized." };
    }

    // Check role and status
    const { data: profile } = await supabase.from("users").select("role, status").eq("id", user.id).single();
    if (!profile || profile.status !== "active" || (profile.role !== "super_admin" && profile.role !== "admin")) {
      return { success: false, sent: 0, error: "Only active admins can send manual reminders." };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Fetch machine details
    const { data: machine, error: fetchError } = await adminSupabase
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
      .eq("id", machineId)
      .single();

    if (fetchError || !machine) {
      return { success: false, sent: 0, error: "Machine not found." };
    }

    const today = new Date().toISOString().split("T")[0];
    const diffTime = new Date(machine.next_service_due_date).getTime() - new Date(today).getTime();
    const diffDays = Math.ceil(diffTime / 86400000);

    let actualAlertType: "today" | "tomorrow" | "overdue" = alertType;

    // Auto-detect alert type if not specified or invalid
    if (diffDays < 0) {
      actualAlertType = "overdue";
    } else if (diffDays === 0) {
      actualAlertType = "today";
    } else if (diffDays === 1) {
      actualAlertType = "tomorrow";
    }

    const engineer = machine.users as { full_name?: string; phone?: string; role?: string; email?: string } | null;
    const daysOverdue = actualAlertType === "overdue" ? Math.abs(diffDays) : undefined;

    const reminderInfo: ServiceReminderData = {
      machineCode: machine.machine_code,
      machineName: machine.machine_name,
      customerName: machine.customer_name,
      customerMobile: machine.customer_mobile,
      dueDate: machine.next_service_due_date,
      alertType: actualAlertType,
      engineerName: engineer?.full_name,
      daysOverdue,
    };

    const message = getServiceReminderMessage(reminderInfo);
    const subject = `Service ${actualAlertType === "today" ? "Due Today" : actualAlertType === "tomorrow" ? "Due Tomorrow" : "Overdue"} — ${machine.machine_code}`;
    let sentCount = 0;

    // Send email to engineer (if assigned & has email)
    if (engineer?.email && engineer.role === "engineer") {
      const engineerResult = await sendNotification({
        to: engineer.email,
        channel: "email",
        message,
        subject,
        recipientName: engineer.full_name || "Engineer",
        metadata: {
          machine_id: machine.id,
          machine_code: machine.machine_code,
          alert_type: actualAlertType,
          due_date: machine.next_service_due_date,
          customer_name: machine.customer_name,
          recipient_type: "engineer",
          manual: true,
        },
      });

      if (engineerResult.success) {
        sentCount++;
        await adminSupabase.from("notifications").insert({
          machine_id: machine.id,
          recipient_id: machine.engineer_id,
          alert_type: actualAlertType,
          alert_date: today,
          channel: "email",
          status: "sent",
          email_message_id: engineerResult.messageId,
          sent_at: new Date().toISOString(),
        });
      }
    }

    // Send email to customer (if customer_email exists)
    if (machine.customer_email) {
      const customerResult = await sendNotification({
        to: machine.customer_email,
        channel: "email",
        message,
        subject,
        recipientName: machine.customer_name,
        metadata: {
          machine_id: machine.id,
          machine_code: machine.machine_code,
          alert_type: actualAlertType,
          due_date: machine.next_service_due_date,
          customer_name: machine.customer_name,
          recipient_type: "customer",
          manual: true,
        },
      });

      if (customerResult.success) {
        sentCount++;
        await adminSupabase.from("notifications").insert({
          machine_id: machine.id,
          recipient_id: null,
          alert_type: actualAlertType,
          alert_date: today,
          channel: "email",
          status: "sent",
          email_message_id: customerResult.messageId,
          sent_at: new Date().toISOString(),
        });
      }
    }

    await logAudit({
      action: "manual.reminder.sent",
      entity_type: "machine",
      entity_id: machineId,
      metadata: { alert_type: actualAlertType, sent_count: sentCount },
    });

    return { success: true, sent: sentCount };
  } catch (error) {
    console.error("Failed to send manual reminder:", error);
    return { success: false, sent: 0, error: error instanceof Error ? error.message : "Unknown error" };
  }
}