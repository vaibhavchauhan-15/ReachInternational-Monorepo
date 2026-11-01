import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PublicApplyInputSchema } from "@reachinternational/validation";
import { TAGS } from "@/lib/cache";

// In-memory rate limiting map (IP -> submission timestamps)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_SUBMISSIONS_PER_HOUR = 6;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recent.length >= MAX_SUBMISSIONS_PER_HOUR) {
    return false;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    // 1. Rate limiting check
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many submissions from this connection. Please try again later." },
        { status: 429 }
      );
    }

    const formData = await req.formData();

    // 2. Anti-spam honeypot check
    const honeypot = formData.get("website")?.toString() || "";
    if (honeypot.trim().length > 0) {
      // Silently accept bot submission without writing
      return NextResponse.json({
        success: true,
        message: "Thank you for submitting your application.",
      });
    }

    // 3. Extract and validate file
    const file = formData.get("resume") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Resume file is required (PDF or DOCX, max 5MB)" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Resume exceeds the maximum allowed size of 5MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic-bytes verification
    const isPdf =
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46; // %PDF

    const isZipDocx =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04; // PK\x03\x04

    if (!isPdf && !isZipDocx) {
      return NextResponse.json(
        { error: "Invalid file content. Upload a genuine PDF or Word document." },
        { status: 400 }
      );
    }

    // 4. Validate form fields with Zod
    const rawData = {
      job_id: formData.get("job_id")?.toString() || null,
      full_name: formData.get("full_name")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      phone: formData.get("phone")?.toString() || "",
      current_city: formData.get("current_city")?.toString() || "",
      total_experience_yrs: formData.get("total_experience_yrs")?.toString() || "0",
      current_ctc: formData.get("current_ctc")?.toString() || null,
      expected_ctc: formData.get("expected_ctc")?.toString() || null,
      notice_period_days: formData.get("notice_period_days")?.toString() || null,
      cover_note: formData.get("cover_note")?.toString() || null,
      consent: formData.get("consent") === "true",
      consent_version: formData.get("consent_version")?.toString() || "2026-10",
    };

    const parsed = PublicApplyInputSchema.safeParse(rawData);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed. Please verify the required fields.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const val = parsed.data;

    // 5. Upload resume to private Supabase storage bucket
    const admin = createSupabaseAdminClient();
    const fileExt = isPdf ? "pdf" : "docx";
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const year = new Date().getFullYear();
    const storagePath = `${year}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await admin.storage
      .from("career_resumes")
      .upload(storagePath, buffer, {
        contentType: isPdf ? "application/pdf" : file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("[api:careers:apply] Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to store resume document. Please try again." },
        { status: 500 }
      );
    }

    // 6. Call atomic submission RPC
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    const { data: appData, error: rpcError } = await admin.rpc(
      "submit_job_application_atomic",
      {
        p_job_id: val.job_id || null,
        p_full_name: val.full_name,
        p_email: val.email.toLowerCase(),
        p_phone: val.phone,
        p_current_city: val.current_city,
        p_total_experience_yrs: val.total_experience_yrs,
        p_current_ctc: val.current_ctc || null,
        p_expected_ctc: val.expected_ctc || null,
        p_notice_period_days: val.notice_period_days || null,
        p_cover_note: val.cover_note || null,
        p_resume_path: storagePath,
        p_resume_file_name: sanitizedName,
        p_resume_mime: isPdf ? "application/pdf" : file.type,
        p_resume_size_bytes: buffer.length,
        p_consent_version: val.consent_version,
        p_ip_hash: ipHash,
      }
    );

    if (rpcError) {
      console.error("[api:careers:apply] RPC error:", rpcError);
      // Clean up uploaded resume file on error
      await admin.storage.from("career_resumes").remove([storagePath]);

      if (rpcError.code === "23505" || rpcError.message?.includes("duplicate")) {
        return NextResponse.json(
          { error: "You have already submitted an application for this position." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Unable to process application submission: " + rpcError.message },
        { status: 500 }
      );
    }

    // 7. Invalidate hiring cache tags
    revalidateTag(TAGS.hiringApplications, "max");
    revalidateTag(TAGS.hiringKpis, "max");

    const result = appData as any;

    return NextResponse.json({
      success: true,
      application_code: result?.application_code,
      message: "Application submitted successfully",
    });
  } catch (err: any) {
    console.error("[api:careers:apply] Unhandled error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
