import "server-only";
import twilio from "twilio";

function getTwilioClient(): { client: ReturnType<typeof twilio>; fromNumber: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return {
    client: twilio(accountSid, authToken),
    fromNumber,
  };
}

export interface WhatsAppMessageOptions {
  to: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppTemplateData {
  engineerName: string;
  machineCode: string;
  customerName: string;
  dueDate: string;
}

export async function sendWhatsAppReminder(
  to: string,
  data: WhatsAppTemplateData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const twilioSetup = getTwilioClient();
    if (!twilioSetup) {
      console.warn("Twilio WhatsApp credentials are not configured in environment variables. Message skipped.");
      return {
        success: false,
        error: "Twilio credentials are not configured in environment variables.",
      };
    }

    const contentSid = process.env.TWILIO_CONTENT_SID;
    if (!contentSid) {
      return {
        success: false,
        error: "TWILIO_CONTENT_SID is not configured in environment variables.",
      };
    }

    const { client, fromNumber } = twilioSetup;

    let formattedTo = to;
    if (!formattedTo.startsWith("+")) {
      formattedTo = formattedTo.length === 10 ? `+91${formattedTo}` : `+${formattedTo}`;
    }

    const response = await client.messages.create({
      from: fromNumber,
      to: `whatsapp:${formattedTo}`,
      contentSid,
      contentVariables: JSON.stringify({
        "1": data.engineerName,
        "2": data.machineCode,
        "3": data.customerName,
        "4": data.dueDate,
      }),
    });

    return {
      success: true,
      messageId: response.sid,
    };
  } catch (error) {
    console.error("Twilio WhatsApp template send failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const twilioSetup = getTwilioClient();
    if (!twilioSetup) {
      console.warn("Twilio WhatsApp credentials are not configured in environment variables. Message skipped.");
      return {
        success: false,
        error: "Twilio credentials are not configured in environment variables.",
      };
    }

    const { client, fromNumber } = twilioSetup;

    let formattedTo = to;
    if (!formattedTo.startsWith("+")) {
      formattedTo = formattedTo.length === 10 ? `+91${formattedTo}` : `+${formattedTo}`;
    }

    const response = await client.messages.create({
      from: fromNumber,
      to: `whatsapp:${formattedTo}`,
      body: message,
    });

    return {
      success: true,
      messageId: response.sid,
    };
  } catch (error) {
    console.error("Twilio WhatsApp send failed:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: msg,
    };
  }
}