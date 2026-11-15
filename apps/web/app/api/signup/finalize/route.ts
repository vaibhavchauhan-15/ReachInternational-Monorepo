import { NextRequest, NextResponse } from "next/server";
import { verifyUploadSessionToken } from "@/lib/security/upload-session";
import { finalizeStagedSignupDocuments } from "@/lib/server/finalize-signup-documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { submitToApprovalEngineSafely } from "@/lib/server/approval-engine-bridge";

export async function POST(req: NextRequest) {
  try {
    const adminSupabase = createSupabaseAdminClient();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { session, userId } = body as { session?: string; userId?: string };

    if (!session || typeof session !== "string") {
      return NextResponse.json({ error: "Session token is required" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Verify session token authenticity and expiry
    const verification = verifyUploadSessionToken(session);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid or expired upload session" },
        { status: 403 }
      );
    }

    // Verify user exists and fetch metadata for approval request
    const { data: userRow, error: userErr } = await adminSupabase
      .from("users")
      .select("id, full_name, email, phone, role, supervisor_id, address, city, district, state, machine_category")
      .eq("id", userId)
      .maybeSingle();

    if (userErr || !userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Move staging documents to canonical user_files
    const result = await finalizeStagedSignupDocuments({
      userId,
      stagingUuid: verification.uuid,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to finalize staged documents" },
        { status: 500 }
      );
    }

    // Submit registration approval to central approval engine
    await submitToApprovalEngineSafely({
      type_key: "registration",
      subject_type: "user",
      subject_id: userId,
      subject_label: `${userRow.full_name || "User"} (${userRow.role})`,
      requested_by: userId,
      summary: `New registration: ${userRow.full_name || "User"} (${userRow.role})`,
      payload: {
        user_id: userId,
        full_name: userRow.full_name,
        email: userRow.email,
        phone: userRow.phone,
        role: userRow.role,
        supervisor_id: userRow.supervisor_id,
        address: userRow.address,
        city: userRow.city,
        district: userRow.district,
        state: userRow.state,
        machine_category: userRow.machine_category,
      },
    });

    // Submit document verification requests for each finalized document
    if (result.documents && result.documents.length > 0) {
      for (const doc of result.documents) {
        await submitToApprovalEngineSafely({
          type_key: "document_verify",
          subject_type: "document",
          subject_id: userId,
          subject_label: `${doc.docType.toUpperCase()} - ${userRow.full_name || "User"}`,
          requested_by: userId,
          summary: `Initial verification for ${doc.docType} (${userRow.full_name || "User"})`,
          payload: {
            user_id: userId,
            document_type_code: doc.docType,
            storage_path: doc.mainPath,
            thumb_path: doc.thumbPath,
            size_bytes: doc.sizeBytes,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      finalizedCount: result.finalizedCount,
      documents: result.documents,
    });
  } catch (err: unknown) {
    console.error("[API:signup:finalize] Fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
