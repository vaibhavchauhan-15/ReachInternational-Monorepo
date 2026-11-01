"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  FilterToolbar,
  FilterDropdown,
  FilterChips,
  type FilterChipItem,
  type FilterDropdownOption,
} from "@/components/ui";
import {
  EquipmentCardGrid,
  EquipmentEnquiryForm,
} from "@/components/equipment";
import type {
  EquipmentSegment,
} from "@reachinternational/types";
import type {
  FeaturedEquipmentCard,
  FilterOptions,
  CategoryWithMeta,
} from "@/lib/queries/equipment";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";

export interface CategoryListingViewProps {
  segment: EquipmentSegment;
  category?: CategoryWithMeta;
  allCategoriesInSegment?: CategoryWithMeta[];
  equipmentItems: FeaturedEquipmentCard[];
  totalCount: number;
  filterOptions: FilterOptions;
  faqs?: Array<{ q: string; a: string }>;
}

export function CategoryListingView({
  segment,
  category,
  equipmentItems,
  totalCount,
  filterOptions,
  faqs,
}: CategoryListingViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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

  // Active query parameters
  const currentQuery = searchParams.get("q") || "";
  const currentBrand = searchParams.get("brand") || "";
  const currentSubtype = searchParams.get("subtype") || "";
  const currentPower = searchParams.get("power") || "";
  const isRental = searchParams.get("rental") === "true";
  const isPurchase = searchParams.get("purchase") === "true";
  const currentSort = searchParams.get("sort") || "featured";

  const currentOffering = isRental ? "rental" : isPurchase ? "purchase" : "all";

  // Local state for instant search input
  const [localSearch, setLocalSearch] = useState(currentQuery);
  const [prevQuery, setPrevQuery] = useState(currentQuery);

  // Sync state if queryParam changed from external navigation or chip removal
  if (currentQuery !== prevQuery) {
    setPrevQuery(currentQuery);
    setLocalSearch(currentQuery);
  }

  // Helper to update query params safely
  const updateFilter = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      params.delete("page"); // Reset page on filter change
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  // Debounced search input sync
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = localSearch.trim();
      if (trimmed !== currentQuery) {
        updateFilter({ q: trimmed || null });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [localSearch, currentQuery, updateFilter]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = localSearch.trim();
    if (trimmed !== currentQuery) {
      updateFilter({ q: trimmed || null });
    }
  };

  const handleResetAllFilters = useCallback(() => {
    setLocalSearch("");
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  }, [pathname, router]);

  // Dropdown options
  const offeringOptions: FilterDropdownOption[] = [
    { value: "all", label: "All Offerings" },
    { value: "rental", label: "Rental Available", count: filterOptions.rentalCount },
    { value: "purchase", label: "Direct Purchase", count: filterOptions.purchaseCount },
  ];

  const brandOptions: FilterDropdownOption[] = [
    { value: "all", label: "All Brands" },
    ...filterOptions.brands.map((b) => ({
      value: b.value,
      label: b.label,
      count: b.count,
    })),
  ];

  const subtypeOptions: FilterDropdownOption[] = [
    { value: "all", label: "All Subtypes" },
    ...filterOptions.subtypes.map((s) => ({
      value: s.value,
      label: s.label,
      count: s.count,
    })),
  ];

  const powerOptions: FilterDropdownOption[] = [
    { value: "all", label: "All Power Sources" },
    ...filterOptions.powerSources.map((p) => ({
      value: p.value,
      label: p.label,
      count: p.count,
    })),
  ];

  const sortOptions: FilterDropdownOption[] = [
    { value: "featured", label: "Featured" },
    { value: "name_asc", label: "Model Name (A-Z)" },
    { value: "name_desc", label: "Model Name (Z-A)" },
    { value: "height_asc", label: "Working Height (Low to High)" },
    { value: "height_desc", label: "Working Height (High to Low)" },
  ];

  // Active filter count for FilterToolbar button badge
  const activeFilterCount =
    (isRental ? 1 : 0) +
    (isPurchase ? 1 : 0) +
    (currentBrand ? 1 : 0) +
    (currentSubtype ? 1 : 0) +
    (currentPower ? 1 : 0) +
    (currentSort && currentSort !== "featured" ? 1 : 0);

  // Build active filter chips
  const filterChips: FilterChipItem[] = [];

  if (currentQuery) {
    filterChips.push({
      id: "query",
      label: "Search",
      valueLabel: `"${currentQuery}"`,
      onRemove: () => {
        setLocalSearch("");
        updateFilter({ q: null });
      },
    });
  }

  if (isRental) {
    filterChips.push({
      id: "rental",
      label: "Offering",
      valueLabel: "Rental Available",
      onRemove: () => updateFilter({ rental: null }),
    });
  }

  if (isPurchase) {
    filterChips.push({
      id: "purchase",
      label: "Offering",
      valueLabel: "Direct Purchase",
      onRemove: () => updateFilter({ purchase: null }),
    });
  }

  if (currentBrand) {
    const brandObj = filterOptions.brands.find((b) => b.value === currentBrand);
    filterChips.push({
      id: "brand",
      label: "Brand",
      valueLabel: brandObj ? brandObj.label : currentBrand.toUpperCase(),
      onRemove: () => updateFilter({ brand: null }),
    });
  }

  if (currentSubtype) {
    const subtypeObj = filterOptions.subtypes.find((s) => s.value === currentSubtype);
    filterChips.push({
      id: "subtype",
      label: "Subtype",
      valueLabel: subtypeObj ? subtypeObj.label : currentSubtype,
      onRemove: () => updateFilter({ subtype: null }),
    });
  }

  if (currentPower) {
    const powerObj = filterOptions.powerSources.find((p) => p.value === currentPower);
    filterChips.push({
      id: "power",
      label: "Power",
      valueLabel: powerObj ? powerObj.label : currentPower,
      onRemove: () => updateFilter({ power: null }),
    });
  }

  if (currentSort && currentSort !== "featured") {
    const sortLabels: Record<string, string> = {
      name_asc: "Model A-Z",
      name_desc: "Model Z-A",
      height_asc: "Height (Low to High)",
      height_desc: "Height (High to Low)",
    };
    filterChips.push({
      id: "sort",
      label: "Sort",
      valueLabel: sortLabels[currentSort] || currentSort,
      onRemove: () => updateFilter({ sort: null }),
    });
  }

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
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-950 dark:text-white mb-3">
              {pageTitle}
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl">
              {pageDescription}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        {/* Existing Canonical FilterToolbar with Search, Filters & Sorting */}
        <FilterToolbar
          searchQuery={localSearch}
          onSearchChange={handleSearchChange}
          onSubmitSearch={handleSearchSubmit}
          placeholder={`Search in ${pageTitle}...`}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetAllFilters}
          isLoading={isPending}
          actions={
            <span className="text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap px-2 hidden sm:inline-block">
              <span className="font-bold text-neutral-900 dark:text-white">{totalCount}</span>{" "}
              {totalCount === 1 ? "Machine" : "Machines"} Available
            </span>
          }
        >
          {/* Expandable Filter Controls Drawer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3 w-full">
            <FilterDropdown
              label="Offering"
              value={currentOffering}
              onChange={(val) => {
                if (val === "rental") updateFilter({ rental: "true", purchase: null });
                else if (val === "purchase") updateFilter({ purchase: "true", rental: null });
                else updateFilter({ rental: null, purchase: null });
              }}
              options={offeringOptions}
            />

            {filterOptions.brands.length > 0 && (
              <FilterDropdown
                label="Brand"
                value={currentBrand || "all"}
                onChange={(val) => updateFilter({ brand: val === "all" ? null : val })}
                options={brandOptions}
              />
            )}

            {filterOptions.subtypes.length > 0 && (
              <FilterDropdown
                label="Subtype"
                value={currentSubtype || "all"}
                onChange={(val) => updateFilter({ subtype: val === "all" ? null : val })}
                options={subtypeOptions}
              />
            )}

            {filterOptions.powerSources.length > 0 && (
              <FilterDropdown
                label="Power"
                value={currentPower || "all"}
                onChange={(val) => updateFilter({ power: val === "all" ? null : val })}
                options={powerOptions}
              />
            )}

            <FilterDropdown
              label="Sort"
              value={currentSort}
              onChange={(val) => updateFilter({ sort: val === "featured" ? null : val })}
              options={sortOptions}
            />
          </div>
        </FilterToolbar>

        {/* Active Filter Chips */}
        {filterChips.length > 0 && (
          <FilterChips
            chips={filterChips}
            onClearAll={handleResetAllFilters}
            className="mt-3"
          />
        )}

        {/* Full-Width Main Equipment Cards Grid */}
        <div className="mt-8">
          <EquipmentCardGrid
            items={equipmentItems}
            onClearFilters={handleResetAllFilters}
          />
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
