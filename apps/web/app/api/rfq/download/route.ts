import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["super_admin", "admin", "sales"].includes(user.role)) {
      return NextResponse.json(
        { error: "Access denied. Insufficient permissions to download RFQ attachments." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get("path");
    if (!storagePath) {
      return NextResponse.json({ error: "Missing storage path parameter" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.storage
      .from("rfq-attachments")
      .createSignedUrl(storagePath, 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || "Failed to generate signed download URL." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
