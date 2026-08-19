import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_SMS_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  throw new Error("Twilio SMS credentials are not configured in environment variables.");
}

const client = twilio(accountSid, authToken);

export interface SMSMessageOptions {
  to: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await client.messages.create({
      from: fromNumber,
      to: to,
      body: message,
    });

    return {
      success: true,
      messageId: response.sid,
    };
  } catch (error) {
    console.error("Twilio SMS send failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}