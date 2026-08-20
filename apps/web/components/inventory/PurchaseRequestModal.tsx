"use client";

import { useState, useTransition } from "react";
import { Modal, Button, Input, Textarea, Select, Badge, useToast } from "@/components/ui";
import { createPurchaseRequestAction } from "@/app/actions/inventory";
import type { InventoryProduct, InventoryStock, Branch, User } from "@/lib/types/database";
import { AnimatedPlus, AnimatedTrash } from "@/components/ui/animated-icons";
import { Send, UserCheck, AlertTriangle } from "lucide-react";

interface PurchaseRequestModalProps {
  open: boolean;
  onClose: () => void;
  products: InventoryProduct[];
  stocks: InventoryStock[];
  branches: Branch[];
  managers: Pick<User, "id" | "full_name" | "email" | "role">[];
  defaultProductId?: string;
  onSuccess?: () => void;
}

export function PurchaseRequestModal({
  open,
  onClose,
  products,
  stocks,
  branches,
  managers,
  defaultProductId,
  onSuccess,
}: PurchaseRequestModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState<string>(branches[0]?.id || "");
  const [sentToManagerId, setSentToManagerId] = useState<string>(managers[0]?.id || "");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [reason, setReason] = useState<string>("Stock level reached reorder threshold");

  // Selected Items State
  const initialProduct = products.find((p) => p.id === defaultProductId) || products[0];
  const [requestItems, setRequestItems] = useState<
    Array<{ productId: string; requestedQty: number; remarks: string }>
  >([
    {
      productId: initialProduct?.id || "",
      requestedQty: initialProduct?.reorder_quantity || 10,
      remarks: "Low stock reorder",
    },
  ]);

  const handleAddItemRow = () => {
    const nextUnselected = products.find(
      (p) => !requestItems.some((item) => item.productId === p.id)
    );
    if (!nextUnselected) {
      toast("info", "All available products are already added");
      return;
    }
    setRequestItems((prev) => [
      ...prev,
      { productId: nextUnselected.id, requestedQty: nextUnselected.reorder_quantity || 10, remarks: "" },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setRequestItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentToManagerId) {
      toast("error", "Please select a specific manager to send this purchase request to");
      return;
    }
    if (!reason.trim()) {
      toast("error", "Please enter a clear reason for this purchase request");
      return;
    }
    if (requestItems.length === 0) {
      toast("error", "Add at least one part item to the request");
      return;
    }

    startTransition(async () => {
      const payloadItems = requestItems.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const prodStock = stocks.find((s) => s.product_id === item.productId && s.branch_id === branchId);
        return {
          productId: item.productId,
          currentStock: prodStock?.quantity || 0,
          minStock: prod?.min_stock_level || 5,
          requestedQuantity: item.requestedQty,
          unitPrice: prod?.unit_cost || 0,
          remarks: item.remarks,
        };
      });

      const res = await createPurchaseRequestAction({
        branchId,
        sentToManagerId,
        priority,
        reason,
        items: payloadItems,
      });

      if (res.success) {
        const targetMgr = managers.find((m) => m.id === sentToManagerId);
        toast(
          "success",
          `Purchase Order Request created!`,
          `Sent directly to Manager ${targetMgr?.full_name || "Manager"}`
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast("error", "Failed to submit Purchase Request", res.error);
      }
    });
  };

  const selectedManager = managers.find((m) => m.id === sentToManagerId);

  return (
    <Modal open={open} onClose={onClose} title="Send Part Purchase Order Request to Manager" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Specific Manager Direct Routing Card */}
        <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 space-y-3">
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-extrabold text-xs uppercase tracking-wider">
            <UserCheck className="h-4 w-4" /> Direct Responsibility Routing
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Branch Scope"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              options={branches.map((b) => ({
                value: b.id,
                label: `${b.name} (${b.code})`,
              }))}
            />

            <Select
              label="Select Receiving Manager (Sent To)"
              value={sentToManagerId}
              onChange={(e) => setSentToManagerId(e.target.value)}
              required
              options={managers.map((m) => ({
                value: m.id,
                label: `${m.full_name} (${m.role.replace("_", " ").toUpperCase()})`,
              }))}
            />
          </div>

          {selectedManager && (
            <div className="text-[11px] text-[var(--color-mute)] bg-[var(--color-canvas-elevated)] p-2.5 rounded-xl border border-[var(--color-hairline)] flex items-center justify-between">
              <div>
                <strong>Sent To:</strong> {selectedManager.full_name} ({selectedManager.email})
              </div>
              <Badge variant="info">{selectedManager.role.replace("_", " ").toUpperCase()}</Badge>
            </div>
          )}
        </div>

        {/* Priority & Reason */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              options={[
                { value: "normal", label: "Normal Priority" },
                { value: "high", label: "High Priority" },
                { value: "urgent", label: "Urgent Breakdown Priority" },
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
              Reason / Justification <span className="text-rose-500">*</span>
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Stock below minimum level / Required for JCB 3DX breakdown repair"
              required
            />
          </div>
        </div>

        {/* Requested Part Line Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
              Requested Part Items
            </label>
            <Button type="button" variant="secondary" onClick={handleAddItemRow}>
              <AnimatedPlus size={14} className="mr-1" /> Add Part Item
            </Button>
          </div>

          <div className="rounded-xl border border-[var(--color-hairline)] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b">
                <tr>
                  <th className="px-3 py-2">Select Part</th>
                  <th className="px-3 py-2 w-24 text-center">Current</th>
                  <th className="px-3 py-2 w-28 text-center">Req Qty</th>
                  <th className="px-3 py-2">Remarks</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                {requestItems.map((item, idx) => {
                  const currentProd = products.find((p) => p.id === item.productId);
                  const prodStock = stocks.find(
                    (s) => s.product_id === item.productId && s.branch_id === branchId
                  );
                  const stockQty = prodStock?.quantity || 0;

                  return (
                    <tr key={idx}>
                      <td className="p-2">
                        <Select
                          value={item.productId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRequestItems((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, productId: val } : r))
                            );
                          }}
                          options={products.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.part_number})`,
                          }))}
                        />
                      </td>
                      <td className="p-2 text-center font-mono font-bold">
                        <span
                          className={
                            stockQty <= (currentProd?.min_stock_level || 5)
                              ? "text-rose-600 dark:text-rose-400 font-extrabold"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {stockQty} Pcs
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={item.requestedQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setRequestItems((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, requestedQty: val } : r))
                            );
                          }}
                          className="w-full px-2 py-1 text-center font-mono font-bold border border-[var(--color-hairline)] rounded-lg bg-[var(--color-canvas)] text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRequestItems((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, remarks: val } : r))
                            );
                          }}
                          placeholder="e.g. Critical spare"
                          className="w-full px-2 py-1 border border-[var(--color-hairline)] rounded-lg bg-[var(--color-canvas)] text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {requestItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-rose-600 hover:text-rose-800 p-1"
                          >
                            <AnimatedTrash size={16} />
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

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-hairline)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending} className="bg-sky-600 hover:bg-sky-700 text-white font-bold">
            <Send className="h-4 w-4 mr-1.5" /> Submit Request to Manager
          </Button>
        </div>
      </form>
    </Modal>
  );
}
