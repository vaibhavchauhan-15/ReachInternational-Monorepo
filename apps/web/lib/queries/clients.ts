import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { CRMClient } from "@/lib/types/database";

const getCachedClients = unstable_cache(
  async (branchId?: string): Promise<CRMClient[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("clients")
      .select("id, client_name, code, contact_person, email, phone, city, state, branch_id, machine_count, open_complaints, status, created_at")
      .order("client_name", { ascending: true });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching clients:", error);
      return [];
    }

    return (data as CRMClient[]) ?? [];
  },
  ["clients-directory-list-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.clients],
  }
);

export const getClients = cache(async (branchId?: string): Promise<CRMClient[]> => {
  return getCachedClients(branchId);
});

export const getClientById = cache(async (id: string): Promise<CRMClient | null> => {
  const clients = await getClients();
  return clients.find((c) => c.id === id) ?? null;
});
