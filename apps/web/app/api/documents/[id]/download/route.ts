import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifySession, getCurrentUserRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    // 1. Authenticate session
    const session = await verifySession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (await getCurrentUserRole()) || "operator";
    const supabase = await createSupabaseServerClient();

    // 2. Fetch document record
    const { data: doc, error: docError } = await supabase
      .from("user_documents")
      .select("id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, file_name")
      .eq("id", id)
      .maybeSingle();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 3. Authorization check: owner or privileged role
    const isOwner = doc.user_id === session.userId;
    const isPrivileged = ["super_admin", "admin", "hr"].includes(role);

    if (!isOwner && !isPrivileged) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Download file binary via admin client from Supabase storage
    const adminClient = createSupabaseAdminClient();
    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from("user_files")
      .download(doc.storage_path);

    if (downloadError || !fileBlob) {
      // Fallback: Generate signed URL with download disposition
      const { data: urlData } = await adminClient.storage
        .from("user_files")
        .createSignedUrl(doc.storage_path, 60, {
          download: doc.file_name || doc.document_type_code || "document",
        });

      if (urlData?.signedUrl) {
        return NextResponse.redirect(urlData.signedUrl);
      }

      return NextResponse.json(
        { error: "Failed to download document from storage" },
        { status: 500 }
      );
    }

    // 5. Audit log download
    void logAudit({
      action: "document.downloaded",
      entity_type: "user_document",
      entity_id: doc.id,
      user_id: session.userId,
      metadata: {
        document_type: doc.document_type_code,
        owner_id: doc.user_id,
        mime_type: doc.mime_type,
        file_name: doc.file_name,
        role,
      },
    });

    // 6. Format safe filename
    let filename = doc.file_name || doc.document_type_code || "document";
    const ext =
      doc.storage_path.split(".").pop() ||
      (doc.mime_type === "application/pdf"
        ? "pdf"
        : doc.mime_type?.includes("png")
        ? "png"
        : doc.mime_type?.includes("jpeg") || doc.mime_type?.includes("jpg")
        ? "jpg"
        : doc.mime_type?.includes("webp")
        ? "webp"
        : "pdf");

    if (!filename.includes(".")) {
      filename = `${filename}.${ext}`;
    }

    const safeFilename = filename.replace(/["\r\n]/g, "_");
    const encodedFilename = encodeURIComponent(safeFilename);
    const arrayBuffer = await fileBlob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": doc.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(arrayBuffer.byteLength),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("Exception in document download API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
