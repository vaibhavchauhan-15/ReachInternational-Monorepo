"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import {
  rfqSubmissionSchema,
  type RfqSubmissionInput,
  rfqStatusUpdateSchema,
  type RfqStatusUpdateInput,
  rfqAssignSchema,
  type RfqAssignInput,
  rfqNoteSchema,
  type RfqNoteInput,
  rfqFollowUpSchema,
  type RfqFollowUpInput,
  rfqContactLogSchema,
  type RfqContactLogInput,
} from "@reachinternational/validation";
import { checkRateLimitAsync, getClientIp, RATE_LIMIT_PROFILES } from "@/lib/security/rate-limiter";

// ============================================================================
// Helper: Staff Auth Guard
// ============================================================================

async function verifySalesStaff() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required. Please log in.");
  }

  const allowedRoles = ["super_admin", "admin", "sales"];
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Access denied. Insufficient permissions for RFQ management.");
  }

  return user;
}

// ============================================================================
// 1. Public RFQ Submission Action (Marketing Site)
// ============================================================================

export interface SubmitRfqResponse {
  success: boolean;
  rfq_number?: string;
  rfq_id?: string;
  duplicate?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function submitRfqAction(
  rawInput: unknown
): Promise<SubmitRfqResponse> {
  try {
    // 1. Edge LPDoS Rate Limiting Guard
    try {
      const headersList = await headers();
      const ip =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "anonymous";
      const rlResult = await checkRateLimitAsync(
        `rfq-submit:${ip}`,
        RATE_LIMIT_PROFILES.MUTATION_API
      );
      if (!rlResult.success) {
        return {
          success: false,
          error: "Too many submission attempts. Please wait a moment and try again.",
        };
      }
    } catch {
      // Continue if headers unavailable in test context
    }

    // 2. Validate with Zod
    const parsed = rfqSubmissionSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        Object.values(fieldErrors)[0]?.[0] || "Invalid submission parameters";
      return {
        success: false,
        error: firstError,
        fieldErrors,
      };
    }

    const data = parsed.data;

    // 3. Honeypot check (hidden field inside attribution if present)
    const attribution = (data.attribution || {}) as Record<string, any>;
    if (attribution.hp_field && attribution.hp_field.length > 0) {
      // Silently return success without DB write to deceive bots
      return {
        success: true,
        rfq_number: "RFQ-2026-000000",
        rfq_id: "00000000-0000-0000-0000-000000000000",
      };
    }

    // 4. Construct atomic payload for submit_rfq() RPC
    const payload = {
      contact: {
        name: data.full_name,
        email: data.email,
        phone: data.phone,
        job_title: null,
      },
      company: {
        name: data.company_name || null,
        city: data.company_city || data.project_city,
        state_code: data.company_state_code || data.project_state_code,
        address: null,
      },
      request: {
        source: data.source || "website",
        project_city: data.project_city,
        project_state_code: data.project_state_code,
        project_site_address: data.project_site_address || null,
        required_from: data.required_from || null,
        client_notes: data.client_notes || null,
        consent_at: new Date().toISOString(),
        attribution: data.attribution || null,
        ip_hash: null,
        idempotency_key: data.idempotency_key || null,
      },
      items: data.items.map((item, index) => ({
        requirement_type: item.requirement_type,
        equipment_id: item.equipment_id || null,
        category_id: item.category_id || null,
        brand_id: item.brand_id || null,
        custom_description: item.custom_description || null,
        quantity: item.quantity,
        min_height_m: item.min_height_m || null,
        min_capacity_kg: item.min_capacity_kg || null,
        duration_value: item.duration_value || null,
        duration_unit: item.duration_unit || null,
        notes: item.notes || null,
        sort_order: item.sort_order ?? index,
      })),
      attachments: (data.attachments || []).map((att) => ({
        storage_path: att.storage_path,
        original_name: att.original_name,
        mime_type: att.mime_type,
        size_bytes: att.size_bytes,
      })),
    };

    // 5. Invoke atomic submit_rfq RPC via service role admin client
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("submit_rfq", {
      p: payload,
    });

    if (rpcErr) {
      console.error("[RFQ] Error invoking submit_rfq RPC:", rpcErr);
      return {
        success: false,
        error: rpcErr.message || "Failed to submit quote request. Please try again.",
      };
    }

    // 6. Invalidate admin RFQ queries
    try {
      revalidatePath("/admin/sales/rfq");
      revalidatePath("/admin/sales/rfq/clients");
    } catch {
      // Revalidate safe catch
    }

    return {
      success: true,
      rfq_number: rpcRes.rfq_number,
      rfq_id: rpcRes.rfq_id,
      duplicate: Boolean(rpcRes.duplicate),
    };
  } catch (err: any) {
    console.error("[RFQ] Unexpected error in submitRfqAction:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while processing your request.",
    };
  }
}

// ============================================================================
// 2. Admin RFQ Status Transition Action
// ============================================================================

export async function updateRfqStatusAction(rawInput: unknown) {
  try {
    await verifySalesStaff();
    const parsed = rfqStatusUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid status transition parameters",
      };
    }

    const { id, to_status, expected_version, lost_reason, note } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_set_status", {
      p_id: id,
      p_to: to_status as any,
      p_expected_version: expected_version,
      p_lost_reason: (lost_reason as any) || null,
      p_note: note || null,
    });

    if (error) {
      console.error("[RFQ] Error updating status:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq`);
    revalidatePath(`/admin/sales/rfq/${id}`);

    return { success: true, updated: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update status." };
  }
}

// ============================================================================
// 3. Admin Assign RFQ Action
// ============================================================================

export async function assignRfqAction(rawInput: unknown) {
  try {
    await verifySalesStaff();
    const parsed = rfqAssignSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid assignment parameters",
      };
    }

    const { id, assigned_to, expected_version } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_assign", {
      p_id: id,
      p_user: assigned_to || null,
      p_expected_version: expected_version,
    });

    if (error) {
      console.error("[RFQ] Error assigning RFQ:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq`);
    revalidatePath(`/admin/sales/rfq/${id}`);

    return { success: true, updated: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign RFQ." };
  }
}

// ============================================================================
// 4. Admin Add Note Action
// ============================================================================

export async function addRfqNoteAction(rawInput: unknown) {
  try {
    await verifySalesStaff();
    const parsed = rfqNoteSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid note parameters",
      };
    }

    const { id, text } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_add_note", {
      p_id: id,
      p_text: text,
    });

    if (error) {
      console.error("[RFQ] Error adding note:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq/${id}`);

    return { success: true, event: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add note." };
  }
}

// ============================================================================
// 5. Admin Log Contact Action
// ============================================================================

export async function logRfqContactAction(rawInput: unknown) {
  try {
    await verifySalesStaff();
    const parsed = rfqContactLogSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid contact log parameters",
      };
    }

    const { id, channel, summary } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_log_contact", {
      p_id: id,
      p_channel: channel,
      p_summary: summary,
    });

    if (error) {
      console.error("[RFQ] Error logging contact:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq/${id}`);

    return { success: true, event: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to log contact." };
  }
}

// ============================================================================
// 6. Admin Set Follow-Up Action
// ============================================================================

export async function setRfqFollowUpAction(rawInput: unknown) {
  try {
    await verifySalesStaff();
    const parsed = rfqFollowUpSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid follow-up parameters",
      };
    }

    const { id, follow_up_at } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_set_follow_up", {
      p_id: id,
      p_follow_up_at: follow_up_at,
    });

    if (error) {
      console.error("[RFQ] Error setting follow up:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq`);
    revalidatePath(`/admin/sales/rfq/${id}`);

    return { success: true, updated: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to set follow up." };
  }
}

// ============================================================================
// 7. Admin Reopen RFQ Action (Admin role required)
// ============================================================================

export async function reopenRfqAction(rfqId: string) {
  try {
    const user = await verifySalesStaff();
    if (!["super_admin", "admin"].includes(user.role)) {
      return { success: false, error: "Only administrators can reopen a closed RFQ." };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_reopen", {
      p_id: rfqId,
    });

    if (error) {
      console.error("[RFQ] Error reopening RFQ:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq`);
    revalidatePath(`/admin/sales/rfq/${rfqId}`);

    return { success: true, updated: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reopen RFQ." };
  }
}

// ============================================================================
// 8. Admin Quotation Actions: Create Version, Update Draft, Send
// ============================================================================

export async function createQuotationVersionAction(rfqId: string) {
  try {
    await verifySalesStaff();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_create_quotation_version", {
      p_request_id: rfqId,
    });

    if (error) {
      console.error("[RFQ] Error creating quotation version:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq/${rfqId}`);
    return { success: true, quotation: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create quotation version." };
  }
}

export interface QuotationLineItemUpdate {
  id?: string;
  kind: "rental" | "sale" | "transport" | "operator" | "other";
  description: string;
  hsn_sac?: string | null;
  quantity: number;
  unit_price_paise: number;
  rate_unit?: "day" | "week" | "month" | null;
  duration_value?: number | null;
  discount_pct?: number;
  gst_rate?: number;
  sort_order: number;
}

export interface SaveQuotationDraftInput {
  quotation_id: string;
  rfq_id: string;
  valid_until?: string;
  place_of_supply_state?: string;
  notes_to_client?: string | null;
  terms_md?: string;
  items: QuotationLineItemUpdate[];
}

export async function saveQuotationDraftAction(input: SaveQuotationDraftInput) {
  try {
    await verifySalesStaff();
    const supabase = await createSupabaseServerClient();

    // 1. Verify quotation is draft
    const { data: q, error: qErr } = await supabase
      .from("quotations")
      .select("id, status")
      .eq("id", input.quotation_id)
      .single();

    if (qErr || !q) {
      return { success: false, error: "Quotation not found" };
    }

    if (q.status !== "draft") {
      return { success: false, error: "Locked quotation cannot be modified. Create a new version." };
    }

    // 2. Update quotation header fields
    const { error: updateErr } = await supabase
      .from("quotations")
      .update({
        valid_until: input.valid_until,
        place_of_supply_state: input.place_of_supply_state,
        notes_to_client: input.notes_to_client || null,
        terms_md: input.terms_md || "Standard terms and conditions apply.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.quotation_id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 3. Upsert / update line items
    // Delete items not in input
    const inputItemIds = input.items.map((i) => i.id).filter(Boolean) as string[];
    if (inputItemIds.length > 0) {
      await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", input.quotation_id)
        .not("id", "in", `(${inputItemIds.join(",")})`);
    } else {
      await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", input.quotation_id);
    }

    // Insert or update each item
    for (const item of input.items) {
      if (item.id) {
        await supabase
          .from("quotation_items")
          .update({
            kind: item.kind,
            description: item.description,
            hsn_sac: item.hsn_sac || null,
            quantity: item.quantity,
            unit_price_paise: item.unit_price_paise,
            rate_unit: item.rate_unit || null,
            duration_value: item.duration_value || null,
            discount_pct: item.discount_pct || 0,
            gst_rate: item.gst_rate ?? 18.0,
            sort_order: item.sort_order,
          })
          .eq("id", item.id);
      } else {
        await supabase.from("quotation_items").insert({
          quotation_id: input.quotation_id,
          kind: item.kind,
          description: item.description,
          hsn_sac: item.hsn_sac || null,
          quantity: item.quantity,
          unit_price_paise: item.unit_price_paise,
          rate_unit: item.rate_unit || null,
          duration_value: item.duration_value || null,
          discount_pct: item.discount_pct || 0,
          gst_rate: item.gst_rate ?? 18.0,
          sort_order: item.sort_order,
        });
      }
    }

    revalidatePath(`/admin/sales/rfq/${input.rfq_id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save quotation draft." };
  }
}

export async function sendQuotationAction(quotationId: string, rfqId: string) {
  try {
    await verifySalesStaff();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_send_quotation", {
      p_quotation_id: quotationId,
    });

    if (error) {
      console.error("[RFQ] Error sending quotation:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/sales/rfq`);
    revalidatePath(`/admin/sales/rfq/${rfqId}`);

    return { success: true, quotation: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to send quotation." };
  }
}

// ============================================================================
// 9. Admin Merge Company Action
// ============================================================================

export async function mergeCompanyAction(fromCompanyId: string, toCompanyId: string) {
  try {
    const user = await verifySalesStaff();
    if (!["super_admin", "admin"].includes(user.role)) {
      return { success: false, error: "Only administrators can merge client companies." };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rfq_merge_company", {
      p_from_company_id: fromCompanyId,
      p_to_company_id: toCompanyId,
    });

    if (error) {
      console.error("[RFQ] Error merging companies:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/sales/rfq");
    revalidatePath("/admin/sales/rfq/clients");

    return { success: true, merged: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to merge companies." };
  }
}

// ============================================================================
// 10. Admin Update Business Profile Action
// ============================================================================

export async function updateBusinessProfileAction(formData: {
  legal_name: string;
  gstin?: string | null;
  address?: string | null;
  state_code?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_details?: string | null;
  default_terms_md?: string | null;
  default_validity_days: number;
  default_gst_rate: number;
  rfq_notify_emails: string[];
}) {
  try {
    const user = await verifySalesStaff();
    if (!["super_admin", "admin"].includes(user.role)) {
      return { success: false, error: "Only administrators can update the business profile." };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("business_profile")
      .update({
        legal_name: formData.legal_name,
        gstin: formData.gstin || null,
        address: formData.address || null,
        state_code: formData.state_code || null,
        phone: formData.phone || null,
        email: formData.email || null,
        bank_details: formData.bank_details || null,
        default_terms_md: formData.default_terms_md || null,
        default_validity_days: formData.default_validity_days,
        default_gst_rate: formData.default_gst_rate,
        rfq_notify_emails: formData.rfq_notify_emails,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    if (error) {
      console.error("[RFQ] Error updating business profile:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/sales/rfq/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update business profile." };
  }
}

// ============================================================================
// 11. Staff Manual RFQ Entry Action (Phone / Walk-in / WhatsApp Enquiries)
// ============================================================================

export async function createManualRfqAction(rawInput: unknown) {
  try {
    const staff = await verifySalesStaff();
    const parsed = rfqSubmissionSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors)[0]?.[0] || "Invalid submission parameters";
      return {
        success: false,
        error: firstError,
        fieldErrors,
      };
    }

    const data = parsed.data;

    const payload = {
      contact: {
        name: data.full_name,
        email: data.email,
        phone: data.phone,
        job_title: null,
      },
      company: {
        name: data.company_name || null,
        city: data.company_city || data.project_city,
        state_code: data.company_state_code || data.project_state_code,
        address: null,
      },
      request: {
        source: data.source || "phone",
        project_city: data.project_city,
        project_state_code: data.project_state_code,
        project_site_address: data.project_site_address || null,
        required_from: data.required_from || null,
        client_notes: data.client_notes || null,
        consent_at: new Date().toISOString(),
        attribution: { created_by_staff_id: staff.id },
        ip_hash: null,
        idempotency_key: data.idempotency_key || null,
      },
      items: data.items.map((item, index) => ({
        requirement_type: item.requirement_type,
        equipment_id: item.equipment_id || null,
        category_id: item.category_id || null,
        brand_id: item.brand_id || null,
        custom_description: item.custom_description || null,
        quantity: item.quantity,
        min_height_m: item.min_height_m || null,
        min_capacity_kg: item.min_capacity_kg || null,
        duration_value: item.duration_value || null,
        duration_unit: item.duration_unit || null,
        notes: item.notes || null,
        sort_order: item.sort_order ?? index,
      })),
      attachments: (data.attachments || []).map((att) => ({
        storage_path: att.storage_path,
        original_name: att.original_name,
        mime_type: att.mime_type,
        size_bytes: att.size_bytes,
      })),
    };

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("submit_rfq", {
      p: payload,
    });

    if (rpcErr) {
      return { success: false, error: rpcErr.message };
    }

    // Auto-assign to creating staff member
    if (rpcRes.rfq_id) {
      await supabaseAdmin.rpc("rfq_assign", {
        p_id: rpcRes.rfq_id,
        p_user: staff.id,
        p_expected_version: 1,
      });
    }

    revalidatePath("/admin/sales/rfq");
    return {
      success: true,
      rfq_id: rpcRes.rfq_id,
      rfq_number: rpcRes.rfq_number,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create manual RFQ." };
  }
}
