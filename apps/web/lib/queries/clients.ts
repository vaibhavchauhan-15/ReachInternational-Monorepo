import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { CRMClient } from "@/lib/types/database";

const CLIENT_SELECT_COLUMNS =
  "id, code, company_name, contact_person, phone, gstin, pan_number, street, city, district, state, pincode, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status, deleted_at, created_at, updated_at";

const getCachedClients = unstable_cache(
  async (includeDeleted: boolean = false): Promise<CRMClient[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("clients")
      .select(CLIENT_SELECT_COLUMNS)
      .order("company_name", { ascending: true });

    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching clients from database:", error.message || error);
      return [];
    }

    return ((data as CRMClient[]) ?? []).map((client) => {
      const street = (client.street || "").trim();
      const fullAddress =
        [street, client.city, client.district, client.state, client.pincode]
          .filter(Boolean)
          .map((s) => String(s).trim())
          .filter(Boolean)
          .join(", ");
      return {
        ...client,
        street,
        address: fullAddress,
        client_name: client.company_name,
        machine_count: client.machine_count ?? 0,
        open_complaints: client.open_complaints ?? 0,
        status: client.status ?? "active",
      };
    });
  },
  ["clients-directory-list-v4"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.clients],
  }
);

export const getClients = cache(async (_branchId?: string, includeDeleted: boolean = false): Promise<CRMClient[]> => {
  return getCachedClients(includeDeleted);
});

export const getClientById = cache(async (id: string): Promise<CRMClient | null> => {
  const clients = await getClients(undefined, true);
  return clients.find((c) => c.id === id) ?? null;
});

export interface ClientOptionItem {
  id: string;
  label: string;
  code?: string;
  company_name: string;
  client_name?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
}

export const getClientOptions = unstable_cache(
  async (): Promise<ClientOptionItem[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, code, company_name, city, district, state, pincode, street, phone")
      .is("deleted_at", null)
      .order("company_name", { ascending: true });

    if (!error && data) {
      return data.map((c: any) => {
        const fullAddress = [c.street, c.city, c.district, c.state, c.pincode]
          .filter(Boolean)
          .map((s: any) => String(s).trim())
          .filter(Boolean)
          .join(", ");
        return {
          id: c.id,
          label: c.company_name || c.code || "Unknown Client",
          company_name: c.company_name || c.code || "Unknown Client",
          client_name: c.company_name,
          code: c.code || undefined,
          city: c.city || undefined,
          state: c.state || undefined,
          address: fullAddress || undefined,
          phone: c.phone || undefined,
        };
      });
    }
    return [];
  },
  ["client-options-v4"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.clients] }
);

export interface PaginatedClientsResult {
  clients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getPaginatedClients = cache(
  async ({
    page = 1,
    pageSize = 10,
    search = "",
    statusFilter = "all",
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
    statusFilter?: "all" | "active" | "inactive";
  }): Promise<PaginatedClientsResult> => {
    const supabase = createSupabaseAdminClient();
    const limit = Math.min(Math.max(1, pageSize), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from("clients").select(CLIENT_SELECT_COLUMNS, { count: "exact" });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    
    // Default to excluding soft deleted unless searching for everything?
    // Let's exclude soft-deleted items unless specifically asking for inactive, or maybe they are fetched?
    // Wait, the previous client-side logic showed "SOFT DELETED" clients in the list.
    // The previous getClients(undefined, true) fetched them all if `includeDeleted` was true.
    // The page route calls `getClients(undefined, true)`. So deleted ones are included.
    // If status is "active", they shouldn't be soft deleted.
    // If status is "inactive", it includes soft-deleted.

    if (search) {
      const q = `%${search}%`;
      query = query.or(
        `company_name.ilike.${q},code.ilike.${q},contact_person.ilike.${q},phone.ilike.${q},gstin.ilike.${q},pan_number.ilike.${q},street.ilike.${q},city.ilike.${q},district.ilike.${q},state.ilike.${q},billing_address.ilike.${q},billing_city.ilike.${q}`
      );
    }

    query = query.order("company_name", { ascending: true });

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error("Error fetching paginated clients:", error.message || error);
      return { clients: [], total: 0, page, pageSize: limit, totalPages: 0 };
    }

    const clients = ((data as CRMClient[]) ?? []).map((client) => {
      const street = (client.street || "").trim();
      const fullAddress =
        [street, client.city, client.district, client.state, client.pincode]
          .filter(Boolean)
          .map((s) => String(s).trim())
          .filter(Boolean)
          .join(", ");
      return {
        ...client,
        street,
        address: fullAddress,
        client_name: client.company_name,
        machine_count: client.machine_count ?? 0,
        open_complaints: client.open_complaints ?? 0,
        status: client.status ?? "active",
      };
    });

    return {
      clients,
      total: count ?? 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  }
);

export const getClientMetrics = unstable_cache(
  async () => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("clients").select("status, city, deleted_at");

    if (error) {
      console.error("Error fetching client metrics:", error.message || error);
      return { total: 0, active: 0, inactive: 0, cities: 0 };
    }

    // To match previous logic, we count total clients including soft-deleted if they were shown.
    const validData = data || [];
    const total = validData.length;
    
    // In previous logic: active = status === "active"
    // inactive = status === "inactive"
    // Let's replicate exact client logic
    const active = validData.filter((c: any) => c.status === "active" && !c.deleted_at).length;
    // Anyone not active is inactive effectively, but previously it strictly checked === "inactive". Soft deletes change status to inactive.
    const inactive = validData.filter((c: any) => c.status === "inactive" || c.deleted_at).length;
    const cities = new Set(validData.map((c: any) => c.city).filter(Boolean)).size;

    return { total, active, inactive, cities };
  },
  ["clients-metrics-v1"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.clients] }
);


