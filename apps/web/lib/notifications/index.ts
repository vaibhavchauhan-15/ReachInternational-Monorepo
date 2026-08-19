import { sendEmailWithTracking } from "@/lib/email";
import { getServiceReminderEmailHtml } from "@/lib/notifications/email-templates";

export type NotificationChannel = "email" | "whatsapp" | "sms";

export interface NotificationPayload {
  to: string;
  channel: NotificationChannel;
  message: string;
  metadata?: Record<string, unknown>;
  recipientName?: string;
  subject?: string;
}

export interface NotificationSendResult {
  success: boolean;
  messageId?: string;
  providerResponse?: Record<string, unknown>;
  error?: string;
  attempts: number;
}

export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationSendResult> {
  try {
    if (payload.channel === "email") {
      // Send via SendGrid with delivery verification + retry.
      const subject = payload.subject || "ServiceCentric Notification";
      const html = getServiceReminderEmailHtml({
        subject,
        message: payload.message,
        recipientName: payload.recipientName || "Customer",
        alertType: (payload.metadata?.alert_type as string) || "reminder",
        machineCode: (payload.metadata?.machine_code as string) || (payload.metadata?.machine_id as string) || "MCH-XXXX",
        dueDate: (payload.metadata?.due_date as string) || "",
        customerName: (payload.metadata?.customer_name as string) || "",
      });

      const result = await sendEmailWithTracking({
        to: payload.to,
        subject,
        html,
        text: payload.message,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        providerResponse: result.providerResponse,
        error: result.error,
        attempts: result.attempts,
      };
    }

    // WhatsApp and SMS are kept for future use — dynamically import so
    // Twilio credentials don't block email-only deployments.
    if (payload.channel === "whatsapp") {
      const { sendWhatsAppMessage } = await import("./whatsapp");
      const result = await sendWhatsAppMessage(payload.to, payload.message);
      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        attempts: 1,
      };
    }

    if (payload.channel === "sms") {
      const { sendSMS } = await import("./sms");
      const result = await sendSMS(payload.to, payload.message);
      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        attempts: 1,
      };
    }

    return { success: false, error: `Unsupported channel: ${payload.channel}`, attempts: 0 };
  } catch (error) {
    console.error("Failed to send notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      attempts: 0,
    };
  }
}
