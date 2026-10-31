"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpDown, Package, Zap, CheckCircle2, Shield } from "lucide-react";
import type { FeaturedEquipmentCard } from "@/lib/queries/equipment";
import { cn } from "@/lib/utils";

export interface EquipmentCardProps {
  equipment: FeaturedEquipmentCard;
  className?: string;
  priorityImage?: boolean;
  onEnquireClick?: (equipmentId: string, modelName: string) => void;
}

export function EquipmentCard({
  equipment,
  className,
  priorityImage = false,
  onEnquireClick,
}: EquipmentCardProps) {
  const detailUrl = `/equipment/${equipment.category.slug}/${equipment.slug}`;

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between rounded-xl sm:rounded-2xl transition-all duration-300",
        "bg-white dark:bg-[#121212]",
        "border border-neutral-200/90 dark:border-neutral-800/90",
        "hover:border-neutral-300 dark:hover:border-neutral-700",
        "shadow-xs hover:shadow-lg dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]",
        "hover:-translate-y-1 focus-within:ring-2 focus-within:ring-[#0284c7]",
        className
      )}
    >
      <div>
        {/* Visual Stage Container */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl sm:rounded-t-2xl bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/5">
          <Link href={detailUrl} tabIndex={-1} aria-hidden="true" className="block w-full h-full">
            <Image
              src={equipment.primary_image_url || "/images/awp_boom_lift.jpg"}
              alt={`${equipment.model_name} - ${equipment.brand.name} machinery`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={priorityImage}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </Link>

          {/* Top Badges: Brand & Availability */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10 gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold uppercase tracking-wider backdrop-blur-md bg-white/95 text-neutral-900 dark:bg-black/90 dark:text-neutral-100 shadow-2xs border border-black/5 dark:border-white/10">
              {equipment.brand.name}
            </span>

            <div className="flex items-center gap-1.5">
              {equipment.rental_available && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 backdrop-blur-xs">
                  Rental
                </span>
              )}
              {equipment.purchase_available && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 backdrop-blur-xs">
                  Sale
                </span>
              )}
            </div>
          </div>

          {/* Category Subtype Tag */}
          <div className="absolute bottom-2.5 left-3 pointer-events-none z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-md bg-black/60 text-white/95 border border-white/10">
              {equipment.subtype || equipment.category.name}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5">
          <div className="mb-2">
            <Link href={detailUrl} className="group-hover:text-[#0284c7] transition-colors focus:outline-hidden">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white line-clamp-1">
                {equipment.model_name}
              </h3>
            </Link>
            <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
              Model: {equipment.model_number}
            </p>
          </div>

          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed mb-4">
            {equipment.short_description}
          </p>

          {/* Key Specifications Strip (3 relevant items) */}
          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/80 mb-4">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 dark:text-neutral-500 truncate flex items-center gap-1">
                <ArrowUpDown className="size-2.5 shrink-0 text-[#0284c7]" /> Height
              </span>
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate mt-0.5">
                {equipment.primary_working_height || "Standard"}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-x border-neutral-200/60 dark:border-neutral-800 px-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 dark:text-neutral-500 truncate flex items-center gap-1">
                <Package className="size-2.5 shrink-0 text-[#0284c7]" /> Capacity
              </span>
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate mt-0.5">
                {equipment.primary_capacity || "Heavy Duty"}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 dark:text-neutral-500 truncate flex items-center gap-1">
                <Zap className="size-2.5 shrink-0 text-[#0284c7]" /> Power
              </span>
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate mt-0.5">
                {equipment.primary_power_source
                  ? equipment.primary_power_source.split(" ")[0]
                  : "Electric"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-neutral-100 dark:border-neutral-850/60 flex items-center justify-between gap-2">
        <Link
          href={detailUrl}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <span>View specs</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>

        {onEnquireClick ? (
          <button
            type="button"
            onClick={() => onEnquireClick(equipment.id, equipment.model_name)}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-2xs transition-colors cursor-pointer"
          >
            Enquire
          </button>
        ) : (
          <Link
            href={`${detailUrl}#quote-enquiry`}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-2xs transition-colors"
          >
            Enquire
          </Link>
        )}
      </div>
    </article>
  );
}
