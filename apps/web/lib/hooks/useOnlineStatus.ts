"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Authoritative Web Network Reachability Hook
 * Uses React useSyncExternalStore to track browser online/offline status with zero tearing.
 */
export function useOnlineStatus(): { isOnline: boolean; isOffline: boolean } {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    isOnline,
    isOffline: !isOnline,
  };
}
