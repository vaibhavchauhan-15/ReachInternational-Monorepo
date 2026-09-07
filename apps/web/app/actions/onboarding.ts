"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { logAudit } from "@/lib/audit";
import { OnboardingProfileSchema } from "@reachinternational/validation";
import { validateAadhaarNumber, validateLicenseNumber, getStateById } from "@reachinternational/utils";

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

  const full_name = ((formData.get("full_name") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const role = ((formData.get("role") as string) || "").trim();
  const shift_start_time = ((formData.get("shift_start_time") as string) || "").trim();
  const shift_end_time = ((formData.get("shift_end_time") as string) || "").trim();
  let shift_time = ((formData.get("shift_time") as string) || "").trim();
  if (!shift_time && shift_start_time && shift_end_time) {
    shift_time = `${shift_start_time} - ${shift_end_time}`;
  }

  const city = ((formData.get("city") as string) || "").trim();
  const district = ((formData.get("district") as string) || "").trim();
  const address = ((formData.get("address") as string) || "").trim();
  let state = ((formData.get("state") as string) || "").trim();
  const stateIdRaw = formData.get("state_id") as string;
  let state_id: number | null = stateIdRaw && !isNaN(Number(stateIdRaw)) ? Number(stateIdRaw) : null;

  if (state_id && !state) {
    const matchedState = getStateById(state_id);
    if (matchedState) state = matchedState.name;
  }

  const aadhaar_number = ((formData.get("aadhaar_number") as string) || "").trim();
  const license_number = ((formData.get("license_number") as string) || "").trim();

  const fieldValues: Record<string, string> = {
    full_name,
    phone,
    role,
    shift_start_time,
    shift_end_time,
    shift_time,
    city,
    district,
    state,
    state_id: state_id ? String(state_id) : "",
    address,
    aadhaar_number,
    license_number,
  };

  // Schema validation via canonical Zod schema
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
    address,
    aadhaar_number,
    license_number: license_number || null,
  });

  const fieldErrors: Record<string, string> = {};

  if (!validationResult.success) {
    for (const issue of validationResult.error.issues) {
      const fieldName = issue.path[0] as string;
      if (!fieldErrors[fieldName]) {
        fieldErrors[fieldName] = issue.message;
      }
    }
  }

  // Deep Verhoeff Aadhaar algorithm check
  if (aadhaar_number) {
    const aadhaarCheck = validateAadhaarNumber(aadhaar_number);
    if (!aadhaarCheck.isValid) {
      fieldErrors.aadhaar_number = aadhaarCheck.error || "Invalid Aadhaar number";
    }
  }

  // Driving licence format check if provided
  if (license_number) {
    const licCheck = validateLicenseNumber(license_number);
    if (!licCheck.isValid) {
      fieldErrors.license_number = licCheck.error || "Invalid driving licence format";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please correct the highlighted fields before completing onboarding.",
      fieldErrors,
      fieldValues,
    };
  }

  const cleanAadhaar = aadhaar_number.replace(/\D/g, "");
  const adminClient = createSupabaseAdminClient();

  try {
    // 1. Attempt atomic RPC invocation
    const { data: rpcData, error: rpcError } = await supabase.rpc("complete_user_onboarding_atomic", {
      p_user_id: user.id,
      p_full_name: full_name,
      p_phone: phone,
      p_role: role,
      p_shift_time: shift_time,
      p_address: address,
      p_city: city,
      p_district: district,
      p_state: state,
      p_state_id: state_id,
      p_aadhaar_number: cleanAadhaar,
      p_license_number: license_number || null,
    });

    if (rpcError) {
      // If RPC doesn't exist yet (migration rollout pending), execute resilient direct admin update
      console.warn("[Onboarding Action] RPC error, using direct table update fallback:", rpcError.message);

      const { error: directError } = await adminClient
        .from("users")
        .update({
          full_name,
          phone,
          role,
          shift_time,
          address,
          city,
          district,
          state,
          state_id,
          aadhaar_number: cleanAadhaar,
          license_number: license_number || null,
          complete_profile: "yes",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (directError) {
        console.error("[Onboarding Action] Direct update failed:", directError);
        return {
          error: directError.message || "Failed to update user profile. Please try again.",
          fieldValues,
        };
      }
    }

    // Invalidate caches
    revalidateTag(CACHE_TAGS.users, "max");
    revalidatePath("/onboarding");
    revalidatePath("/machines");
    revalidatePath("/operations");

    // Structured Audit Log
    try {
      await logAudit({
        user_id: user.id,
        action: "user.onboarding_completed",
        entity_type: "users",
        entity_id: user.id,
        metadata: {
          complete_profile: "yes",
          role,
          shift_time,
          city,
          district,
          state,
        },
      });
    } catch (auditErr) {
      console.warn("[Onboarding Action] Audit log failed non-fatally:", auditErr);
    }

    const destination = role === "operator" ? "/operations?tab=entry" : "/machines";

    return {
      success: true,
      redirectUrl: destination,
    };
  } catch (err: any) {
    console.error("[Onboarding Action] Unexpected error completing onboarding:", err);
    return {
      error: err?.message || "An unexpected error occurred. Please try again.",
      fieldValues,
    };
  }
}
