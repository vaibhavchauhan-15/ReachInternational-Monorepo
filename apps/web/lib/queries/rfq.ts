import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type {
  QuoteRequest,
  QuoteRequestItem,
  Company,
  Contact,
  Quotation,
  QuotationItem,
  RfqListItem,
  RfqDashboardCounts,
  BusinessProfile,
  RfqEvent,
  RfqStatus,
  RfqSource,
} from "@reachinternational/types";
import { INDIAN_STATES, type IndianState } from "@/lib/rfq/states";

// ============================================================================
// 1. Slim Equipment Catalogue for RFQ dropdowns
// ============================================================================

export interface SlimEquipment {
  id: string;
  name: string;
  model_number: string;
  category_id: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  primary_image_url?: string | null;
}

const getCachedSlimEquipmentList = unstable_cache(
  async (): Promise<SlimEquipment[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("equipment_models")
      .select(`
        id,
        model_name,
        model_number,
        category_id,
        primary_image_url,
        category:equipment_categories(name),
        brand:equipment_brands(name)
      `)
      .eq("is_published", true)
      .order("model_name", { ascending: true });

    if (error || !data) {
      console.error("[DAL:RFQ] Error fetching slim equipment list:", error);
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      name: item.model_name,
      model_number: item.model_number || "",
      category_id: item.category_id,
      category_name: item.category?.name || "Equipment",
      brand_name: item.brand?.name || "",
      primary_image_url: item.primary_image_url || null,
    }));
  },
  ["rfq-slim-equipment-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC,
    tags: [TAGS.equipment, "rfq-equipment"],
  }
);

export const getSlimEquipmentList = cache(async (): Promise<SlimEquipment[]> => {
  return getCachedSlimEquipmentList();
});

// ============================================================================
// 2. Business Profile Query
// ============================================================================

const getCachedBusinessProfile = unstable_cache(
  async (): Promise<BusinessProfile | null> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("business_profile")
      .select("*")
      .eq("id", true)
      .single();

    if (error || !data) {
      console.error("[DAL:RFQ] Error fetching business profile:", error);
      return null;
    }

    return data as BusinessProfile;
  },
  ["rfq-business-profile-v1"],
  {
    revalidate: 300,
    tags: ["rfq-settings", "business-profile"],
  }
);

export const getBusinessProfile = cache(async (): Promise<BusinessProfile | null> => {
  return getCachedBusinessProfile();
});

// ============================================================================
// 3. Indian States Lookup
// ============================================================================

export function getIndianStates(): readonly IndianState[] {
  return INDIAN_STATES;
}

// ============================================================================
// 4. Sales Users for Assignment
// ============================================================================

export interface SalesUserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export const getSalesUsers = cache(async (): Promise<SalesUserOption[]> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .in("role", ["super_admin", "admin", "sales"])
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error || !data) {
    console.error("[DAL:RFQ] Error fetching sales users:", error);
    return [];
  }

  return data as SalesUserOption[];
});

// ============================================================================
// 5. RFQ Dashboard KPI Counts
// ============================================================================

export interface RfqDashboardStats {
  total_active: number;
  new_count: number;
  under_review_count: number;
  quotation_prepared_count: number;
  quotation_sent_count: number;
  converted_count: number;
  lost_count: number;
  on_hold_count: number;
  overdue_count: number;
  total_paise: number;
}

export const getRfqDashboardStats = cache(async (): Promise<RfqDashboardStats> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .select("id, status, follow_up_at")
    .is("deleted_at", null);

  if (error || !data) {
    console.error("[DAL:RFQ] Error fetching RFQ dashboard stats:", error);
    return {
      total_active: 0,
      new_count: 0,
      under_review_count: 0,
      quotation_prepared_count: 0,
      quotation_sent_count: 0,
      converted_count: 0,
      lost_count: 0,
      on_hold_count: 0,
      overdue_count: 0,
      total_paise: 0,
    };
  }

  const now = new Date();
  let totalActive = 0;
  let newCount = 0;
  let underReviewCount = 0;
  let quotationPreparedCount = 0;
  let quotationSentCount = 0;
  let convertedCount = 0;
  let lostCount = 0;
  let onHoldCount = 0;
  let overdueCount = 0;

  for (const item of data) {
    const isClosed = ["converted", "lost", "spam"].includes(item.status);
    if (!isClosed) totalActive++;

    if (item.status === "new") newCount++;
    else if (item.status === "under_review") underReviewCount++;
    else if (item.status === "quotation_prepared") quotationPreparedCount++;
    else if (item.status === "quotation_sent") quotationSentCount++;
    else if (item.status === "converted") convertedCount++;
    else if (item.status === "lost") lostCount++;
    else if (item.status === "on_hold") onHoldCount++;

    if (!isClosed && item.follow_up_at && new Date(item.follow_up_at) < now) {
      overdueCount++;
    }
  }

  return {
    total_active: totalActive,
    new_count: newCount,
    under_review_count: underReviewCount,
    quotation_prepared_count: quotationPreparedCount,
    quotation_sent_count: quotationSentCount,
    converted_count: convertedCount,
    lost_count: lostCount,
    on_hold_count: onHoldCount,
    overdue_count: overdueCount,
    total_paise: 0,
  };
});

// ============================================================================
// 6. RFQ List Query
// ============================================================================

export interface RfqFilterParams {
  status?: string;
  source?: string;
  search?: string;
  assignedTo?: string;
  stateCode?: string;
  page?: number;
  limit?: number;
}

export const getRfqList = cache(
  async (params: RfqFilterParams = {}): Promise<{ items: RfqListItem[]; total: number }> => {
    const supabase = await createSupabaseServerClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(10, params.limit || 25));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("rfq_list")
      .select("*", { count: "exact" });

    // Status filter
    if (params.status && params.status !== "all") {
      if (params.status === "overdue") {
        query = query.eq("is_overdue", true);
      } else if (params.status === "active") {
        query = query.not("status", "in", '("converted","lost","spam")');
      } else {
        query = query.eq("status", params.status);
      }
    }

    // Source filter
    if (params.source && params.source !== "all") {
      query = query.eq("source", params.source);
    }

    // Assignee filter
    if (params.assignedTo && params.assignedTo !== "all") {
      if (params.assignedTo === "unassigned") {
        query = query.is("assigned_to", null);
      } else {
        query = query.eq("assigned_to", params.assignedTo);
      }
    }

    // Search query (rfq_number, company_name, contact_name, contact_email, contact_phone, project_city)
    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(
        `rfq_number.ilike.${term},company_name.ilike.${term},contact_name.ilike.${term},contact_email.ilike.${term},contact_phone.ilike.${term},project_city.ilike.${term}`
      );
    }

    // State filter
    if (params.stateCode && params.stateCode !== "all") {
      query = query.eq("project_state_code", params.stateCode);
    }

    // Ordering and Pagination
    query = query
      .order("last_activity_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[DAL:RFQ] Error fetching rfq_list:", error);
      return { items: [], total: 0 };
    }

    return {
      items: (data || []) as RfqListItem[],
      total: count || 0,
    };
  }
);

// ============================================================================
// 7. RFQ Detail Query by ID
// ============================================================================

export interface RfqDetail extends QuoteRequest {
  company: Company | null;
  contact: Contact;
  items: (QuoteRequestItem & {
    equipment?: { id: string; model_name: string; model_number: string; primary_image_url: string | null } | null;
    category?: { id: string; name: string } | null;
    brand?: { id: string; name: string } | null;
  })[];
  attachments: {
    id: string;
    storage_path: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }[];
  events: RfqEvent[];
  assigned_user?: { id: string; full_name: string; email: string } | null;
  quotations: (Quotation & {
    items: QuotationItem[];
    subtotal_paise: number;
    tax_paise: number;
    total_paise: number;
  })[];
}

export const getRfqById = cache(async (id: string): Promise<RfqDetail | null> => {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch quote request core record
  const { data: rfq, error: rfqError } = await supabase
    .from("quote_requests")
    .select(`
      *,
      company:companies(*),
      contact:contacts(*),
      assigned_user:users!quote_requests_assigned_to_fkey(id, full_name, email)
    `)
    .eq("id", id)
    .single();

  if (rfqError || !rfq) {
    console.error("[DAL:RFQ] Error fetching quote request detail:", rfqError);
    return null;
  }

  // 2. Fetch requested equipment items with equipment relations
  const { data: rawItems } = await supabase
    .from("quote_request_items")
    .select(`
      *,
      equipment:equipment_models(id, model_name, model_number, primary_image_url),
      category:equipment_categories(id, name),
      brand:equipment_brands(id, name)
    `)
    .eq("request_id", id)
    .order("sort_order", { ascending: true });

  // 3. Fetch attachments
  const { data: attachments } = await supabase
    .from("rfq_attachments")
    .select("id, storage_path, original_name, mime_type, size_bytes, created_at")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  // 4. Fetch timeline events
  const { data: events } = await supabase
    .from("rfq_events")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: false });

  // 5. Fetch quotations with line items
  const { data: rawQuotations } = await supabase
    .from("quotations")
    .select(`
      *,
      items:quotation_items(*)
    `)
    .eq("request_id", id)
    .order("version", { ascending: false });

  // 6. Fetch totals view for quotations
  const quoteIds = (rawQuotations || []).map((q: any) => q.id);
  const totalsMap = new Map<string, { subtotal: number; tax: number; total: number }>();

  if (quoteIds.length > 0) {
    const { data: totalsData } = await supabase
      .from("quotation_totals")
      .select("*")
      .in("quotation_id", quoteIds);

    if (totalsData) {
      for (const t of totalsData) {
        totalsMap.set(t.quotation_id, {
          subtotal: Number(t.subtotal_paise || 0),
          tax: Number(t.tax_paise || 0),
          total: Number(t.total_paise || 0),
        });
      }
    }
  }

  const quotations = (rawQuotations || []).map((q: any) => {
    const totals = totalsMap.get(q.id) || { subtotal: 0, tax: 0, total: 0 };
    return {
      ...q,
      items: (q.items || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      subtotal_paise: totals.subtotal,
      tax_paise: totals.tax,
      total_paise: totals.total,
    };
  });

  return {
    ...rfq,
    items: rawItems || [],
    attachments: attachments || [],
    events: events || [],
    quotations,
  } as RfqDetail;
});

// ============================================================================
// 8. Companies Directory & Stats for RFQ Clients
// ============================================================================

export interface CompanyWithRfqStats extends Company {
  rfq_count: number;
  total_won_paise: number;
  last_rfq_at: string | null;
  primary_contact?: Contact | null;
}

export const getCompaniesWithStats = cache(async (): Promise<CompanyWithRfqStats[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(`
      *,
      contacts(*),
      quote_requests(id, status, created_at)
    `)
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("[DAL:RFQ] Error fetching companies:", error);
    return [];
  }

  return data.map((c: any) => {
    const requests = c.quote_requests || [];
    const rfqCount = requests.length;
    const sortedReqs = [...requests].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastRfqAt = sortedReqs.length > 0 ? sortedReqs[0].created_at : null;
    const primaryContact = c.contacts?.[0] || null;

    return {
      id: c.id,
      name: c.name,
      gstin: c.gstin,
      pan: c.pan,
      city: c.city,
      state_code: c.state_code,
      address: c.address,
      website: c.website,
      merged_into_id: c.merged_into_id || null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      rfq_count: rfqCount,
      total_won_paise: 0,
      last_rfq_at: lastRfqAt,
      primary_contact: primaryContact,
    };
  });
});
