"use client";

import { useState, useEffect, useRef } from "react";
import {
  AnimatedX,
  AnimatedBuilding2,
  AnimatedMapPin,
  AnimatedFileText,
} from "@/components/ui/animated-icons";
import { AlertCircle, Save, Receipt } from "lucide-react";
import type { CRMClient } from "@/lib/types/database";
import { createClientAction, updateClientAction, type ClientFormState } from "@/app/actions/clients";
import { Button, Input, Switch } from "@/components/ui";

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
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [panNumber, setPanNumber] = useState("");

  // Site Address
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");

  // Conditional Billing Address
  const [isBillingAddressDifferent, setIsBillingAddressDifferent] = useState(false);
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingDistrict, setBillingDistrict] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingPincode, setBillingPincode] = useState("");

  const formContainerRef = useRef<HTMLFormElement>(null);
  const billingSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (client) {
      setCompanyName(client.company_name || client.client_name || "");
      setContactPerson(client.contact_person || "");
      setPhone(client.phone || "");
      setGstin(client.gstin || "");
      setPanNumber(client.pan_number || "");
      setAddress(client.address || "");
      setCity(client.city || "");
      setDistrict(client.district || "");
      setStateName(client.state || "");
      setPincode(client.pincode || "");

      const isDiff = Boolean(client.is_billing_address_different || client.billing_address || client.billing_city);
      setIsBillingAddressDifferent(isDiff);
      setBillingAddress(client.billing_address || "");
      setBillingCity(client.billing_city || "");
      setBillingDistrict(client.billing_district || "");
      setBillingState(client.billing_state || "");
      setBillingPincode(client.billing_pincode || "");
    } else {
      setCompanyName("");
      setContactPerson("");
      setPhone("");
      setGstin("");
      setPanNumber("");
      setAddress("");
      setCity("");
      setDistrict("");
      setStateName("");
      setPincode("");
      setIsBillingAddressDifferent(false);
      setBillingAddress("");
      setBillingCity("");
      setBillingDistrict("");
      setBillingState("");
      setBillingPincode("");
    }
    setFormState({});
  }, [client, isOpen]);

  if (!isOpen) return null;

  const handleToggleBilling = (checked: boolean) => {
    setIsBillingAddressDifferent(checked);
    if (checked) {
      setTimeout(() => {
        billingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormState({});

    const formData = new FormData();
    if (isEditing && client?.id) {
      formData.append("id", client.id);
    }
    formData.append("companyName", companyName);
    formData.append("contactPerson", contactPerson);
    formData.append("phone", phone);
    formData.append("gstin", gstin);
    formData.append("panNumber", panNumber);
    formData.append("address", address);
    formData.append("city", city);
    formData.append("district", district);
    formData.append("state", stateName);
    formData.append("pincode", pincode);
    formData.append("isBillingAddressDifferent", isBillingAddressDifferent ? "true" : "false");
    formData.append("billingAddress", billingAddress);
    formData.append("billingCity", billingCity);
    formData.append("billingDistrict", billingDistrict);
    formData.append("billingState", billingState);
    formData.append("billingPincode", billingPincode);
    formData.append("status", client?.status || "active");

    if (!companyName.trim()) {
      setFormState({ error: "Company Name is required." });
      setIsSubmitting(false);
      return;
    }

    if (!address.trim() || !city.trim() || !stateName.trim()) {
      setFormState({ error: "Site Address, City, and State are required." });
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
      <div className="relative w-full max-w-2xl rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 sm:p-6 shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col">
        {/* Header - Cleaned without icon */}
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-ink)] tracking-tight">
              {isEditing ? `Edit Client (${client?.code || "Client Details"})` : "Add New Client"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            <AnimatedX className="h-5 w-5" />
          </button>
        </div>

        {/* Global Error Alert */}
        {formState.error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-semibold">{formState.error}</span>
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form
          ref={formContainerRef}
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar"
        >
          {/* Section 1: Company & Tax Details */}
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-1 border-b border-[var(--color-hairline)]">
              <AnimatedBuilding2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              Company & Tax Details
            </div>

            <div className="space-y-3">
              <Input
                label="Company Name"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Pushpa Infracon Pvt Ltd"
                error={formState.fieldErrors?.companyName}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Contact Person"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  error={formState.fieldErrors?.contactPerson}
                />

                <Input
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  error={formState.fieldErrors?.phone}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="GSTIN Number"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                  maxLength={15}
                  error={formState.fieldErrors?.gstin}
                />

                <Input
                  label="PAN Number"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  error={formState.fieldErrors?.panNumber}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Site Address */}
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-1 border-b border-[var(--color-hairline)]">
              <AnimatedMapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Site Address
            </div>

            <div>
              <label className="block text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] mb-1 select-none flex items-center gap-1">
                <span>Site Address</span>
                <span className="text-rose-500 font-semibold">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 42, Sector 18, Industrial Area"
                className="w-full rounded-lg border border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas-elevated)] p-3 text-xs sm:text-[13px] font-medium text-[var(--color-ink)] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 resize-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Input
                label="City"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Pune"
                error={formState.fieldErrors?.city}
              />

              <Input
                label="District"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Pune"
                error={formState.fieldErrors?.district}
              />

              <Input
                label="State"
                required
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="e.g. Maharashtra"
                error={formState.fieldErrors?.state}
              />

              <Input
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="411001"
                error={formState.fieldErrors?.pincode}
              />
            </div>
          </div>

          {/* Section 3: Billing Address (Conditional) */}
          <div
            ref={billingSectionRef}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[var(--color-hairline)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                <Receipt className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Billing Address
              </div>
              <Switch
                size="sm"
                checked={isBillingAddressDifferent}
                onChange={(e) => handleToggleBilling(e.target.checked)}
                label={<span className="text-xs font-semibold">Different from Site Address</span>}
              />
            </div>

            {isBillingAddressDifferent ? (
              <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <label className="block text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] mb-1 select-none">
                    Billing Address
                  </label>
                  <textarea
                    rows={2}
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="e.g. Corporate HQ, 5th Floor, Tower B, Cyber City"
                    className="w-full rounded-lg border border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas-elevated)] p-3 text-xs sm:text-[13px] font-medium text-[var(--color-ink)] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 resize-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <Input
                    label="City"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    placeholder="e.g. Gurugram"
                    error={formState.fieldErrors?.billingCity}
                  />

                  <Input
                    label="District"
                    value={billingDistrict}
                    onChange={(e) => setBillingDistrict(e.target.value)}
                    placeholder="e.g. Gurugram"
                    error={formState.fieldErrors?.billingDistrict}
                  />

                  <Input
                    label="State"
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value)}
                    placeholder="e.g. Haryana"
                    error={formState.fieldErrors?.billingState}
                  />

                  <Input
                    label="Pincode"
                    value={billingPincode}
                    onChange={(e) => setBillingPincode(e.target.value)}
                    placeholder="122002"
                    error={formState.fieldErrors?.billingPincode}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-mute)] italic">
                Billing address is currently configured to match the site address.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-hairline)] pt-4 shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              icon={<Save className="h-4 w-4" />}
            >
              {isEditing ? "Update Client" : "Save Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
