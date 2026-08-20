"use client";

import { useState, useTransition } from "react";
import { Modal, Button, Input, Textarea, Select, useToast } from "@/components/ui";
import { createPartIssueAction } from "@/app/actions/inventory";
import type { InventoryProduct, InventoryStock, Branch, Machine } from "@/lib/types/database";
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

  const [branchId, setBranchId] = useState<string>(branches[0]?.id || "");
  const [machineId, setMachineId] = useState<string>(machines[0]?.id || "");
  const [issuedToName, setIssuedToName] = useState<string>("Sushil Mishra / Site Tech");
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isReturnable, setIsReturnable] = useState<boolean>(false);
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [generateDeliveryChallan, setGenerateDeliveryChallan] = useState<boolean>(true);
  const [destinationAddress, setDestinationAddress] = useState<string>(
    "JK PAPER SURAT SITE 80D-7ACE-727"
  );
  const [remarks, setRemarks] = useState<string>("Issued for machine maintenance job");

  // Items State
  const [items, setItems] = useState<
    Array<{ productId: string; quantityIssued: number; machineCode: string; isReturnable: boolean }>
  >([
    {
      productId: products[0]?.id || "",
      quantityIssued: 1,
      machineCode: machines[0]?.machine_code || "M-101",
      isReturnable: false,
    },
  ]);

  const handleAddItemRow = () => {
    const unselected = products.find((p) => !items.some((i) => i.productId === p.id)) || products[0];
    if (!unselected) return;
    setItems((prev) => [
      ...prev,
      {
        productId: unselected.id,
        quantityIssued: 1,
        machineCode: machines[0]?.machine_code || "M-101",
        isReturnable: isReturnable,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuedToName.trim()) {
      toast("error", "Receiver Name (Issue To) is required");
      return;
    }
    if (items.length === 0) {
      toast("error", "Add at least one part item to issue");
      return;
    }

    startTransition(async () => {
      const res = await createPartIssueAction({
        branchId,
        machineId: machineId || undefined,
        issuedToName,
        issueDate,
        isReturnable,
        expectedReturnDate: isReturnable ? expectedReturnDate : undefined,
        generateDeliveryChallan,
        destinationAddress,
        remarks,
        items,
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
            label="Target Machine (Optional)"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            options={[
              { value: "", label: "General Store / Employee Issue" },
              ...(machines || []).map((m) => ({
                value: m.id,
                label: `${m.machine_code} — ${m.machine_name}`,
              })),
            ]}
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

          <Select
            label="Returnable Type"
            value={isReturnable ? "YES" : "NO"}
            onChange={(e) => {
              const val = e.target.value === "YES";
              setIsReturnable(val);
              setItems((prev) => prev.map((item) => ({ ...item, isReturnable: val })));
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
            <Button type="button" variant="secondary" onClick={handleAddItemRow}>
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
                  <th className="p-2 w-28 text-center">Machine Code</th>
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
                      <td className="p-2">
                        <Select
                          value={item.productId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) =>
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
                        <span className={availQty < item.quantityIssued ? "text-rose-600 font-black" : "text-emerald-600"}>
                          {availQty} Pcs
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={availQty}
                          value={item.quantityIssued}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, quantityIssued: val } : r)));
                          }}
                          className="w-full p-1 text-center font-mono font-bold border rounded bg-[var(--color-canvas)] text-sky-600"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.machineCode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, machineCode: val } : r)));
                          }}
                          className="w-full p-1 text-center font-mono border rounded bg-[var(--color-canvas)]"
                          placeholder="M-101"
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
          <Button type="submit" variant="primary" loading={isPending} className="bg-sky-600 hover:bg-sky-700 text-white font-bold">
            <AnimatedCheckCircle size={16} className="mr-1.5" /> Confirm Part Issue & Print Challan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
