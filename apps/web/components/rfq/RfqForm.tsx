"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ItemCard, type RfqFormItem } from "./ItemCard";
import type { SlimEquipment } from "@/lib/queries/rfq";
import { INDIAN_STATES } from "@/lib/rfq/states";
import { submitRfqAction } from "@/app/actions/rfq";
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileUp,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  X,
} from "lucide-react";

interface UploadedAttachment {
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

interface RfqFormProps {
  equipmentList: SlimEquipment[];
  categories: { id: string; name: string }[];
  initialEquipmentId?: string;
  initialCategoryId?: string;
  initialType?: "rental" | "purchase";
}

export function RfqForm({
  equipmentList,
  categories,
  initialEquipmentId,
  initialCategoryId,
  initialType = "rental",
}: RfqFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Contact & Company State
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [projectCity, setProjectCity] = useState("");
  const [projectStateCode, setProjectStateCode] = useState("MH");
  const [projectSiteAddress, setProjectSiteAddress] = useState("");
  const [requiredFrom, setRequiredFrom] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  // Items State (multi-machine)
  const [items, setItems] = useState<RfqFormItem[]>([
    {
      id: "item-1",
      requirement_type: initialType,
      equipment_id: initialEquipmentId || null,
      category_id: initialCategoryId || null,
      quantity: 1,
      duration_value: initialType === "rental" ? 1 : null,
      duration_unit: initialType === "rental" ? "month" : null,
      notes: null,
    },
  ]);

  // Attachments State
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Consent & Form Errors
  const [consentGiven, setConsentGiven] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Machine Item Handlers
  const handleAddItem = () => {
    if (items.length >= 10) return;
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        requirement_type: "rental",
        equipment_id: null,
        category_id: null,
        quantity: 1,
        duration_value: 1,
        duration_unit: "month",
        notes: null,
      },
    ]);
  };

  const handleUpdateItem = (index: number, updated: RfqFormItem) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Direct Attachment Upload Handler via /api/rfq/session
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 5) {
      setUploadError("Maximum 5 file attachments permitted per quote request.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const fileMeta = Array.from(files).map((f) => ({
        filename: f.name,
        mime_type: f.type || "application/octet-stream",
        size_bytes: f.size,
      }));

      // 1. Request signed upload URLs
      const res = await fetch("/api/rfq/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileMeta }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to initialize upload session.");
      }

      const sessionData = await res.json();
      const uploadedList: UploadedAttachment[] = [];

      // 2. Upload each file directly to Supabase Storage via signed URL
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadInfo = sessionData.uploads[i];
        if (!uploadInfo) continue;

        const uploadRes = await fetch(uploadInfo.signed_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload "${file.name}".`);
        }

        uploadedList.push({
          storage_path: uploadInfo.storage_path,
          original_name: uploadInfo.original_name,
          mime_type: uploadInfo.mime_type,
          size_bytes: uploadInfo.size_bytes,
        });
      }

      setAttachments((prev) => [...prev, ...uploadedList]);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (storagePath: string) => {
    setAttachments((prev) => prev.filter((a) => a.storage_path !== storagePath));
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!consentGiven) {
      setFormError("Please accept the data processing terms to submit your quote request.");
      return;
    }

    // Validate at least one item has a model, category, or custom description
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.equipment_id && !it.category_id && !it.custom_description?.trim()) {
        setFormError(`Please select a machine model or enter specifications for Machine #${i + 1}.`);
        return;
      }
    }

    startTransition(async () => {
      const payload = {
        full_name: contactName.trim(),
        email: contactEmail.trim().toLowerCase(),
        phone: contactPhone.trim(),
        company_name: companyName.trim() || contactName.trim(),
        company_city: projectCity.trim() || undefined,
        company_state_code: projectStateCode,
        project_city: projectCity.trim(),
        project_state_code: projectStateCode,
        project_site_address: projectSiteAddress.trim() || undefined,
        required_from: requiredFrom || undefined,
        client_notes: clientNotes.trim() || undefined,
        source: "website" as const,
        consent: true,
        items: items.map((it, idx) => ({
          requirement_type: it.requirement_type,
          equipment_id: it.equipment_id || undefined,
          category_id: it.category_id || undefined,
          brand_id: it.brand_id || undefined,
          custom_description: it.custom_description || undefined,
          quantity: it.quantity,
          min_height_m: it.min_height_m || undefined,
          min_capacity_kg: it.min_capacity_kg || undefined,
          duration_value: it.duration_value || undefined,
          duration_unit: it.duration_unit || undefined,
          notes: it.notes || undefined,
          sort_order: idx,
        })),
        attachments: attachments.map((a) => ({
          storage_path: a.storage_path,
          original_name: a.original_name,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
        })),
        attribution: {
          referrer: typeof document !== "undefined" ? document.referrer : "",
          url: typeof window !== "undefined" ? window.location.href : "",
        },
      };

      const result = await submitRfqAction(payload);

      if (!result.success) {
        setFormError(result.error || "Failed to submit quote request. Please check your inputs.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        window.scrollTo({ top: 300, behavior: "smooth" });
        return;
      }

      // Success: redirect to thank-you page with RFQ reference number
      router.push(`/request-a-quote/thank-you?ref=${encodeURIComponent(result.rfq_number || "")}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Alert Error Box */}
      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-xs dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span>Submission Notice</span>
          </div>
          <p className="mt-1 text-red-800 dark:text-red-300/90">{formError}</p>
        </div>
      )}

      {/* SECTION 1: Contact & Company Details */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              1. Contact & Company Details
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Provide your details so our engineering desk can dispatch an official quotation.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
            {fieldErrors.contact_name && (
              <p className="mt-1 text-[11px] text-red-500">{fieldErrors.contact_name[0]}</p>
            )}
          </div>

          {/* Work Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Work Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
            {fieldErrors.contact_email && (
              <p className="mt-1 text-[11px] text-red-500">{fieldErrors.contact_email[0]}</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Mobile Number (+91) <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
            {fieldErrors.contact_phone && (
              <p className="mt-1 text-[11px] text-red-500">{fieldErrors.contact_phone[0]}</p>
            )}
          </div>

          {/* Company Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Company / Organization Name
            </label>
            <input
              type="text"
              placeholder="e.g. Larsen & Toubro / Tata Projects"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          {/* Job Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Designation / Role
            </label>
            <input
              type="text"
              placeholder="e.g. Project Manager / Plant Engineer"
              value={contactJobTitle}
              onChange={(e) => setContactJobTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          {/* Project State */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Deployment State <span className="text-red-500">*</span>
            </label>
            <select
              value={projectStateCode}
              onChange={(e) => setProjectStateCode(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} (GST: {st.gst_state_code})
                </option>
              ))}
            </select>
          </div>

          {/* Project City */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Deployment City / Industrial Hub <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Navi Mumbai / Chakan / Sanand"
              value={projectCity}
              onChange={(e) => setProjectCity(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
            {fieldErrors.project_city && (
              <p className="mt-1 text-[11px] text-red-500">{fieldErrors.project_city[0]}</p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Equipment Requirements (Multi-Machine) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                2. Equipment & Machinery Required
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Add one or more access platforms, boom lifts, or industrial forklifts to your quotation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            disabled={items.length >= 10}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-2xs hover:bg-neutral-100 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-white dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Another Machine
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {items.map((it, idx) => (
            <ItemCard
              key={it.id}
              index={idx}
              item={it}
              equipmentList={equipmentList}
              categories={categories}
              canRemove={items.length > 1}
              onChange={(updated) => handleUpdateItem(idx, updated)}
              onRemove={() => handleRemoveItem(idx)}
            />
          ))}
        </div>
      </div>

      {/* SECTION 3: Project & Site Execution */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              3. Project Site & Schedule Requirements
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Specify delivery location, site operating conditions, and upload project layout / BOQ drawings.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Site Address / Landmark */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Exact Site Location / Industrial Area / Landmark
            </label>
            <input
              type="text"
              placeholder="e.g. Plot No. 42, MIDC Industrial Area, Phase II"
              value={projectSiteAddress}
              onChange={(e) => setProjectSiteAddress(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          {/* Required From Date */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Expected Machine Mobilization Date
            </label>
            <input
              type="date"
              value={requiredFrom}
              onChange={(e) => setRequiredFrom(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          {/* Client Notes / Operating Conditions */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Site Conditions & Technical Requirements
            </label>
            <textarea
              rows={3}
              placeholder="Mention ground surface (concrete, slab, gravel), slab load limits, indoor/outdoor usage, non-marking tyre needs, or power availability for charging."
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          {/* File Upload Zone */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Upload Site Layout / BOQ / RFQ Documents (Optional, up to 5 files, 10MB each)
            </label>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-5 text-center dark:border-neutral-700 dark:bg-neutral-950/40">
              <FileUp className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
              <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                <label className="cursor-pointer font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400">
                  <span>Browse files</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                    onChange={handleFileUpload}
                    disabled={isUploading || attachments.length >= 5}
                    className="sr-only"
                  />
                </label>{" "}
                or drag & drop
              </div>
              <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                Supported formats: PDF, JPG, PNG, DOCX, XLSX (Max 10MB per file)
              </p>
            </div>

            {uploadError && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400">{uploadError}</p>
            )}

            {isUploading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading documents to secure storage...</span>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.storage_path}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                        {att.original_name}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        ({Math.round(att.size_bytes / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.storage_path)}
                      className="text-neutral-400 hover:text-red-500 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: Consent & Submission */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-start gap-3">
          <input
            id="dpdp_consent"
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-sm border-neutral-300 text-sky-600 focus:ring-sky-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
          <label htmlFor="dpdp_consent" className="text-xs text-neutral-600 dark:text-neutral-400">
            <span className="font-semibold text-neutral-900 dark:text-neutral-200">
              India DPDP Act 2023 Consent:
            </span>{" "}
            I consent to Reach International processing my contact, company, and equipment requirement details for the purpose of preparing commercial quotations, assessing site feasibility, and providing heavy machinery advisory services. Your data will never be sold or shared with external third parties.
          </label>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-neutral-100 pt-5 sm:flex-row dark:border-neutral-800">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Guaranteed 2 to 4 hour formal quotation response SLA</span>
          </div>

          <button
            type="submit"
            disabled={isPending || isUploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-7 py-3 text-sm font-semibold text-white shadow-xs hover:bg-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 active:bg-sky-700 sm:w-auto dark:bg-sky-500 dark:hover:bg-sky-400 transition-all disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Quote Request...</span>
              </>
            ) : (
              <>
                <span>Submit Request for Quote</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
