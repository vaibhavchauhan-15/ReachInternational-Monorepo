/**
 * useNetworkStatus — Reactive Network Reachability Telemetry Hook
 * Phase 14: Mobile Offline Sync & Network Resilience
 *
 * Consumes the centralized NetworkConnectivityManager to avoid redundant NetInfo subscriptions
 * and guarantee synchronized telemetry across components.
 */

import { useState, useEffect } from 'react';
import { networkConnectivityManager, NetworkTelemetry } from './NetworkConnectivityManager';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOffline: boolean;
  connectionType: string;
  checkConnectivity: () => Promise<boolean>;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkTelemetry>(() =>
    networkConnectivityManager.getStatus()
  );

  useEffect(() => {
    // Subscribe to centralized NetworkConnectivityManager updates
    const unsubscribe = networkConnectivityManager.subscribe((latest) => {
      setStatus(latest);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const checkConnectivity = async (): Promise<boolean> => {
    return networkConnectivityManager.checkConnectivity();
  };

  return {
    isConnected: status.isConnected,
    isInternetReachable: status.isInternetReachable,
    isOffline: status.isOffline,
    connectionType: status.connectionType,
    checkConnectivity,
  };
}
