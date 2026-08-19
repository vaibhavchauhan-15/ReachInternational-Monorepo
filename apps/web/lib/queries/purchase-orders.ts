import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { PurchaseOrder } from "@/lib/types/database";

const getCachedPurchaseOrders = unstable_cache(
  async (branchId?: string, status?: string): Promise<PurchaseOrder[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("purchase_orders")
      .select("id, po_number, vendor_id, vendor_name, amount, status, due_date, requested_by, branch_id, created_at")
      .order("created_at", { ascending: false });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching purchase orders:", error);
      return [];
    }

    return (data as PurchaseOrder[]) ?? [];
  },
  ["purchase-orders-list-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL,
    tags: [TAGS.purchaseOrders],
  }
);

export const getPurchaseOrders = cache(async (branchId?: string, status?: string): Promise<PurchaseOrder[]> => {
  return getCachedPurchaseOrders(branchId, status);
});

export const getPOById = cache(async (id: string): Promise<PurchaseOrder | null> => {
  const pos = await getPurchaseOrders();
  return pos.find((p) => p.id === id) ?? null;
});
