"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  AnimatedShoppingBag,
  AnimatedSearch,
  AnimatedPlus,
  AnimatedEye,
  AnimatedDownload,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedXCircle,
  AnimatedChevronRight,
  AnimatedX,
  AnimatedMail,
} from "@/components/ui/animated-icons";
import { X, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { User, PurchaseOrder } from "@/lib/types/database";

interface PurchaseOrdersClientProps {
  user: User;
}

export function PurchaseOrdersClient({ user }: PurchaseOrdersClientProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTabState, setActiveTab] = useState<"all" | "approvals" | "create">("all");
  const activeTab = (tabParam && ["all", "approvals", "create"].includes(tabParam)
    ? tabParam
    : activeTabState) as "all" | "approvals" | "create";
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [poDetailTab, setPoDetailTab] = useState<"overview" | "items" | "vendor" | "approval" | "documents" | "receipts" | "communication" | "activity">("overview");

  // Mock Purchase Orders
  const mockPos: PurchaseOrder[] = [
    {
      id: "po-1",
      po_number: "PO-2026-0045",
      vendor_id: "ven-1",
      vendor_name: "JCB India Ltd",
      amount: 485000,
      status: "pending_approval",
      due_date: "2026-08-20",
      requested_by: "Rahul Store Manager",
      branch_id: "br-1",
      created_at: "2026-08-11",
    },
    {
      id: "po-2",
      po_number: "PO-2026-0044",
      vendor_id: "ven-2",
      vendor_name: "ACE Hydraulics & Seals",
      amount: 125000,
      status: "approved",
      due_date: "2026-08-18",
      requested_by: "Amit Service Engineer",
      branch_id: "br-1",
      created_at: "2026-08-09",
    },
    {
      id: "po-3",
      po_number: "PO-2026-0043",
      vendor_id: "ven-3",
      vendor_name: "National Oil & Lubricants Co.",
      amount: 98000,
      status: "received",
      due_date: "2026-08-15",
      requested_by: "Rahul Store Manager",
      branch_id: "br-2",
      created_at: "2026-08-05",
    },
  ];

  const filteredPos = useMemo(() => {
    return mockPos.filter((po) => {
      const matchesSearch =
        po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.vendor_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab =
        activeTab === "all" ||
        (activeTab === "approvals" && po.status === "pending_approval");

      return matchesSearch && matchesTab;
    });
  }, [mockPos, searchQuery, activeTab]);

  return (
    <div className="w-full space-y-6 max-w-[1400px] mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
            <AnimatedShoppingBag size={14} />
            Procurement & Purchase Orders
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Purchase Orders
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            Manage purchase requests, approvals, vendor purchase orders, and goods receipts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab("create")}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          <AnimatedPlus size={16} />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* SUB-TABS (Item 13 Requirement!) */}
      <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-amber-600 text-white shadow-2xs"
              : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          }`}
        >
          All Purchase Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("approvals")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "approvals"
              ? "bg-amber-600 text-white shadow-2xs"
              : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          }`}
        >
          My Approvals (1)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("create")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "create"
              ? "bg-amber-600 text-white shadow-2xs"
              : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          }`}
        >
          Create Purchase Order
        </button>
      </div>

      {/* SEARCH TOOLBAR */}
      {activeTab !== "create" && (
        <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
          <div className="relative flex items-center">
            <AnimatedSearch size={16} className="absolute left-3 text-[var(--color-mute)]" />
            <input
              type="text"
              placeholder="Search by PO number or vendor name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
      )}

      {/* PO LISTING TABLE */}
      {activeTab !== "create" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {filteredPos.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => setSelectedPo(po)}
                    className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-extrabold text-[var(--color-ink)]">
                      {po.po_number}
                    </td>
                    <td className="py-3 px-4 font-bold text-[var(--color-ink)]">
                      {po.vendor_name}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-mute)] font-medium">
                      {po.requested_by}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-[var(--color-ink)]">
                      ₹{po.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      {po.status === "pending_approval" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300">
                          <AnimatedClock size={12} />
                          Pending Approval
                        </span>
                      )}
                      {po.status === "approved" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                          <AnimatedCheckCircle size={12} />
                          Approved
                        </span>
                      )}
                      {po.status === "received" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300">
                          <AnimatedCheckCircle size={12} />
                          Goods Received
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPo(po);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs transition-colors"
                      >
                        <span>View PO</span>
                        <AnimatedChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE PO FORM */}
      {activeTab === "create" && (
        <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] max-w-2xl mx-auto space-y-4">
          <h2 className="text-base font-extrabold text-[var(--color-ink)]">Create Purchase Order</h2>
          <p className="text-xs text-[var(--color-mute)]">Fill vendor details and item requirements</p>
          <div className="p-4 border border-dashed border-[var(--color-hairline)] rounded-xl text-center text-xs text-[var(--color-mute)]">
            PO Creation Form Engine Ready
          </div>
        </div>
      )}

      {/* PO DETAIL CONTEXTUAL MODAL (Item 13 Requirement!) */}
      <AnimatePresence>
        {selectedPo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPo(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 w-full max-w-4xl max-h-[85vh] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-2xl overflow-y-auto flex flex-col no-scrollbar"
            >
              {/* PO Header */}
              <div className="flex items-start justify-between border-b border-[var(--color-hairline)] pb-4 mb-4 shrink-0">
                <div>
                  <span className="text-[11px] font-mono font-extrabold text-[var(--color-mute)] uppercase">
                    {selectedPo.po_number}
                  </span>
                  <h2 className="text-xl font-extrabold text-[var(--color-ink)] mt-0.5">
                    ₹{selectedPo.amount.toLocaleString("en-IN")} — {selectedPo.vendor_name}
                  </h2>
                  <p className="text-xs text-[var(--color-mute)] mt-1">
                    Requested by {selectedPo.requested_by} • Created {selectedPo.created_at}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPo(null)}
                  className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Contextual Sub-Tabs (Item 13 Requirement!) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar border-b border-[var(--color-hairline)] mb-4 shrink-0">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "items", label: "📦 Items List" },
                  { id: "vendor", label: "🏢 Vendor Profile" },
                  { id: "approval", label: "🔒 Approval Status" },
                  { id: "documents", label: "📄 Documents" },
                  { id: "receipts", label: "🧾 Receipts & GRN" },
                  { id: "communication", label: "✉ Communication / Mail" },
                  { id: "activity", label: "📋 Activity Trail" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPoDetailTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      poDetailTab === tab.id
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab Content View */}
              <div className="flex-1 space-y-4">
                {poDetailTab === "communication" && (
                  <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3 text-xs">
                    <h3 className="font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                      <Mail className="h-4 w-4 text-amber-500" />
                      PO Mail & Supplier Communication
                    </h3>
                    <p className="text-[var(--color-mute)]">
                      Send PO directly to {selectedPo.vendor_name}, view email dispatch history and supplier replies.
                    </p>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors"
                    >
                      Send PO to Vendor
                    </button>
                  </div>
                )}

                {poDetailTab !== "communication" && (
                  <div className="p-8 text-center border border-dashed border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-mute)]">
                    Showing contextual {poDetailTab} for {selectedPo.po_number}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
