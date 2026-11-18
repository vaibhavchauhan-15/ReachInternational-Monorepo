import { NextRequest, NextResponse } from "next/server";
import { processPendingApprovalOutboxItems } from "@/lib/server/approvals-outbox";

export const dynamic = "force-dynamic";

/**
 * Transactional Approval Outbox Worker
 * Triggered periodically via QStash / Cron or on fast-path commit to process
 * pending side-effects (push notifications, emails, file movements, and account deletion).
 */
export async function POST(req: NextRequest) {
  try {
    // Verify bearer token or cron secret if configured
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In production/staging, block unauthorized triggers
      const isDev = process.env.NODE_ENV === "development";
      if (!isDev) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const res = await processPendingApprovalOutboxItems(25);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    return NextResponse.json(res);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
