"use server";

import crypto from "crypto";
import { getCurrentUser } from "@/lib/dal";
import {
  createJob,
  updateJob,
  publishJob,
  unpublishJob,
  closeJob,
  reopenJob,
  duplicateJob,
  softDeleteJob,
  updateApplicationStatus,
  setApplicationRating,
  saveApplicationNotes,
  assignApplication,
  softDeleteApplication,
  getApplicationResumeSignedUrl,
  type ResumeAccessResult,
} from "@/lib/data/careers";
import {
  JobPostingInputSchema,
  ApplicationStatusUpdateSchema,
  ApplicationNoteSchema,
  ApplicationRatingSchema,
  type JobPostingInput,
} from "@reachinternational/validation";
import type { ApplicationStatus } from "@reachinternational/types";

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const AUTHORIZED_ROLES = ["super_admin", "admin", "hr"] as const;

async function checkHiringAuthorization() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  if (!AUTHORIZED_ROLES.includes(user.role as any)) {
    throw new Error("Unauthorized: Insufficient permissions for hiring management");
  }
  return user;
}

export async function createJobAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const parsed = JobPostingInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const res = await createJob(parsed.data, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create job" };
  }
}

export async function updateJobAction(id: string, rawInput: unknown): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const parsed = JobPostingInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const res = await updateJob(id, parsed.data, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update job" };
  }
}

export async function publishJobAction(id: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await publishJob(id, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to publish job" };
  }
}

export async function unpublishJobAction(id: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await unpublishJob(id, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to unpublish job" };
  }
}

export async function closeJobAction(id: string, reason?: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await closeJob(id, reason, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to close job" };
  }
}

export async function reopenJobAction(id: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await reopenJob(id, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reopen job" };
  }
}

export async function duplicateJobAction(id: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await duplicateJob(id, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to duplicate job" };
  }
}

export async function deleteJobAction(id: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await softDeleteJob(id, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete job" };
  }
}

export async function updateApplicationStatusAction(
  id: string,
  status: ApplicationStatus,
  rejectionReason?: string
): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const parsed = ApplicationStatusUpdateSchema.safeParse({ id, status, rejection_reason: rejectionReason });
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid status update payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const res = await updateApplicationStatus(id, status, rejectionReason, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update status" };
  }
}

export async function saveApplicationNotesAction(id: string, notes: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const parsed = ApplicationNoteSchema.safeParse({ id, notes });
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid note payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const res = await saveApplicationNotes(id, notes, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save note" };
  }
}

export async function rateApplicationAction(id: string, rating: number | null): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const parsed = ApplicationRatingSchema.safeParse({ id, rating });
    if (!parsed.success) {
      return {
        success: false,
        error: "Rating must be between 1 and 5",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const res = await setApplicationRating(id, rating, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to rate application" };
  }
}

export async function assignApplicationAction(id: string, assignedTo: string | null): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await assignApplication(id, assignedTo, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign application" };
  }
}

export async function deleteApplicationAction(id: string): Promise<ActionResponse> {
  try {
    const user = await checkHiringAuthorization();
    const res = await softDeleteApplication(id, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete application" };
  }
}

export async function getApplicationResumeUrlAction(
  applicationId: string
): Promise<ActionResponse<ResumeAccessResult>> {
  try {
    const user = await checkHiringAuthorization();
    const res = await getApplicationResumeSignedUrl(applicationId, user.id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch resume link" };
  }
}

export async function generateJobPreviewTokenAction(
  jobId: string
): Promise<ActionResponse<{ token: string; url: string }>> {
  try {
    await checkHiringAuthorization();
    const secret =
      process.env.CAREERS_PREVIEW_SECRET ||
      process.env.SUPABASE_SECRET_KEY ||
      "reach-careers-preview-secret-key-salt";

    const exp = Date.now() + 15 * 60 * 1000; // 15 mins
    const payload = `${jobId}:${exp}`;
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const token = Buffer.from(JSON.stringify({ jobId, exp, hmac })).toString("base64url");

    return {
      success: true,
      data: {
        token,
        url: `/careers/preview/${token}`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate preview token" };
  }
}

export async function verifyJobPreviewToken(token: string): Promise<{ valid: boolean; jobId?: string }> {
  try {
    const secret =
      process.env.CAREERS_PREVIEW_SECRET ||
      process.env.SUPABASE_SECRET_KEY ||
      "reach-careers-preview-secret-key-salt";

    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const { jobId, exp, hmac } = JSON.parse(raw);

    if (!jobId || !exp || !hmac) return { valid: false };
    if (Date.now() > exp) return { valid: false };

    const expectedPayload = `${jobId}:${exp}`;
    const expectedHmac = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex");

    if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return { valid: true, jobId };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}
