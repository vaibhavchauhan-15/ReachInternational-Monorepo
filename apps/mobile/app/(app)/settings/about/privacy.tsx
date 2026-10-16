/**
 * ReachInternational Mobile — Privacy Policy inside About Settings
 * Route: /settings/about/privacy
 * 
 * Renders Privacy Policy with deterministic backward navigation to /settings/about.
 */

import React from 'react';
import { useRouter } from 'expo-router';
import PrivacyPolicyScreen from '../../../privacy';

export default function SettingsAboutPrivacyScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.replace('/settings/about');
  };

  return (
    <PrivacyPolicyScreen
      backRoute="/settings/about"
      onPressBack={handleBack}
    />
  );
}
