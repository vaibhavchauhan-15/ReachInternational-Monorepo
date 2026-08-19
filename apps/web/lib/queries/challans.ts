import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { DeliveryChallan } from "@/lib/types/database";

interface ChallanDatabaseRow {
  id: string;
  challan_number?: string | null;
  to_customer_name?: string | null;
  to_address?: string | null;
  status?: string | null;
  approx_value?: number | null;
  issue_date?: string | null;
  expected_delivery?: string | null;
  created_at?: string | null;
  client_name?: string | null;
  destination?: string | null;
  amount?: number | null;
}

const getCachedDeliveryChallans = unstable_cache(
  async (status?: string): Promise<DeliveryChallan[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("challans")
      .select("id, challan_number, to_customer_name, to_address, status, approx_value, issue_date, created_at")
      .order("issue_date", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching delivery challans:", error.message || error.details || JSON.stringify(error));
      return [];
    }

    return ((data as unknown as ChallanDatabaseRow[]) ?? []).map((row): DeliveryChallan => ({
      id: row.id,
      challan_number: row.challan_number || "",
      client_name: row.to_customer_name || row.client_name || "N/A",
      destination: row.to_address || row.destination || "N/A",
      status: (row.status as DeliveryChallan["status"]) || "dispatched",
      amount: Number(row.approx_value ?? row.amount ?? 0),
      issue_date: row.issue_date || new Date().toISOString().split("T")[0],
      expected_delivery: row.expected_delivery || null,
      created_at: row.created_at || new Date().toISOString(),
    }));
  },
  ["delivery-challans-list-v2"],
  {
    revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL,
    tags: [TAGS.challans],
  }
);

export const getDeliveryChallans = cache(async (status?: string): Promise<DeliveryChallan[]> => {
  return getCachedDeliveryChallans(status);
});

export const getChallanById = cache(async (id: string): Promise<DeliveryChallan | null> => {
  const challans = await getDeliveryChallans();
  return challans.find((c) => c.id === id) ?? null;
});
