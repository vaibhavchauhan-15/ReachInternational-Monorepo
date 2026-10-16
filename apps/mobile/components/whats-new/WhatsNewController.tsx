/**
 * ReachInternational Mobile — WhatsNewController
 * Headless controller coordinating automated post-update announcement presentation.
 * Mounts in protected AppLayout and triggers WhatsNewSheet when an unacknowledged release is eligible.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useWhatsNew } from '../../lib/whats-new';
import { WhatsNewSheet } from './WhatsNewSheet';

export interface WhatsNewControllerProps {
  /**
   * If true (e.g. while NotificationPermissionModal is active),
   * suppresses display until the primary modal is dismissed.
   */
  suppress?: boolean;
}

export function WhatsNewController({ suppress = false }: WhatsNewControllerProps) {
  const router = useRouter();
  const { isEligible, activeRelease, acknowledge, getFilteredHighlights } = useWhatsNew();
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    if (isEligible && activeRelease && !suppress) {
      // Delay presentation slightly so initial dashboard mount and navigation transitions complete smoothly
      const timer = setTimeout(() => {
        setSheetVisible(true);
      }, 750);
      return () => clearTimeout(timer);
    } else {
      setSheetVisible(false);
    }
  }, [isEligible, activeRelease, suppress]);

  const handleClose = async () => {
    setSheetVisible(false);
    await acknowledge();
  };

  const handleViewAllChanges = () => {
    router.push('/(app)/settings/about/whats-new' as any);
  };

  if (!activeRelease) return null;

  return (
    <WhatsNewSheet
      visible={sheetVisible}
      onClose={handleClose}
      release={activeRelease}
      highlights={getFilteredHighlights(activeRelease)}
      onViewAllChanges={handleViewAllChanges}
      testID="automated-whats-new-sheet"
    />
  );
}
