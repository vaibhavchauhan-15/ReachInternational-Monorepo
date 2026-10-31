"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { EquipmentSegment } from "@reachinternational/types";
import { cn } from "@/lib/utils";

export interface EquipmentSegmentCardProps {
  segment: EquipmentSegment;
  imageSrc: string;
  keyCategories: string[];
  className?: string;
  priority?: boolean;
}

export function EquipmentSegmentCard({
  segment,
  imageSrc,
  keyCategories,
  className,
  priority = false,
}: EquipmentSegmentCardProps) {
  const segmentUrl = `/equipment/${segment.slug}`;

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl p-6 sm:p-8 transition-all duration-500",
        "bg-white dark:bg-[#121212]",
        "border border-neutral-200/90 dark:border-neutral-800/90",
        "hover:border-neutral-300 dark:hover:border-neutral-700",
        "shadow-sm hover:shadow-xl dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.6)]",
        className
      )}
    >
      <div className="relative z-10">
        {/* Eyebrow & Badge */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60">
            {segment.slug.toUpperCase()} Division
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Certified Fleet
          </span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-3 group-hover:text-[#0284c7] transition-colors">
          {segment.name}
        </h3>

        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xl mb-6">
          {segment.description}
        </p>

        {/* Machinery Subtypes List */}
        <div className="space-y-2 mb-8">
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Available Machinery Lines:
          </span>
          <ul className="grid grid-cols-2 gap-2 pt-1">
            {keyCategories.map((cat) => (
              <li
                key={cat}
                className="flex items-center gap-2 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-200"
              >
                <CheckCircle2 className="size-3.5 text-[#0284c7] shrink-0" />
                <span>{cat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Visual Image Backdrop */}
      <div className="relative w-full aspect-[21/9] sm:aspect-[16/8] rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/5 mb-6">
        <Image
          src={imageSrc}
          alt={`${segment.name} fleet preview`}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          priority={priority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-104"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Bottom CTA Action */}
      <div className="relative z-10 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Rental &amp; Purchase Across India
        </span>

        <Link
          href={segmentUrl}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs transition-all duration-200 group-hover:translate-x-0.5"
        >
          <span>Explore {segment.slug.toUpperCase()}</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
