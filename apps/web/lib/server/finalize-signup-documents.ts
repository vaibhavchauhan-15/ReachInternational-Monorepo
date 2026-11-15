import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "node:crypto";
import { DOC_UPLOAD, type DocType } from "@reachinternational/utils";

const DOC_TYPES_TO_PROCESS: DocType[] = [
  "bank_document",
  "aadhaar",
  "driving_license",
];

export interface FinalizeStagedDocumentsResult {
  success: boolean;
  finalizedCount: number;
  documents: Array<{
    docType: DocType;
    mainPath: string;
    thumbPath: string | null;
    sizeBytes: number;
  }>;
  error?: string;
}

/**
 * Transfers verified staging documents from bucket `doc_staging` to bucket `user_files`.
 * Executes parallel server-side moves with { destinationBucket: "user_files" }
 * and performs a single array upsert into `public.user_documents`.
 * Zero file bytes pass through Vercel or client memory.
 */
export async function finalizeStagedSignupDocuments(params: {
  userId: string;
  stagingUuid: string;
}): Promise<FinalizeStagedDocumentsResult> {
  const { userId, stagingUuid } = params;
  const adminSupabase = createSupabaseAdminClient();

  // Track moved paths for atomic compensation if subsequent steps fail
  const movedOperations: Array<{
    sourceBucket: "doc_staging" | "user_files";
    destBucket: "doc_staging" | "user_files";
    stagingPath: string;
    userFilesPath: string;
  }> = [];

  try {
    // 1. Inspect existing staged files in bucket doc_staging
    const stagingPrefix = `signup/${stagingUuid}`;
    const { data: stagedFiles, error: listErr } = await adminSupabase.storage
      .from("doc_staging")
      .list(stagingPrefix);

    if (listErr || !stagedFiles) {
      throw new Error(`Failed to list staging documents: ${listErr?.message || "Unknown error"}`);
    }

    const availableNames = new Set(stagedFiles.map((f) => f.name));
    const stagedFileMap = new Map(stagedFiles.map((f) => [f.name, f]));

    interface PendingTransfer {
      docType: DocType;
      fileUuid: string;
      mainStaging: string;
      finalMainPath: string;
      thumbStaging: string | null;
      finalThumbPath: string | null;
      sizeBytes: number;
    }

    const pendingTransfers: PendingTransfer[] = [];

    for (const docType of DOC_TYPES_TO_PROCESS) {
      const mainName = `${docType}.jpg`;
      const thumbName = `${docType}_thumb.jpg`;

      if (availableNames.has(mainName)) {
        const fileUuid = crypto.randomUUID();
        const mainStaging = `${stagingPrefix}/${mainName}`;
        const finalMainPath = `documents/${userId}/${docType}/${fileUuid}.jpg`;

        const hasThumb = availableNames.has(thumbName);
        const thumbStaging = hasThumb ? `${stagingPrefix}/${thumbName}` : null;
        const finalThumbPath = hasThumb ? `documents/${userId}/${docType}/${fileUuid}_thumb.jpg` : null;

        const mainMeta = stagedFileMap.get(mainName)?.metadata;
        const sizeBytes = typeof mainMeta?.size === "number" ? mainMeta.size : 0;

        pendingTransfers.push({
          docType,
          fileUuid,
          mainStaging,
          finalMainPath,
          thumbStaging,
          finalThumbPath,
          sizeBytes,
        });
      }
    }

    if (pendingTransfers.length === 0) {
      return {
        success: true,
        finalizedCount: 0,
        documents: [],
      };
    }

    // 2. Execute parallel server-side move() for all main files and thumbnails
    const movePromises: Promise<void>[] = [];

    for (const item of pendingTransfers) {
      // Main file move
      movePromises.push(
        adminSupabase.storage
          .from("doc_staging")
          .move(item.mainStaging, item.finalMainPath, { destinationBucket: "user_files" })
          .then(({ error }) => {
            if (error) {
              throw new Error(`Failed to move ${item.mainStaging} to user_files: ${error.message}`);
            }
            movedOperations.push({
              sourceBucket: "doc_staging",
              destBucket: "user_files",
              stagingPath: item.mainStaging,
              userFilesPath: item.finalMainPath,
            });
          })
      );

      // Thumbnail file move (if present)
      if (item.thumbStaging && item.finalThumbPath) {
        const thumbSrc = item.thumbStaging;
        const thumbDst = item.finalThumbPath;
        movePromises.push(
          adminSupabase.storage
            .from("doc_staging")
            .move(thumbSrc, thumbDst, { destinationBucket: "user_files" })
            .then(({ error }) => {
              if (error) {
                console.warn(`[Finalize] Thumbnail move failed for ${thumbSrc}:`, error.message);
                // Thumbnail move failure is non-fatal if main succeeded, but log it
              } else {
                movedOperations.push({
                  sourceBucket: "doc_staging",
                  destBucket: "user_files",
                  stagingPath: thumbSrc,
                  userFilesPath: thumbDst,
                });
              }
            })
        );
      }
    }

    await Promise.all(movePromises);

    // 3. Batch array upsert of all user_documents records in one call
    const nowIso = new Date().toISOString();
    const recordsToUpsert = pendingTransfers.map((item) => ({
      user_id: userId,
      document_type_code: item.docType,
      storage_path: item.finalMainPath,
      thumb_path: item.finalThumbPath,
      mime_type: DOC_UPLOAD.mime,
      file_size_bytes: item.sizeBytes,
      file_name: `${item.docType}.jpg`,
      verification_status: "pending",
      status: "pending",
      updated_at: nowIso,
    }));

    const { error: upsertErr } = await adminSupabase.from("user_documents").upsert(
      recordsToUpsert,
      { onConflict: "user_id,document_type_code" }
    );

    if (upsertErr) {
      throw new Error(`Failed to batch upsert user_documents: ${upsertErr.message}`);
    }

    const finalizedDocs = pendingTransfers.map((item) => ({
      docType: item.docType,
      mainPath: item.finalMainPath,
      thumbPath: item.finalThumbPath,
      sizeBytes: item.sizeBytes,
    }));

    return {
      success: true,
      finalizedCount: finalizedDocs.length,
      documents: finalizedDocs,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[FinalizeStagedDocuments] Transfer error, executing staging compensation:", errorMsg);

    // Rollback moved files back to doc_staging so staged files remain intact for user retry
    if (movedOperations.length > 0) {
      await Promise.allSettled(
        movedOperations.map((op) =>
          adminSupabase.storage
            .from(op.destBucket)
            .move(op.userFilesPath, op.stagingPath, { destinationBucket: op.sourceBucket })
        )
      );
    }

    return {
      success: false,
      finalizedCount: 0,
      documents: [],
      error: errorMsg,
    };
  }
}
