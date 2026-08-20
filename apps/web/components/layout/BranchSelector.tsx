"use client";

import { useState, useEffect } from "react";
import { AnimatedBuilding2 } from "@/components/ui/animated-icons";
import { Select } from "@/components/ui";
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

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (onSelectBranch) onSelectBranch(id);
  };

  const branchOptions = [
    { value: "", label: "All Branches (Company Wide)" },
    ...branches.map((b) => ({
      value: b.id,
      label: `${b.name} (${b.city})`,
    })),
  ];

  return (
    <div className="relative inline-flex items-center min-w-[200px]">
      <Select
        value={selectedId || ""}
        onChange={(e) => handleSelect(e.target.value || null)}
        options={branchOptions}
        className="w-full text-xs font-semibold"
      />
    </div>
  );
}
