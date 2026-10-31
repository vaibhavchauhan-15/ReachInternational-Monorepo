"use client";

import React from "react";
import { EquipmentCard } from "./EquipmentCard";
import type { FeaturedEquipmentCard } from "@/lib/queries/equipment";
import { cn } from "@/lib/utils";

export interface RelatedEquipmentProps {
  items: FeaturedEquipmentCard[];
  className?: string;
}

export function RelatedEquipment({ items, className }: RelatedEquipmentProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="related-equipment-heading" className={cn("space-y-6", className)}>
      <div className="pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <h3
          id="related-equipment-heading"
          className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white"
        >
          Related Machinery in this Category
        </h3>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Explore alternative lifting heights, payload capacities, and power configurations
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {items.map((eq) => (
          <EquipmentCard key={eq.id} equipment={eq} />
        ))}
      </div>
    </section>
  );
}
