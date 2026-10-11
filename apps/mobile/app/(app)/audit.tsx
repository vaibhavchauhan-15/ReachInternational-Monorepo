import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Mobile /audit route redirecting to /dashboard.
 * Audit logs on mobile are natively embedded in client details and operations.
 */
export default function AuditRedirect() {
  return <Redirect href="/dashboard" />;
}
