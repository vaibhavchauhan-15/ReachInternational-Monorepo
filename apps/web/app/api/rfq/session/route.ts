import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_FILE_SIZE_BYTES = 10485760; // 10MB
const MAX_FILES_PER_REQUEST = 5;

interface FileRequest {
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const files: FileRequest[] = body?.files || [];
    const draftId: string = body?.draft_id || crypto.randomUUID();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "No files specified for upload session." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_REQUEST} files per quote request.` },
        { status: 400 }
      );
    }

    // Validate files
    for (const f of files) {
      if (!ALLOWED_MIME_TYPES.has(f.mime_type)) {
        return NextResponse.json(
          {
            error: `File "${f.filename}" has unsupported type: ${f.mime_type}. Allowed: PDF, JPG, PNG, DOCX, XLSX.`,
          },
          { status: 400 }
        );
      }
      if (f.size_bytes > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `File "${f.filename}" exceeds 10MB limit.`,
          },
          { status: 400 }
        );
      }
    }

    const supabase = createSupabaseAdminClient();
    const uploads = [];

    for (const f of files) {
      const fileId = crypto.randomUUID();
      const ext = f.filename.split(".").pop()?.toLowerCase() || "bin";
      const storagePath = `rfq/${draftId}/${fileId}.${ext}`;

      const { data, error } = await supabase.storage
        .from("rfq-attachments")
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        console.error("[RFQ Upload Session] Error creating signed upload URL:", error);
        return NextResponse.json(
          { error: "Failed to generate upload URL. Please try again." },
          { status: 500 }
        );
      }

      uploads.push({
        id: fileId,
        filename: f.filename,
        storage_path: storagePath,
        signedUrl: data.signedUrl,
        token: data.token,
      });
    }

    return NextResponse.json({
      draft_id: draftId,
      uploads,
    });
  } catch (error) {
    console.error("[RFQ Upload Session] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error preparing upload session." },
      { status: 500 }
    );
  }
}
