import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SECRET_KEY;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("close_expired_job_postings");

    if (error) {
      console.error("[cron:close-expired-jobs] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const count = Number(data || 0);
    if (count > 0) {
      revalidateTag(TAGS.hiringList, "max");
      revalidateTag(TAGS.hiringKpis, "max");
      revalidateTag(TAGS.careersList, "max");
    }

    return NextResponse.json({
      success: true,
      closed_count: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[cron:close-expired-jobs] Unhandled exception:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
