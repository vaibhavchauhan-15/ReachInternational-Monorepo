"use client";

import React from "react";
import { SegmentedToggle } from "@/components/ui";

interface EntryHeaderProps {
  operatorName?: string;
  activeTab: "entry" | "history";
  onTabChange: (tab: "entry" | "history") => void;
  historyCount?: number;
}

export function EntryHeader({
  activeTab,
  onTabChange,
  historyCount,
}: EntryHeaderProps) {
  return (
    <div className="w-full">
      <SegmentedToggle<"entry" | "history">
        value={activeTab}
        onChange={onTabChange}
        layoutIdPrefix="operator-entry-tab"
        items={[
          {
            id: "entry",
            label: "Log Entry",
          },
          {
            id: "history",
            label: "Log History",
            count: historyCount,
          },
        ]}
      />
    </div>
  );
}
