"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AnimatedPackage,
  AnimatedRefresh,
  AnimatedPlus,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedUpload,
  AnimatedWrench,
  AnimatedPrinter,
  AnimatedDashboard,
  AnimatedBuilding2,
  AnimatedShoppingBag,
  AnimatedFileText,
  AnimatedBarChart3,
  AnimatedClipboardList,
} from "@/components/ui/animated-icons";
import { Badge, Button, Input, Modal, useToast, TooltipWrapper } from "@/components/ui";
import type {
  InventoryStock,
  InventoryTransaction,
  StockTransfer,
  Branch,
  InventoryProduct,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceipt,
  PartIssue,
  PartReturn,
  DeliveryChallan,
  StorageLocation,
  User,
  Machine,
} from "@/lib/types/database";

import { PartDetailModal } from "./PartDetailModal";
import { PurchaseRequestModal } from "./PurchaseRequestModal";
import { GoodsReceiptModal } from "./GoodsReceiptModal";
import { PartIssueModal } from "./PartIssueModal";
import { PrintablePurchaseOrder } from "./PrintablePurchaseOrder";
import { PrintableDeliveryChallan } from "./PrintableDeliveryChallan";
import { PrintablePartsIssueChallan } from "./PrintablePartsIssueChallan";

import {
  createOrUpdatePartAction,
  updatePartStorageLocationAction,
  approveOrRejectPurchaseRequestAction,
  createPurchaseOrderAction,
  recordPartReturnAction,
  acceptStockTransferAction,
} from "@/app/actions/inventory";

import {
  AlertTriangle,
  Search,
  Filter,
  MapPin,
  FileText,
  Truck,
  Send,
  UserCheck,
  Check,
  X,
  ArrowRight,
  ChevronRight,
  Eye,
  Download,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ChevronLeft,
  Package,
  MoreVertical,
} from "lucide-react";

const TAB_CONFIG: Record<string, { label: string; icon: any }> = {
  dashboard: { label: "Inventory Dashboard", icon: AnimatedDashboard },
  master: { label: "Part Master Catalog", icon: AnimatedPackage },
  locations: { label: "Storage & Bins", icon: AnimatedBuilding2 },
  procurement: { label: "Procurement Hub", icon: AnimatedShoppingBag },
  grn: { label: "Goods Receipt (GRN)", icon: AnimatedFileText },
  issues: { label: "Part Issuance", icon: AnimatedWrench },
  returns: { label: "Returnable Parts", icon: AnimatedClipboardList },
  transactions: { label: "Stock Ledger Audit History", icon: AnimatedBarChart3 },
  transfers: { label: "Inter-Branch Transfers", icon: AnimatedRefresh },
};

export interface StockLedgerClientProps {
  stocks: InventoryStock[];
  transactions: InventoryTransaction[];
  transfers: StockTransfer[];
  branches: Branch[];
  products: InventoryProduct[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  partIssues: PartIssue[];
  partReturns: PartReturn[];
  deliveryChallans: DeliveryChallan[];
  storageLocations: StorageLocation[];
  managers: Pick<User, "id" | "full_name" | "email" | "role">[];
  machines: Machine[];
}

export function StockLedgerClient({
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
}: StockLedgerClientProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { toast } = useToast();

  const [activeTabState, setActiveTab] = useState<
    | "dashboard"
    | "master"
    | "locations"
    | "procurement"
    | "grn"
    | "issues"
    | "returns"
    | "transactions"
    | "transfers"
  >("dashboard");

  const validTabs = [
    "dashboard", "master", "locations", "procurement", "grn", "issues", "returns", "transactions", "transfers"
  ];
  const activeTab = (tabParam && validTabs.includes(tabParam)
    ? tabParam
    : activeTabState) as
    | "dashboard"
    | "master"
    | "locations"
    | "procurement"
    | "grn"
    | "issues"
    | "returns"
    | "transactions"
    | "transfers";

  const currentTabConfig = TAB_CONFIG[activeTab] || TAB_CONFIG.dashboard;

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab as any);
    setCurrentPage(1);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.pushState({}, "", url.toString());
  };

  // Modal Open Controls
  const [showPartDetailModal, setShowPartDetailModal] = useState(false);
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<InventoryProduct | null>(null);

  const [showPRModal, setShowPRModal] = useState(false);
  const [prDefaultProductId, setPRDefaultProductId] = useState<string | undefined>(undefined);

  const [showGRNModal, setShowGRNModal] = useState(false);
  const [showPartIssueModal, setShowPartIssueModal] = useState(false);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [relocateProduct, setRelocateProduct] = useState<InventoryProduct | null>(null);

  // Print Document View Modal Controls
  const [printDocument, setPrintDocument] = useState<{
    type: "PO" | "DC" | "PIC";
    data: any;
  } | null>(null);

  // Return Part Process State
  const [returnModalIssue, setReturnModalIssue] = useState<PartIssue | null>(null);
  const [returnedByName, setReturnedByName] = useState("");
  const [returnQty, setReturnQty] = useState(1);
  const [returnCondition, setReturnCondition] = useState<"good" | "damaged" | "scrap">("good");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterManufacturer, setFilterManufacturer] = useState("all");
  const [filterRack, setFilterRack] = useState("all");
  const [filterStockStatus, setFilterStockStatus] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [sortColumn, setSortColumn] = useState<"part_number" | "name" | "manufacturer" | "stock" | "unit_cost">("part_number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Table Selection & Pagination State
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Add Part Form State
  const [partNo, setPartNo] = useState("");
  const [partName, setPartName] = useState("");
  const [partCat, setPartCat] = useState("Filters");
  const [partManufacturer, setPartManufacturer] = useState("JCB");
  const [unitCost, setUnitCost] = useState(1000);
  const [minStock, setMinStock] = useState(5);
  const [rackNo, setRackNo] = useState("R-01");
  const [binNo, setBinNo] = useState("B-01");
  const [submitting, setSubmitting] = useState(false);

  // Relocate state
  const [newZone, setNewZone] = useState("ZONE-A");
  const [newRack, setNewRack] = useState("R-01");
  const [newShelf, setNewShelf] = useState("S-01");
  const [newBin, setNewBin] = useState("B-01");

  // Calculate Metrics
  const totalParts = products.length;
  let totalStockQty = 0;
  let totalStockValue = 0;
  let inStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  products.forEach((prod) => {
    const prodStocks = stocks.filter((s) => s.product_id === prod.id);
    const qty = prodStocks.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    totalStockQty += qty;
    totalStockValue += qty * (prod.unit_cost || 0);

    const minLevel = prod.min_stock_level || 5;
    if (qty === 0) outOfStockCount++;
    else if (qty <= minLevel) lowStockCount++;
    else inStockCount++;
  });

  const pendingPRs = purchaseRequests.filter((pr) => pr.status === "pending_approval");
  const pendingPOs = purchaseOrders.filter((po) => po.status === "pending_approval" || po.status === "approved");
  const overdueReturnableIssues = partIssues.filter(
    (i) => i.is_returnable && i.status !== "fully_returned"
  );

  // Filtered & Sorted Products
  const filteredProducts = products
    .filter((prod) => {
      const prodStocks = stocks.filter((s) => s.product_id === prod.id);
      const qty = prodStocks.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      const minLevel = prod.min_stock_level || 5;

      const matchesSearch =
        !searchQuery ||
        prod.part_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod.manufacturer && prod.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (prod.oem_part_number && prod.oem_part_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (prod.rack_number && prod.rack_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (prod.bin_number && prod.bin_number.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = filterCategory === "all" || prod.category === filterCategory;
      const matchesManufacturer = filterManufacturer === "all" || prod.manufacturer === filterManufacturer;
      const matchesRack = filterRack === "all" || prod.rack_number === filterRack;

      let matchesStockStatus = true;
      if (filterStockStatus === "in_stock") {
        matchesStockStatus = qty > minLevel;
      } else if (filterStockStatus === "low_stock") {
        matchesStockStatus = qty > 0 && qty <= minLevel;
      } else if (filterStockStatus === "out_of_stock") {
        matchesStockStatus = qty === 0;
      }

      return matchesSearch && matchesCategory && matchesManufacturer && matchesRack && matchesStockStatus;
    })
    .sort((a, b) => {
      let valA: any = a[sortColumn as keyof InventoryProduct] || "";
      let valB: any = b[sortColumn as keyof InventoryProduct] || "";

      if (sortColumn === "stock") {
        valA = stocks.filter((s) => s.product_id === a.id).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        valB = stocks.filter((s) => s.product_id === b.id).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      } else if (sortColumn === "unit_cost") {
        valA = a.unit_cost || 0;
        valB = b.unit_cost || 0;
      } else if (sortColumn === "manufacturer") {
        valA = a.manufacturer || "";
        valB = b.manufacturer || "";
      }

      if (typeof valA === "string") {
        const comp = valA.localeCompare(valB as string);
        return sortDirection === "asc" ? comp : -comp;
      }

      const comp = (valA as number) - (valB as number);
      return sortDirection === "asc" ? comp : -comp;
    });

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

  const handleSort = (column: "part_number" | "name" | "manufacturer" | "stock" | "unit_cost") => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedPartIds.length === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedPartIds([]);
    } else {
      setSelectedPartIds(paginatedProducts.map((p) => p.id));
    }
  };

  const toggleSelectPart = (id: string) => {
    setSelectedPartIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterCategory("all");
    setFilterManufacturer("all");
    setFilterRack("all");
    setFilterStockStatus("all");
    setCurrentPage(1);
  };

  const handleBulkExportCSV = () => {
    const partsToExport = selectedPartIds.length > 0
      ? products.filter((p) => selectedPartIds.includes(p.id))
      : filteredProducts;

    const headers = ["Part Number", "Name", "Category", "Manufacturer", "Rack", "Bin", "Available Stock", "Unit Cost", "Min Stock"];
    const rows = partsToExport.map((p) => {
      const qty = stocks.filter((s) => s.product_id === p.id).reduce((a, b) => a + (b.quantity || 0), 0);
      return [
        `"${p.part_number}"`,
        `"${p.name}"`,
        `"${p.category || "General"}"`,
        `"${p.manufacturer || "JCB"}"`,
        `"${p.rack_number || "R-01"}"`,
        `"${p.bin_number || "B-01"}"`,
        qty,
        p.unit_cost || 0,
        p.min_stock_level || 5
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `part_master_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported ${partsToExport.length} parts to CSV`);
  };

  const handleAddPartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await createOrUpdatePartAction({
      part_number: partNo,
      name: partName,
      category: partCat,
      manufacturer: partManufacturer,
      unit_cost: unitCost,
      min_stock_level: minStock,
      rack_number: rackNo,
      bin_number: binNo,
    });
    setSubmitting(false);
    if (res.success) {
      toast("success", `Part ${partNo} added to Part Master!`);
      setShowAddPartModal(false);
      setPartNo("");
      setPartName("");
    } else {
      toast("error", "Failed to add part", res.error);
    }
  };

  const handleRelocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relocateProduct) return;
    setSubmitting(true);
    const res = await updatePartStorageLocationAction({
      partId: relocateProduct.id,
      warehouseZone: newZone,
      rackNumber: newRack,
      shelfNumber: newShelf,
      binNumber: newBin,
    });
    setSubmitting(false);
    if (res.success) {
      toast("success", `Physical location updated for ${relocateProduct.part_number}`);
      setShowRelocateModal(false);
    } else {
      toast("error", "Failed to relocate part", res.error);
    }
  };

  const handleApprovePR = async (requestId: string, status: "approved" | "rejected") => {
    setSubmitting(true);
    const res = await approveOrRejectPurchaseRequestAction({
      requestId,
      status,
      managerRemarks: `Request ${status} by Manager`,
    });
    setSubmitting(false);
    if (res.success) {
      toast("success", `Purchase Request ${status}`);
    } else {
      toast("error", `Failed to update PR`, res.error);
    }
  };

  const handleConvertPRtoPO = async (pr: PurchaseRequest) => {
    setSubmitting(true);
    const res = await createPurchaseOrderAction({
      requestId: pr.id,
      vendorName: "JAY BAJRANG EARTHMOVERS",
      vendorGstin: "24BWKPG2421C1Z6",
      branchId: pr.branch_id,
      items:
        pr.items?.map((i) => ({
          productId: i.product_id,
          partNumber: i.product?.part_number || "PART-001",
          description: i.product?.name || "Spare Part",
          quantity: i.approved_quantity || i.requested_quantity,
          unit: "Pcs",
          unitPrice: i.estimated_unit_cost || i.product?.unit_cost || 1000,
          discountPercent: 0,
          gstPercent: 18,
        })) || [],
    });
    setSubmitting(false);
    if (res.success) {
      toast("success", `Purchase Order ${res.data.po_number} generated!`);
      setPrintDocument({ type: "PO", data: res.data });
    } else {
      toast("error", "Failed to create PO", res.error);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalIssue) return;
    setSubmitting(true);

    const firstItem = returnModalIssue.items?.[0];
    if (!firstItem) return;

    const res = await recordPartReturnAction({
      issueId: returnModalIssue.id,
      returnedByName,
      items: [
        {
          productId: firstItem.product_id,
          quantityReturned: returnQty,
          condition: returnCondition,
        },
      ],
    });
    setSubmitting(false);
    if (res.success) {
      toast("success", `Part return recorded & stock restored!`);
      setReturnModalIssue(null);
    } else {
      toast("error", "Failed to process return", res.error);
    }
  };

  const handlePrintTrigger = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Clean 1-Line Page Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-mute)] shrink-0">
              <span>Inventory</span>
              <ChevronRight className="h-3 w-3 text-[var(--color-mute)]" />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-[var(--color-ink)] tracking-tight truncate">
              {currentTabConfig.label}
            </h1>
          </div>
        </div>

        {/* Action Buttons Hierarchy */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <Button
            onClick={() => setShowAddPartModal(true)}
            variant="primary"
            className="text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs px-3 py-1.5 h-8"
          >
            <AnimatedPlus size={14} className="mr-1" /> Add Part
          </Button>

          <Button
            onClick={() => setShowGRNModal(true)}
            variant="secondary"
            className="text-xs font-semibold px-3 py-1.5 h-8"
          >
            <Truck className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> Receive GRN
          </Button>

          <Button
            onClick={() => setShowPartIssueModal(true)}
            variant="secondary"
            className="text-xs font-semibold px-3 py-1.5 h-8"
          >
            <AnimatedWrench size={14} className="mr-1.5 text-sky-500" /> Issue Part
          </Button>

          <Button
            onClick={() => {
              setPRDefaultProductId(undefined);
              setShowPRModal(true);
            }}
            variant="secondary"
            className="text-xs font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] px-3 py-1.5 h-8"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" /> Request Order
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STORE MANAGER DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Prominent Operational Alerts */}
          {(outOfStockCount > 0 || lowStockCount > 0 || pendingPRs.length > 0 || overdueReturnableIssues.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {outOfStockCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-rose-700 dark:text-rose-300">
                        {outOfStockCount} OUT OF STOCK PARTS
                      </div>
                      <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-medium">
                        Requires immediate purchase order request
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost-sm"
                    onClick={() => handleTabChange("master")}
                    className="text-xs font-bold text-rose-700 hover:bg-rose-500/20"
                  >
                    View
                  </Button>
                </div>
              )}

              {lowStockCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AnimatedClock size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-amber-700 dark:text-amber-300">
                        {lowStockCount} LOW STOCK ALERTS
                      </div>
                      <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-medium">
                        Below minimum reorder threshold
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost-sm"
                    onClick={() => handleTabChange("master")}
                    className="text-xs font-bold text-amber-700 hover:bg-amber-500/20"
                  >
                    Order
                  </Button>
                </div>
              )}

              {pendingPRs.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-sky-700 dark:text-sky-300">
                        {pendingPRs.length} PENDING APPROVALS
                      </div>
                      <div className="text-[11px] text-sky-600/80 dark:text-sky-400/80 font-medium">
                        Purchase requests awaiting manager action
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost-sm"
                    onClick={() => handleTabChange("procurement")}
                    className="text-xs font-bold text-sky-700 hover:bg-sky-500/20"
                  >
                    Review
                  </Button>
                </div>
              )}

              {overdueReturnableIssues.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <RotateCcw className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-purple-700 dark:text-purple-300">
                        {overdueReturnableIssues.length} OVERDUE RETURNABLES
                      </div>
                      <div className="text-[11px] text-purple-600/80 dark:text-purple-400/80 font-medium">
                        Issued tools & parts pending return
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost-sm"
                    onClick={() => handleTabChange("returns")}
                    className="text-xs font-bold text-purple-700 hover:bg-purple-500/20"
                  >
                    Track
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Key KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">Total Parts Master</span>
              <div className="text-xl font-black text-[var(--color-ink)]">{totalParts} SKUs</div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">Total Stock Quantity</span>
              <div className="text-xl font-black text-sky-600 dark:text-sky-400">{totalStockQty} Pcs</div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">Total Inventory Value</span>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{Number(totalStockValue).toLocaleString("en-IN")}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">In Stock SKUs</span>
              <div className="text-xl font-black text-emerald-600">{inStockCount} Parts</div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">Low / Out Stock</span>
              <div className="text-xl font-black text-rose-600">
                {lowStockCount + outOfStockCount} Parts
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">Incoming Receipts</span>
              <div className="text-xl font-black text-purple-600 dark:text-purple-400">{goodsReceipts.length} GRNs</div>
            </div>
          </div>

          {/* Quick Summary Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock & Out of Stock Priority Table */}
            <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-500" /> Reorder Priority List
                </h3>
                <Button variant="ghost-sm" onClick={() => handleTabChange("master")} className="text-xs font-bold">
                  View All Part Master
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--color-hairline)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] font-extrabold uppercase text-[10px] border-b">
                    <tr>
                      <th className="p-2.5">Part No</th>
                      <th className="p-2.5">Part Name</th>
                      <th className="p-2.5 text-center">Stock</th>
                      <th className="p-2.5 text-center">Location</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)] text-[11px] font-medium">
                    {products
                      .filter((p) => {
                        const stockQty = stocks
                          .filter((s) => s.product_id === p.id)
                          .reduce((a, b) => a + (b.quantity || 0), 0);
                        return stockQty <= (p.min_stock_level || 5);
                      })
                      .slice(0, 5)
                      .map((prod) => {
                        const qty = stocks
                          .filter((s) => s.product_id === prod.id)
                          .reduce((a, b) => a + (b.quantity || 0), 0);

                        return (
                          <tr key={prod.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                            <td className="p-2.5 font-mono font-bold text-sky-600 dark:text-sky-400">
                              {prod.part_number}
                            </td>
                            <td className="p-2.5 font-bold text-[var(--color-ink)]">{prod.name}</td>
                            <td className="p-2.5 text-center">
                              <Badge variant={qty === 0 ? "error" : "warning"}>
                                {qty} {prod.unit}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-center font-mono text-[10px] text-[var(--color-mute)]">
                              {prod.rack_number || "R-01"} / {prod.bin_number || "B-01"}
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => {
                                  setPRDefaultProductId(prod.id);
                                  setShowPRModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold hover:bg-sky-700 cursor-pointer"
                              >
                                Request Order
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending Purchase Requests & Approvals */}
            <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-sky-500" /> Pending Purchase Requests ({pendingPRs.length})
                </h3>
                <Button variant="ghost-sm" onClick={() => handleTabChange("procurement")} className="text-xs font-bold">
                  View Procurement Hub
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--color-hairline)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] font-extrabold uppercase text-[10px] border-b">
                    <tr>
                      <th className="p-2.5">PR No</th>
                      <th className="p-2.5">Requested By</th>
                      <th className="p-2.5">Sent To</th>
                      <th className="p-2.5 text-center">Priority</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)] text-[11px] font-medium">
                    {purchaseRequests.slice(0, 5).map((pr) => (
                      <tr key={pr.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                        <td className="p-2.5 font-mono font-bold text-sky-600 dark:text-sky-400">{pr.request_no}</td>
                        <td className="p-2.5 text-[var(--color-ink)] font-bold">{pr.requester?.full_name || "Store Mgr"}</td>
                        <td className="p-2.5 text-[var(--color-mute)]">{pr.target_manager?.full_name || "Manager"}</td>
                        <td className="p-2.5 text-center">
                          <span className="uppercase text-[10px] font-extrabold text-amber-600">{pr.priority}</span>
                        </td>
                        <td className="p-2.5 text-right">
                          <Badge variant={pr.status === "approved" ? "success" : pr.status === "rejected" ? "error" : "warning"}>
                            {pr.status.replace("_", " ")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PART MASTER CATALOG */}
      {/* ========================================================================= */}
      {activeTab === "master" && (
        <div className="space-y-3.5">
          {/* Compact Inventory Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => { setFilterStockStatus("all"); setCurrentPage(1); }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStockStatus === "all"
                  ? "border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/30"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              <div className="text-[10px] font-semibold text-[var(--color-mute)]">Total Parts</div>
              <div className="text-base font-bold text-[var(--color-ink)] flex items-center justify-between mt-0.5">
                <span>{totalParts}</span>
                <span className="text-[10px] font-medium text-[var(--color-mute)]">SKUs</span>
              </div>
            </button>

            <button
              onClick={() => { setFilterStockStatus("in_stock"); setCurrentPage(1); }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStockStatus === "in_stock"
                  ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              <div className="text-[10px] font-semibold text-[var(--color-mute)]">In Stock</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between mt-0.5">
                <span>{inStockCount}</span>
                <span className="text-[10px] font-medium text-emerald-600/80">🟢 Healthy</span>
              </div>
            </button>

            <button
              onClick={() => { setFilterStockStatus("low_stock"); setCurrentPage(1); }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStockStatus === "low_stock"
                  ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              <div className="text-[10px] font-semibold text-[var(--color-mute)]">Low Stock</div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between mt-0.5">
                <span>{lowStockCount}</span>
                <span className="text-[10px] font-medium text-amber-600/80">🟡 Reorder</span>
              </div>
            </button>

            <button
              onClick={() => { setFilterStockStatus("out_of_stock"); setCurrentPage(1); }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStockStatus === "out_of_stock"
                  ? "border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/30"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              <div className="text-[10px] font-semibold text-[var(--color-mute)]">Out of Stock</div>
              <div className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between mt-0.5">
                <span>{outOfStockCount}</span>
                <span className="text-[10px] font-medium text-rose-600/80">🔴 Urgent</span>
              </div>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-mute)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search part no, name, OEM, rack, bin..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="Filters">Filters</option>
                <option value="Seals">Seals</option>
                <option value="Electrical">Electrical</option>
                <option value="Hydraulic">Hydraulic</option>
                <option value="Bearings">Bearings</option>
              </select>

              <select
                value={filterManufacturer}
                onChange={(e) => {
                  setFilterManufacturer(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] cursor-pointer"
              >
                <option value="all">All Manufacturers</option>
                <option value="JCB">JCB</option>
                <option value="Hyundai">Hyundai</option>
                <option value="Caterpillar">Caterpillar</option>
                <option value="Volvo">Volvo</option>
                <option value="Komatsu">Komatsu</option>
                <option value="Genie">Genie</option>
                <option value="JLG">JLG</option>
                <option value="Haulotte">Haulotte</option>
                <option value="Mahindra">Mahindra</option>
                <option value="Tata">Tata</option>
              </select>

              <select
                value={filterRack}
                onChange={(e) => {
                  setFilterRack(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] cursor-pointer"
              >
                <option value="all">All Racks</option>
                <option value="R-01">Rack R-01</option>
                <option value="R-02">Rack R-02</option>
                <option value="R-03">Rack R-03</option>
                <option value="R-04">Rack R-04</option>
              </select>

              <select
                value={filterStockStatus}
                onChange={(e) => {
                  setFilterStockStatus(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] cursor-pointer"
              >
                <option value="all">All Stock</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>

              {(filterCategory !== "all" || filterManufacturer !== "all" || filterRack !== "all" || filterStockStatus !== "all" || searchQuery) && (
                <button
                  onClick={handleClearFilters}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--color-hairline)] text-[var(--color-ink)] text-xs font-semibold hover:bg-[var(--color-hairline-soft-surface)] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {selectedPartIds.length > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-900 dark:text-sky-100">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckSquare className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span>{selectedPartIds.length} parts selected</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const firstProd = products.find((p) => selectedPartIds.includes(p.id));
                    if (firstProd) {
                      setRelocateProduct(firstProd);
                      setShowRelocateModal(true);
                    }
                  }}
                  className="text-xs font-semibold"
                >
                  Relocate Location
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => {
                    setPRDefaultProductId(selectedPartIds[0]);
                    setShowPRModal(true);
                  }}
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400"
                >
                  Request Order
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleBulkExportCSV}
                  className="text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                </Button>

                <button
                  onClick={() => setSelectedPartIds([])}
                  className="text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] px-2 py-1 cursor-pointer"
                >
                  Deselect
                </button>
              </div>
            </div>
          )}

          {/* Part Master Table */}
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] border-b border-[var(--color-hairline)] font-semibold text-[11px]">
                <tr>
                  <th className="px-3 py-2.5 text-center w-8">
                    <button
                      onClick={toggleSelectAll}
                      className="text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
                    >
                      {selectedPartIds.length === paginatedProducts.length && paginatedProducts.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th
                    onClick={() => handleSort("part_number")}
                    className="px-3 py-2.5 cursor-pointer hover:text-[var(--color-ink)] select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Part Number</span>
                      {sortColumn === "part_number" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sky-500" /> : <ArrowDown className="h-3 w-3 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("name")}
                    className="px-3 py-2.5 cursor-pointer hover:text-[var(--color-ink)] select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Part Name</span>
                      {sortColumn === "name" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sky-500" /> : <ArrowDown className="h-3 w-3 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2.5">Category</th>
                  <th
                    onClick={() => handleSort("manufacturer")}
                    className="px-3 py-2.5 cursor-pointer hover:text-[var(--color-ink)] select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Manufacturer</span>
                      {sortColumn === "manufacturer" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sky-500" /> : <ArrowDown className="h-3 w-3 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2.5">Location</th>
                  <th
                    onClick={() => handleSort("stock")}
                    className="px-3 py-2.5 text-center cursor-pointer hover:text-[var(--color-ink)] select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Available Stock</span>
                      {sortColumn === "stock" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sky-500" /> : <ArrowDown className="h-3 w-3 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("unit_cost")}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-[var(--color-ink)] select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Unit Cost</span>
                      {sortColumn === "unit_cost" ? (
                        sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sky-500" /> : <ArrowDown className="h-3 w-3 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center space-y-3">
                      <Package className="h-9 w-9 text-[var(--color-mute)] mx-auto opacity-40" />
                      <div className="text-sm font-bold text-[var(--color-ink)]">No parts found</div>
                      <p className="text-xs text-[var(--color-mute)] max-w-xs mx-auto">
                        No items match your search or current filter selections.
                      </p>
                      <Button
                        variant="secondary"
                        onClick={handleClearFilters}
                        className="text-xs font-semibold mt-1"
                      >
                        Clear Filters
                      </Button>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((prod) => {
                    const prodStocks = stocks.filter((s) => s.product_id === prod.id);
                    const qty = prodStocks.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
                    const minLevel = prod.min_stock_level || 5;
                    const isSelected = selectedPartIds.includes(prod.id);

                    return (
                      <tr
                        key={prod.id}
                        onClick={() => {
                          setSelectedDetailProduct(prod);
                          setShowPartDetailModal(true);
                        }}
                        className={`hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer ${
                          isSelected ? "bg-sky-500/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSelectPart(prod.id)}
                            className="text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-sky-600 dark:text-sky-400">
                          {prod.part_number}
                        </td>
                        <td className="px-3 py-2.5 font-bold">{prod.name}</td>
                        <td className="px-3 py-2.5 text-[var(--color-mute)] text-[11px]">{prod.category || "General"}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border uppercase tracking-wider ${
                            prod.manufacturer === "JCB"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : prod.manufacturer === "Hyundai"
                              ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                              : prod.manufacturer === "Caterpillar"
                              ? "bg-yellow-500/10 text-yellow-800 dark:text-yellow-300 border-yellow-500/30"
                              : prod.manufacturer === "Volvo"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                              : prod.manufacturer === "Komatsu"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              : "bg-[var(--color-canvas)] text-[var(--color-ink)] border-[var(--color-hairline)]"
                          }`}>
                            {prod.manufacturer || "OEM Generic"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] border border-[var(--color-hairline)] font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400">
                            {prod.rack_number || "R-01"} / {prod.bin_number || "B-01"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono">
                          <span
                            className={`font-bold ${
                              qty === 0
                                ? "text-rose-600 dark:text-rose-400 font-black"
                                : qty <= minLevel
                                ? "text-amber-600 dark:text-amber-400 font-extrabold"
                                : "text-[var(--color-ink)]"
                            }`}
                          >
                            {qty} pcs
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          ₹{Number(prod.unit_cost || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {qty === 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                              Out of Stock
                            </span>
                          ) : qty <= minLevel ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <TooltipWrapper content="View Part Details & History" side="top">
                              <button
                                onClick={() => {
                                  setSelectedDetailProduct(prod);
                                  setShowPartDetailModal(true);
                                }}
                                aria-label="View Part Details & History"
                                className="p-1 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </TooltipWrapper>

                            <TooltipWrapper content="Relocate Storage Location" side="top">
                              <button
                                onClick={() => {
                                  setRelocateProduct(prod);
                                  setNewRack(prod.rack_number || "R-01");
                                  setNewBin(prod.bin_number || "B-01");
                                  setShowRelocateModal(true);
                                }}
                                aria-label="Relocate Storage Location"
                                className="p-1 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] cursor-pointer"
                              >
                                <MapPin className="h-3.5 w-3.5 text-purple-500" />
                              </button>
                            </TooltipWrapper>

                            <TooltipWrapper content="Create purchase request for this part" side="top">
                              <button
                                onClick={() => {
                                  setPRDefaultProductId(prod.id);
                                  setShowPRModal(true);
                                }}
                                className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-bold hover:bg-sky-700 cursor-pointer"
                              >
                                Order
                              </button>
                            </TooltipWrapper>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination & Footer */}
            {filteredProducts.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-mute)]">
                <div>
                  Showing <span className="font-bold text-[var(--color-ink)]">{startIndex + 1}</span>–
                  <span className="font-bold text-[var(--color-ink)]">
                    {Math.min(startIndex + pageSize, filteredProducts.length)}
                  </span>{" "}
                  of <span className="font-bold text-[var(--color-ink)]">{filteredProducts.length}</span> parts
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-semibold text-[var(--color-ink)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 text-[var(--color-ink)]" />
                      <span>Prev</span>
                    </button>

                    <span className="px-2.5 py-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-bold text-[var(--color-ink)] text-xs">
                      {safePage} / {totalPages}
                    </span>

                    <button
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all text-xs"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--color-ink)]" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RACK & BIN STORAGE LOCATION MANAGER */}
      {/* ========================================================================= */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
            <h2 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-purple-500" /> Physical Warehouse Storage Map
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Parts physical location mapping across Zone, Rack, Shelf, and Bin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["R-01", "R-02", "R-03"].map((rack) => {
              const rackProducts = products.filter((p) => p.rack_number === rack);

              return (
                <div key={rack} className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2">
                    <h3 className="text-xs font-black uppercase text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" /> Rack {rack}
                    </h3>
                    <Badge variant="info">{rackProducts.length} Stored Items</Badge>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {rackProducts.map((p) => (
                      <div key={p.id} className="p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[var(--color-ink)]">{p.name}</div>
                          <div className="font-mono text-[10px] text-[var(--color-mute)]">PN: {p.part_number}</div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 font-mono text-[10px] font-bold block">
                            Bin: {p.bin_number || "B-01"}
                          </span>
                          <span className="text-[10px] text-[var(--color-mute)] mt-0.5 block">
                            Shelf: {p.shelf_number || "S-01"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PROCUREMENT & PURCHASE ORDERS */}
      {/* ========================================================================= */}
      {activeTab === "procurement" && (
        <div className="space-y-6">
          {/* Purchase Requests Section */}
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-sky-500" /> Purchase Requests ({purchaseRequests.length})
                </h3>
                <p className="text-xs text-[var(--color-mute)]">
                  Store Manager order requests sent to specific selected managers for approval.
                </p>
              </div>

              <Button onClick={() => setShowPRModal(true)} variant="primary" className="text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white">
                <Send className="h-3.5 w-3.5 mr-1.5" /> + New Purchase Request
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--color-hairline)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold text-[10px] border-b">
                  <tr>
                    <th className="p-3">PR Number</th>
                    <th className="p-3">Requested By (Store)</th>
                    <th className="p-3">Sent To (Manager)</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3 text-center">Priority</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                  {purchaseRequests.map((pr) => (
                    <tr key={pr.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400">{pr.request_no}</td>
                      <td className="p-3 font-bold">{pr.requester?.full_name || "Store Manager"}</td>
                      <td className="p-3 text-purple-600 dark:text-purple-400 font-bold">
                        {pr.target_manager?.full_name || "Assigned Manager"}
                      </td>
                      <td className="p-3 max-w-xs truncate text-[var(--color-mute)]">{pr.reason}</td>
                      <td className="p-3 text-center">
                        <span className="uppercase text-[10px] font-black text-amber-600">{pr.priority}</span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={pr.status === "approved" || pr.status === "converted_to_po" ? "success" : pr.status === "rejected" ? "error" : "warning"}>
                          {pr.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {pr.status === "pending_approval" && (
                            <>
                              <button
                                onClick={() => handleApprovePR(pr.id, "approved")}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[10px]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApprovePR(pr.id, "rejected")}
                                className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {pr.status === "approved" && (
                            <button
                              onClick={() => handleConvertPRtoPO(pr)}
                              className="px-2.5 py-1 rounded bg-sky-600 text-white font-bold text-[10px]"
                            >
                              Generate PO
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generated Purchase Orders Section */}
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-500" /> Purchase Orders ({purchaseOrders.length})
            </h3>

            <div className="overflow-hidden rounded-xl border border-[var(--color-hairline)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold text-[10px] border-b">
                  <tr>
                    <th className="p-3">PO Number</th>
                    <th className="p-3">Supplier Vendor</th>
                    <th className="p-3 text-right">Total Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Document Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="p-3 font-mono font-bold text-purple-600 dark:text-purple-400">{po.po_number}</td>
                      <td className="p-3 font-bold">{po.vendor_name}</td>
                      <td className="p-3 text-right font-mono font-bold">₹{Number(po.amount).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-center">
                        <Badge variant={po.status === "received" ? "success" : "info"}>{po.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setPrintDocument({ type: "PO", data: po })}
                          className="px-2.5 py-1 rounded bg-[var(--color-canvas)] border border-[var(--color-hairline)] font-bold text-[10px] flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <AnimatedPrinter size={14} /> Printable PO PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: GOODS RECEIPTS / GRN */}
      {/* ========================================================================= */}
      {activeTab === "grn" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
            <div>
              <h2 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-500" /> Incoming Goods Receipts (GRN) ({goodsReceipts.length})
              </h2>
              <p className="text-xs text-[var(--color-mute)]">
                Recorded incoming shipments with linked supplier invoices and bill PDFs.
              </p>
            </div>

            <Button onClick={() => setShowGRNModal(true)} variant="primary" className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              <AnimatedPlus size={16} className="mr-1" /> + Receive Goods (GRN)
            </Button>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold text-[10px] border-b">
                <tr>
                  <th className="p-3">GRN No</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Bill Number</th>
                  <th className="p-3">Bill Date</th>
                  <th className="p-3">Received By</th>
                  <th className="p-3 text-right">Bill PDF Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                {goodsReceipts.map((grn) => (
                  <tr key={grn.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                    <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{grn.grn_number}</td>
                    <td className="p-3 font-bold">{grn.supplier_name}</td>
                    <td className="p-3 font-mono">{grn.bill_number}</td>
                    <td className="p-3 font-mono">{grn.bill_date}</td>
                    <td className="p-3">{grn.receiver?.full_name || "Store Officer"}</td>
                    <td className="p-3 text-right">
                      {grn.bill_document_url ? (
                        <a
                          href={grn.bill_document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" /> View Bill PDF
                        </a>
                      ) : (
                        <span className="text-[var(--color-mute)] text-[10px]">No File</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PART ISSUANCE & CHALLANS */}
      {/* ========================================================================= */}
      {activeTab === "issues" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold text-[10px] border-b">
                <tr>
                  <th className="p-3">Challan No</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Issued To</th>
                  <th className="p-3">Machine</th>
                  <th className="p-3 text-center">Returnable</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Print Challan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                {partIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                    <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400">{issue.challan_number}</td>
                    <td className="p-3 font-mono">{issue.issue_date}</td>
                    <td className="p-3 font-bold">{issue.issued_to_name}</td>
                    <td className="p-3 font-mono text-[var(--color-mute)]">{issue.machine?.machine_code || "M-STORE"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${issue.is_returnable ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600"}`}>
                        {issue.is_returnable ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={issue.status === "fully_returned" ? "success" : "info"}>{issue.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPrintDocument({ type: "PIC", data: issue })}
                          className="px-2.5 py-1 rounded bg-[var(--color-canvas)] border font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <AnimatedPrinter size={14} /> Parts Issue Challan
                        </button>
                        <button
                          onClick={() => setPrintDocument({ type: "DC", data: { challan_number: `RI/DC/${issue.challan_number}`, client_name: issue.issued_to_name, issue_date: issue.issue_date, items: issue.items } })}
                          className="px-2.5 py-1 rounded bg-sky-600 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          Delivery Challan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: RETURNABLE PARTS TRACKER */}
      {/* ========================================================================= */}
      {activeTab === "returns" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold text-[10px] border-b">
                <tr>
                  <th className="p-3">Challan No</th>
                  <th className="p-3">Issued To</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Expected Return Date</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Process Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                {partIssues
                  .filter((i) => i.is_returnable)
                  .map((issue) => (
                    <tr key={issue.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400">{issue.challan_number}</td>
                      <td className="p-3 font-bold">{issue.issued_to_name}</td>
                      <td className="p-3 font-mono">{issue.issue_date}</td>
                      <td className="p-3 font-mono font-bold text-rose-600">{issue.expected_return_date || "Overdue"}</td>
                      <td className="p-3 text-center">
                        <Badge variant={issue.status === "fully_returned" ? "success" : "warning"}>{issue.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {issue.status !== "fully_returned" && (
                          <button
                            onClick={() => {
                              setReturnModalIssue(issue);
                              setReturnedByName(issue.issued_to_name);
                            }}
                            className="px-2.5 py-1 rounded bg-purple-600 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Return Part
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: STOCK LEDGER & COMPLETE AUDIT HISTORY */}
      {/* ========================================================================= */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold text-[10px] border-b">
                <tr>
                  <th className="p-3">Txn No</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Part Name</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3">Performed By</th>
                  <th className="p-3">Remarks / Document Reference</th>
                  <th className="p-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                    <td className="p-3 font-mono font-bold">{t.transaction_no}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          ["STOCK_IN", "PURCHASE", "PURCHASE_RECEIPT", "PART_RETURN", "RETURN"].includes(t.type)
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold">{t.product?.name || "Spare Part"}</td>
                    <td className="p-3 text-[var(--color-mute)]">{t.branch?.name || "Delhi HQ"}</td>
                    <td className="p-3 text-center font-mono font-bold text-sm">
                      {["STOCK_IN", "PURCHASE", "PURCHASE_RECEIPT", "PART_RETURN", "RETURN"].includes(t.type) ? "+" : "-"}
                      {t.quantity}
                    </td>
                    <td className="p-3 text-[var(--color-ink)] font-bold">{t.user?.full_name || "System"}</td>
                    <td className="p-3 text-[var(--color-mute)]">{t.remarks || t.reference_id || "-"}</td>
                    <td className="p-3 text-right font-mono text-[10px]">
                      {new Date(t.created_at).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 9: INTER-BRANCH STOCK TRANSFERS */}
      {/* ========================================================================= */}
      {activeTab === "transfers" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold text-[10px] border-b">
                <tr>
                  <th className="p-3">Transfer No</th>
                  <th className="p-3">From Branch</th>
                  <th className="p-3">To Branch</th>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                {transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                    <td className="p-3 font-mono font-bold text-purple-600 dark:text-purple-400">{tr.transfer_no}</td>
                    <td className="p-3">{tr.from_branch?.name}</td>
                    <td className="p-3 font-bold">{tr.to_branch?.name}</td>
                    <td className="p-3 font-bold">{tr.product?.name}</td>
                    <td className="p-3 text-center font-mono font-bold">{tr.quantity} Pcs</td>
                    <td className="p-3 text-center">
                      <Badge variant={tr.status === "accepted" ? "success" : "warning"}>{tr.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {tr.status === "pending" && (
                        <button
                          onClick={async () => {
                            const res = await acceptStockTransferAction(tr.id);
                            if (res.success) toast("success", "Transfer accepted & stock updated!");
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                        >
                          Accept Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Part Detail Modal */}
      {showPartDetailModal && (
        <PartDetailModal
          open={showPartDetailModal}
          onClose={() => setShowPartDetailModal(false)}
          product={selectedDetailProduct}
          stocks={stocks}
          transactions={transactions}
          issues={partIssues}
        />
      )}

      {/* Purchase Request Modal */}
      {showPRModal && (
        <PurchaseRequestModal
          open={showPRModal}
          onClose={() => setShowPRModal(false)}
          products={products}
          stocks={stocks}
          branches={branches}
          managers={managers}
          defaultProductId={prDefaultProductId}
        />
      )}

      {/* Goods Receipt Modal */}
      {showGRNModal && (
        <GoodsReceiptModal
          open={showGRNModal}
          onClose={() => setShowGRNModal(false)}
          products={products}
          stocks={stocks}
          branches={branches}
          purchaseOrders={purchaseOrders}
        />
      )}

      {/* Part Issue Modal */}
      {showPartIssueModal && (
        <PartIssueModal
          open={showPartIssueModal}
          onClose={() => setShowPartIssueModal(false)}
          products={products}
          stocks={stocks}
          branches={branches}
          machines={machines}
        />
      )}

      {/* Add New Part Master Modal */}
      {showAddPartModal && (
        <Modal open={showAddPartModal} onClose={() => setShowAddPartModal(false)} title="Create New Part Master SKU" size="md">
          <form onSubmit={handleAddPartSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Part Number (SKU) *</label>
                <Input value={partNo} onChange={(e) => setPartNo(e.target.value)} placeholder="HYD-FLT-102" required />
              </div>
              <div>
                <label className="block font-bold mb-1">Part Name *</label>
                <Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Hydraulic Filter" required />
              </div>
              <div>
                <label className="block font-bold mb-1">Category</label>
                <select value={partCat} onChange={(e) => setPartCat(e.target.value)} className="w-full p-2 border rounded-xl bg-[var(--color-canvas)]">
                  <option value="Filters">Filters</option>
                  <option value="Seals">Seals</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Hydraulic">Hydraulic</option>
                  <option value="Bearings">Bearings</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Manufacturer</label>
                <select value={partManufacturer} onChange={(e) => setPartManufacturer(e.target.value)} className="w-full p-2 border rounded-xl bg-[var(--color-canvas)] font-medium">
                  <option value="JCB">JCB</option>
                  <option value="Hyundai">Hyundai</option>
                  <option value="Caterpillar">Caterpillar</option>
                  <option value="Volvo">Volvo</option>
                  <option value="Komatsu">Komatsu</option>
                  <option value="Genie">Genie</option>
                  <option value="JLG">JLG</option>
                  <option value="Haulotte">Haulotte</option>
                  <option value="Mahindra">Mahindra</option>
                  <option value="Tata">Tata</option>
                  <option value="Other">Other / OEM</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Unit Cost (₹)</label>
                <Input type="number" value={unitCost} onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)} required />
              </div>
              <div>
                <label className="block font-bold mb-1">Rack Number</label>
                <Input value={rackNo} onChange={(e) => setRackNo(e.target.value)} placeholder="R-01" required />
              </div>
              <div>
                <label className="block font-bold mb-1">Bin Number</label>
                <Input value={binNo} onChange={(e) => setBinNo(e.target.value)} placeholder="B-01" required />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowAddPartModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={submitting} className="bg-sky-600 text-white font-bold">Create SKU</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Relocate Rack/Bin Modal */}
      {showRelocateModal && relocateProduct && (
        <Modal open={showRelocateModal} onClose={() => setShowRelocateModal(false)} title={`Relocate Storage — ${relocateProduct.part_number}`} size="sm">
          <form onSubmit={handleRelocateSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Rack Number</label>
                <Input value={newRack} onChange={(e) => setNewRack(e.target.value)} required />
              </div>
              <div>
                <label className="block font-bold mb-1">Bin Number</label>
                <Input value={newBin} onChange={(e) => setNewBin(e.target.value)} required />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowRelocateModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={submitting} className="bg-purple-600 text-white font-bold">Update Location</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Process Return Part Modal */}
      {returnModalIssue && (
        <Modal open={!!returnModalIssue} onClose={() => setReturnModalIssue(null)} title={`Process Part Return — Challan #${returnModalIssue.challan_number}`} size="md">
          <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold mb-1">Returned By (Name)</label>
              <Input value={returnedByName} onChange={(e) => setReturnedByName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Returned Quantity</label>
                <Input type="number" min={1} value={returnQty} onChange={(e) => setReturnQty(parseInt(e.target.value, 10) || 1)} required />
              </div>
              <div>
                <label className="block font-bold mb-1">Item Condition</label>
                <select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value as any)} className="w-full p-2 border rounded-xl bg-[var(--color-canvas)]">
                  <option value="good">Good (Restore Available Stock)</option>
                  <option value="damaged">Damaged (Mark Damaged)</option>
                  <option value="scrap">Scrap (Mark Scrap)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setReturnModalIssue(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={submitting} className="bg-purple-600 text-white font-bold">Process Return</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Printable Document Modal Preview */}
      {printDocument && (
        <Modal open={!!printDocument} onClose={() => setPrintDocument(null)} title={`Document Preview — ${printDocument.type}`} size="xl">
          <div className="space-y-4">
            <div className="flex justify-end gap-2 no-print">
              <Button variant="secondary" onClick={handlePrintTrigger}>
                <AnimatedPrinter size={16} className="mr-1.5" /> Print / Save PDF
              </Button>
              <Button variant="secondary" onClick={() => setPrintDocument(null)}>Close</Button>
            </div>

            {printDocument.type === "PO" && <PrintablePurchaseOrder po={printDocument.data} />}
            {printDocument.type === "DC" && <PrintableDeliveryChallan challan={printDocument.data} />}
            {printDocument.type === "PIC" && <PrintablePartsIssueChallan issue={printDocument.data} />}
          </div>
        </Modal>
      )}
    </div>
  );
}
