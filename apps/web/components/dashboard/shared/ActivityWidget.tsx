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
      className={`p-3.5 sm:p-4 md:p-5 border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-canvas)] rounded-[var(--radius-md)] ${className}`}
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-2">
          <Activity size={16} className="w-4 h-4 text-[var(--color-mute)] shrink-0" />
          <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <span className="text-[11px] text-[var(--color-mute)]">Live Stream</span>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-mute)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex items-start justify-between gap-3 text-xs"
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
              <div className="shrink-0 text-[10px] text-[var(--color-mute)] font-mono">
                {item.timestamp}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
