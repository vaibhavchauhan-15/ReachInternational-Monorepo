/**
 * ServiceCentric Mobile — Drawer Context
 * Provides global openDrawer callback for MobileHeader.
 */

import React, { createContext, useContext, useState } from 'react';
import { MobileDrawer } from '../../components/navigation/MobileDrawer';

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer, isDrawerOpen }}>
      {children}
      <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
    </DrawerContext.Provider>
  );
};

export const useDrawer = (): DrawerContextType => useContext(DrawerContext);
