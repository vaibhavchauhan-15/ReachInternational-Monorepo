"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EquipmentEnquiry } from "@reachinternational/types";
import { updateEnquiryStatusAction } from "@/app/actions/equipment";

interface EquipmentEnquiriesTableClientProps {
  enquiries: (EquipmentEnquiry & { equipment?: any })[];
  total: number;
  currentStatus: string;
}

export function EquipmentEnquiriesTableClient({
  enquiries,
  total,
  currentStatus,
}: EquipmentEnquiriesTableClientProps) {
  const router = useRouter();
  const [selectedEnquiry, setSelectedEnquiry] = useState<
    (EquipmentEnquiry & { equipment?: any }) | null
  >(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const statusTabs = [
    { key: "all", label: "All Enquiries" },
    { key: "new", label: "New (Uncontacted)" },
    { key: "contacted", label: "Contacted" },
    { key: "quoted", label: "Quoted" },
    { key: "closed", label: "Closed / Won" },
    { key: "rejected", label: "Rejected" },
  ];

  async function handleStatusChange(enquiryId: string, newStatus: any) {
    setIsUpdating(true);
    await updateEnquiryStatusAction({ id: enquiryId, status: newStatus });
    if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
      setSelectedEnquiry({ ...selectedEnquiry, status: newStatus });
    }
    setIsUpdating(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl overflow-x-auto w-fit">
        {statusTabs.map((tab) => {
          const isActive = currentStatus === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/marketing/equipment/enquiries${
                tab.key === "all" ? "" : `?status=${tab.key}`
              }`}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 select-none",
                isActive
                  ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] font-semibold">
                <th className="py-3 px-4">Customer & Company</th>
                <th className="py-3 px-4">Contact Details</th>
                <th className="py-3 px-4">Interested Machine</th>
                <th className="py-3 px-4">Requirement</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date Received</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {enquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--color-mute)]">
                    <p className="font-semibold text-sm mb-1 text-[var(--color-ink)]">
                      No customer enquiries found
                    </p>
                    <p className="text-xs">
                      Enquiries submitted through the public equipment catalogue will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                enquiries.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--color-hairline-soft-surface)]/60 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-bold text-[var(--color-ink)] block">
                        {item.customer_name}
                      </span>
                      {item.company_name && (
                        <span className="text-[11px] text-[var(--color-mute)] block">
                          {item.company_name}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <a
                          href={`tel:${item.phone}`}
                          className="flex items-center gap-1.5 text-sky-600 hover:underline font-mono"
                        >
                          <Phone size={11} />
                          <span>{item.phone}</span>
                        </a>
                        <a
                          href={`mailto:${item.email}`}
                          className="flex items-center gap-1.5 text-[var(--color-mute)] hover:underline"
                        >
                          <Mail size={11} />
                          <span>{item.email}</span>
                        </a>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {item.equipment ? (
                        <span className="font-semibold text-[var(--color-ink)] block">
                          {item.equipment.model_name}
                        </span>
                      ) : (
                        <span className="text-[var(--color-mute)] italic">General Fleet Enquiry</span>
                      )}
                      <span className="text-[11px] text-[var(--color-mute)] flex items-center gap-1">
                        <MapPin size={10} />
                        {item.project_location}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)]">
                        {item.requirement_type}
                      </span>
                      {item.rental_duration && (
                        <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
                          Duration: {item.rental_duration}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          item.status === "new" &&
                            "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                          item.status === "contacted" &&
                            "bg-blue-500/10 text-blue-600 border-blue-500/20",
                          item.status === "quoted" &&
                            "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          item.status === "closed" &&
                            "bg-neutral-500/10 text-neutral-600 border-neutral-500/20",
                          item.status === "rejected" &&
                            "bg-red-500/10 text-red-600 border-red-500/20"
                        )}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-[var(--color-mute)]">
                      {new Date(item.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedEnquiry(item)}
                        className="px-2.5 py-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Drawer / Modal */}
      {selectedEnquiry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline)]">
              <div>
                <h3 className="text-base font-bold text-[var(--color-ink)]">
                  Customer Enquiry Details
                </h3>
                <p className="text-xs text-[var(--color-mute)]">
                  Received on {new Date(selectedEnquiry.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEnquiry(null)}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <div>
                  <span className="text-[var(--color-mute)] block">Customer Name</span>
                  <span className="font-bold text-[var(--color-ink)]">{selectedEnquiry.customer_name}</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">Company</span>
                  <span className="font-bold text-[var(--color-ink)]">{selectedEnquiry.company_name || "–"}</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">Phone Number</span>
                  <a href={`tel:${selectedEnquiry.phone}`} className="font-bold text-sky-600 hover:underline">
                    {selectedEnquiry.phone}
                  </a>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">Email</span>
                  <a href={`mailto:${selectedEnquiry.email}`} className="font-bold text-sky-600 hover:underline">
                    {selectedEnquiry.email}
                  </a>
                </div>
              </div>

              <div>
                <span className="text-[var(--color-mute)] block mb-1">Target Equipment</span>
                <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] font-semibold text-[var(--color-ink)]">
                  {selectedEnquiry.equipment ? selectedEnquiry.equipment.model_name : "General Enquiry"}
                  <span className="text-[var(--color-mute)] font-normal block text-[11px] mt-0.5">
                    Location: {selectedEnquiry.project_location} • Requirement: {selectedEnquiry.requirement_type.toUpperCase()}
                  </span>
                </div>
              </div>

              {selectedEnquiry.additional_requirements && (
                <div>
                  <span className="text-[var(--color-mute)] block mb-1">Customer Requirements Message</span>
                  <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)] leading-relaxed">
                    {selectedEnquiry.additional_requirements}
                  </div>
                </div>
              )}

              {/* Status Update Strip */}
              <div className="pt-2">
                <span className="text-xs font-bold text-[var(--color-ink)] block mb-2">
                  Update Lead Status
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(["new", "contacted", "quoted", "closed", "rejected"] as const).map((s) => (
                    <button
                      key={s}
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(selectedEnquiry.id, s)}
                      className={cn(
                        "py-1.5 rounded-lg text-center font-bold text-[10px] uppercase border transition-all",
                        selectedEnquiry.status === s
                          ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                          : "bg-[var(--color-canvas)] text-[var(--color-mute)] border-[var(--color-hairline)] hover:text-[var(--color-ink)]"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
