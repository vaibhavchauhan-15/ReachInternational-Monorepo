/**
 * NetworkConnectivityManager — Centralized Network Reachability & Reconnection Engine
 *
 * Responsibilities:
 * 1. Single authoritative NetInfo event listener for the entire app.
 * 2. Synchronizes real-time status with TanStack Query's `onlineManager`
 *    (pausing queries when offline and unpausing when online).
 * 3. Detects genuine offline → online transitions (avoids duplicate online triggers).
 * 4. Debounced stabilization (750ms) to prevent reconnect storms and handle rapid
 *    OFF → ON → OFF → ON link flap safely.
 * 5. Emits verified reconnect signals to the Synchronization Coordinator.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

export interface NetworkTelemetry {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOnline: boolean;
  isOffline: boolean;
  connectionType: string;
}

export type NetworkStatusListener = (status: NetworkTelemetry) => void;
export type ReconnectListener = (telemetry: NetworkTelemetry) => void | Promise<void>;

export const RECONNECT_STABILIZATION_MS = 750;

export class NetworkConnectivityManager {
  private static instance: NetworkConnectivityManager | null = null;

  private currentTelemetry: NetworkTelemetry = {
    isConnected: true,
    isInternetReachable: true,
    isOnline: true,
    isOffline: false,
    connectionType: 'unknown',
  };

  private wasOffline = false;
  private isInitialized = false;
  private isReconnecting = false;
  private stabilizationTimer: ReturnType<typeof setTimeout> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  private statusListeners: Set<NetworkStatusListener> = new Set();
  private reconnectListeners: Set<ReconnectListener> = new Set();

  private constructor() {
    this.init();
  }

  public static getInstance(): NetworkConnectivityManager {
    if (!NetworkConnectivityManager.instance) {
      NetworkConnectivityManager.instance = new NetworkConnectivityManager();
    }
    return NetworkConnectivityManager.instance;
  }

  /**
   * Initializes network monitoring and binds TanStack Query onlineManager
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Connect TanStack Query onlineManager to our single authoritative network engine
    onlineManager.setEventListener((setOnline) => {
      const unsubscribe = this.subscribe((telemetry) => {
        setOnline(telemetry.isOnline);
      });
      return () => {
        unsubscribe();
      };
    });

    try {
      const initial = await NetInfo.fetch();
      this.handleNetInfoUpdate(initial, true);
    } catch {
      // Fallback: assume online
      this.currentTelemetry = {
        isConnected: true,
        isInternetReachable: true,
        isOnline: true,
        isOffline: false,
        connectionType: 'unknown',
      };
    }

    try {
      this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        this.handleNetInfoUpdate(state, false);
      });
    } catch (err) {
      console.warn('[NetworkConnectivityManager] NetInfo listener registration failed:', err);
    }
  }

  /**
   * Evaluates NetInfo state updates, manages transition tracking and stabilization
   */
  private handleNetInfoUpdate(state: NetInfoState, isInitial: boolean): void {
    const isConnected = state.isConnected ?? true;
    const isInternetReachable = state.isInternetReachable ?? null;
    // Captive portal & unreachable detection: isInternetReachable === false || isConnected === false
    const isOffline = isInternetReachable === false || isConnected === false;
    const isOnline = !isOffline;
    const connectionType = state.type || 'unknown';

    const previousOnline = this.currentTelemetry.isOnline;

    this.currentTelemetry = {
      isConnected,
      isInternetReachable,
      isOnline,
      isOffline,
      connectionType,
    };

    // Update TanStack Query
    onlineManager.setOnline(isOnline);

    // Broadcast status to all telemetry subscribers
    this.notifyStatusListeners();

    if (isInitial) {
      // If initialized while offline, mark wasOffline so future reconnect fires
      if (isOffline) {
        this.wasOffline = true;
      }
      return;
    }

    // Transition 1: Transitioned from Online -> Offline
    if (!isOnline) {
      this.wasOffline = true;
      // Cancel any pending reconnection debounce
      if (this.stabilizationTimer) {
        clearTimeout(this.stabilizationTimer);
        this.stabilizationTimer = null;
      }
      return;
    }

    // Transition 2: Network came back Online
    if (isOnline && (this.wasOffline || !previousOnline)) {
      this.scheduleStabilizedReconnect();
    }
  }

  /**
   * Debounces the online transition to prevent reconnect storms and rapid link flapping
   */
  private scheduleStabilizedReconnect(): void {
    if (this.stabilizationTimer) {
      clearTimeout(this.stabilizationTimer);
    }

    this.stabilizationTimer = setTimeout(async () => {
      this.stabilizationTimer = null;

      // Double-check real connectivity before dispatching reconnect
      try {
        const verifyState = await NetInfo.fetch();
        const stillOnline =
          (verifyState.isConnected ?? true) && verifyState.isInternetReachable !== false;

        if (!stillOnline) {
          this.wasOffline = true;
          return;
        }

        // Reconnect confirmed!
        this.wasOffline = false;
        await this.dispatchReconnect();
      } catch (err) {
        console.warn('[NetworkConnectivityManager] Error verifying connection stability:', err);
      }
    }, RECONNECT_STABILIZATION_MS);
  }

  /**
   * Invokes all registered reconnect listeners with mutex guard against duplicate synchronization
   */
  private async dispatchReconnect(): Promise<void> {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    try {
      const telemetry = { ...this.currentTelemetry };
      for (const listener of this.reconnectListeners) {
        try {
          await listener(telemetry);
        } catch (listenerErr) {
          console.warn('[NetworkConnectivityManager] Error in reconnect listener:', listenerErr);
        }
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Current network telemetry snapshot
   */
  public getStatus(): NetworkTelemetry {
    return { ...this.currentTelemetry };
  }

  public isOnline(): boolean {
    return this.currentTelemetry.isOnline;
  }

  public isOffline(): boolean {
    return this.currentTelemetry.isOffline;
  }

  /**
   * Manually checks connectivity on-demand
   */
  public async checkConnectivity(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.handleNetInfoUpdate(state, false);
      return this.currentTelemetry.isOnline;
    } catch {
      return false;
    }
  }

  /**
   * Subscribes to network status updates
   */
  public subscribe(listener: NetworkStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Subscribes to verified offline → online reconnect events
   */
  public onReconnect(listener: ReconnectListener): () => void {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  private notifyStatusListeners(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (e) {
        console.error('[NetworkConnectivityManager] Status listener error:', e);
      }
    });
  }

  /**
   * Teardown for testing environments
   */
  public teardown(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    if (this.stabilizationTimer) {
      clearTimeout(this.stabilizationTimer);
      this.stabilizationTimer = null;
    }
    this.statusListeners.clear();
    this.reconnectListeners.clear();
    this.isInitialized = false;
    this.wasOffline = false;
    this.isReconnecting = false;
  }
}

export const networkConnectivityManager = NetworkConnectivityManager.getInstance();
