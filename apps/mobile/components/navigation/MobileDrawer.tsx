/**
 * ReachInternational Mobile — Mobile Drawer (Deprecated)
 * Deprecated in favor of the floating bottom navbar (MobileBottomNav).
 * Retained as a no-op placeholder for clean backwards compatibility.
 */

import React from 'react';

export interface MobileDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = () => {
  return null;
};
