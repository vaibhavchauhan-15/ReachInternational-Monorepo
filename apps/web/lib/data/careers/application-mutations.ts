import "server-only";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import type { ApplicationStatus } from "@reachinternational/types";

interface MutationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function invalidateApplicationTags(id: string) {
  revalidateTag(TAGS.hiringApplications, "max");
  revalidateTag(TAGS.hiringKpis, "max");
  revalidateTag(TAGS.hiringApplicationDetail(id), "max");
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  rejectionReason?: string,
  userId?: string
): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();

    // Fetch previous status
    const { data: previous, error: fetchErr } = await supabase
      .from("job_applications")
      .select("id, application_code, status, job_id, full_name, hr_notes")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !previous) {
      return { success: false, error: "Application not found" };
    }

    const updates: Record<string, any> = {
      status,
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (rejectionReason && status === "rejected") {
      updates.hr_notes = previous.hr_notes
        ? `${previous.hr_notes}\n[Rejection reason]: ${rejectionReason}`
        : `[Rejection reason]: ${rejectionReason}`;
    }

    const { data, error } = await supabase
      .from("job_applications")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[updateApplicationStatus] error:", error);
      return { success: false, error: error.message };
    }

    await logAudit({
      action: "application.status_changed",
      entity_type: "job_application",
      entity_id: id,
      user_id: userId,
      category: "hiring",
      details: {
        application_code: previous.application_code,
        candidate_name: previous.full_name,
        old_status: previous.status,
        new_status: status,
        rejection_reason: rejectionReason || null,
      },
    });

    invalidateApplicationTags(id);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update application status" };
  }
}

export async function setApplicationRating(
  id: string,
  rating: number | null,
  userId?: string
): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: previous, error: fetchErr } = await supabase
      .from("job_applications")
      .select("id, application_code, rating")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !previous) {
      return { success: false, error: "Application not found" };
    }

    const { data, error } = await supabase
      .from("job_applications")
      .update({
        rating,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await logAudit({
      action: "application.note_saved",
      entity_type: "job_application",
      entity_id: id,
      user_id: userId,
      category: "hiring",
      details: {
        application_code: previous.application_code,
        old_rating: previous.rating,
        new_rating: rating,
      },
    });

    invalidateApplicationTags(id);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update rating" };
  }
}

export async function saveApplicationNotes(
  id: string,
  notes: string,
  userId?: string
): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: previous, error: fetchErr } = await supabase
      .from("job_applications")
      .select("id, application_code")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !previous) {
      return { success: false, error: "Application not found" };
    }

    const { data, error } = await supabase
      .from("job_applications")
      .update({
        hr_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await logAudit({
      action: "application.note_saved",
      entity_type: "job_application",
      entity_id: id,
      user_id: userId,
      category: "hiring",
      details: {
        application_code: previous.application_code,
        notes_length: notes.length,
      },
    });

    invalidateApplicationTags(id);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save notes" };
  }
}

export async function assignApplication(
  id: string,
  assignedTo: string | null,
  userId?: string
): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("job_applications")
      .update({
        assigned_to: assignedTo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    invalidateApplicationTags(id);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign application" };
  }
}

export async function softDeleteApplication(
  id: string,
  userId?: string
): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: previous, error: fetchErr } = await supabase
      .from("job_applications")
      .select("id, application_code")
      .eq("id", id)
      .single();

    if (fetchErr || !previous) {
      return { success: false, error: "Application not found" };
    }

    const { error } = await supabase
      .from("job_applications")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    invalidateApplicationTags(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete application" };
  }
}
