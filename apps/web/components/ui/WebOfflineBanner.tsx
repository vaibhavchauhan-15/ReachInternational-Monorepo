"use client";

import React, { useState, useEffect } from "react";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { Wifi, RefreshCw, CheckCircle2 } from "@/components/icons";
import { AnimatePresence, motion } from "framer-motion";

export function WebOfflineBanner() {
  const { isOffline } = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setShowRestored(false);
    } else if (wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  const handleCheckConnection = async () => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/health", { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // Still offline
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] w-full bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/25 px-4 py-2 backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <Wifi className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 opacity-70" />
              <span className="truncate">
                You are currently offline. Field updates and queries cannot be synced until connection is restored.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCheckConnection}
              disabled={isChecking}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/30 text-xs font-semibold cursor-pointer active:scale-95 transition-all"
            >
              <RefreshCw className={`h-3 w-3 ${isChecking ? "animate-spin" : ""}`} />
              <span>{isChecking ? "Checking..." : "Retry"}</span>
            </button>
          </div>
        </motion.div>
      )}

      {showRestored && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] w-full bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/25 px-4 py-1.5 backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Connection restored. Online synchronization active.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
