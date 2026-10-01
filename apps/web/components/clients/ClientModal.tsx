"use client";

import { useState, useEffect, useRef } from "react";
import {
  AnimatedX,
  AnimatedBuilding2,
  AnimatedMapPin,
  AnimatedReceipt,
} from "@/components/ui/animated-icons";
import { AlertCircle, Save, Lock, Wrench, Clock, CheckCircle2, Moon, Sparkles } from "lucide-react";
import type { CRMClient } from "@/lib/types/database";
import { createClientAction, updateClientAction, type ClientFormState } from "@/app/actions/clients";
import { Button, Input, Switch, CustomTimePicker, useToast } from "@/components/ui";
import { invalidateClientShiftsCache } from "@/lib/cache/client-shifts-cache";
import {
  CLIENT_SHIFT_PRESETS,
  DEFAULT_CLIENT_SHIFT_PRESET_ID,
  formatTo12Hour,
} from "@reachinternational/utils";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: CRMClient | null;
  onSuccess?: (updatedClient?: CRMClient) => void;
}

export function ClientModal({ isOpen, onClose, client, onSuccess }: ClientModalProps) {
  const isEditing = Boolean(client);
  const { toast } = useToast();

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

  // Monthly Maintenance Allowance (managed with CustomTimePicker)
  const [allowanceHours, setAllowanceHours] = useState(0);
  const [allowanceMinutes, setAllowanceMinutes] = useState(0);
  const [allowanceTime, setAllowanceTime] = useState("00:00");

  // Operational Shift Template Preset (1-Click Industry Templates)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_CLIENT_SHIFT_PRESET_ID);

  const formContainerRef = useRef<HTMLFormElement>(null);
  const billingSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (client) {
      setCompanyName(client.company_name || client.client_name || "");
      setContactPerson(client.contact_person || "");
      setPhone(client.phone || "");
      setGstin(client.gstin || "");
      setPanNumber(client.pan_number || "");
      setAddress(client.street || "");
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

      // Load maintenance allowance from stored minutes
      const totalMin = client.maintenance_allowance_minutes ?? 0;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      setAllowanceHours(h);
      setAllowanceMinutes(m);
      setAllowanceTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
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
      setAllowanceHours(0);
      setAllowanceMinutes(0);
      setAllowanceTime("00:00");
      setSelectedPresetId(DEFAULT_CLIENT_SHIFT_PRESET_ID);
    }
    setFormState({});
  }, [client, isOpen]);

  const handleAllowanceTimeChange = (val: string) => {
    setAllowanceTime(val);
    if (!val || !val.includes(":")) {
      setAllowanceHours(0);
      setAllowanceMinutes(0);
      return;
    }
    const [hStr, mStr] = val.split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    setAllowanceHours(h);
    setAllowanceMinutes(m);
  };

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
    formData.append("street", address);
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
    // Compute total allowance in minutes from hours + minutes inputs
    const totalAllowanceMinutes = Math.max(0, (allowanceHours * 60) + allowanceMinutes);
    formData.append("maintenanceAllowanceMinutes", String(totalAllowanceMinutes));
    if (!isEditing) {
      formData.append("shift_preset", selectedPresetId);
    }

    // Validate all required fields
    const missingFields: string[] = [];

    if (!companyName.trim()) missingFields.push("Company Name");
    if (!contactPerson.trim()) missingFields.push("Contact Person");
    if (!phone.trim()) missingFields.push("Phone Number");
    if (!gstin.trim()) missingFields.push("GSTIN Number");
    if (!panNumber.trim()) missingFields.push("PAN Number");
    if (!address.trim()) missingFields.push("Street / Area");
    if (!city.trim()) missingFields.push("City / Town / Village");
    if (!district.trim()) missingFields.push("District");
    if (!stateName.trim()) missingFields.push("State");
    if (!pincode.trim()) missingFields.push("Pincode");

    if (isBillingAddressDifferent) {
      if (!billingAddress.trim()) missingFields.push("Billing Street / Area");
      if (!billingCity.trim()) missingFields.push("Billing City");
      if (!billingDistrict.trim()) missingFields.push("Billing District");
      if (!billingState.trim()) missingFields.push("Billing State");
      if (!billingPincode.trim()) missingFields.push("Billing Pincode");
    }

    if (missingFields.length > 0) {
      setFormState({ error: `Required fields missing: ${missingFields.join(", ")}.` });
      setIsSubmitting(false);
      return;
    }

    const action = isEditing ? updateClientAction : createClientAction;
    const res = await action({}, formData);

    setIsSubmitting(false);

    if (res.error) {
      setFormState(res);
      toast("error", res.error);
    } else if (res.success) {
      if (client?.id) {
        invalidateClientShiftsCache(client.id);
      }
      toast("success", isEditing ? "Client updated successfully" : "Client created successfully");
      onSuccess?.(res.client);
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
              {isEditing ? `Edit Client (${client?.client_id || client?.code || "Client Details"})` : "Add New Client"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            <AnimatedX size={18} className="w-4.5 h-4.5" />
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
          <div
            data-hover-parent
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-2 border-b border-[var(--color-hairline)]">
              <AnimatedBuilding2 size={16} className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              Company & Tax Details
            </div>

            <div className="space-y-3">
              {isEditing && (client?.client_id || client?.code) && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-mute)]">Client ID</span>
                    <span className="inline-flex items-center gap-1 rounded bg-[var(--color-hairline-soft-surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-mute)] border border-[var(--color-hairline)]">
                      <Lock className="h-2.5 w-2.5 text-amber-500" />
                      Permanent &amp; Immutable
                    </span>
                  </div>
                  <Input
                    value={client.client_id || client.code || ""}
                    readOnly
                    disabled
                    className="font-mono bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] opacity-80 cursor-not-allowed font-semibold"
                  />
                </div>
              )}

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
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  error={formState.fieldErrors?.contactPerson}
                />

                <Input
                  label="Phone Number"
                  required
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
                  required
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                  maxLength={15}
                  error={formState.fieldErrors?.gstin}
                />

                <Input
                  label="PAN Number"
                  required
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  error={formState.fieldErrors?.panNumber}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Site Location */}
          <div
            data-hover-parent
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-2 border-b border-[var(--color-hairline)]">
              <AnimatedMapPin size={16} className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              Site Location
            </div>

            <div className="space-y-3">
              {/* 1. Street / Area */}
              <Input
                label="Street / Area"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 42, Sector 18, Industrial Area"
                error={formState.fieldErrors?.street || formState.fieldErrors?.address}
              />

              {/* 2. City / Town / Village & 3. District */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="City / Town / Village"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune"
                  error={formState.fieldErrors?.city}
                />

                <Input
                  label="District"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Pune"
                  error={formState.fieldErrors?.district}
                />
              </div>

              {/* 4. State & 5. Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="411001"
                  maxLength={6}
                  error={formState.fieldErrors?.pincode}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Billing Address (Conditional) */}
          <div
            data-hover-parent
            ref={billingSectionRef}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                <AnimatedReceipt size={16} className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                Billing Address
              </div>
              <Switch
                size="sm"
                checked={isBillingAddressDifferent}
                onChange={(e) => handleToggleBilling(e.target.checked)}
                label={<span className="text-xs font-semibold">Different from Site Location</span>}
              />
            </div>

            {isBillingAddressDifferent ? (
              <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* 1. Billing Street / Area */}
                <Input
                  label="Billing Street / Area"
                  required
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="e.g. Corporate HQ, 5th Floor, Tower B, Cyber City"
                  error={formState.fieldErrors?.billingAddress}
                />

                {/* 2. Billing City / Town / Village & 3. Billing District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Billing City / Town / Village"
                    required
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    placeholder="e.g. Gurugram"
                    error={formState.fieldErrors?.billingCity}
                  />

                  <Input
                    label="Billing District"
                    required
                    value={billingDistrict}
                    onChange={(e) => setBillingDistrict(e.target.value)}
                    placeholder="e.g. Gurugram"
                    error={formState.fieldErrors?.billingDistrict}
                  />
                </div>

                {/* 4. Billing State & 5. Billing Pincode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Billing State"
                    required
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value)}
                    placeholder="e.g. Haryana"
                    error={formState.fieldErrors?.billingState}
                  />

                  <Input
                    label="Billing Pincode"
                    required
                    value={billingPincode}
                    onChange={(e) => setBillingPincode(e.target.value)}
                    placeholder="122002"
                    maxLength={6}
                    error={formState.fieldErrors?.billingPincode}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-mute)] italic">
                Billing address is currently configured to match the site location.
              </p>
            )}
          </div>

          {/* Section 4: Monthly Maintenance Allowance */}
          <div
            data-hover-parent
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                <Wrench size={16} className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                Monthly Maintenance Allowance
              </div>
              {(allowanceHours > 0 || allowanceMinutes > 0) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {allowanceHours > 0 && `${allowanceHours}h`}{allowanceHours > 0 && allowanceMinutes > 0 && " "}{allowanceMinutes > 0 && `${allowanceMinutes}m`} / machine / month
                </span>
              )}
            </div>

            <p className="text-[11px] text-[var(--color-mute)] leading-relaxed">
              Breakdown time up to this limit per machine per calendar month will be classified as <span className="font-semibold text-amber-700 dark:text-amber-400">Maintenance</span> instead of B/D. Leave at 0 for no allowance.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <CustomTimePicker
                label="Maintenance Allowance Window (Hours : Minutes)"
                iconColor="text-amber-500"
                value={allowanceTime}
                onChange={handleAllowanceTimeChange}
                showPeriod={false}
                maxHours={744}
                minHours={0}
                hourPlaceholder="00"
                minutePlaceholder="00"
                error={formState.fieldErrors?.maintenanceAllowanceMinutes}
                helperText="Format: HH:MM (e.g. 12:00 for 12 hours). Breakdowns up to this monthly limit per machine are classified as Maintenance instead of B/D. Leave at 00:00 for no allowance."
              />
            </div>
          </div>

          {/* Section 5: Operational Shift Templates (1-Click Industry Presets) */}
          {!isEditing && (
            <div
              data-hover-parent
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                  <Clock size={16} className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  Operational Shift Templates (1-Click Presets)
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-700 dark:text-sky-300 border border-sky-500/20">
                  <Sparkles size={10} />
                  Instant Provisioning
                </span>
              </div>

              <p className="text-[11px] text-[var(--color-mute)] leading-relaxed">
                Select an industry operational schedule. Shift codes and timings will be pre-configured immediately on client creation. You can fine-tune shift names and windows later.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {CLIENT_SHIFT_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                        isSelected
                          ? "border-sky-500 bg-sky-500/5 dark:bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30"
                          : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-sky-500/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-xs font-bold text-[var(--color-ink)] leading-snug">
                            {preset.name}
                          </span>
                          {isSelected ? (
                            <CheckCircle2 size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                          ) : (
                            <span className="w-4 h-4 rounded-full border border-[var(--color-hairline)] shrink-0 mt-0.5 group-hover:border-sky-500/40" />
                          )}
                        </div>
                        <span className="inline-block text-[10px] font-semibold text-sky-600 dark:text-sky-400 font-mono mb-1.5">
                          {preset.badge}
                        </span>
                        <p className="text-[11px] text-[var(--color-mute)] leading-relaxed mb-2.5">
                          {preset.description}
                        </p>
                      </div>

                      {/* Shift Preview Pills */}
                      {preset.shifts.length > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--color-hairline)]">
                          {preset.shifts.map((s) => (
                            <span
                              key={s.code}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)]"
                            >
                              <strong className="text-sky-600 dark:text-sky-400">{s.code}:</strong>
                              <span>{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</span>
                              {s.crossesMidnight && <Moon size={9} className="text-purple-500 shrink-0" />}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="pt-1 border-t border-[var(--color-hairline)]">
                          <span className="text-[10px] text-[var(--color-mute)] italic">
                            No shift codes configured. Set up manually anytime.
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
