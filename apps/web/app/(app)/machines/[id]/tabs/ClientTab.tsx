"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Building2,
  ExternalLink,
  Check,
  Copy,
} from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedMessageSquare } from "@/components/ui/animated-icons";
import { Card, Badge, Button, useToast } from "@/components/ui";
import type { MachineWithEngineer } from "@/lib/types/database";
import { formatDate } from "@reachinternational/utils";

interface ClientTabProps {
  machine: MachineWithEngineer;
  activeRental?: any;
  allowEdit: boolean;
}

export default function ClientTab({ machine, activeRental = null, allowEdit }: ClientTabProps) {
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedBillingAddress, setCopiedBillingAddress] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);

  // Linked Client Data
  const client = machine.client || activeRental?.client || null;
  const clientCompanyName = client?.company_name || machine.customer_name || "";
  const clientCode = client?.code || "";
  const clientContactPerson = client?.contact_person || "";
  const clientPhone = client?.phone || machine.customer_mobile || "";
  const clientEmail = (client as any)?.email || machine.customer_email || "";
  const clientGstin = client?.gstin || "";
  const clientPan = client?.pan_number || "";
  const clientAddress = client?.street || client?.address || machine.customer_address || "";
  const clientCity = client?.city || machine.city || "";
  const clientDistrict = client?.district || "";
  const clientState = client?.state || machine.state || "";
  const clientPincode = client?.pincode || "";
  const isBillingAddressDifferent = Boolean(client?.is_billing_address_different);
  const billingAddress = client?.billing_address || "";
  const billingCity = client?.billing_city || "";
  const billingDistrict = client?.billing_district || "";
  const billingState = client?.billing_state || "";
  const billingPincode = client?.billing_pincode || "";

  const clientLocationParts = [clientCity, clientDistrict, clientState].filter(Boolean);
  const clientLocation = clientLocationParts.length > 0 ? Array.from(new Set(clientLocationParts)).join(", ") : "";
  const hasLinkedClient = Boolean(clientCompanyName || clientAddress || clientPhone || client?.id);

  const fullSiteAddress = [clientAddress, clientLocation, clientPincode ? `PIN: ${clientPincode}` : ""]
    .filter(Boolean)
    .join(", ");

  const fullBillingAddress = [
    billingAddress,
    [billingCity, billingDistrict, billingState].filter(Boolean).join(", "),
    billingPincode ? `PIN: ${billingPincode}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const handleCopySiteAddress = () => {
    navigator.clipboard.writeText(fullSiteAddress || "—");
    setCopiedAddress(true);
    toast("info", "Address Copied!", "Site location address copied to clipboard.");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopyBillingAddress = () => {
    navigator.clipboard.writeText(fullBillingAddress || "—");
    setCopiedBillingAddress(true);
    toast("info", "Billing Address Copied!", "Billing address copied to clipboard.");
    setTimeout(() => setCopiedBillingAddress(false), 2000);
  };

  const handleCopyGstin = () => {
    if (!clientGstin) return;
    navigator.clipboard.writeText(clientGstin);
    setCopiedGstin(true);
    toast("info", "GSTIN Copied!", `${clientGstin} copied to clipboard.`);
    setTimeout(() => setCopiedGstin(false), 2000);
  };

  const handleCopyPan = () => {
    if (!clientPan) return;
    navigator.clipboard.writeText(clientPan);
    setCopiedPan(true);
    toast("info", "PAN Copied!", `${clientPan} copied to clipboard.`);
    setTimeout(() => setCopiedPan(false), 2000);
  };

  const cleanPhone = clientPhone ? clientPhone.replace(/[^0-9+]/g, "") : "";
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello ${clientContactPerson || clientCompanyName || "Client"}, regarding machine ${machine.model ? `${machine.model} (${machine.machine_id})` : machine.machine_id}.`
  )}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${clientCompanyName} ${clientAddress} ${clientLocation}`.trim()
  )}`;

  return (
    <Card padding="md" className="card-hover-system sm:p-6 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
            Assigned Client Details
          </h3>
          {clientCode && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              {clientCode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={machine.status === "on_rent" || machine.status === "rented" ? "info" : "neutral"}>
            <span className="text-[10px] sm:text-xs font-semibold">
              {machine.status === "on_rent" || machine.status === "rented" ? "On Rent Active" : "Site Deployed"}
            </span>
          </Badge>
          {client?.id && (
            <Link
              href={`/clients?tab=all`}
              className="hidden sm:inline-flex items-center gap-1 text-xs text-[var(--color-link)] hover:underline ml-1 font-medium"
            >
              <span>View Directory</span>
              <ExternalLink size={12} />
            </Link>
          )}
        </div>
      </div>

      {hasLinkedClient ? (
        <div className="flex flex-col gap-3.5 sm:gap-4 mt-3.5 sm:mt-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
            {/* CLIENT NAME */}
            <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                CLIENT NAME
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-[var(--color-ink)] text-sm sm:text-base">
                  {clientCompanyName}
                </p>
                {clientCode && (
                  <span className="inline-flex sm:hidden items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {clientCode}
                  </span>
                )}
              </div>
              {activeRental?.contract_number && (
                <span className="inline-block mt-1.5 font-mono text-[11px] text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded self-start border border-sky-500/20">
                  Contract: {activeRental.contract_number}
                </span>
              )}
            </div>

            {/* Contact Person */}
            <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                Contact Person
              </span>
              <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                {clientContactPerson || "—"}
              </p>
            </div>

            {/* Contact Mobile */}
            <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                Contact Mobile
              </span>
              {clientPhone ? (
                <a
                  href={`tel:${clientPhone}`}
                  className="font-semibold text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {clientPhone}
                </a>
              ) : (
                <p className="text-[var(--color-mute)]">—</p>
              )}
            </div>

            {/* Contact Email */}
            {clientEmail && (
              <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                  Contact Email
                </span>
                <a
                  href={`mailto:${clientEmail}`}
                  className="font-medium text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 break-all text-xs sm:text-sm"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {clientEmail}
                </a>
              </div>
            )}

            {/* City & State */}
            <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                City & State
              </span>
              <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                {clientLocation || "—"}
              </p>
            </div>

            {/* GSTIN */}
            {clientGstin && (
              <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                    GSTIN
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyGstin}
                    title={copiedGstin ? "Copied!" : "Copy GSTIN"}
                    aria-label="Copy GSTIN"
                    className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
                  >
                    {copiedGstin ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="font-mono font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                  {clientGstin}
                </p>
              </div>
            )}

            {/* PAN Number */}
            {clientPan && (
              <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                    PAN Number
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPan}
                    title={copiedPan ? "Copied!" : "Copy PAN Number"}
                    aria-label="Copy PAN Number"
                    className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
                  >
                    {copiedPan ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="font-mono font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                  {clientPan}
                </p>
              </div>
            )}
          </div>

          {/* SITE LOCATION */}
          <div className="flex flex-col p-3 sm:p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                SITE LOCATION
              </span>
              <button
                type="button"
                onClick={handleCopySiteAddress}
                title={copiedAddress ? "Copied!" : "Copy Site Address"}
                aria-label="Copy Site Address"
                className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
              >
                {copiedAddress ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed font-medium">
              {clientAddress || "—"}
              {clientLocation && !clientAddress.includes(clientLocation) ? `, ${clientLocation}` : ""}
              {clientPincode ? ` - ${clientPincode}` : ""}
            </p>
          </div>

          {/* Billing Address (if separate) */}
          {isBillingAddressDifferent && (billingAddress || billingCity) && (
            <div className="flex flex-col p-3 sm:p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                  Billing Address
                </span>
                <button
                  type="button"
                  onClick={handleCopyBillingAddress}
                  title={copiedBillingAddress ? "Copied!" : "Copy Billing Address"}
                  aria-label="Copy Billing Address"
                  className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
                >
                  {copiedBillingAddress ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed font-medium">
                {fullBillingAddress || "—"}
              </p>
            </div>
          )}

          {/* Rental Contract Timeline & Rate if available */}
          {activeRental && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental Start</span>
                <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.start_date)}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental End</span>
                <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.end_date)}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental Rate</span>
                <span className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                  ₹{(activeRental.monthly_rate || activeRental.rental_rate || 0).toLocaleString("en-IN")} / {activeRental.rate_unit || "month"}
                </span>
              </div>
            </div>
          )}

          {/* Quick Action Touch Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {clientPhone ? (
              <motion.a
                whileTap={{ scale: 0.96 }}
                href={`tel:${clientPhone}`}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-all text-center font-semibold text-xs min-h-[44px]"
              >
                <Phone className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">Call</span>
              </motion.a>
            ) : null}

            {clientPhone ? (
              <motion.a
                whileTap={{ scale: 0.96 }}
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 transition-all text-center font-semibold text-xs min-h-[44px]"
              >
                <AnimatedMessageSquare size={16} className="shrink-0 text-green-600 dark:text-green-400" />
                <span className="truncate">WhatsApp</span>
              </motion.a>
            ) : null}

            <motion.a
              whileTap={{ scale: 0.96 }}
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/20 transition-all text-center font-semibold text-xs min-h-[44px]"
            >
              <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <span className="truncate">Map Location</span>
            </motion.a>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center bg-[var(--color-hairline-soft-surface)]/30 rounded-xl border border-dashed border-[var(--color-hairline)] mt-3 p-4">
          <Building2 className="h-8 w-8 text-[var(--color-mute)] mx-auto mb-2 opacity-50" />
          <p className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">No Client Assigned</p>
          <p className="text-xs text-[var(--color-mute)] mt-1 max-w-sm mx-auto">
            This machine is currently available in the fleet inventory and has not been linked to a client account in the CRM.
          </p>
          {allowEdit && (
            <div className="mt-4">
              <Button href={`/machines/${machine.id}/edit`} variant="secondary" size="sm">
                Assign Client
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
