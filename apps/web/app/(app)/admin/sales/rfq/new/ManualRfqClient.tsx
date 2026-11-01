"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SlimEquipment } from "@/lib/queries/rfq";
import { INDIAN_STATES } from "@/lib/rfq/states";
import { createManualRfqAction } from "@/app/actions/rfq";
import {
  Phone,
  Building2,
  User,
  Mail,
  MapPin,
  Calendar,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";

interface ManualRfqClientProps {
  equipmentList: SlimEquipment[];
  categories: { id: string; name: string }[];
}

export function ManualRfqClient({ equipmentList, categories }: ManualRfqClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [source, setSource] = useState<"phone" | "whatsapp" | "email" | "walk_in" | "referral">("phone");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [projectCity, setProjectCity] = useState("");
  const [projectStateCode, setProjectStateCode] = useState("MH");
  const [projectSiteAddress, setProjectSiteAddress] = useState("");
  const [requiredFrom, setRequiredFrom] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  const [items, setItems] = useState([
    {
      requirement_type: "rental" as "rental" | "purchase",
      equipment_id: "",
      category_id: "",
      custom_description: "",
      quantity: 1,
      duration_value: 1,
      duration_unit: "month" as "day" | "week" | "month",
      notes: "",
    },
  ]);

  const [formError, setFormError] = useState<string | null>(null);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        requirement_type: "rental",
        equipment_id: "",
        category_id: "",
        custom_description: "",
        quantity: 1,
        duration_value: 1,
        duration_unit: "month",
        notes: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const payload = {
        source,
        full_name: contactName.trim(),
        email: contactEmail.trim().toLowerCase(),
        phone: contactPhone.trim(),
        company_name: companyName.trim() || contactName.trim(),
        project_city: projectCity.trim(),
        project_state_code: projectStateCode,
        project_site_address: projectSiteAddress.trim() || undefined,
        required_from: requiredFrom || undefined,
        client_notes: clientNotes.trim() || undefined,
        consent: true,
        items: items.map((it, idx) => ({
          requirement_type: it.requirement_type,
          equipment_id: it.equipment_id || undefined,
          category_id: it.category_id || undefined,
          custom_description: it.custom_description || undefined,
          quantity: it.quantity,
          duration_value: it.duration_value || undefined,
          duration_unit: it.duration_unit || undefined,
          notes: it.notes || undefined,
          sort_order: idx,
        })),
        attachments: [],
      };

      const res = await createManualRfqAction(payload);
      if (!res.success) {
        setFormError(res.error || "Failed to create manual RFQ.");
        return;
      }

      router.push(`/admin/sales/rfq/${res.rfq_id}`);
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/sales/rfq"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Log New Manual RFQ / Enquiry
          </h1>
          <p className="text-xs text-neutral-500">
            Record direct phone calls, WhatsApp inquiries, walk-ins, and verbal enquiries.
          </p>
        </div>
      </div>

      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-xs dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-4 w-4" />
            <span>Submission Error</span>
          </div>
          <p className="mt-1">{formError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source & Channel */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-3">
            Enquiry Intake Source
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
            {[
              { id: "phone", label: "Phone Call" },
              { id: "whatsapp", label: "WhatsApp" },
              { id: "email", label: "Direct Email" },
              { id: "walk_in", label: "Walk-in" },
              { id: "referral", label: "Referral" },
            ].map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => setSource(src.id as any)}
                className={`rounded-lg border p-2.5 font-medium transition-all ${
                  source === src.id
                    ? "border-sky-500 bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950/50 dark:text-sky-300"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>
        </div>

        {/* Client & Company */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4">
            Client & Contact Details
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="block text-neutral-500 mb-1">Contact Name *</label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Anand Verma"
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Company / Organization</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Shapoorji Pallonji"
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Mobile Number (+91) *</label>
              <input
                type="tel"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="anand@company.com"
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>
          </div>
        </div>

        {/* Location & Schedule */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4">
            Site Location & Project Schedule
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div>
              <label className="block text-neutral-500 mb-1">Deployment City *</label>
              <input
                type="text"
                required
                value={projectCity}
                onChange={(e) => setProjectCity(e.target.value)}
                placeholder="e.g. Pune"
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Deployment State *</label>
              <select
                value={projectStateCode}
                onChange={(e) => setProjectStateCode(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} ({st.gst_state_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Required Mobilization Date</label>
              <input
                type="date"
                value={requiredFrom}
                onChange={(e) => setRequiredFrom(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-neutral-500 mb-1">Notes / Operating Context</label>
              <textarea
                rows={2}
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Details discussed during phone call / enquiry..."
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>
          </div>
        </div>

        {/* Machinery Items */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Machinery Items ({items.length})
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
            >
              <Plus className="h-3 w-3" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950/40"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    Item #{idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-neutral-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-neutral-500 mb-1">Equipment Selection</label>
                    <select
                      value={it.equipment_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) => {
                          const copy = [...prev];
                          copy[idx].equipment_id = val;
                          return copy;
                        });
                      }}
                      className="w-full rounded-md border border-neutral-200 p-1.5 dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <option value="">-- Select Model or General Requirement --</option>
                      {equipmentList.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name} ({eq.category_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-500 mb-1">Requirement</label>
                    <select
                      value={it.requirement_type}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setItems((prev) => {
                          const copy = [...prev];
                          copy[idx].requirement_type = val;
                          return copy;
                        });
                      }}
                      className="w-full rounded-md border border-neutral-200 p-1.5 dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <option value="rental">Rental</option>
                      <option value="purchase">Sale</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-500 mb-1">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setItems((prev) => {
                          const copy = [...prev];
                          copy[idx].quantity = val;
                          return copy;
                        });
                      }}
                      className="w-full rounded-md border border-neutral-200 p-1.5 dark:border-neutral-800 dark:bg-neutral-950"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-3">
          <Link
            href="/admin/sales/rfq"
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-sky-500 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save & Open RFQ
          </button>
        </div>
      </form>
    </div>
  );
}
