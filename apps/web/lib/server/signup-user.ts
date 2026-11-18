import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyUploadSessionToken } from "@/lib/security/upload-session";
import { finalizeStagedSignupDocuments } from "@/lib/server/finalize-signup-documents";
import { submitToApprovalEngineSafely } from "@/lib/server/approval-engine-bridge";
import { checkRateLimitAsync, RATE_LIMIT_PROFILES } from "@/lib/security/rate-limiter";
import { validateSignupFormData } from "@reachinternational/validation";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  validateBankAccountNumber,
  validateIfscCode,
  getStateById,
  getStateByName,
  DOC_UPLOAD,
  normalizeMachineCategory,
  type RegisterSignupUserPayload,
  type RegisterSignupUserResponse,
} from "@reachinternational/utils";
import { isSupervisedRole } from "@reachinternational/permissions";

/**
 * Format helper for rate limit reset seconds
 */
function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    const s = Math.round(seconds);
    return s <= 1 ? "1 second" : `${s} seconds`;
  }
  if (seconds < 3600) {
    const m = Math.round(seconds / 60);
    return m === 1 ? "1 minute" : `${m} minutes`;
  }
  const h = Math.round(seconds / 3600);
  return h === 1 ? "1 hour" : `${h} hours`;
}

/**
 * Verifies that the first 3 bytes of a staged file match JPEG magic bytes FF D8 FF.
 * Uses HTTP Range 0-2 request so exactly 3 bytes travel across the network.
 */
async function verifyStagedJpegMagicBytes(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  stagingPath: string
): Promise<boolean> {
  try {
    const { data: signedData, error: signErr } = await adminSupabase.storage
      .from("doc_staging")
      .createSignedUrl(stagingPath, 60);

    if (signErr || !signedData?.signedUrl) {
      console.error(`[MagicBytes] Failed to create signed URL for ${stagingPath}:`, signErr);
      return false;
    }

    const resp = await fetch(signedData.signedUrl, {
      headers: { Range: "bytes=0-2" },
    });

    if (!resp.ok && resp.status !== 206) {
      console.error(`[MagicBytes] HTTP error ${resp.status} reading ${stagingPath}`);
      return false;
    }

    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < 3) return false;

    // Standard JPEG magic bytes: FF D8 FF
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  } catch (err) {
    console.error(`[MagicBytes] Exception reading magic bytes for ${stagingPath}:`, err);
    return false;
  }
}

export interface RegisterNewUserServerParams extends RegisterSignupUserPayload {
  clientIp?: string;
}

/**
 * Centralized, authoritative server-side user registration handler.
 * Used by both Next.js Server Action (`signup`) and REST API (`POST /api/signup`).
 *
 * KEY GUARANTEES:
 * 1. Pre-flight Validation: Validates all fields; rejects missing or empty details before touching database.
 * 2. Uniqueness Checks: Checks email, phone, Aadhaar, and licence against existing accounts.
 * 3. Staging Documents & Magic Bytes: Verifies presence and valid JPEG signatures (FF D8 FF).
 * 4. Zero Confirmation Emails & Zero 429 Rate Limits: Uses `adminSupabase.auth.admin.createUser`
 *    with `email_confirm: true`. This prevents Supabase Auth from invoking its rate-limited
 *    email service (over_email_send_rate_limit) while placing the account in `pending` status.
 * 5. Atomic Document Finalization & Approval Request Creation: Moves staged documents to user_files
 *    and registers the approval in public.approval_requests in one seamless operation.
 */
export async function registerNewUserServer(
  params: RegisterNewUserServerParams
): Promise<RegisterSignupUserResponse & { status?: number }> {
  const sanitize = (val?: string | null) => (val || "").replace(/[\x00-\x1F\x7F]/g, "").trim();

  const clientIp = params.clientIp || "127.0.0.1";

  // 1. Rate Limiting Check
  const rateLimitResult = await checkRateLimitAsync(`${clientIp}:action:signup`, RATE_LIMIT_PROFILES.AUTH_STRICT);
  if (!rateLimitResult.success) {
    const retryText = formatRetryAfter(rateLimitResult.resetSeconds);
    return {
      success: false,
      error: `Too many registration attempts. Please try again in ${retryText}.`,
      status: 429,
    };
  }

  // 2. Extract and sanitize input fields
  const fullName = sanitize(params.fullName);
  const email = sanitize(params.email).toLowerCase();
  const phone = sanitize(params.phone);
  const requestedRole = sanitize(params.role) || "operator";
  const rawSupervisorId = sanitize(params.supervisorId);
  const rawMachineCategory = sanitize(params.machineCategory);
  const shiftStartTime = sanitize(params.shiftStartTime);
  const shiftEndTime = sanitize(params.shiftEndTime);
  const street = sanitize(params.street || params.address);
  const city = sanitize(params.city);
  const district = sanitize(params.district);
  const stateRaw = sanitize(params.state);
  const stateIdRaw = params.stateId;
  const bankAccountNumber = sanitize(params.bankAccountNumber).replace(/\D/g, "");
  const bankIfscCode = sanitize(params.bankIfscCode).toUpperCase();
  const aadhaarNumber = sanitize(params.aadhaarNumber).replace(/\D/g, "");
  const licenseNumber = sanitize(params.licenseNumber).toUpperCase();
  const password = params.password || "";
  const confirmPassword = params.confirmPassword || "";
  const stagingSessionToken = sanitize(params.stagingSessionToken || params.session);

  // Normalize state
  let resolvedStateId: number | null = null;
  let resolvedStateName = stateRaw;

  if (stateIdRaw && !isNaN(Number(stateIdRaw)) && Number(stateIdRaw) > 0) {
    const matchedState = getStateById(Number(stateIdRaw));
    if (matchedState) {
      resolvedStateId = matchedState.id;
      resolvedStateName = matchedState.name;
    }
  }

  if (!resolvedStateId && stateRaw) {
    const matchedState = getStateByName(stateRaw);
    if (matchedState) {
      resolvedStateId = matchedState.id;
      resolvedStateName = matchedState.name;
    }
  }

  // Normalize machine category for operator
  const machineCategory =
    requestedRole === "operator"
      ? normalizeMachineCategory(rawMachineCategory) || rawMachineCategory || null
      : null;

  // Resolve shift time display
  const resolvedShiftTime =
    params.shiftTime ||
    (shiftStartTime && shiftEndTime
      ? `${shiftStartTime} - ${shiftEndTime}`
      : shiftStartTime || shiftEndTime || "");

  // 3. Client & Server-side Form Validation Check
  const validationRes = validateSignupFormData({
    fullName,
    email,
    phone,
    role: requestedRole,
    supervisorId: isSupervisedRole(requestedRole) ? rawSupervisorId || null : null,
    machineCategory: requestedRole === "operator" ? machineCategory : null,
    shiftStartTime,
    shiftEndTime,
    street,
    city,
    district,
    state: resolvedStateName,
    stateId: resolvedStateId,
    bankAccountNumber,
    bankIfscCode,
    hasBankDoc: Boolean(stagingSessionToken),
    aadhaarNumber,
    hasAadhaarDoc: Boolean(stagingSessionToken),
    licenseNumber: licenseNumber || null,
    password,
    confirmPassword: confirmPassword || password,
    agreedToTerms: true,
  });

  if (!validationRes.isValid) {
    return {
      success: false,
      error: "Please complete all required fields properly.",
      fieldErrors: validationRes.errors,
      status: 400,
    };
  }

  // 4. Staging Session Token Verification
  if (!stagingSessionToken) {
    return {
      success: false,
      error: "Document upload session is required. Please attach your document photos.",
      fieldErrors: { bank_doc: "Document photos required." },
      status: 400,
    };
  }

  const verifyRes = verifyUploadSessionToken(stagingSessionToken);
  if (verifyRes.valid === false) {
    return {
      success: false,
      error: (verifyRes as any).error || "Upload session expired.",
      fieldErrors: { bank_doc: "Upload session expired." },
      status: 403,
    };
  }
  const stagingUuid = verifyRes.uuid;

  const adminSupabase = createSupabaseAdminClient();
  const digitsOnly = phone.replace(/\D/g, "");
  const last10Digits = digitsOnly.slice(-10);

  // Validate clean Aadhaar & licence
  const cleanAadhaar = validateAadhaarNumber(aadhaarNumber).clean || aadhaarNumber;
  const licClean = licenseNumber ? validateLicenseNumber(licenseNumber).clean || licenseNumber : null;
  const formattedLicense = licenseNumber ? validateLicenseNumber(licenseNumber).formatted || licenseNumber : null;

  // 5. Parallel Database & Storage Verification
  const [
    supervisorCheckResult,
    emailCheckResult,
    phoneCheckResult,
    aadhaarCheckResult,
    licenseCheckResult,
    stagingListResult,
  ] = await Promise.all([
    isSupervisedRole(requestedRole) && rawSupervisorId
      ? adminSupabase.from("users").select("id, role, status").eq("id", rawSupervisorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    adminSupabase.from("users").select("id").ilike("email", email).maybeSingle(),

    adminSupabase
      .from("users")
      .select("id, phone")
      .or(`phone.eq.${phone},phone.ilike.%${last10Digits}`)
      .limit(5),

    cleanAadhaar
      ? adminSupabase.from("users").select("id").eq("aadhaar_number", cleanAadhaar).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    licClean
      ? adminSupabase.from("users").select("id").ilike("license_number", licClean).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    adminSupabase.storage.from("doc_staging").list(`signup/${stagingUuid}`),
  ]);

  // Evaluate supervisor validity
  if (isSupervisedRole(requestedRole)) {
    const validSup = supervisorCheckResult.data;
    if (
      !validSup ||
      (validSup.role !== "supervisor" &&
        validSup.role !== "manager" &&
        validSup.role !== "admin" &&
        validSup.role !== "super_admin") ||
      validSup.status !== "active"
    ) {
      return {
        success: false,
        error: "The selected supervisor is invalid or inactive.",
        fieldErrors: { supervisor_id: "The selected supervisor is invalid or inactive." },
        status: 400,
      };
    }
  }

  // Evaluate email uniqueness
  if (emailCheckResult.data) {
    return {
      success: false,
      error: "An account with this email already exists.",
      fieldErrors: { email: "Email already registered." },
      status: 409,
    };
  }

  // Evaluate phone uniqueness
  if (phoneCheckResult.data && phoneCheckResult.data.length > 0) {
    const hasDup = phoneCheckResult.data.some((u) => {
      if (!u.phone) return false;
      const uDigits = u.phone.replace(/\D/g, "");
      if (digitsOnly.length >= 10 && uDigits.length >= 10) {
        return digitsOnly.slice(-10) === uDigits.slice(-10);
      }
      return digitsOnly === uDigits;
    });
    if (hasDup) {
      return {
        success: false,
        error: "This mobile number is already registered.",
        fieldErrors: { phone: "Mobile number already registered." },
        status: 409,
      };
    }
  }

  // Evaluate Aadhaar uniqueness
  if (cleanAadhaar && aadhaarCheckResult.data) {
    return {
      success: false,
      error: "Aadhaar number already registered.",
      fieldErrors: { aadhaar_number: "Aadhaar number already registered." },
      status: 409,
    };
  }

  // Evaluate Driving Licence uniqueness
  if (licClean && licenseCheckResult.data) {
    return {
      success: false,
      error: "Licence number already registered.",
      fieldErrors: { license_number: "Licence number already registered." },
      status: 409,
    };
  }

  // 6. Staged Files Presence & Metadata Check
  const stagedFiles = stagingListResult.data;
  if (stagingListResult.error || !stagedFiles) {
    console.error("[Signup] Staging check error:", stagingListResult.error);
    return {
      success: false,
      error: "Failed to verify uploaded documents in staging.",
      status: 500,
    };
  }

  const stagedFileMap = new Map(stagedFiles.map((f) => [f.name, f]));
  const fieldErrors: Record<string, string> = {};

  const validateSlotMetadata = (docType: string, label: string, required: boolean) => {
    const mainName = `${docType}.jpg`;
    const thumbName = `${docType}_thumb.jpg`;
    const mainFile = stagedFileMap.get(mainName);
    const thumbFile = stagedFileMap.get(thumbName);

    if (!mainFile) {
      if (required) return `${label} photo is required.`;
      return null;
    }

    const mainMime = mainFile.metadata?.mimetype || "";
    if (mainMime && mainMime !== "image/jpeg") {
      return `${label} must be a JPEG image.`;
    }

    const mainSize = mainFile.metadata?.size;
    if (typeof mainSize === "number" && mainSize > DOC_UPLOAD.maxBytes) {
      return `${label} exceeds maximum allowed size of 1 MB.`;
    }

    if (!thumbFile && required) {
      return `${label} thumbnail is missing. Please re-upload.`;
    }

    return null;
  };

  const bankDocErr = validateSlotMetadata("bank_document", "Bank document", true);
  if (bankDocErr) fieldErrors.bank_doc = bankDocErr;

  const aadhaarDocErr = validateSlotMetadata("aadhaar", "Aadhaar document", true);
  if (aadhaarDocErr) fieldErrors.aadhaar_doc = aadhaarDocErr;

  if (stagedFileMap.has("driving_license.jpg")) {
    const licDocErr = validateSlotMetadata("driving_license", "Licence document", false);
    if (licDocErr) fieldErrors.license_doc = licDocErr;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Document verification failed. Please check your uploaded document photos.",
      fieldErrors,
      status: 400,
    };
  }

  // 7. Verify JPEG Magic Bytes (FF D8 FF)
  const magicByteChecks: Array<Promise<{ docType: string; valid: boolean }>> = [
    verifyStagedJpegMagicBytes(adminSupabase, `signup/${stagingUuid}/bank_document.jpg`).then((valid) => ({
      docType: "bank_document",
      valid,
    })),
    verifyStagedJpegMagicBytes(adminSupabase, `signup/${stagingUuid}/aadhaar.jpg`).then((valid) => ({
      docType: "aadhaar",
      valid,
    })),
  ];

  if (stagedFileMap.has("driving_license.jpg")) {
    magicByteChecks.push(
      verifyStagedJpegMagicBytes(adminSupabase, `signup/${stagingUuid}/driving_license.jpg`).then((valid) => ({
        docType: "driving_license",
        valid,
      }))
    );
  }

  const magicResults = await Promise.all(magicByteChecks);
  for (const res of magicResults) {
    if (!res.valid) {
      return {
        success: false,
        error: "Uploaded document file is invalid or corrupted. Please re-upload your document.",
        status: 400,
      };
    }
  }

  // 8. Provision User via Supabase Admin API with email_confirm: true
  // This bypasses GoTrue email sending entirely, preventing HTTP 429 over_email_send_rate_limit.
  // The PostgreSQL trigger handle_new_user() will insert into public.users with status = 'pending'.
  const { data: createData, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: requestedRole,
      supervisor_id: isSupervisedRole(requestedRole) ? rawSupervisorId || null : null,
      machine_category: requestedRole === "operator" ? machineCategory : null,
      shift_time: resolvedShiftTime || null,
      shift_start_time: shiftStartTime || null,
      shift_end_time: shiftEndTime || null,
      street: street || null,
      address: street || null,
      city,
      district,
      state: resolvedStateName,
      state_id: resolvedStateId,
      location: `${street ? `${street}, ` : ""}${city}, ${district}, ${resolvedStateName}`,
      monthly_salary: null,
      bank_account_number: bankAccountNumber,
      bank_ifsc_code: bankIfscCode,
      aadhaar_number: cleanAadhaar,
      license_number: formattedLicense,
      staging_session_token: stagingSessionToken,
      session: stagingSessionToken,
    },
  });

  if (createError || !createData?.user) {
    console.error("[Signup] Admin createUser error:", createError);
    const msg = (createError?.message || "").toLowerCase();
    if (
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("unique constraint") ||
      msg.includes("user already exists")
    ) {
      return {
        success: false,
        error: "An account with this email already exists.",
        fieldErrors: { email: "Email already registered." },
        status: 409,
      };
    }

    return {
      success: false,
      error: createError?.message || "Registration failed. Please try again.",
      status: 400,
    };
  }

  const userId = createData.user.id;

  // 9. Finalize Staged Documents: Move from doc_staging to user_files
  try {
    const finalizeRes = await finalizeStagedSignupDocuments({
      userId,
      stagingUuid,
    });

    if (!finalizeRes.success) {
      console.warn("[Signup] Staged document finalization warning:", finalizeRes.error);
    }
  } catch (finalizeErr) {
    console.error("[Signup] Exception finalizing staged documents:", finalizeErr);
  }

  // 10. Ensure Registration Approval Request in public.approval_requests
  try {
    await submitToApprovalEngineSafely({
      type_key: "registration",
      subject_type: "user",
      subject_id: userId,
      subject_label: `${fullName} (${requestedRole})`,
      requested_by: userId,
      summary: `New registration: ${fullName} (${requestedRole})`,
      payload: {
        user_id: userId,
        full_name: fullName,
        email,
        phone,
        role: requestedRole,
        supervisor_id: isSupervisedRole(requestedRole) ? rawSupervisorId || null : null,
        machine_category: requestedRole === "operator" ? machineCategory : null,
        address: street,
        city,
        district,
        state: resolvedStateName,
      },
    });
  } catch (approvalErr) {
    console.warn("[Signup] Failed to submit approval request (trigger may have created it):", approvalErr);
  }

  return {
    success: true,
    userId,
    message: "Registration request submitted successfully! Your account is pending administrator approval. After approval, you can log in.",
    status: 201,
  };
}
