"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RfqDetail, SalesUserOption } from "@/lib/queries/rfq";
import { formatPaiseToInr } from "@/lib/rfq/money";
import {
  updateRfqStatusAction,
  assignRfqAction,
  addRfqNoteAction,
  logRfqContactAction,
  setRfqFollowUpAction,
  reopenRfqAction,
  createQuotationVersionAction,
  saveQuotationDraftAction,
  sendQuotationAction,
} from "@/app/actions/rfq";
import {
  FileText,
  User,
  Building2,
  Calendar,
  MapPin,
  Clock,
  Phone,
  Mail,
  Send,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  MessageSquare,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  Trash2,
  DollarSign,
} from "lucide-react";

interface RfqDetailClientProps {
  rfq: RfqDetail;
  salesUsers: SalesUserOption[];
  currentRole: string;
}

export function RfqDetailClient({
  rfq,
  salesUsers,
  currentRole,
}: RfqDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modals & Panels
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState(rfq.status);
  const [lostReason, setLostReason] = useState<string>("price");
  const [statusNote, setStatusNote] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(rfq.assigned_to || "");

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(
    rfq.follow_up_at ? rfq.follow_up_at.substring(0, 16) : ""
  );

  // Note & Contact inputs
  const [noteText, setNoteText] = useState("");
  const [contactChannel, setContactChannel] = useState<"phone" | "whatsapp" | "email" | "meeting">("phone");
  const [contactSummary, setContactSummary] = useState("");

  // Quotation Editor State (for current draft version if exists)
  const activeQuotation = rfq.quotations[0] || null;
  const isDraft = activeQuotation?.status === "draft";

  const [quoteItems, setQuoteItems] = useState(
    activeQuotation
      ? activeQuotation.items.map((i) => ({
          id: i.id,
          kind: i.kind,
          description: i.description,
          hsn_sac: i.hsn_sac || "997311",
          quantity: i.quantity,
          unit_price_paise: i.unit_price_paise,
          unit_price_rupees: i.unit_price_paise / 100,
          rate_unit: i.rate_unit || "month",
          duration_value: i.duration_value || 1,
          discount_pct: i.discount_pct || 0,
          gst_rate: Number(i.gst_rate ?? 18),
          sort_order: i.sort_order,
        }))
      : []
  );

  const [actionError, setActionError] = useState<string | null>(null);

  // Status Update Handler
  const handleUpdateStatus = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await updateRfqStatusAction({
        id: rfq.id,
        to_status: targetStatus as any,
        expected_version: rfq.version,
        lost_reason: targetStatus === "lost" ? (lostReason as any) : undefined,
        note: statusNote.trim() || undefined,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to update status");
        return;
      }
      setShowStatusModal(false);
      router.refresh();
    });
  };

  // Assign Handler
  const handleAssign = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await assignRfqAction({
        id: rfq.id,
        assigned_to: selectedAssignee || null,
        expected_version: rfq.version,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to assign RFQ");
        return;
      }
      setShowAssignModal(false);
      router.refresh();
    });
  };

  // Follow-Up Handler
  const handleSetFollowUp = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await setRfqFollowUpAction({
        id: rfq.id,
        follow_up_at: followUpDate ? new Date(followUpDate).toISOString() : new Date().toISOString(),
      });

      if (!res.success) {
        setActionError(res.error || "Failed to set follow up");
        return;
      }
      setShowFollowUpModal(false);
      router.refresh();
    });
  };

  // Reopen Handler (Admin only)
  const handleReopen = () => {
    if (!confirm("Are you sure you want to reopen this closed RFQ?")) return;
    setActionError(null);
    startTransition(async () => {
      const res = await reopenRfqAction(rfq.id);
      if (!res.success) {
        setActionError(res.error || "Failed to reopen RFQ");
        return;
      }
      router.refresh();
    });
  };

  // Add Note Handler
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setActionError(null);
    startTransition(async () => {
      const res = await addRfqNoteAction({
        id: rfq.id,
        text: noteText.trim(),
      });
      if (!res.success) {
        setActionError(res.error || "Failed to add note");
        return;
      }
      setNoteText("");
      router.refresh();
    });
  };

  // Log Contact Handler
  const handleLogContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSummary.trim()) return;
    setActionError(null);
    startTransition(async () => {
      const res = await logRfqContactAction({
        id: rfq.id,
        channel: contactChannel,
        summary: contactSummary.trim(),
      });
      if (!res.success) {
        setActionError(res.error || "Failed to log contact");
        return;
      }
      setContactSummary("");
      router.refresh();
    });
  };

  // Create Quotation Version Handler
  const handleCreateQuotation = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await createQuotationVersionAction(rfq.id);
      if (!res.success) {
        setActionError(res.error || "Failed to create quotation");
        return;
      }
      router.refresh();
    });
  };

  // Save Quotation Draft Handler
  const handleSaveQuotationDraft = () => {
    if (!activeQuotation) return;
    setActionError(null);
    startTransition(async () => {
      const res = await saveQuotationDraftAction({
        quotation_id: activeQuotation.id,
        rfq_id: rfq.id,
        valid_until: activeQuotation.valid_until,
        place_of_supply_state: activeQuotation.place_of_supply_state,
        notes_to_client: activeQuotation.notes_to_client,
        terms_md: activeQuotation.terms_md,
        items: quoteItems.map((item, idx) => ({
          id: item.id,
          kind: item.kind as any,
          description: item.description,
          hsn_sac: item.hsn_sac,
          quantity: item.quantity,
          unit_price_paise: Math.round(item.unit_price_rupees * 100),
          rate_unit: item.rate_unit as any,
          duration_value: item.duration_value,
          discount_pct: item.discount_pct,
          gst_rate: item.gst_rate,
          sort_order: idx,
        })),
      });

      if (!res.success) {
        setActionError(res.error || "Failed to save quotation");
        return;
      }
      router.refresh();
    });
  };

  // Send Quotation Handler
  const handleSendQuotation = () => {
    if (!activeQuotation) return;
    if (
      !confirm(
        `Send quotation version ${activeQuotation.version} to ${rfq.contact.email}? This locks the quotation and emails the client.`
      )
    )
      return;

    setActionError(null);
    startTransition(async () => {
      const res = await sendQuotationAction(activeQuotation.id, rfq.id);
      if (!res.success) {
        setActionError(res.error || "Failed to send quotation");
        return;
      }
      router.refresh();
    });
  };

  const isClosed = ["converted", "lost", "spam"].includes(rfq.status);

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sales/rfq"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {rfq.rfq_number}
              </h1>
              <span className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                {rfq.status.replace("_", " ")}
              </span>
              <span className="text-xs text-neutral-400">v{rfq.version}</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Logged on {new Date(rfq.created_at).toLocaleString("en-IN")} via {rfq.source}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!isClosed ? (
            <>
              <button
                onClick={() => setShowStatusModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
              >
                Change Status
              </button>
              <button
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
              >
                <User className="h-3.5 w-3.5 text-neutral-400" />
                <span>{rfq.assigned_user?.full_name || "Assign"}</span>
              </button>
              <button
                onClick={() => setShowFollowUpModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
              >
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                <span>
                  {rfq.follow_up_at
                    ? new Date(rfq.follow_up_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    : "Set Follow-Up"}
                </span>
              </button>
            </>
          ) : (
            ["super_admin", "admin"].includes(currentRole) && (
              <button
                onClick={handleReopen}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reopen RFQ
              </button>
            )
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-xs dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {actionError}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Request Specifications, Client, Site, Attachments (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Client & Company Card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Client & Organization Details
                </h3>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-[11px] text-neutral-400">Primary Contact Person</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {rfq.contact.full_name}
                </p>
              </div>

              <div>
                <span className="text-[11px] text-neutral-400">Company Name</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {rfq.company?.name || "Direct Client / Individual"}
                </p>
                {rfq.company?.gstin && (
                  <p className="font-mono text-neutral-500">GST: {rfq.company.gstin}</p>
                )}
              </div>

              <div>
                <span className="text-[11px] text-neutral-400">Email Address</span>
                <p className="font-medium">
                  <a
                    href={`mailto:${rfq.contact.email}`}
                    className="text-sky-600 hover:underline dark:text-sky-400"
                  >
                    {rfq.contact.email}
                  </a>
                </p>
              </div>

              <div>
                <span className="text-[11px] text-neutral-400">Phone / Mobile</span>
                <p className="font-medium">
                  <a
                    href={`tel:${rfq.contact.phone}`}
                    className="text-sky-600 hover:underline dark:text-sky-400"
                  >
                    {rfq.contact.phone}
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Requested Machines Card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Requested Machinery ({rfq.items.length})
                </h3>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {rfq.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-3.5 text-xs dark:border-neutral-800 dark:bg-neutral-950/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">
                        {item.equipment?.model_name ||
                          item.category?.name ||
                          item.custom_description ||
                          "Custom Equipment"}
                      </span>
                      {item.equipment?.model_number && (
                        <span className="ml-2 font-mono text-[11px] text-neutral-400">
                          [{item.equipment.model_number}]
                        </span>
                      )}
                    </div>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                      {item.requirement_type}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-neutral-600 dark:text-neutral-400">
                    <span>
                      Qty: <strong className="text-neutral-900 dark:text-white">{item.quantity}</strong> unit(s)
                    </span>
                    {item.duration_value && (
                      <span>
                        Duration:{" "}
                        <strong className="text-neutral-900 dark:text-white">
                          {item.duration_value} {item.duration_unit}(s)
                        </strong>
                      </span>
                    )}
                    {item.min_height_m && <span>Min Height: {item.min_height_m}m</span>}
                    {item.min_capacity_kg && <span>Min Capacity: {item.min_capacity_kg}kg</span>}
                  </div>

                  {item.notes && (
                    <p className="mt-2 text-[11px] italic text-neutral-500">
                      Note: {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Site & Execution Card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <MapPin className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Site Location & Schedule
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-[11px] text-neutral-400">Deployment Location</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {rfq.project_city}, State Code: {rfq.project_state_code}
                </p>
                {rfq.project_site_address && (
                  <p className="text-neutral-500">{rfq.project_site_address}</p>
                )}
              </div>

              <div>
                <span className="text-[11px] text-neutral-400">Mobilization Required By</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {rfq.required_from
                    ? new Date(rfq.required_from).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Immediate / As soon as available"}
                </p>
              </div>

              {rfq.client_notes && (
                <div className="sm:col-span-2">
                  <span className="text-[11px] text-neutral-400">Technical & Terrain Notes</span>
                  <p className="mt-1 rounded-md bg-neutral-50 p-2 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                    {rfq.client_notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <Download className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Client Uploaded Attachments ({rfq.attachments.length})
              </h3>
            </div>

            {rfq.attachments.length === 0 ? (
              <p className="mt-4 text-xs italic text-neutral-400">
                No files uploaded with this quote request.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {rfq.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/50 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-950/40"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                        {att.original_name}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        ({Math.round(att.size_bytes / 1024)} KB)
                      </span>
                    </div>

                    <a
                      href={`/api/rfq/download?path=${encodeURIComponent(att.storage_path)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Quotation Editor & Event Timeline (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Quotations & Pricing Drafts */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Quotations & Commercial Pricing
                </h3>
              </div>

              {!isClosed && (
                <button
                  type="button"
                  onClick={handleCreateQuotation}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
                >
                  <Plus className="h-3 w-3" />
                  {rfq.quotations.length > 0 ? "New Revision" : "Draft Quotation"}
                </button>
              )}
            </div>

            {rfq.quotations.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <p>No quotation drafted yet for this RFQ.</p>
                <p className="mt-1">
                  Click &quot;Draft Quotation&quot; to generate an initial pricing breakdown from the requested machines.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Quotation Version Tabs */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    Quote #{rfq.rfq_number}-Q{activeQuotation?.version}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      activeQuotation?.status === "sent"
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                        : activeQuotation?.status === "draft"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                    }`}
                  >
                    {activeQuotation?.status}
                  </span>
                </div>

                {/* Draft Line Items */}
                <div className="space-y-3">
                  {quoteItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950/40"
                    >
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {item.description}
                      </div>

                      {isDraft ? (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-neutral-400">Rate (INR / {item.rate_unit})</label>
                            <input
                              type="number"
                              min={0}
                              value={item.unit_price_rupees}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setQuoteItems((prev) => {
                                  const copy = [...prev];
                                  copy[idx].unit_price_rupees = val;
                                  return copy;
                                });
                              }}
                              className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                            />
                          </div>

                          <div>
                            <label className="text-neutral-400">Quantity</label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setQuoteItems((prev) => {
                                  const copy = [...prev];
                                  copy[idx].quantity = val;
                                  return copy;
                                });
                              }}
                              className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {item.quantity} unit(s) × ₹{item.unit_price_paise / 100} / {item.rate_unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quotation Summary Totals */}
                <div className="border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
                  <div className="flex justify-between text-neutral-500">
                    <span>Subtotal:</span>
                    <span>₹{formatPaiseToInr(activeQuotation?.subtotal_paise || 0)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-500">
                    <span>GST (18%):</span>
                    <span>₹{formatPaiseToInr(activeQuotation?.tax_paise || 0)}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-bold text-neutral-900 dark:text-neutral-100">
                    <span>Grand Total:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ₹{formatPaiseToInr(activeQuotation?.total_paise || 0)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons for Quotation */}
                {isDraft && (
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveQuotationDraft}
                      disabled={isPending}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={handleSendQuotation}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-sky-500"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send to Client
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline & Activity Feed */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Timeline & Activity History ({rfq.events.length})
              </h3>
            </div>

            {/* Quick Note Input */}
            <form onSubmit={handleAddNote} className="mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add internal note for sales desk..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                />
                <button
                  type="submit"
                  disabled={isPending || !noteText.trim()}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </form>

            {/* Quick Contact Log */}
            <form onSubmit={handleLogContact} className="mt-2 flex gap-2">
              <select
                value={contactChannel}
                onChange={(e) => setContactChannel(e.target.value as any)}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950"
              >
                <option value="phone">Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
              </select>
              <input
                type="text"
                placeholder="Log discussion summary..."
                value={contactSummary}
                onChange={(e) => setContactSummary(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950"
              />
              <button
                type="submit"
                disabled={isPending || !contactSummary.trim()}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 disabled:opacity-50"
              >
                Log
              </button>
            </form>

            {/* Event List */}
            <div className="mt-5 space-y-3 max-h-[450px] overflow-y-auto pr-1 text-xs">
              {rfq.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 rounded-lg border border-neutral-100 bg-neutral-50/40 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-950/40"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    <span className="text-[10px] font-bold">
                      {ev.type.substring(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold capitalize text-neutral-800 dark:text-neutral-200">
                        {ev.type.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(ev.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
                      {(ev.data as any)?.text ||
                        (ev.data as any)?.summary ||
                        (ev.data as any)?.to_status ||
                        JSON.stringify(ev.data)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Change Status */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Change RFQ Status
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1">Target Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <option value="under_review">Under Review</option>
                  <option value="contacted">Contacted</option>
                  <option value="quotation_prepared">Quotation Prepared</option>
                  <option value="quotation_sent">Quotation Sent</option>
                  <option value="on_hold">On Hold</option>
                  <option value="converted">Won / Converted</option>
                  <option value="lost">Lost</option>
                  <option value="spam">Spam</option>
                </select>
              </div>

              {targetStatus === "lost" && (
                <div>
                  <label className="block text-neutral-500 mb-1">Lost Reason</label>
                  <select
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <option value="price">High Price</option>
                    <option value="availability">Machine Unavailable</option>
                    <option value="competitor">Chosen Competitor</option>
                    <option value="no_response">Client No Response</option>
                    <option value="project_cancelled">Project Cancelled</option>
                    <option value="not_serviceable">Location Not Serviceable</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-neutral-500 mb-1">Reason / Note</label>
                <textarea
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional transition note..."
                  className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={isPending}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Save Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign Staff */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Assign Sales Representative
            </h3>
            <div className="mt-4 text-xs">
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <option value="">Unassigned</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={isPending}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Set Follow-Up */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Set Next Follow-Up Date & Time
            </h3>
            <div className="mt-4 text-xs">
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSetFollowUp}
                disabled={isPending}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Save Follow-Up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
