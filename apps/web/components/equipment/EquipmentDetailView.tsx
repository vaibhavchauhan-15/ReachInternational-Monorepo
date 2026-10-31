"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  EquipmentGallery,
  EquipmentSpecifications,
  EquipmentDocuments,
  EquipmentEnquiryForm,
  RelatedEquipment,
  StickyEnquiryAction,
} from "@/components/equipment";
import type { EquipmentDetailData, FeaturedEquipmentCard } from "@/lib/queries/equipment";
import {
  ArrowUpDown,
  Package,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Truck,
  ArrowRight,
  Phone,
  FileCheck2,
  Clock,
} from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";

export interface EquipmentDetailViewProps {
  equipment: EquipmentDetailData;
  relatedEquipment: FeaturedEquipmentCard[];
  faqs?: Array<{ q: string; a: string }>;
}

export function EquipmentDetailView({
  equipment,
  relatedEquipment,
  faqs,
}: EquipmentDetailViewProps) {
  const segmentSlug = equipment.category.segment?.slug || "awp";
  const segmentName = equipment.category.segment?.name || "Aerial Platforms";

  // Breadcrumbs
  const breadcrumbItems = [
    { label: "Equipment", href: "/equipment" },
    { label: segmentName, href: `/equipment/${segmentSlug}` },
    { label: equipment.category.name, href: `/equipment/${segmentSlug}/${equipment.category.slug}` },
    { label: equipment.model_number },
  ];

  return (
    <div className="bg-[#fafafa] dark:bg-[#0a0a0a] min-h-screen pb-24">
      {/* Sticky Bottom Enquiry Action Bar */}
      <StickyEnquiryAction modelName={equipment.model_name} />

      {/* Top Breadcrumb Header */}
      <div className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <Breadcrumb items={breadcrumbItems} showHome homeHref="/" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        {/* ================================================================== */}
        {/* Product Overview Stage: Left Gallery, Right Specifications & Hero  */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-16">
          {/* Left Column: Image Gallery (7 cols) */}
          <div className="lg:col-span-7">
            <EquipmentGallery media={equipment.media} modelName={equipment.model_name} />
          </div>

          {/* Right Column: Key Details & Quick CTA (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              {/* Brand & Subtype Pills */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 shadow-2xs text-neutral-900 dark:text-neutral-100">
                  {equipment.brand.name}
                </span>

                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {equipment.subtype || equipment.category.name}
                </span>

                <div className="flex items-center gap-1.5 ml-auto">
                  {equipment.rental_available && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      Rental
                    </span>
                  )}
                  {equipment.purchase_available && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                      Sale
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Model Code */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white mb-1">
                {equipment.model_name}
              </h1>
              <p className="text-xs sm:text-sm font-mono text-neutral-500 dark:text-neutral-400 mb-4">
                OEM Code: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{equipment.model_number}</span>
              </p>

              {/* Short Summary */}
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
                {equipment.short_description}
              </p>

              {/* Primary Metrics Trio Card */}
              <div className="grid grid-cols-3 gap-2 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 shadow-2xs mb-6">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                    <ArrowUpDown className="size-3 text-[#0284c7]" /> Height
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white mt-1 block truncate">
                    {equipment.primary_working_height || "N/A"}
                  </span>
                </div>

                <div className="border-x border-neutral-200/70 dark:border-neutral-800 px-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                    <Package className="size-3 text-[#0284c7]" /> Capacity
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white mt-1 block truncate">
                    {equipment.primary_capacity || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                    <Zap className="size-3 text-[#0284c7]" /> Power
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white mt-1 block truncate">
                    {equipment.primary_power_source ? equipment.primary_power_source.split(" ")[0] : "Standard"}
                  </span>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="space-y-2 mb-8">
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>Certified Third-Party Fitness &amp; Statutory Safety Compliant</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                  <Clock className="size-4 text-[#0284c7] shrink-0" />
                  <span>On-site technician breakdown response under 2 hours</span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <a
                href="#quote-enquiry"
                className="w-full sm:flex-1 py-3.5 px-6 rounded-xl text-center text-sm font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs transition-colors cursor-pointer"
              >
                Request Quotation
              </a>

              <a
                href="tel:+919820000000"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-sm font-semibold bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 shadow-2xs transition-colors"
              >
                <Phone className="size-4 text-[#0284c7]" />
                <span>Call Specialist</span>
              </a>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* Section 4: Full Equipment Overview                                 */}
        {/* ================================================================== */}
        <section aria-labelledby="overview-heading" className="py-10 border-t border-neutral-200/80 dark:border-neutral-800">
          <div className="max-w-3xl">
            <h2
              id="overview-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-4"
            >
              Equipment Overview
            </h2>
            <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
              {equipment.full_description}
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* Section 5 & 6: Key & Structured Technical Specifications           */}
        {/* ================================================================== */}
        <section className="py-10 border-t border-neutral-200/80 dark:border-neutral-800">
          <EquipmentSpecifications
            groupedSpecifications={equipment.groupedSpecifications}
            keySpecifications={equipment.keySpecifications}
          />
        </section>

        {/* ================================================================== */}
        {/* Section 7 & 8: Applications, Features & Benefits                   */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10 border-t border-neutral-200/80 dark:border-neutral-800">
          {/* Features */}
          {equipment.features && equipment.features.length > 0 && (
            <section aria-labelledby="features-heading">
              <h3
                id="features-heading"
                className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white mb-4"
              >
                Features &amp; Engineering Benefits
              </h3>
              <ul className="space-y-3">
                {equipment.features.map((feat, idx) => (
                  <li
                    key={idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#121212] border border-neutral-200/80 dark:border-neutral-800/80 flex items-start gap-3 shadow-2xs"
                  >
                    <CheckCircle2 className="size-4 text-[#0284c7] shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Applications & Environments */}
          {equipment.applications && equipment.applications.length > 0 && (
            <section aria-labelledby="applications-heading">
              <h3
                id="applications-heading"
                className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white mb-4"
              >
                Applications &amp; Operating Environments
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {equipment.applications.map((app, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#121212] border border-neutral-200/80 dark:border-neutral-800/80 flex items-center gap-2.5 shadow-2xs"
                  >
                    <Building2 className="size-4 text-[#0284c7] shrink-0" />
                    <span className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                      {app}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ================================================================== */}
        {/* Section 9: Technical Documents                                     */}
        {/* ================================================================== */}
        {equipment.documents && equipment.documents.length > 0 && (
          <div className="py-10 border-t border-neutral-200/80 dark:border-neutral-800">
            <EquipmentDocuments documents={equipment.documents} modelName={equipment.model_name} />
          </div>
        )}

        {/* ================================================================== */}
        {/* Section 10: Rental / Purchase Quotation Form                       */}
        {/* ================================================================== */}
        <section aria-labelledby="enquiry-form-heading" className="py-12 border-t border-neutral-200/80 dark:border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <EquipmentEnquiryForm
              equipmentId={equipment.id}
              equipmentName={equipment.model_name}
            />
          </div>
        </section>

        {/* ================================================================== */}
        {/* Section 11: Related Equipment                                      */}
        {/* ================================================================== */}
        {relatedEquipment.length > 0 && (
          <div className="py-12 border-t border-neutral-200/80 dark:border-neutral-800">
            <RelatedEquipment items={relatedEquipment} />
          </div>
        )}

        {/* ================================================================== */}
        {/* Section 12: Frequently Asked Questions                             */}
        {/* ================================================================== */}
        {faqs && faqs.length > 0 && (
          <section aria-labelledby="faqs-heading" className="py-12 border-t border-neutral-200/80 dark:border-neutral-800">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                  Machine Questions
                </span>
                <h3
                  id="faqs-heading"
                  className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white"
                >
                  Frequently Asked Questions about {equipment.model_name}
                </h3>
              </div>

              <Accordion type="single" collapsible variant="card">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger>{faq.q}</AccordionTrigger>
                    <AccordionContent>{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
