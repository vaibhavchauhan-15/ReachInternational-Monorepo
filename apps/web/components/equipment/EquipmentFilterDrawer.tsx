"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { SlidersHorizontal, X } from "lucide-react";
import { EquipmentFilterPanel } from "./EquipmentFilterPanel";
import type { FilterOptions } from "@/lib/queries/equipment";

export interface EquipmentFilterDrawerProps {
  filterOptions: FilterOptions;
  totalResults: number;
}

export function EquipmentFilterDrawer({
  filterOptions,
  totalResults,
}: EquipmentFilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  const currentBrand = searchParams.get("brand") || "";
  const currentSubtype = searchParams.get("subtype") || "";
  const currentPower = searchParams.get("power") || "";
  const isRental = searchParams.get("rental") === "true";
  const isPurchase = searchParams.get("purchase") === "true";
  const currentQuery = searchParams.get("q") || "";

  const activeCount =
    (currentBrand ? 1 : 0) +
    (currentSubtype ? 1 : 0) +
    (currentPower ? 1 : 0) +
    (isRental ? 1 : 0) +
    (isPurchase ? 1 : 0) +
    (currentQuery ? 1 : 0);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 shadow-2xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        aria-label="Open filter drawer"
      >
        <SlidersHorizontal className="size-4 text-[#0284c7]" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center size-5 rounded-full text-[11px] font-bold bg-[#0284c7] text-white">
            {activeCount}
          </span>
        )}
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          <Dialog.Content className="fixed inset-y-0 right-0 w-full max-w-sm sm:max-w-md bg-white dark:bg-[#121212] p-0 shadow-2xl z-50 flex flex-col focus:outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
            <VisuallyHidden.Root>
              <Dialog.Title>Equipment Filter Options</Dialog.Title>
              <Dialog.Description>
                Filter machinery by OEM brand, technical subtype, offering, or power source.
              </Dialog.Description>
            </VisuallyHidden.Root>

            {/* Mobile Drawer Top Bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-[#0284c7]" />
                <span className="font-bold text-sm uppercase font-mono tracking-wider text-neutral-900 dark:text-white">
                  Filter Equipment
                </span>
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0284c7] text-white">
                    {activeCount}
                  </span>
                )}
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Close filters"
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Scrollable Filter Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <EquipmentFilterPanel filterOptions={filterOptions} totalResults={totalResults} />
            </div>

            {/* Bottom Apply Action */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#161616]">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs transition-colors cursor-pointer"
                >
                  Show {totalResults} {totalResults === 1 ? "Result" : "Results"}
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
