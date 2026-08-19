import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  throw new Error("Twilio credentials are not configured in environment variables.");
}

const client = twilio(accountSid, authToken);

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
    const contentSid = process.env.TWILIO_CONTENT_SID;

    if (!contentSid) {
      throw new Error("TWILIO_CONTENT_SID is not configured in environment variables.");
    }

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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}