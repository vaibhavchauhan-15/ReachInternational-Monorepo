"use client";

import React from "react";
import { EquipmentCard } from "./EquipmentCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FeaturedEquipmentCard } from "@/lib/queries/equipment";
import { cn } from "@/lib/utils";

export interface EquipmentCardGridProps {
  items: FeaturedEquipmentCard[];
  className?: string;
  onClearFilters?: () => void;
  onEnquireClick?: (equipmentId: string, modelName: string) => void;
}

export function EquipmentCardGrid({
  items,
  className,
  onClearFilters,
  onEnquireClick,
}: EquipmentCardGridProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 sm:py-16">
        <EmptyState
          variant="filtered"
          title="No Equipment Matches Your Criteria"
          description="We couldn't find any machines matching your selected filters or search terms. Try adjusting your parameters or clearing the filters."
          actionLabel={onClearFilters ? "Clear All Filters" : undefined}
          onAction={onClearFilters}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7",
        className
      )}
    >
      {items.map((eq, idx) => (
        <EquipmentCard
          key={eq.id}
          equipment={eq}
          priorityImage={idx < 3}
          onEnquireClick={onEnquireClick}
        />
      ))}
    </div>
  );
}
