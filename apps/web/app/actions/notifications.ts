"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { sendEmailWithTracking } from "@/lib/email";
import { requireRole } from "@/lib/dal";
import { CACHE_TAGS } from "@/lib/cache";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

export async function resendNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
  if (!isValidUuid(notificationId)) {
    return { success: false, error: "Invalid notification ID format." };
  }
  const user = await requireRole("admin", "super_admin");

  if (!user) {
    return { success: false, error: "Only active admins can resend notifications." };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch target notification
  const { data: notif, error: fetchErr } = await supabase
    .from("notifications")
    .select("*, machine:machines(machine_code, machine_name, customer_name, customer_email), recipient:users(phone, email, full_name)")
    .eq("id", notificationId)
    .single();

  if (fetchErr || !notif) {
    return { success: false, error: "Notification not found." };
  }

  // Determine recipient email
  const adminSupabase = createSupabaseAdminClient();
  const { data: recipientData } = await adminSupabase
    .from("users")
    .select("email, full_name")
    .eq("id", notif.recipient_id)
    .single();

  const recipientEmail = recipientData?.email || notif.machine?.customer_email;

  if (!recipientEmail) {
    return { success: false, error: "Recipient email address not found." };
  }

  // Detailed summary emails store the full rendered payload (subject, html, text)
  // so a resend can reproduce the original message exactly.
  const isSummary =
    notif.alert_type === "daily_summary" || notif.alert_type === "engineer_summary";

  const storedPayload = (notif.payload as { subject?: string; html?: string; text?: string } | null) ?? null;
  const payloadHtml = storedPayload?.html;
  const payloadSubject = storedPayload?.subject;
  const payloadText = storedPayload?.text;

  const sendResult = isSummary && payloadHtml && payloadSubject
    ? await sendEmailWithTracking({
        to: recipientEmail,
        subject: payloadSubject,
        html: payloadHtml,
        text: payloadText || payloadSubject,
      })
    : await sendNotification({
        to: recipientEmail,
        channel: "email",
        message: `This is a reminder regarding machine ${notif.machine?.machine_code || ""} (${notif.machine?.machine_name || ""}). Please check the REACH INTERNATIONAL dashboard for details.`,
        subject: `Service ${notif.alert_type === "today" ? "Due Today" : notif.alert_type === "tomorrow" ? "Due Tomorrow" : "Overdue"} — ${notif.machine?.machine_code || "MCH-XXXX"}`,
        recipientName: recipientData?.full_name || notif.machine?.customer_name || "Customer",
        metadata: {
          machine_id: notif.machine_id,
          machine_code: notif.machine?.machine_code,
          alert_type: notif.alert_type,
          due_date: notif.alert_date,
          customer_name: notif.machine?.customer_name,
        },
      });

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("notifications")
    .update({
      status: sendResult.success ? "sent" : "failed",
      email_message_id: sendResult.messageId || null,
      provider_response: sendResult.providerResponse ?? notif.provider_response ?? null,
      error_message: sendResult.error || null,
      retry_count: (notif.retry_count || 0) + 1,
      sent_at: sendResult.success ? now : null,
    })
    .eq("id", notificationId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await logAudit({
    action: "notification.resent",
    entity_type: "notification",
    entity_id: notificationId,
    metadata: {
      alert_type: notif.alert_type,
      recipient_id: notif.recipient_id,
      machine_id: notif.machine_id,
    },
  });

  revalidatePath("/notifications");
  revalidateTag(CACHE_TAGS.notifications, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { success: !updateErr };
}