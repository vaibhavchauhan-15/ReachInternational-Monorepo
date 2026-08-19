"use client";

import { Modal, Badge, Button } from "@/components/ui";
import type { InventoryProduct, InventoryStock, InventoryTransaction, PartIssue } from "@/lib/types/database";
import {
  AnimatedPackage,
  AnimatedClock,
  AnimatedHistory,
  AnimatedWrench,
} from "@/components/ui/animated-icons";
import { MapPin, Truck, AlertTriangle } from "lucide-react";

interface PartDetailModalProps {
  open: boolean;
  onClose: () => void;
  product: InventoryProduct | null;
  stocks: InventoryStock[];
  transactions: InventoryTransaction[];
  issues?: PartIssue[];
}

export function PartDetailModal({
  open,
  onClose,
  product,
  stocks,
  transactions,
  issues = [],
}: PartDetailModalProps) {
  if (!product) return null;

  const currentStock = stocks
    .filter((s) => s.product_id === product.id)
    .reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  const reservedStock = product.reserved_quantity || 0;
  const availableStock = Math.max(0, currentStock - reservedStock);
  const minStock = product.min_stock_level || 5;

  const partTransactions = transactions.filter((t) => t.product_id === product.id);
  const partIssues = issues.filter((i) => i.items?.some((item) => item.product_id === product.id));

  return (
    <Modal open={open} onClose={onClose} title={`Part Detail — ${product.part_number}`} size="xl">
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <AnimatedPackage size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[var(--color-ink)]">{product.name}</h2>
                <Badge variant={currentStock === 0 ? "error" : currentStock <= minStock ? "warning" : "success"}>
                  {currentStock === 0 ? "Out of Stock" : currentStock <= minStock ? "Low Stock" : "In Stock"}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-mute)] font-mono mt-0.5">
                PN: {product.part_number} {product.oem_part_number && `| OEM: ${product.oem_part_number}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-[var(--color-hairline)] pt-3 sm:pt-0 sm:pl-6">
            <div>
              <div className="text-xs text-[var(--color-mute)] font-semibold">Current</div>
              <div className="text-lg font-black text-[var(--color-ink)]">{currentStock} {product.unit}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-mute)] font-semibold">Reserved</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400">{reservedStock} {product.unit}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-mute)] font-semibold">Available</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{availableStock} {product.unit}</div>
            </div>
          </div>
        </div>

        {/* Physical Storage & Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Storage Location Card */}
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-rose-500" /> Physical Storage Location
            </h3>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                <span className="text-[10px] text-[var(--color-mute)] block font-bold">Zone</span>
                <span className="text-xs font-black text-[var(--color-ink)]">{product.warehouse_zone || "ZONE-A"}</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                <span className="text-[10px] text-[var(--color-mute)] block font-bold">Rack</span>
                <span className="text-xs font-black text-sky-600 dark:text-sky-400">{product.rack_number || "R-01"}</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                <span className="text-[10px] text-[var(--color-mute)] block font-bold">Shelf</span>
                <span className="text-xs font-black text-[var(--color-ink)]">{product.shelf_number || "S-01"}</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                <span className="text-[10px] text-[var(--color-mute)] block font-bold">Bin</span>
                <span className="text-xs font-black text-purple-600 dark:text-purple-400">{product.bin_number || "B-01"}</span>
              </div>
            </div>

            <div className="text-xs text-[var(--color-ink)] font-medium pt-1">
              <strong>Full Location Path:</strong>{" "}
              <code className="px-2 py-1 rounded bg-[var(--color-canvas-elevated)] border font-mono text-[11px] font-bold">
                {product.storage_location || "ZONE-A > R-01 > S-01 > B-01"}
              </code>
            </div>
          </div>

          {/* Part Specifications & Pricing */}
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 text-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedWrench size={16} className="text-amber-500" /> Technical & Pricing Specs
            </h3>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-[var(--color-mute)]">Category:</span> <strong>{product.category || "General"}</strong></div>
              <div><span className="text-[var(--color-mute)]">Part Type:</span> <strong className="capitalize">{product.part_type || "spare"}</strong></div>
              <div><span className="text-[var(--color-mute)]">Manufacturer:</span> <strong>{product.manufacturer || "OEM Generic"}</strong></div>
              <div><span className="text-[var(--color-mute)]">Criticality:</span> <strong className="uppercase text-amber-600">{product.criticality || "normal"}</strong></div>
              <div><span className="text-[var(--color-mute)]">Unit Cost:</span> <strong>₹{Number(product.unit_cost || 0).toLocaleString("en-IN")}</strong></div>
              <div><span className="text-[var(--color-mute)]">Last Purchase Price:</span> <strong>₹{Number(product.last_purchase_price || product.unit_cost || 0).toLocaleString("en-IN")}</strong></div>
              <div><span className="text-[var(--color-mute)]">Min / Reorder Level:</span> <strong>{product.min_stock_level} / {product.reorder_level || 5} Pcs</strong></div>
              <div><span className="text-[var(--color-mute)]">Reorder Quantity:</span> <strong>{product.reorder_quantity || 10} Pcs</strong></div>
            </div>
          </div>
        </div>

        {/* Transaction & Movement History */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
            <AnimatedHistory size={16} className="text-sky-500" /> Transaction Audit Timeline ({partTransactions.length})
          </h3>

          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] font-extrabold uppercase text-[10px] border-b sticky top-0">
                <tr>
                  <th className="px-3 py-2">Txn No</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Remarks / Document</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)] text-[11px]">
                {partTransactions.length > 0 ? (
                  partTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-3 py-2 font-mono font-bold">{t.transaction_no}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            ["STOCK_IN", "PURCHASE", "PART_RETURN", "RETURN"].includes(t.type)
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono font-bold">
                        {["STOCK_IN", "PURCHASE", "PART_RETURN", "RETURN"].includes(t.type) ? "+" : "-"}{t.quantity}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[var(--color-mute)]">{t.remarks || "Stock Movement"}</td>
                      <td className="px-3 py-2 font-mono text-[10px]">
                        {new Date(t.created_at).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-[var(--color-mute)]">
                      No stock movement audit records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-[var(--color-hairline)]">
          <Button variant="secondary" onClick={onClose}>
            Close Detail
          </Button>
        </div>
      </div>
    </Modal>
  );
}
