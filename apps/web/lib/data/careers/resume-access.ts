import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export interface ResumeAccessResult {
  signedUrl: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
}

export async function getApplicationResumeSignedUrl(
  applicationId: string,
  userId?: string
): Promise<{ success: boolean; data?: ResumeAccessResult; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: app, error } = await supabase
      .from("job_applications")
      .select("id, application_code, full_name, resume_path, resume_file_name, resume_mime, resume_size_bytes")
      .eq("id", applicationId)
      .is("deleted_at", null)
      .single();

    if (error || !app) {
      return { success: false, error: "Application not found" };
    }

    if (!app.resume_path) {
      return { success: false, error: "No resume on file for this application" };
    }

    // Storage bucket is private; mint short-lived 120-second signed URL via admin client
    const admin = createSupabaseAdminClient();
    const { data: signedData, error: signError } = await admin.storage
      .from("career_resumes")
      .createSignedUrl(app.resume_path, 120);

    if (signError || !signedData?.signedUrl) {
      console.error("[getApplicationResumeSignedUrl] signedUrl error:", signError);
      return { success: false, error: "Failed to generate secure resume link" };
    }

    // Audit log
    await logAudit({
      category: "hiring",
      action: "application.resume_viewed",
      entity_id: app.id,
      entity_type: "job_application",
      user_id: userId,
      details: {
        application_code: app.application_code,
        candidate_name: app.full_name,
        file_name: app.resume_file_name,
      },
    });

    return {
      success: true,
      data: {
        signedUrl: signedData.signedUrl,
        fileName: app.resume_file_name,
        mime: app.resume_mime,
        sizeBytes: app.resume_size_bytes,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to access resume" };
  }
}
