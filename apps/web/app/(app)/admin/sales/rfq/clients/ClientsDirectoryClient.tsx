"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CompanyWithRfqStats } from "@/lib/queries/rfq";
import { mergeCompanyAction } from "@/app/actions/rfq";
import {
  Building2,
  User,
  Search,
  Merge,
  ChevronLeft,
  Mail,
  Phone,
  FileText,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface ClientsDirectoryClientProps {
  companies: CompanyWithRfqStats[];
  currentRole: string;
}

export function ClientsDirectoryClient({
  companies,
  currentRole,
}: ClientsDirectoryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sourceCompanyId, setSourceCompanyId] = useState("");
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [mergeError, setMergeError] = useState<string | null>(null);

  const filteredCompanies = companies.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(term);
    const gstinMatch = c.gstin?.toLowerCase().includes(term);
    const cityMatch = c.city?.toLowerCase().includes(term);
    const contactMatch = c.primary_contact?.full_name?.toLowerCase().includes(term);
    return nameMatch || gstinMatch || cityMatch || contactMatch;
  });

  const handleMerge = () => {
    if (!sourceCompanyId || !targetCompanyId) {
      setMergeError("Please select both a source company and a target company.");
      return;
    }
    if (sourceCompanyId === targetCompanyId) {
      setMergeError("Source company and target company cannot be identical.");
      return;
    }

    setMergeError(null);
    startTransition(async () => {
      const res = await mergeCompanyAction(sourceCompanyId, targetCompanyId);
      if (!res.success) {
        setMergeError(res.error || "Failed to merge companies.");
        return;
      }
      setShowMergeModal(false);
      setSourceCompanyId("");
      setTargetCompanyId("");
      router.refresh();
    });
  };

  const isAdmin = ["super_admin", "admin"].includes(currentRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sales/rfq"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Client Companies & Accounts ({companies.length})
            </h1>
            <p className="text-xs text-neutral-500">
              Directory of client organizations and key contact stakeholders established via RFQs.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowMergeModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          >
            <Merge className="h-3.5 w-3.5 text-neutral-500" />
            Merge Duplicate Companies
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search companies by name, GSTIN, city, contact person..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 shadow-2xs focus:border-sky-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      {/* Company Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-neutral-400">
            No client companies found matching your search.
          </div>
        ) : (
          filteredCompanies.map((comp) => (
            <div
              key={comp.id}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                      {comp.name}
                    </h3>
                    <span className="text-[11px] text-neutral-400">
                      {comp.city || "Pan-India"} {comp.state_code ? `(${comp.state_code})` : ""}
                    </span>
                  </div>
                </div>

                <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {comp.rfq_count} RFQ{comp.rfq_count > 1 ? "s" : ""}
                </span>
              </div>

              {comp.gstin && (
                <div className="mt-3 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                  GSTIN: {comp.gstin}
                </div>
              )}

              {comp.primary_contact && (
                <div className="mt-3 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
                  <span className="text-[10px] font-medium uppercase text-neutral-400">
                    Key Contact
                  </span>
                  <div className="mt-1 font-medium text-neutral-800 dark:text-neutral-200">
                    {comp.primary_contact.full_name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                    {comp.primary_contact.email && <span>{comp.primary_contact.email}</span>}
                    {comp.primary_contact.phone && <span>{comp.primary_contact.phone}</span>}
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-neutral-100 pt-3 flex items-center justify-between text-[11px] text-neutral-400 dark:border-neutral-800">
                <span>
                  Last RFQ:{" "}
                  {comp.last_rfq_at
                    ? new Date(comp.last_rfq_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "None"}
                </span>
                <Link
                  href={`/admin/sales/rfq?search=${encodeURIComponent(comp.name)}`}
                  className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
                >
                  View RFQs →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Merge Companies */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Merge Duplicate Client Companies
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Consolidates contacts, quote requests, and quotations into a single target company record. The source duplicate company will be deleted.
            </p>

            {mergeError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {mergeError}
              </div>
            )}

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  1. Source Company (Duplicate to be deleted)
                </label>
                <select
                  value={sourceCompanyId}
                  onChange={(e) => setSourceCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <option value="">-- Select duplicate company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city || "No City"}, {c.rfq_count} RFQs)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  2. Target Company (Primary record to keep)
                </label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <option value="">-- Select target primary company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city || "No City"}, {c.rfq_count} RFQs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={isPending || !sourceCompanyId || !targetCompanyId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
