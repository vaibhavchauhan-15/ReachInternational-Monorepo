"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { CategoryWithMeta } from "@/lib/queries/equipment";
import { cn } from "@/lib/utils";

export interface EquipmentCategoryCardProps {
  category: CategoryWithMeta;
  className?: string;
  priority?: boolean;
}

export function EquipmentCategoryCard({
  category,
  className,
  priority = false,
}: EquipmentCategoryCardProps) {
  const categoryUrl = `/equipment/${category.segment.slug}/${category.slug}`;

  return (
    <Link
      href={categoryUrl}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl sm:rounded-2xl p-2 sm:p-2.5 transition-all duration-300",
        "bg-white dark:bg-[#121212]",
        "border border-neutral-200/90 dark:border-neutral-800/90",
        "hover:border-neutral-300 dark:hover:border-neutral-700",
        "shadow-xs hover:shadow-lg dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]",
        "hover:-translate-y-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0284c7]",
        className
      )}
    >
      <div>
        {/* Visual Stage */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg sm:rounded-xl bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/5">
          <Image
            src={category.image_url || "/images/awp_boom_lift.jpg"}
            alt={`${category.name} machinery category`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />

          <div
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"
            aria-hidden="true"
          />

          {/* Top Segment Tag & Model Count */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider backdrop-blur-md bg-white/90 text-neutral-900 dark:bg-black/85 dark:text-neutral-100 border border-black/5 dark:border-white/10">
              {category.segment.slug.toUpperCase()}
            </span>

            {category.models_count !== undefined && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md bg-black/65 text-white/95 border border-white/15">
                {category.models_count} {category.models_count === 1 ? "Model" : "Models"}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-4">
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white group-hover:text-[#0284c7] transition-colors">
            {category.name}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed mt-1.5">
            {category.description}
          </p>
        </div>
      </div>

      {/* Action Row */}
      <div className="px-3.5 pb-2 sm:px-4 sm:pb-3 pt-0 flex items-center justify-between text-xs font-semibold text-[#0284c7] dark:text-[#38bdf8]">
        <span>Explore category</span>
        <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 group-hover:bg-[#0284c7] group-hover:text-white transition-all duration-300 group-hover:translate-x-0.5">
          <ArrowRight className="size-3" />
        </div>
      </div>
    </Link>
  );
}
