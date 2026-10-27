import React from "react";
import { Card } from "@/components/ui/Card";
import { Activity } from "lucide-react";

export interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  badge?: string;
}

interface ActivityWidgetProps {
  items: ActivityItem[];
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export function ActivityWidget({
  items,
  title = "Recent System Activity",
  emptyMessage = "No recent activity recorded today.",
  className = "",
}: ActivityWidgetProps) {
  return (
    <Card
      padding="none"
      className={`p-3.5 sm:p-4 md:p-5 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-[var(--radius-md)] shadow-2xs ${className}`}
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-2">
          <Activity size={16} className="w-4 h-4 text-[var(--color-mute)] shrink-0" />
          <h3 className="text-xs sm:text-sm font-semibold font-mono text-[var(--color-ink)] uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium">
          Live Stream
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-mute)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex items-start justify-between gap-3 text-xs p-1.5 -mx-1.5 rounded hover:bg-[var(--color-canvas)] transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium text-[var(--color-ink)] truncate">
                  {item.title}
                </div>
                {item.description && (
                  <div className="text-[11px] text-[var(--color-mute)] truncate mt-0.5">
                    {item.description}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-[10px] text-[var(--color-mute)] font-mono tabular-nums">
                {item.timestamp}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
