"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  AnimatedBuilding2,
  AnimatedSearch,
  AnimatedPlus,
  AnimatedStar,
  AnimatedPhone,
  AnimatedMail,
  AnimatedMapPin,
  AnimatedEye,
  AnimatedChevronRight,
  AnimatedX,
  AnimatedShoppingBag,
} from "@/components/ui/animated-icons";
import { Building2, X, Mail, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { User, Vendor } from "@/lib/types/database";
import { TooltipWrapper } from "@/components/ui";

interface VendorsClientProps {
  user: User;
}

export function VendorsClient({ user }: VendorsClientProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTabState, setActiveTab] = useState<"directory" | "performance">("directory");
  const activeTab = (tabParam && ["directory", "performance"].includes(tabParam)
    ? tabParam
    : activeTabState) as "directory" | "performance";
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorDetailTab, setVendorDetailTab] = useState<"overview" | "contacts" | "products" | "purchase_orders" | "documents" | "performance" | "activity">("overview");

  // Mock Vendors
  const mockVendors: Vendor[] = [
    {
      id: "ven-1",
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
    },
    {
      id: "ven-2",
      vendor_name: "ACE Hydraulics & Filters",
      code: "VEN-ACE-02",
      contact_person: "Suresh Gupta (Sales Head)",
      email: "sales@acehydraulics.com",
      phone: "+91 11 23456789",
      city: "Delhi",
      category: "Hydraulics & Seals",
      rating: 4.5,
      status: "active",
      created_at: "2023-09-15",
    },
    {
      id: "ven-3",
      vendor_name: "National Oil & Lubricants Co.",
      code: "VEN-NOL-03",
      contact_person: "Deepak Patel (Key Account Manager)",
      email: "orders@nationaloil.com",
      phone: "+91 22 87654321",
      city: "Mumbai",
      category: "Engine Oil & Grease",
      rating: 4.6,
      status: "active",
      created_at: "2024-01-20",
    },
  ];

  const filteredVendors = useMemo(() => {
    return mockVendors.filter(
      (v) =>
        v.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [mockVendors, searchQuery]);

  return (
    <div className="w-full space-y-6 max-w-[1400px] mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-2">
            <AnimatedBuilding2 size={14} />
            Suppliers & Vendor Procurement
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Vendors Management
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            Supplier directory, purchase orders, performance ratings, and vendor agreements
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          <AnimatedPlus size={16} />
          <span>Add Vendor</span>
        </button>
      </div>

      {/* SUB-TABS (Item 12 Requirement!) */}
      <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "directory"
              ? "bg-indigo-600 text-white shadow-2xs"
              : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          }`}
        >
          Vendor Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "performance"
              ? "bg-indigo-600 text-white shadow-2xs"
              : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          }`}
        >
          Vendor Performance
        </button>
      </div>

      {/* SEARCH TOOLBAR */}
      <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
        <div className="relative flex items-center">
          <AnimatedSearch size={16} className="absolute left-3 text-[var(--color-mute)]" />
          <input
            type="text"
            placeholder="Search by vendor name, code, category, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* VENDORS DIRECTORY TABLE */}
      {activeTab === "directory" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="py-3 px-4">Vendor Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4 text-center">Rating</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => setSelectedVendor(vendor)}
                    className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <p className="font-extrabold text-[var(--color-ink)]">{vendor.vendor_name}</p>
                      <p className="text-[11px] font-mono text-[var(--color-mute)]">{vendor.code}</p>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[var(--color-ink)]">
                      {vendor.category}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-body)] font-medium">
                      {vendor.city}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-body)]">
                      <p className="font-semibold text-[var(--color-ink)]">{vendor.contact_person}</p>
                      <p className="text-[11px] text-[var(--color-mute)]">{vendor.phone}</p>
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold text-amber-500">
                      ★ {vendor.rating}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVendor(vendor);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition-colors"
                      >
                        <span>View Details</span>
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

      {/* VENDOR PROFILE CONTEXTUAL MODAL (Item 12 Requirement!) */}
      <AnimatePresence>
        {selectedVendor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVendor(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 w-full max-w-4xl max-h-[85vh] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-2xl overflow-y-auto flex flex-col no-scrollbar"
            >
              {/* Vendor Header */}
              <div className="flex items-start justify-between border-b border-[var(--color-hairline)] pb-4 mb-4 shrink-0">
                <div>
                  <span className="text-[11px] font-mono font-extrabold text-[var(--color-mute)] uppercase">
                    {selectedVendor.code}
                  </span>
                  <h2 className="text-xl font-extrabold text-[var(--color-ink)] mt-0.5">
                    {selectedVendor.vendor_name}
                  </h2>
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-2 mt-1">
                    <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                    {selectedVendor.category} • {selectedVendor.city}
                  </p>
                </div>

                <TooltipWrapper content="Close vendor details" side="left">
                  <button
                    type="button"
                    onClick={() => setSelectedVendor(null)}
                    aria-label="Close vendor details"
                    className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </TooltipWrapper>
              </div>

              {/* Contextual Sub-Tabs (Item 12 Requirement!) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar border-b border-[var(--color-hairline)] mb-4 shrink-0">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "contacts", label: "📞 Contacts" },
                  { id: "products", label: "📦 Products / Parts" },
                  { id: "purchase_orders", label: "📋 Purchase Orders (14)" },
                  { id: "documents", label: "📄 Documents (3)" },
                  { id: "performance", label: "★ Performance (4.8)" },
                  { id: "activity", label: "📋 Activity Log" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setVendorDetailTab(tab.id as typeof vendorDetailTab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      vendorDetailTab === tab.id
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab View */}
              <div className="flex-1 space-y-4">
                {vendorDetailTab === "overview" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                      <p className="font-extrabold text-[var(--color-ink)] uppercase text-[10px] tracking-wider text-[var(--color-mute)]">
                        Primary Representative
                      </p>
                      <p className="font-bold text-[var(--color-ink)] text-sm">{selectedVendor.contact_person}</p>
                      <p className="text-[var(--color-mute)] flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-indigo-500" />
                        {selectedVendor.email}
                      </p>
                      <p className="text-[var(--color-mute)] flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                        {selectedVendor.phone}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                      <p className="font-extrabold text-[var(--color-ink)] uppercase text-[10px] tracking-wider text-[var(--color-mute)]">
                        Performance Metrics
                      </p>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-mute)]">Overall Rating:</span>
                        <span className="font-bold text-amber-500">★ {selectedVendor.rating} / 5.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-mute)]">Status:</span>
                        <span className="font-bold text-emerald-600">Active Approved Supplier</span>
                      </div>
                    </div>
                  </div>
                )}

                {vendorDetailTab !== "overview" && (
                  <div className="p-8 text-center border border-dashed border-[var(--color-hairline)] rounded-xl">
                    <p className="text-xs font-semibold text-[var(--color-mute)]">
                      Showing contextual {vendorDetailTab} for {selectedVendor.vendor_name}
                    </p>
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
