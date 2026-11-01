"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BusinessProfile } from "@reachinternational/types";
import { INDIAN_STATES } from "@/lib/rfq/states";
import { updateBusinessProfileAction } from "@/app/actions/rfq";
import {
  Building2,
  ChevronLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  FileText,
  Mail,
  ShieldCheck,
} from "lucide-react";

interface RfqSettingsClientProps {
  initialProfile: BusinessProfile | null;
}

export function RfqSettingsClient({ initialProfile }: RfqSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [legalName, setLegalName] = useState(initialProfile?.legal_name || "Reach International");
  const [gstin, setGstin] = useState(initialProfile?.gstin || "");
  const [address, setAddress] = useState(initialProfile?.address || "");
  const [stateCode, setStateCode] = useState(initialProfile?.state_code || "MH");
  const [phone, setPhone] = useState(initialProfile?.phone || "+91 88000 40308");
  const [email, setEmail] = useState(initialProfile?.email || "rental@reachinternational.co.in");
  const [bankDetails, setBankDetails] = useState(initialProfile?.bank_details || "");
  const [defaultTermsMd, setDefaultTermsMd] = useState(
    initialProfile?.default_terms_md ||
      "1. Validity: This quotation is valid for 15 days from issue date.\n2. Payment: Advance monthly rental with PO sign-off.\n3. Mobilization: Freight extra at actuals.\n4. Site Access: Client provides leveled ground and charging point."
  );
  const [defaultValidityDays, setDefaultValidityDays] = useState(
    initialProfile?.default_validity_days || 15
  );
  const [defaultGstRate, setDefaultGstRate] = useState(
    initialProfile?.default_gst_rate ? Number(initialProfile.default_gst_rate) : 18.0
  );
  const [notifyEmails, setNotifyEmails] = useState(
    initialProfile?.rfq_notify_emails ? initialProfile.rfq_notify_emails.join(", ") : ""
  );

  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(false);
    setErrorMsg(null);

    startTransition(async () => {
      const emailList = notifyEmails
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const res = await updateBusinessProfileAction({
        legal_name: legalName.trim(),
        gstin: gstin.trim() || null,
        address: address.trim() || null,
        state_code: stateCode || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        bank_details: bankDetails.trim() || null,
        default_terms_md: defaultTermsMd.trim() || null,
        default_validity_days: defaultValidityDays,
        default_gst_rate: defaultGstRate,
        rfq_notify_emails: emailList,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to update business settings.");
        return;
      }

      setSuccessMsg(true);
      router.refresh();
      setTimeout(() => setSuccessMsg(false), 4000);
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
            Business Profile & Quotation PDF Configuration
          </h1>
          <p className="text-xs text-neutral-500">
            Configure legal entity details, bank accounts, default terms, and notification targets used for official RFQ quotations.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>Business settings updated successfully.</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Legal Identity */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 mb-4 dark:border-neutral-800">
            <Building2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Legal Business Identity & Tax Registration
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="block text-neutral-500 mb-1">Legal Entity Name *</label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Company GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27AABCU9603R1ZM"
                className="w-full rounded-lg border border-neutral-200 p-2 font-mono dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Primary State Code</label>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
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
              <label className="block text-neutral-500 mb-1">Official Support Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-neutral-500 mb-1">Registered Business Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>
          </div>
        </div>

        {/* Banking & Quotation Defaults */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 mb-4 dark:border-neutral-800">
            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Bank Account Details & Quotation Defaults
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-neutral-500 mb-1">
                Bank RTGS / NEFT Details (printed on PDF)
              </label>
              <textarea
                rows={2}
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                placeholder="Bank Name, A/C Number, IFSC Code, Branch"
                className="w-full rounded-lg border border-neutral-200 p-2 font-mono dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Default Quote Validity (Days)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={defaultValidityDays}
                onChange={(e) => setDefaultValidityDays(parseInt(e.target.value, 10) || 15)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-neutral-500 mb-1">Default GST Rate (%)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={28}
                value={defaultGstRate}
                onChange={(e) => setDefaultGstRate(parseFloat(e.target.value) || 18)}
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-neutral-500 mb-1">
                New RFQ Alert Notification Emails (comma-separated)
              </label>
              <input
                type="text"
                value={notifyEmails}
                onChange={(e) => setNotifyEmails(e.target.value)}
                placeholder="sales@reachinternational.co.in, quotes@reachinternational.co.in"
                className="w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-neutral-500 mb-1">
                Default Terms & Conditions (Markdown)
              </label>
              <textarea
                rows={5}
                value={defaultTermsMd}
                onChange={(e) => setDefaultTermsMd(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 p-2 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-sky-500 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
