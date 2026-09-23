"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { logAudit } from "@/lib/audit";
import { OnboardingProfileSchema } from "@reachinternational/validation";
import { getStateById } from "@reachinternational/utils";

export interface OnboardingFormState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  fieldValues?: Record<string, string>;
  redirectUrl?: string;
}

export async function completeOnboardingAction(
  prevState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Authentication session expired. Please log in again.",
    };
  }

  // Fetch verified user profile from database to enforce canonical role & verify status
  const { data: userProfile, error: profileErr } = await supabase
    .from("users")
    .select("id, role, complete_profile")
    .eq("id", user.id)
    .single();

  if (profileErr || !userProfile) {
    return {
      error: "User profile record not found. Please contact an administrator.",
    };
  }

  // Idempotency / state guard: if already complete, direct immediately to appropriate dashboard
  const isComplete = typeof userProfile.complete_profile === "boolean"
    ? userProfile.complete_profile
    : userProfile.complete_profile === "yes";
  if (isComplete) {
    return {
      success: true,
      redirectUrl: "/dashboard",
    };
  }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const full_name = (raw.full_name || "").trim();
  const phone = (raw.phone || "").trim();
  // SECURITY (REV-C01): User role is strictly bound to the authenticated user's assigned role in the database.
  // Never permit client-submitted formData.role to overwrite or escalate user role.
  const role = userProfile.role || "operator";
  const shift_start_time = (raw.shift_start_time || "").trim();
  const shift_end_time = (raw.shift_end_time || "").trim();
  const shift_time = (raw.shift_time || "").trim() || (shift_start_time && shift_end_time ? `${shift_start_time} - ${shift_end_time}` : "");

  const city = (raw.city || "").trim();
  const district = (raw.district || "").trim();
  const street = (raw.street || raw.address || "").trim();
  const stateIdRaw = raw.state_id;
  const state_id = stateIdRaw && !isNaN(Number(stateIdRaw)) ? Number(stateIdRaw) : null;
  const state = (raw.state || "").trim() || (state_id ? getStateById(state_id)?.name || "" : "");

  const aadhaar_number = (raw.aadhaar_number || "").trim();
  const license_number = (raw.license_number || "").trim();
  const monthlySalaryRaw = raw.monthly_salary;
  const monthly_salary = monthlySalaryRaw !== undefined && monthlySalaryRaw !== "" && !isNaN(Number(monthlySalaryRaw))
    ? Number(monthlySalaryRaw)
    : null;

  const fieldValues: Record<string, string> = {
    ...raw,
    full_name,
    phone,
    role,
    shift_time,
    shift_start_time,
    shift_end_time,
    city,
    district,
    street,
    address: street,
    state,
    state_id: state_id ? String(state_id) : "",
    monthly_salary: monthly_salary !== null ? String(monthly_salary) : "",
    aadhaar_number,
    license_number,
  };

  const validationResult = OnboardingProfileSchema.safeParse({
    full_name,
    phone,
    role,
    shift_time,
    shift_start_time,
    shift_end_time,
    city,
    district,
    state,
    state_id,
    street,
    address: street,
    monthly_salary,
    aadhaar_number,
    license_number: license_number || null,
  });

  if (!validationResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validationResult.error.issues) {
      const fieldName = issue.path[0] as string;
      if (!fieldErrors[fieldName]) {
        fieldErrors[fieldName] = issue.message;
      }
    }
    return {
      error: "Please correct the highlighted fields before completing onboarding.",
      fieldErrors,
      fieldValues,
    };
  }

  const cleanAadhaar = aadhaar_number.replace(/\D/g, "");

  try {
    const { error: rpcError } = await supabase.rpc("complete_user_onboarding_atomic", {
      p_user_id: user.id,
      p_full_name: full_name,
      p_phone: phone,
      p_role: role,
      p_shift_time: shift_time,
      p_address: street,
      p_city: city,
      p_district: district,
      p_state: state,
      p_state_id: state_id,
      p_aadhaar_number: cleanAadhaar,
      p_license_number: license_number || null,
    });

    if (rpcError) {
      console.warn("[Onboarding] complete_user_onboarding_atomic RPC returned error, attempting direct table update via admin client:", rpcError.message);
      const adminClient = createSupabaseAdminClient();
      // SECURITY (REV-C01): Do NOT include role in update payload. Role is established on signup/approval.
      const updatePayload: Record<string, any> = {
        full_name,
        phone,
        shift_start_time: shift_start_time || null,
        shift_end_time: shift_end_time || null,
        street,
        city,
        district,
        state,
        state_id,
        aadhaar_number: cleanAadhaar,
        license_number: license_number || null,
        complete_profile: true,
        updated_at: new Date().toISOString(),
      };
      if (monthly_salary !== null) {
        updatePayload.monthly_salary = monthly_salary;
      }
      const { error: directError } = await adminClient
        .from("users")
        .update(updatePayload)
        .eq("id", user.id);

      if (directError) {
        console.error("[Onboarding] Direct table fallback failed:", directError);
        return {
          error: directError.message || "Failed to update user profile. Please try again.",
          fieldValues,
        };
      }
    } else if (monthly_salary !== null) {
      const adminClient = createSupabaseAdminClient();
      await adminClient
        .from("users")
        .update({
          monthly_salary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    // Process document uploads if attached to onboarding formData
    const aadhaarFile = formData.get("aadhaar_file") as File | null;
    const licenseFile = formData.get("license_file") as File | null;
    const adminUploadClient = createSupabaseAdminClient();

    if (aadhaarFile && aadhaarFile.size > 0) {
      try {
        const ext = aadhaarFile.name.split(".").pop()?.toLowerCase() || "bin";
        const storagePath = `documents/${user.id}/aadhaar.${ext}`;
        const fileBytes = await aadhaarFile.arrayBuffer();

        const { error: uploadErr } = await adminUploadClient.storage
          .from("user_files")
          .upload(storagePath, fileBytes, {
            contentType: aadhaarFile.type,
            upsert: true,
          });

        if (!uploadErr) {
          await adminUploadClient.from("user_documents").upsert(
            {
              user_id: user.id,
              document_type_code: "aadhaar",
              storage_path: storagePath,
              mime_type: aadhaarFile.type,
              file_size_bytes: aadhaarFile.size,
            },
            { onConflict: "user_id,document_type_code" }
          );
        }
      } catch (err) {
        console.error("Failed to upload onboarding Aadhaar file:", err);
      }
    }

    if (licenseFile && licenseFile.size > 0) {
      try {
        const ext = licenseFile.name.split(".").pop()?.toLowerCase() || "bin";
        const storagePath = `documents/${user.id}/driving_license.${ext}`;
        const fileBytes = await licenseFile.arrayBuffer();

        const { error: uploadErr } = await adminUploadClient.storage
          .from("user_files")
          .upload(storagePath, fileBytes, {
            contentType: licenseFile.type,
            upsert: true,
          });

        if (!uploadErr) {
          await adminUploadClient.from("user_documents").upsert(
            {
              user_id: user.id,
              document_type_code: "driving_license",
              storage_path: storagePath,
              mime_type: licenseFile.type,
              file_size_bytes: licenseFile.size,
            },
            { onConflict: "user_id,document_type_code" }
          );
        }
      } catch (err) {
        console.error("Failed to upload onboarding Licence file:", err);
      }
    }

    revalidateTag(CACHE_TAGS.users, "max");
    revalidatePath("/onboarding");
    revalidatePath("/machines");
    revalidatePath("/operations");

    try {
      await logAudit({
        user_id: user.id,
        action: "user.onboarding_completed",
        entity_type: "users",
        entity_id: user.id,
        metadata: {
          complete_profile: true,
          role,
          shift_time,
          city,
          district,
          state,
        },
      });
    } catch {
      // Non-fatal audit log catch
    }

    return {
      success: true,
      redirectUrl: "/dashboard",
    };
  } catch (err: any) {
    return {
      error: err?.message || "An unexpected error occurred. Please try again.",
      fieldValues,
    };
  }
}
