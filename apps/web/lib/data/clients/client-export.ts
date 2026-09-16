import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ClientDirectoryFilter } from "@reachinternational/utils";

export interface ClientExportRecord {
  code: string;
  company_name: string;
  contact_person: string;
  phone: string;
  gstin: string;
  pan_number: string;
  site_address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  is_billing_different: boolean;
  billing_address: string;
  status: string;
  created_at: string;
}

export async function getClientsForExport(filter?: ClientDirectoryFilter): Promise<ClientExportRecord[]> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("clients")
    .select(
      "code, company_name, contact_person, phone, gstin, pan_number, street, city, district, state, pincode, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status, deleted_at, created_at"
    );

  if (filter?.status === "active") {
    query = query.eq("status", "active").is("deleted_at", null);
  } else if (filter?.status === "inactive") {
    query = query.or("status.eq.inactive,deleted_at.not.is.null");
  }

  if (filter?.city && filter.city !== "all") {
    query = query.eq("city", filter.city);
  }

  if (filter?.search && filter.search.trim()) {
    const s = filter.search.trim().replace(/[,()"\\]/g, "");
    if (s) {
      query = query.or(
        `company_name.ilike.%${s}%,code.ilike.%${s}%,contact_person.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%,gstin.ilike.%${s}%,pan_number.ilike.%${s}%`
      );
    }
  }

  query = query.order("company_name", { ascending: true }).limit(2000);

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error fetching clients for export:", error?.message || error);
    return [];
  }

  return data.map((c: any) => {
    const street = (c.street || "").trim();
    const fullSite = [street, c.city, c.district, c.state, c.pincode].filter(Boolean).join(", ");
    const fullBilling = c.is_billing_address_different
      ? [c.billing_address, c.billing_city, c.billing_district, c.billing_state, c.billing_pincode]
          .filter(Boolean)
          .join(", ")
      : "Same as Site Address";

    return {
      code: c.code || "",
      company_name: c.company_name || "",
      contact_person: c.contact_person || "",
      phone: c.phone || "",
      gstin: c.gstin || "",
      pan_number: c.pan_number || "",
      site_address: fullSite,
      city: c.city || "",
      district: c.district || "",
      state: c.state || "",
      pincode: c.pincode || "",
      is_billing_different: Boolean(c.is_billing_address_different),
      billing_address: fullBilling,
      status: c.deleted_at ? "SOFT DELETED" : (c.status || "active").toUpperCase(),
      created_at: c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "",
    };
  });
}

// Named alias
export const exportClients = getClientsForExport;
