"use client";

import { useState, useEffect } from "react";
import {
  AnimatedUsers,
  AnimatedX,
  AnimatedCheck,
  AnimatedBuilding2,
  AnimatedMapPin,
  AnimatedPhone,
  AnimatedMail,
  AnimatedFileText,
} from "@/components/ui/animated-icons";
import { AlertCircle, Loader2, Save } from "lucide-react";
import type { CRMClient } from "@/lib/types/database";
import { createClientAction, updateClientAction, type ClientFormState } from "@/app/actions/clients";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: CRMClient | null;
  onSuccess?: () => void;
}

export function ClientModal({ isOpen, onClose, client, onSuccess }: ClientModalProps) {
  const isEditing = Boolean(client);

  const [formState, setFormState] = useState<ClientFormState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form field states
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  useEffect(() => {
    if (client) {
      setClientName(client.client_name || "");
      setCompanyName(client.company_name || "");
      setContactPerson(client.contact_person || "");
      setPhone(client.phone || "");
      setEmail(client.email || "");
      setGstin(client.gstin || "");
      setAddress(client.address || "");
      setCity(client.city || "");
      setStateName(client.state || "");
      setPincode(client.pincode || "");
      setNotes(client.notes || "");
      setStatus(client.status || "active");
    } else {
      setClientName("");
      setCompanyName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setGstin("");
      setAddress("");
      setCity("");
      setStateName("");
      setPincode("");
      setNotes("");
      setStatus("active");
    }
    setFormState({});
  }, [client, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormState({});

    const formData = new FormData();
    if (isEditing && client?.id) {
      formData.append("id", client.id);
    }
    formData.append("clientName", clientName);
    formData.append("companyName", companyName);
    formData.append("contactPerson", contactPerson);
    formData.append("phone", phone);
    formData.append("email", email);
    formData.append("gstin", gstin);
    formData.append("address", address);
    formData.append("city", city);
    formData.append("state", stateName);
    formData.append("pincode", pincode);
    formData.append("notes", notes);
    formData.append("status", status);

    if (!clientName.trim()) {
      setFormState({ error: "Client Name is required." });
      setIsSubmitting(false);
      return;
    }

    if (!address.trim() || !city.trim() || !stateName.trim()) {
      setFormState({ error: "Office / Site Address, City, and State are required." });
      setIsSubmitting(false);
      return;
    }

    const action = isEditing ? updateClientAction : createClientAction;
    const res = await action({}, formData);

    setIsSubmitting(false);

    if (res.error) {
      setFormState(res);
    } else if (res.success) {
      onSuccess?.();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-5 sm:p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border,#ebebeb)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-neutral-100,#f5f5f5)] text-[var(--color-ink,#171717)] border border-[var(--color-border,#ebebeb)]">
              <AnimatedUsers className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-ink,#171717)] tracking-tight">
                {isEditing ? `Edit Client (${client?.code || "Client Details"})` : "Add New Client"}
              </h3>
              <p className="text-xs text-neutral-500">
                {isEditing
                  ? "Update stored client information, contact info, and tax parameters."
                  : "Register a new client profile into database directory for monthly running logs."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <AnimatedX className="h-5 w-5" />
          </button>
        </div>

        {/* Global Error Alert */}
        {formState.error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-semibold">{formState.error}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Section 1: Client & Contact Info */}
          <div className="rounded-lg border border-[var(--color-border,#ebebeb)] bg-neutral-50/50 p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
              <AnimatedBuilding2 className="h-4 w-4 text-blue-600" />
              Client & Contact Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Pushpa Infracon Pvt Ltd"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                {formState.fieldErrors?.clientName && (
                  <p className="mt-1 text-[10px] text-red-600">{formState.fieldErrors.clientName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Pushpa Group"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. info@pushpainfra.com"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                {formState.fieldErrors?.email && (
                  <p className="mt-1 text-[10px] text-red-600">{formState.fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  GSTIN / Tax ID Number
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Address & Location */}
          <div className="rounded-lg border border-[var(--color-border,#ebebeb)] bg-neutral-50/50 p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
              <AnimatedMapPin className="h-4 w-4 text-emerald-600" />
              Address & Location Details
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                Office / Site Address *
              </label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 42, Sector 18, Industrial Area"
                className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  State *
                </label>
                <input
                  type="text"
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="e.g. Maharashtra"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="110001"
                  className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Status & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active Client</option>
                <option value="inactive">Inactive Client</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-ink,#171717)] mb-1">
                Internal Remarks / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special billing terms, project details..."
                className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-3 py-2 text-xs text-[var(--color-ink,#171717)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border,#ebebeb)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-hidden disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary,#0070f3)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-600 focus:outline-hidden disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? "Update Client" : "Save Client"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
