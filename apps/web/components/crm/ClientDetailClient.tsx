"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AnimatedUsers,
  AnimatedChevronLeft,
  AnimatedMapPin,
  AnimatedMail,
  AnimatedPhone,
  AnimatedWrench,
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedActivity,
} from "@/components/ui/animated-icons";
import { motion } from "framer-motion";
import type { User, CRMClient } from "@/lib/types/database";

interface ClientDetailClientProps {
  user: User;
  clientId: string;
}

export function ClientDetailClient({ user, clientId }: ClientDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "machines" | "service" | "complaints" | "documents" | "contacts" | "activity">("overview");

  // Mock client data
  const client: CRMClient = {
    id: clientId,
    client_name: "ABC Infrastructure Pvt Ltd",
    code: "CLI-ABC-01",
    contact_person: "Rajesh Sharma (Procurement Head)",
    email: "rajesh@abcinfra.com",
    phone: "+91 98765 43210",
    city: "Delhi",
    state: "Delhi",
    branch_id: "br-1",
    machine_count: 12,
    open_complaints: 2,
    status: "active",
    created_at: "2024-01-15",
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <Link
        href="/crm"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
      >
        <AnimatedChevronLeft size={16} />
        <span>Back to CRM Directory</span>
      </Link>

      {/* Client Header Card */}
      <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-4">
          <div>
            <span className="text-xs font-mono font-bold text-[var(--color-mute)]">{client.code}</span>
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">{client.client_name}</h1>
            <p className="text-xs text-[var(--color-mute)] flex items-center gap-2 mt-1">
              <AnimatedMapPin size={14} className="text-sky-500" />
              {client.city}, {client.state}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
              Active Client
            </span>
          </div>
        </div>

        {/* Sub-Tabs Navigation (Item 7 Requirement!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[var(--color-hairline)]">
          {[
            { id: "overview", label: "Overview", icon: AnimatedUsers },
            { id: "machines", label: "🚜 Machines (12)", icon: AnimatedWrench },
            { id: "service", label: "🔧 Service History", icon: AnimatedWrench },
            { id: "complaints", label: "🔴 Complaints (2)", icon: AnimatedAlertTriangle },
            { id: "documents", label: "📄 Documents (5)", icon: AnimatedFileText },
            { id: "contacts", label: "📞 Contacts", icon: AnimatedPhone },
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
                    ? "bg-blue-600 text-white shadow-2xs"
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
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-[var(--color-mute)]">Primary Contact</p>
                <p className="font-bold text-sm text-[var(--color-ink)]">{client.contact_person}</p>
                <p className="text-[var(--color-mute)] flex items-center gap-2">
                  <AnimatedMail size={14} className="text-sky-500" />
                  {client.email}
                </p>
                <p className="text-[var(--color-mute)] flex items-center gap-2">
                  <AnimatedPhone size={14} className="text-emerald-500" />
                  {client.phone}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-[var(--color-mute)]">Account Metrics</p>
                <div className="flex justify-between">
                  <span className="text-[var(--color-mute)]">Active Machines:</span>
                  <span className="font-bold text-[var(--color-ink)]">{client.machine_count} Units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-mute)]">Open Breakdown Complaints:</span>
                  <span className="font-bold text-red-600">{client.open_complaints} Open</span>
                </div>
              </div>
            </div>
          )}

          {activeTab !== "overview" && (
            <div className="p-8 text-center border border-dashed border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-mute)]">
              Contextual view for {activeTab} of client {client.client_name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
