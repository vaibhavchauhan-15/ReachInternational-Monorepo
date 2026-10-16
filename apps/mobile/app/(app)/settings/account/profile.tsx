/**
 * ReachInternational Mobile — Profile Screen inside Account Settings
 * Route: /settings/account/profile
 * 
 * Renders full profile details with deterministic backward navigation to /settings/account.
 */

import React from 'react';
import { useRouter } from 'expo-router';
import ProfileScreen from '../../profile';

export default function SettingsAccountProfileScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.replace('/settings/account');
  };

  return (
    <ProfileScreen
      backRoute="/settings/account"
      onPressBack={handleBack}
    />
  );
}
