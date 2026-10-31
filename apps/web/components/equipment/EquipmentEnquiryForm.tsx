"use client";

import React, { useActionState, useState } from "react";
import { submitEquipmentEnquiry, type EnquiryActionResponse } from "@/app/actions/equipment-enquiry";
import { CheckCircle2, AlertCircle, Loader2, Send, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EquipmentEnquiryFormProps {
  equipmentId?: string;
  equipmentName?: string;
  className?: string;
  onSuccess?: () => void;
}

const initialState: EnquiryActionResponse = {
  success: false,
};

export function EquipmentEnquiryForm({
  equipmentId,
  equipmentName,
  className,
  onSuccess,
}: EquipmentEnquiryFormProps) {
  const [requirementType, setRequirementType] = useState<"rental" | "purchase" | "both">("rental");
  const [state, formAction, isPending] = useActionState(submitEquipmentEnquiry, initialState);

  return (
    <div
      id="quote-enquiry"
      className={cn(
        "rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 shadow-sm",
        className
      )}
    >
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-[#0284c7]/10 text-[#0284c7] mb-3 border border-[#0284c7]/20">
          <ShieldCheck className="size-3.5" />
          <span>Quick Quotation &amp; Logistics</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {equipmentName ? `Request Quote for ${equipmentName}` : "Request Equipment Quotation"}
        </h3>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
          Submit your project requirements. Our equipment specialists will respond within 2 hours with customized rental or outright purchase terms.
        </p>
      </div>

      {state.success ? (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 flex flex-col items-center text-center">
          <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400 mb-3" />
          <h4 className="text-base sm:text-lg font-bold mb-1">Quotation Request Submitted</h4>
          <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 max-w-md leading-relaxed mb-4">
            {state.message}
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400">
            <span>Direct Hotline:</span>
            <span className="font-bold">+91 98200 00000</span>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4 sm:space-y-5">
          {/* Hidden Fields for Context & Anti-Spam */}
          {equipmentId && <input type="hidden" name="equipment_id" value={equipmentId} />}
          <input
            type="text"
            name="website_url_hp"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          {/* Error Banner */}
          {state.error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Segmented Toggle: Rental vs Purchase vs Both */}
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-2 font-semibold">
              Requirement Type *
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setRequirementType("rental")}
                className={cn(
                  "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer",
                  requirementType === "rental"
                    ? "bg-white dark:bg-[#1f1f1f] text-neutral-900 dark:text-white shadow-2xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Rental
              </button>
              <button
                type="button"
                onClick={() => setRequirementType("purchase")}
                className={cn(
                  "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer",
                  requirementType === "purchase"
                    ? "bg-white dark:bg-[#1f1f1f] text-neutral-900 dark:text-white shadow-2xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Purchase
              </button>
              <button
                type="button"
                onClick={() => setRequirementType("both")}
                className={cn(
                  "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer",
                  requirementType === "both"
                    ? "bg-white dark:bg-[#1f1f1f] text-neutral-900 dark:text-white shadow-2xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Both
              </button>
            </div>
            <input type="hidden" name="requirement_type" value={requirementType} />
          </div>

          {/* 2-Column Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="customer_name"
                className="text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block mb-1 font-medium"
              >
                Full Name *
              </label>
              <input
                id="customer_name"
                name="customer_name"
                type="text"
                required
                placeholder="e.g. Rajesh Sharma"
                className={cn(
                  "w-full py-2.5 px-3.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900/80 border text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#0284c7]",
                  state.fieldErrors?.customer_name
                    ? "border-red-500"
                    : "border-neutral-300 dark:border-neutral-700"
                )}
              />
              {state.fieldErrors?.customer_name && (
                <span className="text-[11px] text-red-500 mt-1 block">
                  {state.fieldErrors.customer_name[0]}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="company_name"
                className="text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block mb-1 font-medium"
              >
                Company Name (Optional)
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                placeholder="e.g. L&T Construction"
                className="w-full py-2.5 px-3.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#0284c7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="phone"
                className="text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block mb-1 font-medium"
              >
                Mobile Number (10 digits) *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="e.g. 9820123456"
                className={cn(
                  "w-full py-2.5 px-3.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900/80 border text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#0284c7]",
                  state.fieldErrors?.phone
                    ? "border-red-500"
                    : "border-neutral-300 dark:border-neutral-700"
                )}
              />
              {state.fieldErrors?.phone && (
                <span className="text-[11px] text-red-500 mt-1 block">
                  {state.fieldErrors.phone[0]}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block mb-1 font-medium"
              >
                Work Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="e.g. procurement@company.com"
                className={cn(
                  "w-full py-2.5 px-3.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900/80 border text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#0284c7]",
                  state.fieldErrors?.email
                    ? "border-red-500"
                    : "border-neutral-300 dark:border-neutral-700"
                )}
              />
              {state.fieldErrors?.email && (
                <span className="text-[11px] text-red-500 mt-1 block">
                  {state.fieldErrors.email[0]}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="project_location"
                className="text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block mb-1 font-medium"
              >
                Project Site Location / City *
              </label>
              <input
                id="project_location"
                name="project_location"
                type="text"
                required
                placeholder="e.g. Pune Industrial Corridor"
                className={cn(
                  "w-full py-2.5 px-3.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900/80 border text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#0284c7]",
                  state.fieldErrors?.project_location
                    ? "border-red-500"
                    : "border-neutral-300 dark:border-neutral-700"
                )}
              />
            </div>

            {(requirementType === "rental" || requirementType === "both") && (
              <div>
                <label
                  htmlFor="rental_duration"
                  className="text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block mb-1 font-medium"
                >
                  Estimated Rental Period
                </label>
                <input
                  id="rental_duration"
                  name="rental_duration"
                  type="text"
                  placeholder="e.g. 3 Months / Long-Term Lease"
                  className="w-full py-2.5 px-3.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#0284c7]"
                />
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="additional_requirements"
              className="text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block mb-1 font-medium"
            >
              Additional Project Requirements / Site Conditions
            </label>
            <textarea
              id="additional_requirements"
              name="additional_requirements"
              rows={3}
              placeholder="Specify required working height, indoor/outdoor surface, floor loading constraints, or target delivery date..."
              className="w-full py-2.5 px-3.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#0284c7] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Sending Enquiry...</span>
              </>
            ) : (
              <>
                <span>Request Equipment Assistance</span>
                <Send className="size-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-neutral-400 dark:text-neutral-500">
            Guaranteed SLA: Response within 2 business hours. Your contact details are protected under our Data Privacy Policy.
          </p>
        </form>
      )}
    </div>
  );
}
