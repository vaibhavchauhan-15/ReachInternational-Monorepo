import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Legacy /hr route redirecting to /(app)/payroll for mobile backward compatibility.
 */
export default function HRRedirect() {
  return <Redirect href="/(app)/payroll" />;
}
