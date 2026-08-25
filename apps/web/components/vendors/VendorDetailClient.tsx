"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AnimatedBuilding2,
  AnimatedChevronLeft,
  AnimatedMail,
  AnimatedPhone,
  AnimatedShoppingBag,
  AnimatedFileText,
  AnimatedStar,
  AnimatedActivity,
  AnimatedPackage,
} from "@/components/ui/animated-icons";
import type { User, Vendor } from "@/lib/types/database";

interface VendorDetailClientProps {
  user: User;
  vendorId: string;
}

export function VendorDetailClient({ user, vendorId }: VendorDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "products" | "purchase_orders" | "documents" | "performance" | "activity">("overview");

  // Mock vendor data
  const vendor: Vendor = {
    id: vendorId,
    vendor_name: "JCB India Ltd",
    code: "VEN-JCB-01",
    contact_person: "Anand Mahindra (Regional Supply Manager)",
    email: "orders@jcb-india.com",
    phone: "+91 124 4567890",
    category: "OEM Spare Parts",
    city: "Ballabgarh",
    rating: 4.8,
    status: "active",
    created_at: "2023-05-10",
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Breadcrumb */}
      <Link
        href="/vendors"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
      >
        <AnimatedChevronLeft size={16} />
        <span>Back to Vendors Directory</span>
      </Link>

      {/* Vendor Header Card */}
      <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-4">
          <div>
            <span className="text-xs font-mono font-bold text-[var(--color-mute)]">{vendor.code}</span>
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">{vendor.vendor_name}</h1>
            <p className="text-xs text-[var(--color-mute)] flex items-center gap-2 mt-1">
              <AnimatedBuilding2 size={14} className="text-indigo-500" />
              {vendor.category} • {vendor.city}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
              Active Vendor
            </span>
          </div>
        </div>

        {/* Sub-Tabs Navigation (Item 12 Requirement!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[var(--color-hairline)]">
          {[
            { id: "overview", label: "Overview", icon: AnimatedBuilding2 },
            { id: "contacts", label: "📞 Contacts", icon: AnimatedPhone },
            { id: "products", label: "📦 Products / Parts", icon: AnimatedPackage },
            { id: "purchase_orders", label: "📋 Purchase Orders (14)", icon: AnimatedShoppingBag },
            { id: "documents", label: "📄 Documents (3)", icon: AnimatedFileText },
            { id: "performance", label: "★ Performance (4.8)", icon: AnimatedStar },
            { id: "activity", label: "📋 Activity Log", icon: AnimatedActivity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-2xs"
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
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-[var(--color-mute)]">Primary Representative</p>
                <p className="font-bold text-sm text-[var(--color-ink)]">{vendor.contact_person}</p>
                <p className="text-[var(--color-mute)] flex items-center gap-2">
                  <AnimatedMail size={14} className="text-indigo-500" />
                  {vendor.email}
                </p>
                <p className="text-[var(--color-mute)] flex items-center gap-2">
                  <AnimatedPhone size={14} className="text-emerald-500" />
                  {vendor.phone}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-[var(--color-mute)]">Performance Metrics</p>
                <div className="flex justify-between">
                  <span className="text-[var(--color-mute)]">Overall Rating:</span>
                  <span className="font-bold text-amber-500">★ {vendor.rating} / 5.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-mute)]">Status:</span>
                  <span className="font-bold text-emerald-600">Active Approved Supplier</span>
                </div>
              </div>
            </div>
          )}

          {activeTab !== "overview" && (
            <div className="p-8 text-center border border-dashed border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-mute)]">
              Contextual view for {activeTab} of vendor {vendor.vendor_name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
