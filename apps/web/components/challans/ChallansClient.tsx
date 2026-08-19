"use client";

import { useState, useMemo } from "react";
import {
  AnimatedTruck,
  AnimatedSearch,
  AnimatedPlus,
  AnimatedEye,
  AnimatedDownload,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedXCircle,
  AnimatedArrowRight,
} from "@/components/ui/animated-icons";
import type { User, DeliveryChallan } from "@/lib/types/database";

import { TooltipWrapper } from "@/components/ui";

interface ChallansClientProps {
  user: User;
}

export function ChallansClient({ user }: ChallansClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  // Mock Delivery Challans
  const mockChallans: DeliveryChallan[] = [
    {
      id: "dc-1024",
      challan_number: "DC-1024",
      client_name: "ABC Construction Ltd",
      destination: "Delhi Metro Site 4, Najafgarh",
      status: "in_transit",
      amount: 82500,
      issue_date: "2026-08-12",
      expected_delivery: "2026-08-14",
      created_at: "2026-08-12",
    },
    {
      id: "dc-1025",
      challan_number: "DC-1025",
      client_name: "XYZ Infrastructure",
      destination: "Noida Sector 62 Expressway",
      status: "delivered",
      amount: 145000,
      issue_date: "2026-08-10",
      expected_delivery: "2026-08-11",
      created_at: "2026-08-10",
    },
    {
      id: "dc-1026",
      challan_number: "DC-1026",
      client_name: "Global Logistics Hub",
      destination: "Gurugram Phase 5",
      status: "pending",
      amount: 45000,
      issue_date: "2026-08-13",
      expected_delivery: "2026-08-15",
      created_at: "2026-08-13",
    },
    {
      id: "dc-1027",
      challan_number: "DC-1027",
      client_name: "Northern Heavy Infra",
      destination: "Jaipur Highway Yard",
      status: "returned",
      amount: 32000,
      issue_date: "2026-08-05",
      expected_delivery: "2026-08-07",
      created_at: "2026-08-05",
    },
  ];

  const filteredChallans = useMemo(() => {
    return mockChallans.filter((c) => {
      const matchesSearch =
        c.challan_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.destination.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab = activeTab === "all" || c.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [mockChallans, searchQuery, activeTab]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-2">
            <AnimatedTruck size={14} />
            Consolidated Logistics & Challan Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Delivery Challans
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            Track equipment & spare part dispatch status, in-transit movements, and returns
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          <AnimatedPlus size={16} />
          <span>Create Challan</span>
        </button>
      </div>

      {/* STATUS TABS & SEARCH TOOLBAR */}
      <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
        <div className="relative flex items-center">
          <AnimatedSearch size={16} className="absolute left-3 text-[var(--color-mute)]" />
          <input
            type="text"
            placeholder="Search by challan number, client name, or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-[var(--color-hairline)] pt-3">
          {[
            { id: "all", label: "All Challans" },
            { id: "draft", label: "Draft" },
            { id: "pending", label: "Pending Approval" },
            { id: "dispatched", label: "Dispatched" },
            { id: "in_transit", label: "In Transit 🚚" },
            { id: "delivered", label: "Delivered 🟢" },
            { id: "returned", label: "Returned ↩" },
            { id: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CHALLANS TABLE */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-4">Challan No</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Declared Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {filteredChallans.map((challan) => (
                <tr key={challan.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                  <td className="py-3 px-4 font-mono font-extrabold text-[var(--color-ink)]">
                    {challan.challan_number}
                  </td>
                  <td className="py-3 px-4 font-bold text-[var(--color-ink)]">
                    {challan.client_name}
                  </td>
                  <td className="py-3 px-4 text-[var(--color-body)] font-medium">
                    {challan.destination}
                  </td>
                  <td className="py-3 px-4 text-[var(--color-mute)] font-medium">
                    {challan.issue_date}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-[var(--color-ink)]">
                    ₹{challan.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4">
                    {challan.status === "in_transit" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300">
                        <AnimatedTruck size={12} />
                        In Transit
                      </span>
                    )}
                    {challan.status === "delivered" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        <AnimatedCheckCircle size={12} />
                        Delivered
                      </span>
                    )}
                    {challan.status === "pending" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300">
                        <AnimatedClock size={12} />
                        Pending Dispatch
                      </span>
                    )}
                    {challan.status === "returned" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300">
                        <AnimatedXCircle size={12} />
                        Returned
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TooltipWrapper content="View Delivery Details" side="top">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-purple-600 hover:bg-purple-500/10 transition-colors cursor-pointer"
                          aria-label="View Delivery Details"
                        >
                          <AnimatedEye size={14} />
                        </button>
                      </TooltipWrapper>
                      <TooltipWrapper content="Download Printable PDF Challan" side="top">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          aria-label="Download Printable PDF Challan"
                        >
                          <AnimatedDownload size={14} />
                        </button>
                      </TooltipWrapper>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
