"use client";

import React from "react";
import type { ApprovalRequestListItem } from "@reachinternational/types";
import { ApprovalTypeBadge } from "./ApprovalTypeBadge";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { formatTinyRelativeTime } from "@reachinternational/utils";
import { ChevronRight, Clock, User } from "lucide-react";

export interface ApprovalRowProps {
  item: ApprovalRequestListItem;
  isSelected?: boolean;
  onSelect: (item: ApprovalRequestListItem) => void;
}

export function ApprovalRow({ item, isSelected = false, onSelect }: ApprovalRowProps) {
  return (
    <div
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer min-h-[44px] ${
        isSelected
          ? "bg-sky-500/10 border-sky-500/40 shadow-xs"
          : "bg-[var(--color-canvas-elevated)] border-[var(--color-border)] hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-[var(--color-canvas)]"
      }`}
    >
      <div className="flex flex-col gap-1.5 min-w-0 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ApprovalTypeBadge typeKey={item.type_key} typeLabel={item.type_label} />
          <ApprovalStatusBadge status={item.status} />
        </div>

        <div className="text-sm font-semibold text-[var(--color-ink)] truncate leading-tight">
          {item.summary}
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
          <span className="flex items-center gap-1 truncate">
            <User size={12} className="shrink-0" />
            <span className="truncate">{item.requester_name || "System"}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock size={12} className="shrink-0" />
            <span>{formatTinyRelativeTime(item.created_at)}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center shrink-0 text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink)] transition-colors">
        <ChevronRight size={16} />
      </div>
    </div>
  );
}
