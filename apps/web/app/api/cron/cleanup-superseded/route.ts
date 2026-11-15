import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Daily Cron: Remove files in user_files no longer referenced by user_documents
 * and older than 90 days.
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
    const cutoffTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Gather all actively referenced paths in user_documents
    const { data: activeDocs, error: docsError } = await admin
      .from("user_documents")
      .select("storage_path, thumb_path");

    if (docsError) {
      console.error("[cron:cleanup-superseded] Error fetching active docs:", docsError);
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    const activePaths = new Set<string>();
    for (const doc of activeDocs || []) {
      if (doc.storage_path) activePaths.add(doc.storage_path);
      if (doc.thumb_path) activePaths.add(doc.thumb_path);
    }

    // Also protect pending change requests
    const { data: pendingRequests } = await admin
      .from("document_change_requests")
      .select("staging_path, staging_thumb_path")
      .eq("status", "pending");

    for (const req of pendingRequests || []) {
      if (req.staging_path) activePaths.add(req.staging_path);
      if (req.staging_thumb_path) activePaths.add(req.staging_thumb_path);
    }

    let purgedCount = 0;
    const errors: string[] = [];
    const filesToPurge: string[] = [];

    // 2. Traverse documents folder in user_files
    // Folders under 'documents': user IDs
    const { data: userFolders, error: listUserFoldersError } = await admin.storage
      .from("user_files")
      .list("documents", { limit: 1000 });

    if (listUserFoldersError) {
      console.error("[cron:cleanup-superseded] Error listing documents:", listUserFoldersError);
      return NextResponse.json({ error: listUserFoldersError.message }, { status: 500 });
    }

    if (userFolders && userFolders.length > 0) {
      for (const userFolder of userFolders) {
        const userFolderPath = `documents/${userFolder.name}`;
        const { data: userFiles, error: subError } = await admin.storage
          .from("user_files")
          .list(userFolderPath, { limit: 100 });

        if (subError) {
          errors.push(`Error listing ${userFolderPath}: ${subError.message}`);
          continue;
        }

        if (userFiles && userFiles.length > 0) {
          for (const file of userFiles) {
            // Check subfolders if structured as documents/<userId>/<docType>/<uuid>.jpg
            if (file.id === null) {
              const docTypeFolderPath = `${userFolderPath}/${file.name}`;
              const { data: leafFiles } = await admin.storage
                .from("user_files")
                .list(docTypeFolderPath, { limit: 50 });

              for (const leaf of leafFiles || []) {
                const fullLeafPath = `${docTypeFolderPath}/${leaf.name}`;
                const isOlderThan90d = leaf.created_at && leaf.created_at < cutoffTime;
                if (isOlderThan90d && !activePaths.has(fullLeafPath)) {
                  filesToPurge.push(fullLeafPath);
                }
              }
            } else {
              // Legacy flat layout: documents/<userId>/<docType>.jpg
              const fullFilePath = `${userFolderPath}/${file.name}`;
              const isOlderThan90d = file.created_at && file.created_at < cutoffTime;
              if (isOlderThan90d && !activePaths.has(fullFilePath)) {
                filesToPurge.push(fullFilePath);
              }
            }
          }
        }
      }
    }

    // 3. Purge orphaned files older than 90 days
    if (filesToPurge.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < filesToPurge.length; i += CHUNK_SIZE) {
        const chunk = filesToPurge.slice(i, i + CHUNK_SIZE);
        const { data: removeData, error: removeError } = await admin.storage
          .from("user_files")
          .remove(chunk);

        if (removeError) {
          errors.push(`Error removing batch: ${removeError.message}`);
        } else {
          purgedCount += removeData?.length || chunk.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      purgedCount,
      activePathsCount: activePaths.size,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[cron:cleanup-superseded] Unhandled exception:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
