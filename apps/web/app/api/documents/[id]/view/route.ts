import { NextRequest, NextResponse } from "next/server";
import { getDocumentViewUrlAction } from "@/app/actions/documents";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid Document ID is required" },
        { status: 400 }
      );
    }

    const result = await getDocumentViewUrlAction({ documentId: id });
    if (!result.success || !result.signedUrl) {
      const err = result.error || "Document not accessible";
      const isNotFound = err.toLowerCase().includes("not found");
      const isForbidden = err.toLowerCase().includes("permission") || err.toLowerCase().includes("unauthorized");
      const status = isNotFound ? 404 : isForbidden ? 403 : 500;

      return NextResponse.json(
        { success: false, error: err },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: result.signedUrl,
      title: result.title,
      mimeType: result.mimeType,
      fileName: result.fileName,
      fileSizeBytes: result.fileSizeBytes,
    });
  } catch (err: unknown) {
    console.error("[DocumentsAPI] Error fetching document view url:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while accessing the document." },
      { status: 500 }
    );
  }
}
