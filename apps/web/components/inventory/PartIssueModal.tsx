"use client";

import { useState, useTransition } from "react";
import { Modal, Button, Input, Textarea, Select, useToast, MachineSelect, SearchableSelect } from "@/components/ui";
import { createPartIssueAction } from "@/app/actions/inventory";
import type { InventoryProduct, InventoryStock, Machine } from "@/lib/types/database";
import type { Branch } from "@/lib/queries/branches";
import { AnimatedPlus, AnimatedTrash, AnimatedCheckCircle } from "@/components/ui/animated-icons";
import { Wrench, Printer, FileText } from "lucide-react";

interface PartIssueModalProps {
  open: boolean;
  onClose: () => void;
  products: InventoryProduct[];
  stocks: InventoryStock[];
  branches: Branch[];
  machines?: Machine[];
  onSuccess?: () => void;
}

export function PartIssueModal({
  open,
  onClose,
  products,
  stocks,
  branches,
  machines = [],
  onSuccess,
}: PartIssueModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [machineId, setMachineId] = useState("");
  const [issuedToName, setIssuedToName] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [isReturnable, setIsReturnable] = useState(false);
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [generateDeliveryChallan, setGenerateDeliveryChallan] = useState(true);

  // Dynamic parts table rows
  const [items, setItems] = useState<Array<{ productId: string; quantity: number; notes: string; isReturnable: boolean }>>([
    { productId: products[0]?.id || "", quantity: 1, notes: "", isReturnable: false },
  ]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { productId: products[0]?.id || "", quantity: 1, notes: "", isReturnable: isReturnable },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      toast("error", "Branch is required");
      return;
    }

    if (!issuedToName.trim()) {
      toast("error", "Issued to personnel name is required");
      return;
    }

    const validItems = items.filter((item) => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      toast("error", "Please add at least one spare part with quantity > 0");
      return;
    }

    startTransition(async () => {
      const res = await createPartIssueAction({
        branchId,
        machineId: machineId || undefined,
        issuedToName: issuedToName.trim(),
        issueDate,
        isReturnable,
        expectedReturnDate: isReturnable && expectedReturnDate ? expectedReturnDate : undefined,
        remarks: notes.trim() || undefined,
        generateDeliveryChallan,
        items: validItems.map((item) => ({
          productId: item.productId,
          quantityIssued: Number(item.quantity),
          isReturnable: item.isReturnable,
        })),
      });

      if (res.success) {
        toast("success", `Parts Issue Challan (#${res.data.challan_number}) generated!`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast("error", "Failed to issue parts", res.error);
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Issue Spare Parts & Generate Issue Challan" size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Recipient & Machine Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
          <SearchableSelect
            label="Branch Scope"
            value={branchId}
            onChange={(val) => setBranchId(val)}
            options={branches.map((b) => ({
              value: b.id,
              label: `${b.name} (${b.code})`,
            }))}
          />

          <MachineSelect
            label="Target Machine (Optional)"
            value={machineId}
            onChange={(mId) => setMachineId(mId)}
            machines={machines}
            placeholder="General Store / Employee Issue"
            clearable
          />

          <div>
            <label className="block text-xs font-bold mb-1 text-[var(--color-ink)]">
              Issued To (Employee / Mechanic) <span className="text-rose-500">*</span>
            </label>
            <Input
              value={issuedToName}
              onChange={(e) => setIssuedToName(e.target.value)}
              placeholder="e.g. Sushil Mishra / Field Engineer"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-[var(--color-ink)]">Issue Date</label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>

          <SearchableSelect
            label="Returnable Type"
            value={isReturnable ? "YES" : "NO"}
            onChange={(val) => {
              const boolVal = val === "YES";
              setIsReturnable(boolVal);
              setItems((prev) => prev.map((item) => ({ ...item, isReturnable: boolVal })));
            }}
            options={[
              { value: "NO", label: "NON-RETURNABLE (Consumable/Permanent)" },
              { value: "YES", label: "RETURNABLE (Tools/Assembly/Trial)" },
            ]}
          />

          {isReturnable && (
            <div>
              <label className="block text-xs font-bold mb-1 text-[var(--color-ink)]">
                Expected Return Date
              </label>
              <Input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Challan Generation Option */}
        <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-ink)]">
            <FileText className="h-4 w-4 text-sky-500" /> Auto-generate Delivery Challan (RI/DC/XXXX)
          </div>
          <input
            type="checkbox"
            checked={generateDeliveryChallan}
            onChange={(e) => setGenerateDeliveryChallan(e.target.checked)}
            className="h-4 w-4 rounded accent-sky-600"
          />
        </div>

        {/* Issued Parts Items Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
              Select Parts To Issue
            </label>
            <Button type="button" variant="secondary" onClick={handleAddItem}>
              <AnimatedPlus size={14} className="mr-1" /> Add Part
            </Button>
          </div>

          <div className="rounded-xl border border-[var(--color-hairline)] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b text-[10px]">
                <tr>
                  <th className="p-2">Part Item</th>
                  <th className="p-2 w-24 text-center">Available</th>
                  <th className="p-2 w-24 text-center">Issue Qty</th>
                  <th className="p-2 w-24 text-center">Returnable</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[11px]">
                {items.map((item, idx) => {
                  const currentProd = products.find((p) => p.id === item.productId);
                  const prodStock = stocks.find(
                    (s) => s.product_id === item.productId && s.branch_id === branchId
                  );
                  const availQty = prodStock?.quantity || 0;

                  return (
                    <tr key={idx}>
                      <td className="p-2 min-w-[200px]">
                        <SearchableSelect
                          value={item.productId}
                          onChange={(val) => {
                            setItems((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, productId: val } : r))
                            );
                          }}
                          options={products.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.part_number})`,
                            description: p.category || undefined,
                          }))}
                          compact
                        />
                      </td>
                      <td className="p-2 text-center font-mono font-bold">
                        <span className={availQty < item.quantity ? "text-rose-600 font-black" : "text-emerald-600"}>
                          {availQty} Pcs
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={availQty}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r)));
                          }}
                          className="w-full p-1.5 text-center font-mono font-bold border border-[var(--color-hairline)] rounded-lg bg-[var(--color-canvas)] text-sky-600"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.isReturnable}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, isReturnable: checked } : r)));
                          }}
                          className="h-4 w-4 rounded accent-amber-600"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-600 hover:text-rose-800 p-1 font-bold text-base cursor-pointer"
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
          <Button type="submit" variant="primary" loading={isPending} className="bg-sky-600 hover:bg-sky-700 text-white font-bold">
            <AnimatedCheckCircle size={16} className="mr-1.5" /> Confirm Part Issue & Print Challan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
