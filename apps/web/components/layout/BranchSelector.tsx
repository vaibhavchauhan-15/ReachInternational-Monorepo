"use client";

import { useState, useEffect } from "react";
import { AnimatedBuilding2, AnimatedChevronDown } from "@/components/ui/animated-icons";
import type { Branch } from "@/lib/types/database";
import { getBranchesAction } from "@/app/actions/branches";

export interface BranchSelectorProps {
  currentBranchId?: string | null;
  onSelectBranch?: (branchId: string | null) => void;
}

export function BranchSelector({ currentBranchId, onSelectBranch }: BranchSelectorProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentBranchId || null);

  useEffect(() => {
    getBranchesAction().then((res) => {
      if (res.success && res.data) {
        setBranches(res.data);
      }
    });
  }, []);

  const selectedBranch = branches.find((b) => b.id === selectedId);

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (onSelectBranch) onSelectBranch(id);
  };

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs text-[var(--color-ink)] shadow-2xs">
        <AnimatedBuilding2 size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
        <select
          value={selectedId || ""}
          onChange={(e) => handleSelect(e.target.value || null)}
          className="bg-transparent font-semibold focus:outline-none cursor-pointer text-xs pr-4 appearance-none"
        >
          <option value="">All Branches (Company Wide)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.city})
            </option>
          ))}
        </select>
        <AnimatedChevronDown size={12} className="text-[var(--color-mute)] pointer-events-none -ml-3" />
      </div>
    </div>
  );
}
