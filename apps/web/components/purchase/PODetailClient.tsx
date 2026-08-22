"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AnimatedShoppingBag,
  AnimatedChevronLeft,
  AnimatedMail,
  AnimatedFileText,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedBuilding2,
  AnimatedPackage,
  AnimatedActivity,
} from "@/components/ui/animated-icons";
import type { User, PurchaseOrder } from "@/lib/types/database";

interface PODetailClientProps {
  user: User;
  poId: string;
}

export function PODetailClient({ user, poId }: PODetailClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "vendor" | "approval" | "documents" | "receipts" | "communication" | "activity">("overview");

  // Mock PO data
  const po: PurchaseOrder = {
    id: poId,
    po_number: "PO-2026-0045",
    vendor_id: "ven-1",
    vendor_name: "JCB India Ltd",
    amount: 485000,
    status: "pending_approval",
    due_date: "2026-08-20",
    requested_by: "Rahul Store Manager",
    branch_id: "br-1",
    created_at: "2026-08-11",
  };

  return (
    <div className="w-full space-y-6 max-w-[1400px] mx-auto">
      {/* Top Breadcrumb */}
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
      >
        <AnimatedChevronLeft size={16} />
        <span>Back to Purchase Orders</span>
      </Link>

      {/* PO Header Card */}
      <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-4">
          <div>
            <span className="text-xs font-mono font-bold text-[var(--color-mute)]">{po.po_number}</span>
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">
              ₹{po.amount.toLocaleString("en-IN")} — {po.vendor_name}
            </h1>
            <p className="text-xs text-[var(--color-mute)] mt-1">
              Requested by {po.requested_by} • Created {po.created_at}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300">
              Pending Approval
            </span>
          </div>
        </div>

        {/* Sub-Tabs Navigation (Item 13 Requirement!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[var(--color-hairline)]">
          {[
            { id: "overview", label: "Overview", icon: AnimatedShoppingBag },
            { id: "items", label: "📦 Items List", icon: AnimatedPackage },
            { id: "vendor", label: "🏢 Vendor Profile", icon: AnimatedBuilding2 },
            { id: "approval", label: "🔒 Approval Status", icon: AnimatedClock },
            { id: "documents", label: "📄 Documents", icon: AnimatedFileText },
            { id: "receipts", label: "🧾 Receipts & GRN", icon: AnimatedCheckCircle },
            { id: "communication", label: "✉ Communication / Mail", icon: AnimatedMail },
            { id: "activity", label: "📋 Activity Trail", icon: AnimatedActivity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sub-Tab View */}
        <div className="pt-2">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-[var(--color-mute)]">PO Details</p>
                <p className="font-bold text-sm text-[var(--color-ink)]">{po.po_number}</p>
                <p className="text-[var(--color-mute)]">Vendor: {po.vendor_name}</p>
                <p className="text-[var(--color-mute)]">Due Date: {po.due_date}</p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-[var(--color-mute)]">Financial Summary</p>
                <div className="flex justify-between">
                  <span className="text-[var(--color-mute)]">Total PO Amount:</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">₹{po.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-mute)]">Approval Status:</span>
                  <span className="font-bold text-amber-600">Pending Branch Manager Review</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "communication" && (
            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3 text-xs">
              <h3 className="font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                <AnimatedMail size={16} className="text-amber-500" />
                PO Mail & Supplier Communication
              </h3>
              <p className="text-[var(--color-mute)]">
                Send PO directly to {po.vendor_name}, view email dispatch history and supplier replies.
              </p>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors"
              >
                Send PO to Vendor
              </button>
            </div>
          )}

          {activeTab !== "overview" && activeTab !== "communication" && (
            <div className="p-8 text-center border border-dashed border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-mute)]">
              Contextual view for {activeTab} of PO {po.po_number}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
