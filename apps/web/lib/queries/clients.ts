import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { CRMClient } from "@/lib/types/database";

const CLIENT_SELECT_COLUMNS =
  "id, code, company_name, contact_person, phone, gstin, pan_number, address, city, district, state, pincode, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status, deleted_at, created_at, updated_at";

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

    return ((data as CRMClient[]) ?? []).map((client) => ({
      ...client,
      client_name: client.company_name,
      machine_count: client.machine_count ?? 0,
      open_complaints: client.open_complaints ?? 0,
      status: client.status ?? "active",
    }));
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

export const getClientOptions = unstable_cache(
  async (): Promise<{ id: string; label: string; code?: string }[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, code, company_name")
      .is("deleted_at", null)
      .order("company_name", { ascending: true });

    if (error || !data) return [];

    return data.map((c: any) => ({
      id: c.id,
      label: c.company_name || c.code || "Unknown Client",
      code: c.code || undefined,
    }));
  },
  ["client-options-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.clients] }
);


