/**
 * ReachInternational Mobile — Centralized Overlay Host & Manager
 * Coordinates portal rendering, z-index layering, and BackHandler interception.
 * Enforces rule: Back button/gesture closes the topmost overlay first before popping route.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, BackHandler, Platform } from 'react-native';

export interface OverlayInstance {
  id: string;
  onDismiss: () => void;
  priority?: number;
}

interface OverlayHostContextValue {
  registerOverlay: (instance: OverlayInstance) => void;
  unregisterOverlay: (id: string) => void;
  activeCount: number;
}

const OverlayHostContext = createContext<OverlayHostContextValue | null>(null);

export const useOverlayHost = () => {
  const ctx = useContext(OverlayHostContext);
  if (!ctx) {
    // Graceful fallback when outside provider
    return {
      registerOverlay: () => {},
      unregisterOverlay: () => {},
      activeCount: 0,
    };
  }
  return ctx;
};

export const OverlayHostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stackRef = useRef<OverlayInstance[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  const registerOverlay = useCallback((instance: OverlayInstance) => {
    stackRef.current = [...stackRef.current.filter((o) => o.id !== instance.id), instance];
    setActiveCount(stackRef.current.length);
  }, []);

  const unregisterOverlay = useCallback((id: string) => {
    stackRef.current = stackRef.current.filter((o) => o.id !== id);
    setActiveCount(stackRef.current.length);
  }, []);

  // Intercept Android hardware back button
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onBackPress = () => {
      const currentStack = stackRef.current;
      if (currentStack.length > 0) {
        // Pop and dismiss topmost overlay
        const topOverlay = currentStack[currentStack.length - 1];
        topOverlay.onDismiss();
        return true; // Consumed: prevent screen pop
      }
      return false; // Let Expo Router handle back navigation
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  return (
    <OverlayHostContext.Provider value={{ registerOverlay, unregisterOverlay, activeCount }}>
      <View style={styles.container}>
        {children}
      </View>
    </OverlayHostContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
