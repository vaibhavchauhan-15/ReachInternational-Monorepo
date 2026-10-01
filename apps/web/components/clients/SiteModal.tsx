"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatedX, AnimatedMapPin } from "@/components/ui/animated-icons";
import { AlertCircle, Save, Building2 } from "lucide-react";
import { createClientSite, updateClientSite } from "@/app/actions/client-sites";
import { getClientOptionsAction } from "@/app/actions/clients";
import { Button, Input, useToast, ClientSelect, type ClientSelectItem } from "@/components/ui";
import { AddressFields, type AddressValues, type AddressState } from "./AddressFields";
import { INDIAN_STATES } from "@reachinternational/utils";
import type { ClientSite } from "@/lib/data/clients/client-sites";

interface SiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  clients?: ClientSelectItem[];
  site?: ClientSite | null;
  states?: AddressState[];
  onSuccess?: () => void;
}

export function SiteModal({
  isOpen,
  onClose,
  clientId,
  clients: initialClients,
  site,
  states = [...INDIAN_STATES],
  onSuccess,
}: SiteModalProps) {
  const isEditing = Boolean(site);
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFixedClient = typeof clientId === "string" && clientId.trim().length > 0;

  // Client Selection State when clientId is not provided
  const [selectedClientId, setSelectedClientId] = useState<string>(isFixedClient ? clientId : "");
  const [clientOptions, setClientOptions] = useState<ClientSelectItem[]>(initialClients || []);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const [siteName, setSiteName] = useState("");
  const [addressValues, setAddressValues] = useState<AddressValues>({
    street: "",
    city: "",
    district: "",
    state_id: "",
    pincode: "",
  });

  const formContainerRef = useRef<HTMLFormElement>(null);

  // Sync client options if passed via props
  useEffect(() => {
    if (initialClients && initialClients.length > 0) {
      setClientOptions(initialClients);
    }
  }, [initialClients]);

  // Load client options on-demand if no clients were passed
  useEffect(() => {
    if (isOpen && (!clientOptions || clientOptions.length === 0)) {
      let active = true;
      setIsLoadingClients(true);
      getClientOptionsAction()
        .then((options) => {
          if (active && options) {
            setClientOptions(options);
          }
        })
        .catch((err) => {
          console.error("Failed to load client options for site modal:", err);
        })
        .finally(() => {
          if (active) setIsLoadingClients(false);
        });
      return () => {
        active = false;
      };
    }
  }, [isOpen, clientOptions]);

  useEffect(() => {
    if (site) {
      setSiteName(site.site_name || "");
      setSelectedClientId(site.client_id || (isFixedClient ? clientId : ""));
      setAddressValues({
        street: site.street || "",
        city: site.city || "",
        district: site.district || "",
        state_id: site.state_id || "",
        pincode: site.pincode || "",
      });
    } else {
      setSiteName("");
      setSelectedClientId(isFixedClient ? clientId : "");
      setAddressValues({
        street: "",
        city: "",
        district: "",
        state_id: "",
        pincode: "",
      });
    }
    setError(null);
  }, [site, isOpen, clientId, isFixedClient]);

  // Resolve target client info if available
  const effectiveId = isFixedClient ? clientId : selectedClientId;
  const targetClient = clientOptions.find((c) => c.id === effectiveId);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const effectiveClientId = (clientId || selectedClientId || "").trim();

    // Validate
    const missingFields: string[] = [];
    if (!effectiveClientId) missingFields.push("Client Account");
    if (!siteName.trim()) missingFields.push("Site Name");
    if (!addressValues.street.trim()) missingFields.push("Street / Area");
    if (!addressValues.city.trim()) missingFields.push("City / Town / Village");
    if (!addressValues.district.trim()) missingFields.push("District");
    if (addressValues.state_id === "") missingFields.push("State");
    if (!addressValues.pincode.trim() || addressValues.pincode.length !== 6) missingFields.push("Valid Pincode");

    if (missingFields.length > 0) {
      setError(`Required fields missing or invalid: ${missingFields.join(", ")}.`);
      setIsSubmitting(false);
      return;
    }

    const formData = {
      site_name: siteName,
      street: addressValues.street,
      city: addressValues.city,
      district: addressValues.district,
      state_id: Number(addressValues.state_id),
      pincode: addressValues.pincode,
    };

    let res;
    if (isEditing && site) {
      res = await updateClientSite(site.id, effectiveClientId, formData);
    } else {
      res = await createClientSite(effectiveClientId, formData);
    }

    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
      toast("error", res.error);
    } else if (res.success) {
      toast("success", isEditing ? "Site updated successfully" : "Site created successfully");
      if (!isEditing && "similarSites" in res && res.similarSites?.length) {
        toast("warning", "A similar site already exists, but site was created.");
      }
      onSuccess?.();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 sm:p-6 shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-ink)] tracking-tight">
              {isEditing
                ? `Edit Site (${site?.site_code || site?.site_name})`
                : isFixedClient && targetClient
                ? `Add Site — ${targetClient.company_name || targetClient.client_name}`
                : "Add Client Site"}
            </h3>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              {isEditing
                ? "Update operating site details."
                : isFixedClient
                ? "Register a new operating location or branch facility for this client."
                : "Select an existing client and register an operating site location."}
            </p>
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
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-semibold">{error}</span>
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form
          ref={formContainerRef}
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar"
        >
          {/* Target Client Banner (when clientId is fixed from row or detail page) */}
          {isFixedClient && (
            <div
              data-hover-parent
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/60 flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-sky-600 dark:text-sky-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
                    Target Client Account
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] truncate">
                    {targetClient?.company_name || targetClient?.client_name || "Client Account"}
                  </div>
                </div>
              </div>
              {targetClient?.client_code && (
                <span className="font-mono text-[11px] font-medium text-[var(--color-mute)] bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] px-2 py-0.5 rounded-md shrink-0">
                  {targetClient.client_code}
                </span>
              )}
            </div>
          )}

          {/* Client Selection (only displayed when clientId is not pre-fixed) */}
          {!isFixedClient && (
            <div
              data-hover-parent
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-2 border-b border-[var(--color-hairline)]">
                <Building2 size={16} className="w-4 h-4 text-sky-600 shrink-0" />
                Target Client Account
              </div>

              <ClientSelect
                clients={clientOptions}
                value={selectedClientId}
                onChange={(id) => {
                  setSelectedClientId(id);
                  if (error) setError(null);
                }}
                label="Client Account"
                placeholder="Search and select existing client..."
                isLoading={isLoadingClients}
                disabled={isSubmitting || isEditing}
                required
              />
            </div>
          )}

          <div
            data-hover-parent
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-2 border-b border-[var(--color-hairline)]">
              <AnimatedMapPin size={16} className="w-4 h-4 text-emerald-600 shrink-0" />
              Site Details & Location
            </div>

            <div className="space-y-4">
              <Input
                label="Site Name"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. Pune Manufacturing Facility"
                disabled={isSubmitting}
              />

              <AddressFields
                values={addressValues}
                onChange={setAddressValues}
                states={states}
                disabled={isSubmitting}
              />
            </div>
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
              {isEditing ? "Update Site" : "Save Site"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

