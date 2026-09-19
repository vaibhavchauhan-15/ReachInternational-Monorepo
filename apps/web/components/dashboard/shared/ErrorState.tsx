"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface DashboardErrorStateProps {
  error?: Error;
  reset?: () => void;
  title?: string;
  message?: string;
}

export function DashboardErrorState({
  error,
  reset,
  title = "Failed to load dashboard data",
  message = "An error occurred while communicating with the telemetry service. Please try reloading.",
}: DashboardErrorStateProps) {
  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <Card className="p-6 sm:p-8 text-center space-y-4 border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/15">
        <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)]">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1.5 max-w-sm mx-auto">
            {error?.message || message}
          </p>
        </div>

        {reset && (
          <div className="pt-2">
            <Button
              onClick={() => reset()}
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-2 border-[var(--color-hairline)]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
