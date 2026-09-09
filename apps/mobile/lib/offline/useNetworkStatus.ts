/**
 * useNetworkStatus — Reactive Network Reachability Telemetry Hook
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-03, D-07, and avoids captive portal Pitfall 1.
 */

import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOffline: boolean;
  connectionType: string;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    isOffline: false,
    connectionType: 'unknown',
  });

  useEffect(() => {
    let isMounted = true;

    // Read initial network state immediately
    NetInfo.fetch().then((state: NetInfoState) => {
      if (!isMounted) return;
      const isConnected = state.isConnected ?? true;
      const isInternetReachable = state.isInternetReachable ?? null;
      // Evaluate captive portal / unreachable state: isInternetReachable === false or isConnected === false
      const isOffline = isInternetReachable === false || isConnected === false;

      setStatus({
        isConnected,
        isInternetReachable,
        isOffline,
        connectionType: state.type || 'unknown',
      });
    }).catch(() => {});

    // Listen to real-time link transitions
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (!isMounted) return;
      const isConnected = state.isConnected ?? true;
      const isInternetReachable = state.isInternetReachable ?? null;
      const isOffline = isInternetReachable === false || isConnected === false;

      setStatus({
        isConnected,
        isInternetReachable,
        isOffline,
        connectionType: state.type || 'unknown',
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return status;
}
