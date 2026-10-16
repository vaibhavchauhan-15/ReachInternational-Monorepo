/**
 * ReachInternational Mobile — Terms of Service inside About Settings
 * Route: /settings/about/terms
 * 
 * Renders Terms of Service with deterministic backward navigation to /settings/about.
 */

import React from 'react';
import { useRouter } from 'expo-router';
import TermsOfServiceScreen from '../../../terms';

export default function SettingsAboutTermsScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.replace('/settings/about');
  };

  return (
    <TermsOfServiceScreen
      backRoute="/settings/about"
      onPressBack={handleBack}
    />
  );
}
