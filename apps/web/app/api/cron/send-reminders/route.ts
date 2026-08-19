import { NextResponse } from "next/server";
import { sendDailyReminders } from "@/app/actions/send-reminders";

export async function POST(request: Request) {
  try {
    // Verify QStash signature (if using Upstash QStash)
    const qstashSignature = request.headers.get("upstash-signature");
    const qstashCurrentSigned = request.headers.get("upstash-current-signed");

    if (process.env.NODE_ENV === "production") {
      if (!qstashSignature || !qstashCurrentSigned) {
        // If missing QStash signature, fallback to checking an explicit CRON_SECRET
        const authHeader = request.headers.get("authorization");
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
        }
      }
    } else if (!qstashSignature || !qstashCurrentSigned) {
      console.warn("Missing QStash signature - allowing direct access in development mode");
    }

    const result = await sendDailyReminders();

    if (result.success) {
      return NextResponse.json({
        success: true,
        sent: result.sent,
        failed: result.failed,
        message: result.error || "Reminders sent successfully",
      });
    } else {
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