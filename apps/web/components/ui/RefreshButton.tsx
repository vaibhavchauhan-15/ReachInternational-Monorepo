"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedRefresh } from "./animated-icons";
import { Button, type ButtonVariant } from "./Button";
import { useToast } from "./Toast";
import { InfoTooltip } from "./tooltip";
import { refreshPageDataAction } from "@/app/actions/refresh";

export interface RefreshButtonProps {
  path?: string;
  tag?: string;
  variant?: ButtonVariant;
  showLabel?: boolean;
  label?: string;
  tooltipText?: string;
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

export function RefreshButton({
  path,
  tag,
  variant = "secondary",
  showLabel = true,
  label = "Refresh",
  tooltipText = "Refresh live database values without full page reload",
  onRefresh,
  className = "",
}: RefreshButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        if (onRefresh) {
          await onRefresh();
        }
        await refreshPageDataAction(path, tag);
        router.refresh();

        const nowTime = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setLastRefreshed(nowTime);

        toast(
          "success",
          "Database Refreshed",
          `Updated live data from server at ${nowTime}.`
        );
      } catch (error) {
        console.error("Error refreshing data:", error);
        toast(
          "error",
          "Refresh Failed",
          "Unable to refresh database values. Please try again."
        );
      }
    });
  };

  const buttonContent = (
    <Button
      variant={variant}
      onClick={handleRefresh}
      disabled={isPending}
      className={`relative inline-flex items-center gap-1.5 transition-all ${className}`}
      aria-label={label}
    >
      <AnimatedRefresh
        isSpinning={isPending}
        size={14}
        className={isPending ? "text-blue-500" : "text-[var(--color-mute)]"}
      />
      {showLabel && (
        <span className="text-xs font-semibold">
          {isPending ? "Syncing..." : label}
        </span>
      )}
    </Button>
  );

  if (tooltipText) {
    return (
      <InfoTooltip content={`${tooltipText}${lastRefreshed ? ` (Last: ${lastRefreshed})` : ""}`}>
        {buttonContent}
      </InfoTooltip>
    );
  }

  return buttonContent;
}
