import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const isReadinessCheck = url.searchParams.get("check") === "ready";
  const release = process.env.NEXT_PUBLIC_APP_VERSION || "2026.08.27.01";
  const timestamp = new Date().toISOString();

  // 1. Liveness Check (Process is alive and responding)
  if (!isReadinessCheck) {
    return NextResponse.json(
      {
        status: "ok",
        type: "liveness",
        release,
        timestamp,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  // 2. Readiness Check (Verify database connectivity)
  try {
    const supabase = await createSupabaseServerClient();
    const start = performance.now();
    const { error } = await supabase.from("machines").select("id").limit(1);
    const dbLatencyMs = Math.round((performance.now() - start) * 100) / 100;

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          type: "readiness",
          release,
          db: "unhealthy",
          timestamp,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        type: "readiness",
        release,
        db: "healthy",
        dbLatencyMs,
        timestamp,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        type: "readiness",
        release,
        db: "unavailable",
        timestamp,
      },
      { status: 503 }
    );
  }
}
