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
import { SegmentedToggle } from "@/components/ui";

interface ClientDetailClientProps {
  user: User;
  clientId: string;
}

export function ClientDetailClient({ user, clientId }: ClientDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "machines" | "service" | "complaints" | "documents" | "contacts" | "activity">("overview");

  // Mock client data
  const client: CRMClient = {
    id: clientId,
    company_name: "ABC Infrastructure Pvt Ltd",
    code: "CLI-0001",
    contact_person: "Rajesh Sharma",
    phone: "+91 98765 43210",
    city: "Mumbai",
    state: "Maharashtra",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as CRMClient;

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/crm" className="hover:text-[var(--color-ink)] transition-colors flex items-center gap-1">
          <AnimatedChevronLeft size={14} /> Back to CRM
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)] font-semibold">{client.company_name}</span>
      </div>

      {/* Client Profile Header Card */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xl">
              {client.company_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--color-ink)]">{client.company_name}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                  {client.code}
                </span>
              </div>
              <p className="text-xs text-[var(--color-mute)] mt-0.5">Primary Contact: {client.contact_person || "Not specified"}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Client Sub-Module Navigation Tabs */}
        <div className="border-t border-[var(--color-hairline)] pt-4 overflow-x-auto no-scrollbar">
          <SegmentedToggle<"overview" | "machines" | "service" | "complaints" | "documents" | "contacts" | "activity">
            value={activeTab}
            onChange={setActiveTab}
            layoutIdPrefix="client-detail-tabs"
            size="sm"
            responsive={false}
            items={[
              { id: "overview", label: "Overview", icon: <AnimatedUsers size={14} /> },
              { id: "machines", label: "Machines", icon: <AnimatedWrench size={14} />, count: 12 },
              { id: "service", label: "Service History", icon: <AnimatedWrench size={14} /> },
              { id: "complaints", label: "Complaints", icon: <AnimatedAlertTriangle size={14} />, count: 2 },
              { id: "documents", label: "Documents", icon: <AnimatedFileText size={14} />, count: 5 },
              { id: "contacts", label: "Contacts", icon: <AnimatedPhone size={14} /> },
              { id: "activity", label: "Activity Trail", icon: <AnimatedActivity size={14} /> },
            ]}
          />
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
