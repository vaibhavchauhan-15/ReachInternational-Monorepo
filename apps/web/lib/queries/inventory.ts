import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type {
  InventoryStock,
  InventoryTransaction,
  StockTransfer,
  InventoryProduct,
  PurchaseRequest,
  GoodsReceipt,
  PartIssue,
  PartReturn,
  StorageLocation,
  StoreManagerDashboardMetrics,
  User,
} from "@/lib/types/database";

const getCachedInventoryProducts = unstable_cache(
  async (): Promise<InventoryProduct[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("inventory_products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching inventory products:", error);
      return [];
    }

    return (data as InventoryProduct[]) ?? [];
  },
  ["inventory-products-list-v2"],
  {
    revalidate: CACHE_TIERS.CLASS_B_CATALOG,
    tags: [TAGS.inventoryProducts],
  }
);

export const getInventoryProducts = cache(async (): Promise<InventoryProduct[]> => {
  return getCachedInventoryProducts();
});

const getCachedInventoryStock = unstable_cache(
  async (branchId?: string): Promise<InventoryStock[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("inventory_stock")
      .select(
        "id, product_id, branch_id, quantity, updated_at, product:inventory_products(*), branch:branches(id, code, name, city)"
      )
      .order("updated_at", { ascending: false });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching inventory stock:", error);
      return [];
    }

    return (data as unknown as InventoryStock[]) ?? [];
  },
  ["inventory-stock-list-v2"],
  {
    revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL,
    tags: [TAGS.inventoryProducts],
  }
);

export const getInventoryStock = cache(async (branchId?: string): Promise<InventoryStock[]> => {
  return getCachedInventoryStock(branchId);
});

export const getInventoryTransactions = cache(
  async (branchId?: string, limit: number = 200): Promise<InventoryTransaction[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("inventory_transactions")
      .select(
        "id, transaction_no, product_id, branch_id, type, quantity, reference_id, user_id, remarks, created_at, product:inventory_products(*), branch:branches(id, code, name), user:users(id, full_name, role, email)"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching inventory transactions:", error);
      return [];
    }

    return (data as unknown as InventoryTransaction[]) ?? [];
  }
);

export const getStockTransfers = cache(async (branchId?: string): Promise<StockTransfer[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("stock_transfers")
    .select(
      "id, transfer_no, from_branch_id, to_branch_id, product_id, quantity, status, requested_by, accepted_by, remarks, created_at, updated_at, product:inventory_products(*), from_branch:branches!from_branch_id(id, code, name), to_branch:branches!to_branch_id(id, code, name), requester:users!requested_by(id, full_name), accepter:users!accepted_by(id, full_name)"
    )
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching stock transfers:", error);
    return [];
  }

  return (data as unknown as StockTransfer[]) ?? [];
});

export const getStorageLocations = cache(async (branchId?: string): Promise<StorageLocation[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("inventory_storage_locations")
    .select("*, branch:branches(id, code, name)")
    .order("rack", { ascending: true });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching storage locations:", error);
    return [];
  }
  return (data as unknown as StorageLocation[]) ?? [];
});

export const getPurchaseRequests = cache(
  async (branchId?: string, sentToManagerId?: string): Promise<PurchaseRequest[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("inventory_purchase_requests")
      .select(
        "*, branch:branches(id, code, name), requester:users!requested_by(id, full_name, email, role), target_manager:users!sent_to_manager_id(id, full_name, email, role), approver:users!approved_by(id, full_name, email, role), items:inventory_purchase_request_items(*, product:inventory_products(*))"
      )
      .order("created_at", { ascending: false });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }
    if (sentToManagerId) {
      query = query.eq("sent_to_manager_id", sentToManagerId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching purchase requests:", error);
      return [];
    }
    return (data as unknown as PurchaseRequest[]) ?? [];
  }
);

export const getGoodsReceipts = cache(async (branchId?: string): Promise<GoodsReceipt[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("inventory_goods_receipts")
    .select(
      "*, branch:branches(id, code, name), receiver:users!received_by(id, full_name, email), po:purchase_orders(*), items:inventory_goods_receipt_items(*, product:inventory_products(*))"
    )
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching goods receipts:", error);
    return [];
  }
  return (data as unknown as GoodsReceipt[]) ?? [];
});

export const getPartIssues = cache(async (branchId?: string): Promise<PartIssue[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("inventory_part_issues")
    .select(
      "*, branch:branches(id, code, name), machine:machines(id, machine_code, machine_name), issuer:users!issued_by(id, full_name), recipient:users!issued_to_user_id(id, full_name), items:inventory_part_issue_items(*, product:inventory_products(*))"
    )
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching part issues:", error);
    return [];
  }
  return (data as unknown as PartIssue[]) ?? [];
});

export const getPartReturns = cache(async (branchId?: string): Promise<PartReturn[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("inventory_part_returns")
    .select(
      "*, receiver:users!received_by(id, full_name), issue:inventory_part_issues(*, machine:machines(id, machine_code, machine_name)), items:inventory_part_return_items(*, product:inventory_products(*))"
    )
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("issue.branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching part returns:", error);
    return [];
  }
  return (data as unknown as PartReturn[]) ?? [];
});

export const getManagersList = cache(async (): Promise<Pick<User, "id" | "full_name" | "email" | "role">[]> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .in("role", ["super_admin", "admin", "manager", "service_manager", "store_manager", "hr_manager"])
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching managers list:", error);
    return [];
  }
  return data ?? [];
});

export const getStoreManagerDashboardMetrics = cache(
  async (branchId?: string): Promise<StoreManagerDashboardMetrics> => {
    const [stocks, products, prs, grns, issues, returns] = await Promise.all([
      getInventoryStock(branchId),
      getInventoryProducts(),
      getPurchaseRequests(branchId),
      getGoodsReceipts(branchId),
      getPartIssues(branchId),
      getPartReturns(branchId),
    ]);

    const totalParts = products.length;
    let totalStockQty = 0;
    let totalStockValue = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    // Calculate per product stock status
    products.forEach((prod) => {
      const prodStocks = stocks.filter((s) => s.product_id === prod.id);
      const qty = prodStocks.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      totalStockQty += qty;
      totalStockValue += qty * (prod.unit_cost || 0);

      const minLevel = prod.min_stock_level || 5;
      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= minLevel) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    });

    const pendingPurchaseRequests = prs.filter((pr) => pr.status === "pending_approval").length;
    const pendingPartRequests = prs.filter((pr) => pr.status === "submitted").length;
    const pendingPurchaseOrders = prs.filter((pr) => pr.status === "approved").length;
    const incomingShipments = grns.length;

    const todayStr = new Date().toISOString().split("T")[0];

    const partsIssuedToday = issues
      .filter((i) => i.issue_date === todayStr)
      .reduce((acc, curr) => acc + (curr.items?.reduce((a, b) => a + b.quantity_issued, 0) || 0), 0);

    const partsReceivedToday = grns
      .filter((g) => g.created_at?.startsWith(todayStr))
      .reduce((acc, curr) => acc + (curr.items?.reduce((a, b) => a + b.quantity_received, 0) || 0), 0);

    const partsReturnedToday = returns
      .filter((r) => r.return_date === todayStr)
      .reduce((acc, curr) => acc + (curr.items?.reduce((a, b) => a + b.quantity_returned, 0) || 0), 0);

    const overdueReturnablePartsCount = issues.filter(
      (i) =>
        i.is_returnable &&
        i.status !== "fully_returned" &&
        i.expected_return_date &&
        i.expected_return_date < todayStr
    ).length;

    return {
      totalParts,
      totalStockQty,
      totalStockValue,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      pendingPartRequests,
      pendingPurchaseRequests,
      pendingPurchaseOrders,
      incomingShipments,
      partsIssuedToday,
      partsReceivedToday,
      partsReturnedToday,
      overdueReturnablePartsCount,
    };
  }
);
