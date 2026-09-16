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

import { getPaginatedClientsList, getClientKPIs, type PaginatedClientsResponse, type ClientKPIs } from "@/lib/data/clients";

export type PaginatedClientsResult = PaginatedClientsResponse;

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
    return getPaginatedClientsList({
      page,
      pageSize,
      search,
      status: statusFilter,
    });
  }
);

export const getClientMetrics = cache(async (): Promise<ClientKPIs> => {
  return getClientKPIs();
});


