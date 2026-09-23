import { NextRequest, NextResponse } from "next/server";
import { getDocumentViewUrlAction } from "@/app/actions/documents";

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

    const result = await getDocumentViewUrlAction({ documentId: id });
    if (!result.success || !result.signedUrl) {
      return NextResponse.json(
        { error: result.error || "Document not accessible" },
        { status: 403 }
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
