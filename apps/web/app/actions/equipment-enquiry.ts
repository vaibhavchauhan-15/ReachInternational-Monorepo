"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { equipmentEnquirySchema, type EquipmentEnquiryInput } from "@reachinternational/validation";
import { TAGS } from "@/lib/cache";

export interface EnquiryActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function submitEquipmentEnquiry(
  prevState: unknown,
  formData: FormData
): Promise<EnquiryActionResponse> {
  try {
    // 1. Honeypot Anti-Spam Check
    const honeypot = formData.get("website_url_hp")?.toString() || "";
    if (honeypot.trim().length > 0) {
      // Silently accept bot submission without writing to database
      return {
        success: true,
        message: "Thank you! Your equipment quotation request has been received. Our team will contact you shortly.",
      };
    }

    // 2. Parse Raw Form Values
    const rawData = {
      equipment_id: formData.get("equipment_id")?.toString() || null,
      customer_name: formData.get("customer_name")?.toString() || "",
      company_name: formData.get("company_name")?.toString() || null,
      phone: formData.get("phone")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      project_location: formData.get("project_location")?.toString() || "",
      requirement_type: formData.get("requirement_type")?.toString() || "rental",
      rental_duration: formData.get("rental_duration")?.toString() || null,
      additional_requirements: formData.get("additional_requirements")?.toString() || null,
      source_url: formData.get("source_url")?.toString() || null,
    };

    // 3. Zod Canonical Server-Side Validation
    const parsed = equipmentEnquirySchema.safeParse(rawData);
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      const firstErrorMessage = Object.values(flattened)[0]?.[0] || "Invalid submission parameters";
      return {
        success: false,
        error: firstErrorMessage,
        fieldErrors: flattened,
      };
    }

    const {
      equipment_id,
      customer_name,
      company_name,
      phone,
      email,
      project_location,
      requirement_type,
      rental_duration,
      additional_requirements,
      source_url,
    } = parsed.data;

    // 4. Client Request IP Hash for rate-limiting traceability
    let ipHash: string | null = null;
    try {
      const headerList = await headers();
      const clientIp =
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headerList.get("x-real-ip") ||
        "unknown";
      if (clientIp !== "unknown") {
        // Simple hash to avoid storing raw IP
        ipHash = Buffer.from(clientIp).toString("base64").slice(0, 32);
      }
    } catch {
      // Fallback
    }

    // 5. Insert Record into Supabase
    const supabase = createSupabaseAdminClient();
    const { error: insertError } = await supabase.from("equipment_enquiries").insert({
      equipment_id: equipment_id || null,
      customer_name,
      company_name: company_name || null,
      phone,
      email,
      project_location,
      requirement_type,
      rental_duration: rental_duration || null,
      additional_requirements: additional_requirements || null,
      status: "new",
      source_url: source_url || null,
      ip_hash: ipHash,
    });

    if (insertError) {
      console.error("[Enquiry Action] Supabase insert failed:", insertError);
      return {
        success: false,
        error: "We were unable to process your request at this time. Please call our direct helpline.",
      };
    }

    // 6. Revalidate cache tags
    try {
      revalidateTag(TAGS.equipmentEnquiries, { expire: 0 });
    } catch {
      // Ignore if cache tag not yet initialized
    }

    return {
      success: true,
      message:
        "Thank you! Your equipment enquiry has been received. A Reach International machinery specialist will contact you within 2 hours with customized terms.",
    };
  } catch (err: unknown) {
    console.error("[Enquiry Action] Unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again or reach out to our support team.",
    };
  }
}
