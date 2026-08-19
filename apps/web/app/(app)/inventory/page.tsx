import { requirePermission } from "@/lib/dal";
import {
  getInventoryStock,
  getInventoryTransactions,
  getStockTransfers,
  getInventoryProducts,
  getPurchaseRequests,
  getGoodsReceipts,
  getPartIssues,
  getPartReturns,
  getStorageLocations,
  getManagersList,
} from "@/lib/queries/inventory";
import { getBranches } from "@/lib/queries/branches";
import { getPurchaseOrders } from "@/lib/queries/purchase-orders";
import { getDeliveryChallans } from "@/lib/queries/challans";
import { getMachines } from "@/lib/queries/machines";
import { StockLedgerClient } from "@/components/inventory/StockLedgerClient";

export default async function InventoryPage() {
  await requirePermission("inventory.view");

  const [
    stocks,
    transactions,
    transfers,
    branches,
    products,
    purchaseRequests,
    purchaseOrders,
    goodsReceipts,
    partIssues,
    partReturns,
    deliveryChallans,
    storageLocations,
    managers,
    machines,
  ] = await Promise.all([
    getInventoryStock(),
    getInventoryTransactions(undefined, 200),
    getStockTransfers(),
    getBranches(),
    getInventoryProducts(),
    getPurchaseRequests(),
    getPurchaseOrders(),
    getGoodsReceipts(),
    getPartIssues(),
    getPartReturns(),
    getDeliveryChallans(),
    getStorageLocations(),
    getManagersList(),
    getMachines().then((res) => res.machines || []),
  ]);

  return (
    <div className="p-4 sm:p-6">
      <StockLedgerClient
        stocks={stocks}
        transactions={transactions}
        transfers={transfers}
        branches={branches}
        products={products}
        purchaseRequests={purchaseRequests}
        purchaseOrders={purchaseOrders}
        goodsReceipts={goodsReceipts}
        partIssues={partIssues}
        partReturns={partReturns}
        deliveryChallans={deliveryChallans}
        storageLocations={storageLocations}
        managers={managers}
        machines={machines}
      />
    </div>
  );
}
