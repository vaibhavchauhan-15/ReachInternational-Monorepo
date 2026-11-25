import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DOC_UPLOAD, type DocType } from "@reachinternational/utils";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const adminSupabase = createSupabaseAdminClient();
    let authUser: { id: string } | null = null;

    // 1. Dual authentication: Bearer token (Mobile) or Cookie session (Web)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data, error } = await adminSupabase.auth.getUser(token);
      if (!error && data?.user) {
        authUser = data.user;
      }
    }

    if (!authUser) {
      try {
        const supabase = await createSupabaseServerClient();
        const { data, error: authErr } = await supabase.auth.getUser();
        if (!authErr && data?.user) {
          authUser = data.user;
        }
      } catch {
        // Fallback handled below
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const userId = authUser.id;

    // 2. Fetch existing user_documents and active pending change requests
    const [docsRes, changeReqsRes] = await Promise.all([
      adminSupabase
        .from("user_documents")
        .select(
          "id, user_id, document_type_code, storage_path, thumb_path, mime_type, file_size_bytes, file_name, verification_status, rejection_reason, created_at, updated_at"
        )
        .eq("user_id", userId)
        .order("document_type_code"),
      adminSupabase
        .from("document_change_requests")
        .select("id, user_id, document_type_code, staging_path, staging_thumb_path, status, rejection_reason, reviewed_at, created_at")
        .eq("user_id", userId)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false }),
    ]);

    if (docsRes.error) {
      console.error("[MyDocumentsAPI] Error querying user_documents:", docsRes.error);
    }

    const docs = docsRes.data || [];
    const changeReqs = changeReqsRes.data || [];

    // 3. Batch generate signed URLs for fast thumbnail and preview rendering
    const userFilesPaths = [
      ...docs.map((d) => d.storage_path).filter(Boolean),
      ...docs.map((d) => d.thumb_path).filter(Boolean),
    ];
    const stagingPaths = [
      ...changeReqs.map((r) => r.staging_path).filter(Boolean),
      ...changeReqs.map((r) => r.staging_thumb_path).filter(Boolean),
    ];

    const [userFilesSignedRes, stagingSignedRes] = await Promise.all([
      userFilesPaths.length > 0
        ? adminSupabase.storage
            .from("user_files")
            .createSignedUrls(Array.from(new Set(userFilesPaths)), 3600)
        : { data: [] },
      stagingPaths.length > 0
        ? adminSupabase.storage
            .from("doc_staging")
            .createSignedUrls(Array.from(new Set(stagingPaths)), 3600)
        : { data: [] },
    ]);

    const userFilesMap = new Map<string, string>();
    if (userFilesSignedRes.data) {
      for (const item of userFilesSignedRes.data) {
        if (item?.signedUrl && item.path) userFilesMap.set(item.path, item.signedUrl);
      }
    }

    const stagingMap = new Map<string, string>();
    if (stagingSignedRes.data) {
      for (const item of stagingSignedRes.data) {
        if (item?.signedUrl && item.path) stagingMap.set(item.path, item.signedUrl);
      }
    }

    const changeReqMap = new Map<string, any>();
    for (const cr of changeReqs) {
      if (!changeReqMap.has(cr.document_type_code)) {
        changeReqMap.set(cr.document_type_code, cr);
      }
    }

    const coveredTypes = new Set<string>();
    const items: Array<any> = [];

    // Format existing documents
    for (const doc of docs) {
      coveredTypes.add(doc.document_type_code);
      const cr = changeReqMap.get(doc.document_type_code);

      const isPending = cr?.status === "pending";
      const isRejected = cr?.status === "rejected";

      const hasPendingReplacement = Boolean(isPending);
      const hasRejectedReplacement = Boolean(isRejected);

      const pendingThumbSignedUrl = isPending
        ? cr?.staging_thumb_path
          ? stagingMap.get(cr.staging_thumb_path) || null
          : cr?.staging_path
          ? stagingMap.get(cr.staging_path) || null
          : null
        : null;
      const pendingSignedUrl = isPending && cr?.staging_path ? stagingMap.get(cr.staging_path) || null : null;

      const rejectedThumbSignedUrl = isRejected
        ? cr?.staging_thumb_path
          ? stagingMap.get(cr.staging_thumb_path) || null
          : cr?.staging_path
          ? stagingMap.get(cr.staging_path) || null
          : null
        : null;
      const rejectedSignedUrl = isRejected && cr?.staging_path ? stagingMap.get(cr.staging_path) || null : null;

      const originalThumbUrl = doc.thumb_path ? userFilesMap.get(doc.thumb_path) || null : userFilesMap.get(doc.storage_path) || null;
      const originalSignedUrl = userFilesMap.get(doc.storage_path) || null;

      // When replacement is pending, prioritize the new replacement thumbnail and preview
      // When replacement is rejected, the user STILL HAS the active original older document displayed as primary
      const displayThumbUrl = hasPendingReplacement ? (pendingThumbSignedUrl || originalThumbUrl) : originalThumbUrl;
      const displaySignedUrl = hasPendingReplacement ? (pendingSignedUrl || originalSignedUrl) : originalSignedUrl;

      items.push({
        id: doc.id,
        user_id: doc.user_id,
        document_type_code: doc.document_type_code as DocType,
        storage_path: hasPendingReplacement && cr?.staging_path ? cr.staging_path : doc.storage_path,
        thumb_path: hasPendingReplacement && cr?.staging_thumb_path ? cr.staging_thumb_path : doc.thumb_path,
        mime_type: doc.mime_type,
        file_size_bytes: doc.file_size_bytes,
        file_name: doc.file_name,
        verification_status: hasPendingReplacement ? "pending" : (doc.verification_status as "pending" | "verified" | "rejected"),
        rejection_reason: hasPendingReplacement ? null : doc.rejection_reason,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        thumbSignedUrl: displayThumbUrl,
        signedUrl: displaySignedUrl,
        hasPendingReplacement,
        pendingRequestId: isPending ? cr?.id || null : null,
        pendingThumbSignedUrl,
        pendingSignedUrl,
        pendingCreatedAt: isPending ? cr?.created_at || null : null,
        hasRejectedReplacement,
        rejectedReplacement: isRejected && cr ? {
          id: cr.id,
          document_type_code: cr.document_type_code as DocType,
          rejectionReason: cr.rejection_reason || "Document replacement rejected by administrator.",
          reviewedAt: cr.reviewed_at,
          stagingPath: cr.staging_path,
          signedUrl: rejectedSignedUrl,
          thumbSignedUrl: rejectedThumbSignedUrl,
        } : null,
        originalVerificationStatus: doc.verification_status,
      });
    }

    // Include any document types that only exist in pending change requests (e.g. first-time upload from profile)
    for (const cr of changeReqs) {
      if (!coveredTypes.has(cr.document_type_code)) {
        coveredTypes.add(cr.document_type_code);
        const thumbUrl = cr.staging_thumb_path
          ? stagingMap.get(cr.staging_thumb_path) || null
          : stagingMap.get(cr.staging_path) || null;
        const fullUrl = stagingMap.get(cr.staging_path) || null;

        items.push({
          id: cr.id,
          user_id: userId,
          document_type_code: cr.document_type_code as DocType,
          storage_path: cr.staging_path,
          thumb_path: cr.staging_thumb_path,
          mime_type: "image/jpeg",
          file_size_bytes: 0,
          file_name: `${cr.document_type_code}.jpg`,
          verification_status: "pending",
          rejection_reason: null,
          created_at: cr.created_at,
          updated_at: cr.created_at,
          thumbSignedUrl: thumbUrl,
          signedUrl: fullUrl,
          hasPendingReplacement: true,
          isPendingChangeRequest: true,
          pendingRequestId: cr.id,
          pendingThumbSignedUrl: thumbUrl,
          pendingSignedUrl: fullUrl,
          pendingCreatedAt: cr.created_at,
          originalVerificationStatus: "pending",
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        documents: items,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[MyDocumentsAPI] Fatal error:", errorMsg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
