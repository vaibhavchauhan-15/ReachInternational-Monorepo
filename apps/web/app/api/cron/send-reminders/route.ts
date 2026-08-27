import { NextResponse } from "next/server";
import { sendDailyReminders } from "@/lib/notifications/send-reminders";
import {
  checkAndStoreIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
} from "@/lib/security/idempotency";

export async function POST(request: Request) {
  try {
    // SECURITY (F15): Cryptographically verify QStash webhook signatures or CRON_SECRET bearer token
    const qstashSignature = request.headers.get("upstash-signature");
    const qstashMessageId = request.headers.get("upstash-message-id");
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    const qstashCurrentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const qstashNextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (qstashCurrentSigningKey && qstashNextSigningKey && qstashSignature) {
      // Verify using @upstash/qstash Receiver
      try {
        const { Receiver } = await import("@upstash/qstash");
        const receiver = new Receiver({
          currentSigningKey: qstashCurrentSigningKey,
          nextSigningKey: qstashNextSigningKey,
        });
        const body = await request.clone().text();
        await receiver.verify({ signature: qstashSignature, body });
      } catch (verifyError) {
        console.error("[Cron] QStash signature verification failed:", verifyError);
        return NextResponse.json({ error: "Invalid QStash signature" }, { status: 401 });
      }
    } else if (cronSecret) {
      // Require CRON_SECRET bearer token across all environments when configured
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized cron request: Invalid CRON_SECRET" }, { status: 401 });
      }
    } else if (isProduction) {
      // In production, either QStash signing keys or CRON_SECRET MUST be configured
      return NextResponse.json({ error: "Unauthorized cron request: No signing keys or secret configured" }, { status: 401 });
    } else {
      console.warn("[Cron] Direct access allowed only in development mode when CRON_SECRET is unconfigured");
    }

    // Cron Replay Protection Key: use QStash Message ID or daily timestamp key
    const todayHourKey = new Date().toISOString().slice(0, 13); // e.g. 2026-08-26T12
    const cronIdempotencyKey = qstashMessageId || `cron-send-reminders-${todayHourKey}`;

    const idempotency = await checkAndStoreIdempotencyKey({
      userId: null, // System Cron execution
      actionName: "cron.sendReminders",
      idempotencyKey: cronIdempotencyKey,
      payload: { hourKey: todayHourKey },
    });

    if (idempotency.isDuplicate) {
      return NextResponse.json(
        idempotency.cachedResult || { success: true, message: "Reminders already processed for this period" }
      );
    }

    if (idempotency.isProcessing) {
      return NextResponse.json({ success: false, error: idempotency.error }, { status: 429 });
    }

    const result = await sendDailyReminders();

    if (result.success) {
      const responsePayload = {
        success: true,
        sent: result.sent,
        failed: result.failed,
        message: result.error || "Reminders sent successfully",
      };
      await completeIdempotencyKey(idempotency.idempotencyKey, idempotency.executionToken, responsePayload);
      return NextResponse.json(responsePayload);
    } else {
      await failIdempotencyKey(idempotency.idempotencyKey, idempotency.executionToken);
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send reminders" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Cron endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST method to trigger reminders" });
}