import "server-only";
import twilio from "twilio";

function getTwilioClient(): { client: ReturnType<typeof twilio>; fromNumber: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SMS_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return {
    client: twilio(accountSid, authToken),
    fromNumber,
  };
}

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
    const twilioSetup = getTwilioClient();
    if (!twilioSetup) {
      console.warn("Twilio SMS is not configured in environment variables. SMS delivery skipped.");
      return {
        success: false,
        error: "Twilio SMS credentials are not configured in environment variables.",
      };
    }

    const { client, fromNumber } = twilioSetup;
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
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: msg,
    };
  }
}