"use client";

import { useState, useMemo } from "react";
import {
  AnimatedFileText,
  AnimatedSearch,
  AnimatedUpload,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedClock,
  AnimatedDownload,
  AnimatedEye,
  AnimatedSlidersHorizontal,
  AnimatedX,
  AnimatedPlus,
} from "@/components/ui/animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import type { User, DocumentRecord } from "@/lib/types/database";
import { Select, TooltipWrapper } from "@/components/ui";

interface DocumentsClientProps {
  user: User;
}

export function DocumentsClient({ user }: DocumentsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Mock Document Records
  const mockDocuments: DocumentRecord[] = [
    {
      id: "doc-1",
      document_name: "Insurance Policy Certificate (2025-2026)",
      entity_type: "machine",
      entity_id: "mch-001",
      entity_label: "JCB-3DX-001 (Hydraulic Excavator)",
      document_type: "Insurance Certificate",
      file_url: "#",
      status: "expiring_soon",
      expiry_date: "2026-08-25",
      branch_id: "br-1",
      owner_id: user.id,
      created_at: "2025-08-25",
    },
    {
      id: "doc-2",
      document_name: "Third Party Fitness Certificate",
      entity_type: "machine",
      entity_id: "mch-002",
      entity_label: "CAT-320D Excavator",
      document_type: "Fitness Certificate",
      file_url: "#",
      status: "valid",
      expiry_date: "2027-01-15",
      branch_id: "br-1",
      owner_id: user.id,
      created_at: "2026-01-15",
    },
    {
      id: "doc-3",
      document_name: "Master Service Agreement & GST Tax Invoice",
      entity_type: "client",
      entity_id: "cli-101",
      entity_label: "ABC Infrastructure Pvt Ltd",
      document_type: "Service Agreement",
      file_url: "#",
      status: "valid",
      expiry_date: "2027-04-01",
      branch_id: "br-2",
      owner_id: user.id,
      created_at: "2026-04-01",
    },
    {
      id: "doc-4",
      document_name: "OEM Authorized Vendor Dealership License",
      entity_type: "vendor",
      entity_id: "ven-201",
      entity_label: "JCB India Ltd",
      document_type: "Vendor License",
      file_url: "#",
      status: "expired",
      expiry_date: "2026-08-01",
      branch_id: "br-1",
      owner_id: user.id,
      created_at: "2024-08-01",
    },
    {
      id: "doc-5",
      document_name: "Employee Identity & Driving License",
      entity_type: "hr",
      entity_id: "emp-301",
      entity_label: "Amit Kumar (Senior Service Engineer)",
      document_type: "KYC / ID Proof",
      file_url: "#",
      status: "valid",
      expiry_date: null,
      branch_id: "br-1",
      owner_id: user.id,
      created_at: "2025-03-10",
    },
    {
      id: "doc-6",
      document_name: "Purchase Order Receipt & Inspection Report",
      entity_type: "po",
      entity_id: "po-401",
      entity_label: "PO-2026-0045 (Spare Cylinders)",
      document_type: "Purchase Invoice",
      file_url: "#",
      status: "pending_approval",
      expiry_date: null,
      branch_id: "br-1",
      owner_id: user.id,
      created_at: "2026-08-10",
    },
  ];

  const filteredDocuments = useMemo(() => {
    return mockDocuments.filter((doc) => {
      const matchesSearch =
        doc.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.entity_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.document_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesEntity = selectedEntity === "all" || doc.entity_type === selectedEntity;
      const matchesStatus = selectedStatus === "all" || doc.status === selectedStatus;

      return matchesSearch && matchesEntity && matchesStatus;
    });
  }, [mockDocuments, searchQuery, selectedEntity, selectedStatus]);

  const stats = {
    total: 8421,
    valid: 8102,
    expiringSoon: 214,
    expired: 32,
    pendingApproval: 51,
    missingRequired: 22,
  };

  return (
    <div className="w-full space-y-6 max-w-[1400px] mx-auto">
      {/* HEADER & UPLOAD ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 mb-2">
            <AnimatedFileText size={14} />
            Central Smart Document Vault
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Documents Repository
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            Access, track expiring certificates, and manage entity-linked compliance records
          </p>
        </div>

        <button
          type="button"
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          <AnimatedUpload size={16} />
          <span>Upload Document</span>
        </button>
      </div>

      {/* DOCUMENT HEALTH SCORECARD DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-center">
          <p className="text-[11px] font-bold text-[var(--color-mute)] uppercase">Total</p>
          <p className="text-xl font-extrabold text-[var(--color-ink)] mt-0.5">{stats.total.toLocaleString()}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center">
          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Valid 🟢</p>
          <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">{stats.valid.toLocaleString()}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">Expiring &lt;30d 🟡</p>
          <p className="text-xl font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">{stats.expiringSoon}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase">Expired 🔴</p>
          <p className="text-xl font-extrabold text-red-700 dark:text-red-400 mt-0.5">{stats.expired}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-center">
          <p className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase">Pending 🟠</p>
          <p className="text-xl font-extrabold text-sky-700 dark:text-sky-400 mt-0.5">{stats.pendingApproval}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-center">
          <p className="text-[11px] font-bold text-[var(--color-mute)] uppercase">Missing ⚪</p>
          <p className="text-xl font-extrabold text-[var(--color-mute)] mt-0.5">{stats.missingRequired}</p>
        </div>
      </div>

      {/* FILTER TOOLBAR & ENTITY TABS */}
      <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 flex items-center">
            <AnimatedSearch size={16} className="absolute left-3 text-[var(--color-mute)]" />
            <input
              type="text"
              placeholder="Search by document name, entity label, or certificate type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: "all", label: "All Document Statuses" },
              { value: "valid", label: "Valid (🟢)" },
              { value: "expiring_soon", label: "Expiring Soon (🟡)" },
              { value: "expired", label: "Expired (🔴)" },
              { value: "pending_approval", label: "Pending Approval (🟠)" },
            ]}
          />
        </div>

        {/* Entity Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-[var(--color-hairline)] pt-3">
          {[
            { id: "all", label: "All Entities" },
            { id: "machine", label: "🚜 Machines" },
            { id: "client", label: "👥 Clients" },
            { id: "vendor", label: "🏢 Vendors" },
            { id: "hr", label: "👥 HR & Staff" },
            { id: "po", label: "📋 Purchase Orders" },
            { id: "challan", label: "🚚 Delivery Challans" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedEntity(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedEntity === tab.id
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* DOCUMENTS LISTING TABLE */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-4">Document Name</th>
                <th className="py-3 px-4">Associated Entity</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                  <td className="py-3 px-4 font-bold text-[var(--color-ink)]">
                    <div className="flex items-center gap-2">
                      <AnimatedFileText size={16} className="text-sky-500 shrink-0" />
                      <span className="truncate max-w-xs">{doc.document_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--color-body)] font-medium">
                    {doc.entity_label}
                  </td>
                  <td className="py-3 px-4 text-[var(--color-mute)] font-medium">
                    {doc.document_type}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[var(--color-ink)]">
                    {doc.expiry_date ? doc.expiry_date : "N/A (Permanent)"}
                  </td>
                  <td className="py-3 px-4">
                    {doc.status === "valid" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        <AnimatedCheckCircle size={12} />
                        Valid
                      </span>
                    )}
                    {doc.status === "expiring_soon" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300">
                        <AnimatedClock size={12} />
                        Expiring Soon
                      </span>
                    )}
                    {doc.status === "expired" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300">
                        <AnimatedAlertTriangle size={12} />
                        Expired
                      </span>
                    )}
                    {doc.status === "pending_approval" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300">
                        <AnimatedClock size={12} />
                        Pending Approval
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TooltipWrapper content="View Document" side="top">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-sky-600 hover:bg-sky-500/10 transition-colors cursor-pointer"
                          aria-label="View Document"
                        >
                          <AnimatedEye size={14} />
                        </button>
                      </TooltipWrapper>
                      <TooltipWrapper content="Download Document" side="top">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          aria-label="Download Document"
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
