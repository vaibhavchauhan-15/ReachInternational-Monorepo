"use client";

import { useState, useTransition } from "react";
import { Modal, Button, Input, Textarea, Select, useToast } from "@/components/ui";
import { recordGoodsReceiptAction } from "@/app/actions/inventory";
import type { InventoryProduct, InventoryStock, Branch, PurchaseOrder } from "@/lib/types/database";
import { AnimatedPlus, AnimatedUpload, AnimatedCheckCircle } from "@/components/ui/animated-icons";
import { FileText, Truck, MapPin } from "lucide-react";

interface GoodsReceiptModalProps {
  open: boolean;
  onClose: () => void;
  products: InventoryProduct[];
  stocks: InventoryStock[];
  branches: Branch[];
  purchaseOrders?: PurchaseOrder[];
  onSuccess?: () => void;
}

export function GoodsReceiptModal({
  open,
  onClose,
  products,
  stocks,
  branches,
  purchaseOrders = [],
  onSuccess,
}: GoodsReceiptModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("JAY BAJRANG EARTHMOVERS");
  const [supplierGstin, setSupplierGstin] = useState<string>("24BWKPG2421C1Z6");
  const [billNumber, setBillNumber] = useState<string>(`INV-${Math.floor(10000 + Math.random() * 90000)}`);
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [transportDetails, setTransportDetails] = useState<string>("VRL Logistics Ltd / Courier LR #984210");
  const [billDocumentUrl, setBillDocumentUrl] = useState<string>("");
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || "");
  const [remarks, setRemarks] = useState<string>("Goods inspected and received in good condition");

  // Receipt Line Items
  const [items, setItems] = useState<
    Array<{
      productId: string;
      qtyOrdered: number;
      qtyReceived: number;
      unitPrice: number;
      taxAmount: number;
      rack: string;
      shelf: string;
      bin: string;
      batchNo: string;
    }>
  >([
    {
      productId: products[0]?.id || "",
      qtyOrdered: 10,
      qtyReceived: 10,
      unitPrice: products[0]?.unit_cost || 1250,
      taxAmount: 225,
      rack: products[0]?.rack_number || "R-01",
      shelf: products[0]?.shelf_number || "S-01",
      bin: products[0]?.bin_number || "B-01",
      batchNo: `BATCH-${new Date().getFullYear()}-01`,
    },
  ]);

  const handleAddItemRow = () => {
    const unselected = products.find((p) => !items.some((i) => i.productId === p.id)) || products[0];
    if (!unselected) return;
    setItems((prev) => [
      ...prev,
      {
        productId: unselected.id,
        qtyOrdered: 10,
        qtyReceived: 10,
        unitPrice: unselected.unit_cost || 500,
        taxAmount: 90,
        rack: unselected.rack_number || "R-01",
        shelf: unselected.shelf_number || "S-01",
        bin: unselected.bin_number || "B-01",
        batchNo: "",
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePoSelect = (poId: string) => {
    setSelectedPoId(poId);
    const selectedPO = purchaseOrders.find((p) => p.id === poId);
    if (selectedPO) {
      setSupplierName(selectedPO.vendor_name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast("error", "Supplier name is required");
      return;
    }
    if (!billNumber.trim()) {
      toast("error", "Supplier Invoice / Bill number is required");
      return;
    }
    if (items.length === 0) {
      toast("error", "Add at least one part item being received");
      return;
    }

    startTransition(async () => {
      const payloadItems = items.map((item) => ({
        productId: item.productId,
        quantityOrdered: item.qtyOrdered,
        quantityReceived: item.qtyReceived,
        unitPrice: item.unitPrice,
        taxAmount: item.taxAmount,
        rack: item.rack,
        shelf: item.shelf,
        bin: item.bin,
        batchNumber: item.batchNo,
      }));

      const res = await recordGoodsReceiptAction({
        poId: selectedPoId || undefined,
        supplierName,
        supplierGstin,
        billNumber,
        billDate,
        deliveryDate,
        transportDetails,
        billDocumentUrl: billDocumentUrl || `/documents/bills/${billNumber}.pdf`,
        branchId,
        remarks,
        items: payloadItems,
      });

      if (res.success) {
        toast("success", `Goods Receipt (${res.data.grn_number}) recorded & stock updated!`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast("error", "Failed to record Goods Receipt", res.error);
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Incoming Goods Receipt (GRN) & Stock Entry" size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
          <Select
            label="Link Purchase Order (Optional)"
            value={selectedPoId}
            onChange={(e) => handlePoSelect(e.target.value)}
            options={[
              { value: "", label: "Direct Supplier Receipt (No PO)" },
              ...(purchaseOrders || []).map((p) => ({
                value: p.id,
                label: `${p.po_number} — ${p.vendor_name} (₹${Number(p.amount).toLocaleString("en-IN")})`,
              })),
            ]}
          />

          <div>
            <label className="block text-xs font-bold mb-1 text-[var(--color-ink)]">
              Supplier / Vendor Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Jay Bajrang Earthmovers"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-[var(--color-ink)]">Supplier GSTIN</label>
            <Input
              value={supplierGstin}
              onChange={(e) => setSupplierGstin(e.target.value)}
              placeholder="e.g. 24BWKPG2421C1Z6"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-[var(--color-ink)]">
              Supplier Invoice / Bill No <span className="text-rose-500">*</span>
            </label>
            <Input
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="e.g. INV-984210"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-[var(--color-ink)]">Bill Date</label>
            <Input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              required
            />
          </div>

          <Select
            label="Receiving Branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={branches.map((b) => ({
              value: b.id,
              label: `${b.name} (${b.code})`,
            }))}
          />
        </div>

        {/* Transport & PDF Document Upload Section */}
        <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-emerald-500" /> Invoice PDF Document Upload & Courier Logistics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                Transport / Courier Details
              </label>
              <Input
                value={transportDetails}
                onChange={(e) => setTransportDetails(e.target.value)}
                placeholder="e.g. VRL Logistics LR #98421 / Driver Contact"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                Supplier Bill PDF URL / Attachment
              </label>
              <div className="flex gap-2">
                <Input
                  value={billDocumentUrl}
                  onChange={(e) => setBillDocumentUrl(e.target.value)}
                  placeholder="https://... or /documents/bills/inv-01.pdf"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const mockUrl = `/documents/bills/${billNumber}.pdf`;
                    setBillDocumentUrl(mockUrl);
                    toast("info", "Bill Document attached", mockUrl);
                  }}
                >
                  <AnimatedUpload size={14} className="mr-1" /> Attach
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Received Parts Grid & Storage Placement */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
              Incoming Parts & Storage Bin Assignment
            </label>
            <Button type="button" variant="secondary" onClick={handleAddItemRow}>
              <AnimatedPlus size={14} className="mr-1" /> Add Received Part
            </Button>
          </div>

          <div className="rounded-xl border border-[var(--color-hairline)] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b text-[10px]">
                <tr>
                  <th className="p-2">Part Item</th>
                  <th className="p-2 w-20 text-center">Ordered</th>
                  <th className="p-2 w-20 text-center">Received</th>
                  <th className="p-2 w-24 text-right">Unit Cost (₹)</th>
                  <th className="p-2 w-24 text-center">Rack</th>
                  <th className="p-2 w-24 text-center">Bin</th>
                  <th className="p-2 w-28 text-right">Total (₹)</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[11px]">
                {items.map((item, idx) => {
                  const lineTotal = item.qtyReceived * item.unitPrice + item.taxAmount;

                  return (
                    <tr key={idx}>
                      <td className="p-2">
                        <Select
                          value={item.productId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const selectedProd = products.find((p) => p.id === val);
                            setItems((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      productId: val,
                                      unitPrice: selectedProd?.unit_cost || 0,
                                      rack: selectedProd?.rack_number || "R-01",
                                      bin: selectedProd?.bin_number || "B-01",
                                    }
                                  : r
                              )
                            );
                          }}
                          options={products.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.part_number})`,
                          }))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.qtyOrdered}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, qtyOrdered: val } : r)));
                          }}
                          className="w-full p-1 text-center font-mono border rounded bg-[var(--color-canvas)]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.qtyReceived}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, qtyReceived: val } : r)));
                          }}
                          className="w-full p-1 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 border rounded bg-[var(--color-canvas)]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, unitPrice: val } : r)));
                          }}
                          className="w-full p-1 text-right font-mono border rounded bg-[var(--color-canvas)]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.rack}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, rack: val } : r)));
                          }}
                          className="w-full p-1 text-center font-bold text-sky-600 border rounded bg-[var(--color-canvas)]"
                          placeholder="R-01"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.bin}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, bin: val } : r)));
                          }}
                          className="w-full p-1 text-center font-bold text-purple-600 border rounded bg-[var(--color-canvas)]"
                          placeholder="B-01"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-[var(--color-ink)]">
                        ₹{Number(lineTotal).toLocaleString("en-IN")}
                      </td>
                      <td className="p-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-rose-600 hover:text-rose-800"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-hairline)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            <AnimatedCheckCircle size={16} className="mr-1.5" /> Confirm Receipt & Add Stock
          </Button>
        </div>
      </form>
    </Modal>
  );
}
