"use client";

import React from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  EquipmentSearch,
  EquipmentCardGrid,
  EquipmentFilterPanel,
  EquipmentFilterDrawer,
  EquipmentSort,
  EquipmentEnquiryForm,
} from "@/components/equipment";
import type {
  EquipmentSegment,
  EquipmentCategory,
} from "@reachinternational/types";
import type {
  FeaturedEquipmentCard,
  FilterOptions,
  CategoryWithMeta,
} from "@/lib/queries/equipment";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";
import { ShieldCheck, HelpCircle } from "lucide-react";

export interface CategoryListingViewProps {
  segment: EquipmentSegment;
  category?: CategoryWithMeta;
  allCategoriesInSegment: CategoryWithMeta[];
  equipmentItems: FeaturedEquipmentCard[];
  totalCount: number;
  filterOptions: FilterOptions;
  faqs?: Array<{ q: string; a: string }>;
}

export function CategoryListingView({
  segment,
  category,
  allCategoriesInSegment,
  equipmentItems,
  totalCount,
  filterOptions,
  faqs,
}: CategoryListingViewProps) {
  const isCategoryPage = !!category;
  const pageTitle = isCategoryPage ? category.name : segment.name;
  const pageDescription = isCategoryPage
    ? category.description || `Explore ${category.name} available for rental and purchase across India.`
    : segment.description || `Explore ${segment.name} available for rental and purchase across India.`;

  // Breadcrumbs
  const breadcrumbItems = [
    { label: "Equipment", href: "/equipment" },
    {
      label: segment.name,
      href: `/equipment/${segment.slug}`,
    },
    ...(isCategoryPage && category
      ? [{ label: category.name }]
      : []),
  ];

  return (
    <div className="bg-[#fafafa] dark:bg-[#0a0a0a] min-h-screen pb-20">
      {/* Top Banner / Breadcrumbs Bar */}
      <div className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <Breadcrumb items={breadcrumbItems} showHome homeHref="/" />
        </div>
      </div>

      {/* Hero Category Header */}
      <header className="py-10 sm:py-14 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-[#0284c7]/10 text-[#0284c7] mb-3 border border-[#0284c7]/20">
              <ShieldCheck className="size-3.5" />
              <span>{segment.name} Division</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-950 dark:text-white mb-3">
              {pageTitle}
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl">
              {pageDescription}
            </p>
          </div>

          {/* Sibling Category Pill Navigation Strip */}
          {allCategoriesInSegment.length > 1 && (
            <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800/80">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-3 font-medium">
                Categories in this Division:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <Link
                  href={`/equipment/${segment.slug}`}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    !isCategoryPage
                      ? "bg-[#0284c7] text-white shadow-2xs"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  All {segment.slug.toUpperCase()}
                </Link>

                {allCategoriesInSegment.map((cat) => {
                  const isSelected = category?.slug === cat.slug;
                  return (
                    <Link
                      key={cat.id}
                      href={`/equipment/${segment.slug}/${cat.slug}`}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                        isSelected
                          ? "bg-[#0284c7] text-white shadow-2xs"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {cat.name} ({cat.models_count})
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout: Sidebar + Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        {/* Controls Toolbar: Search, Result Count, Mobile Filter Trigger, Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-neutral-200/80 dark:border-neutral-800">
          <div className="flex-1 max-w-md">
            <EquipmentSearch
              placeholder={`Search in ${pageTitle}...`}
              targetUrl={isCategoryPage && category ? `/equipment/${segment.slug}/${category.slug}` : `/equipment/${segment.slug}`}
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-300">
              <span className="font-bold text-neutral-900 dark:text-white">{totalCount}</span>{" "}
              {totalCount === 1 ? "Machine" : "Machines"} Available
            </span>

            {/* Mobile Filter Drawer Trigger */}
            <EquipmentFilterDrawer filterOptions={filterOptions} totalResults={totalCount} />

            {/* Sort Control */}
            <EquipmentSort />
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Desktop Left Sidebar: Dynamic Filters */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-24">
            <EquipmentFilterPanel filterOptions={filterOptions} totalResults={totalCount} />
          </aside>

          {/* Main Equipment Cards Grid */}
          <div className="lg:col-span-3">
            <EquipmentCardGrid items={equipmentItems} />
          </div>
        </div>

        {/* Relevant FAQs Section (if provided) */}
        {faqs && faqs.length > 0 && (
          <section aria-labelledby="faqs-heading" className="mt-20 pt-12 border-t border-neutral-200/80 dark:border-neutral-800">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                  Common Questions
                </span>
                <h2
                  id="faqs-heading"
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white"
                >
                  Frequently Asked Questions about {pageTitle}
                </h2>
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

        {/* Category Assistance CTA */}
        <section aria-labelledby="enquiry-cta-heading" className="mt-20">
          <EquipmentEnquiryForm />
        </section>
      </main>
    </div>
  );
}
