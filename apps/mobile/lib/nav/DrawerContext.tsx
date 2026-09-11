/**
 * ReachInternational Mobile — Drawer Context (Deprecated)
 * Safe no-op pass-through retained for backwards compatibility without rendering any sidebar drawer.
 */

import React, { createContext, useContext } from 'react';

export interface DrawerContextType {
  openDrawer: () => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
}

const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isDrawerOpen: false,
});

export const DrawerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DrawerContext.Provider value={{ openDrawer: () => {}, closeDrawer: () => {}, isDrawerOpen: false }}>
      {children}
    </DrawerContext.Provider>
  );
};

export const useDrawer = (): DrawerContextType => useContext(DrawerContext);
