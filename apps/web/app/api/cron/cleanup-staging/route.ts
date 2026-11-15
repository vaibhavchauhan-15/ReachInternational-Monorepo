import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Hourly Cron: Remove doc_staging sessions older than 24 hours.
 * Uses the Supabase Storage API exclusively (never direct SQL on storage.objects).
 * Protected by CRON_SECRET authorization header.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SECRET_KEY;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let removedCount = 0;
    const errors: string[] = [];

    // 1. List top-level folders / sessions in doc_staging
    const { data: topItems, error: listError } = await admin.storage
      .from("doc_staging")
      .list("", { limit: 1000 });

    if (listError) {
      console.error("[cron:cleanup-staging] Error listing doc_staging:", listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    if (!topItems || topItems.length === 0) {
      return NextResponse.json({
        success: true,
        removedCount: 0,
        message: "No staging files found",
        timestamp: new Date().toISOString(),
      });
    }

    const filesToRemove: string[] = [];

    for (const item of topItems) {
      if (item.id === null) {
        // It's a folder (e.g., session UUID folder)
        const folderName = item.name;
        const { data: sessionFiles, error: subError } = await admin.storage
          .from("doc_staging")
          .list(folderName, { limit: 100 });

        if (subError) {
          errors.push(`Error listing folder ${folderName}: ${subError.message}`);
          continue;
        }

        if (sessionFiles && sessionFiles.length > 0) {
          // Check if any file in this session folder is older than 24h
          const isOlderThan24h = sessionFiles.some(
            (f) => f.created_at && f.created_at < cutoffTime
          );

          if (isOlderThan24h) {
            for (const f of sessionFiles) {
              filesToRemove.push(`${folderName}/${f.name}`);
            }
          }
        }
      } else {
        // Direct root file in doc_staging
        if (item.created_at && item.created_at < cutoffTime) {
          filesToRemove.push(item.name);
        }
      }
    }

    // 2. Batch remove stale staging files (in chunks of 100)
    if (filesToRemove.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < filesToRemove.length; i += CHUNK_SIZE) {
        const chunk = filesToRemove.slice(i, i + CHUNK_SIZE);
        const { data: removeData, error: removeError } = await admin.storage
          .from("doc_staging")
          .remove(chunk);

        if (removeError) {
          errors.push(`Error removing batch: ${removeError.message}`);
        } else {
          removedCount += removeData?.length || chunk.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      removedCount,
      filesEvaluated: topItems.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[cron:cleanup-staging] Unhandled exception:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
