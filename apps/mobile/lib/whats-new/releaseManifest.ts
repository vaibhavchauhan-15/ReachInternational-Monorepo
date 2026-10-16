/**
 * ReachInternational Mobile — Release Notes Manifest
 * Bundled typed manifest of app releases, OTA updates, and announcements.
 *
 * NOTE: Release highlights in this manifest reflect actual delivered capabilities
 * and verified features from the Reach International monorepo engineering log.
 */

import type { ReleaseItem } from './types';

export const RELEASE_MANIFEST: ReleaseItem[] = [
  {
    releaseId: 'v1.3.0-native-launch',
    version: '1.3.0',
    versionCode: 4,
    runtimeVersion: '1.3.0',
    releaseDate: '2026-10-16',
    type: 'native',
    title: "What's New in Reach Ops",
    subtitle: 'Engineered for sub-second fleet visibility, zero ANR freezes, and instant tactile feedback.',
    isMajor: true,
    targetEnv: 'all',
    highlights: [
      {
        id: 'splash-perf-130',
        title: 'Instant Launch & Splash Screen',
        description: 'Instant launch experience with redesigned splash screen and 60fps GPU animations (eliminated loading spinner, standard 144dp emblem).',
        iconName: 'zap',
        category: 'performance',
      },
      {
        id: 'operations-anr-130',
        title: 'Operations Shift Monitor',
        description: 'Eradicated shift list freezes with fast keyset pagination and real-time shift monitoring (sub-2ms RPC summary counters).',
        iconName: 'gauge',
        category: 'feature',
      },
      {
        id: 'user-management-130',
        title: 'User Directory & Fleet Slicing',
        description: 'Instant directory KPIs, targeted fleet assignment views, and infinite scrolling.',
        iconName: 'users',
        category: 'feature',
      },
      {
        id: 'attendance-pagination-130',
        title: 'Attendance Month Navigation',
        description: 'Fast month-by-month navigation, monthly work hour summaries, and interactive filters.',
        iconName: 'calendar',
        category: 'improvement',
      },
      {
        id: 'haptics-navigation-130',
        title: 'High Contrast Tabs & Haptics',
        description: 'Re-engineered tabs with high contrast and instant tactile haptics.',
        iconName: 'sparkles',
        category: 'improvement',
      },
      {
        id: 'timepicker-130',
        title: 'TimePicker Dial & Keyboard Modes',
        description: 'Ergonomic time input modal with dual dial/keyboard switcher, vertical AM/PM capsule, and zero button clutter.',
        iconName: 'clock',
        category: 'improvement',
      },
      {
        id: 'whats-new-130',
        title: "What's New & Release Hub",
        description: "Automated post-release announcement bottom sheet and on-demand changelog exploration in Settings.",
        iconName: 'sparkles',
        category: 'feature',
      },
    ],
  },
  {
    releaseId: 'v1.2.0-native-core',
    version: '1.2.0',
    versionCode: 3,
    runtimeVersion: '1.2.0',
    releaseDate: '2026-10-01',
    type: 'native',
    title: 'Fleet Operations & Offline Queue',
    subtitle: 'Core industrial equipment logging, offline shift synchronization, and fleet management.',
    isMajor: false,
    targetEnv: 'all',
    highlights: [
      {
        id: 'fleet-mgmt-120',
        title: 'Machinery Fleet Directory',
        description: 'Searchable machinery catalog with model, serial, and active operator shift assignments.',
        iconName: 'truck',
        category: 'feature',
      },
      {
        id: 'offline-queue-120',
        title: 'Offline Shift Synchronization',
        description: 'Log machine running hours and shift entries offline with automated cloud sync on reconnect.',
        iconName: 'shield-check',
        category: 'feature',
      },
      {
        id: 'secure-store-120',
        title: 'Hardware Keystore Security',
        description: 'Cryptographically protected authentication tokens backed by Android KeyStore and iOS Keychain.',
        iconName: 'lock',
        category: 'security',
      },
    ],
  },
  {
    releaseId: 'ota-preview-pilot-patch',
    version: '1.3.0',
    runtimeVersion: '1.3.0',
    releaseDate: '2026-10-16',
    type: 'ota',
    title: 'Preview OTA Diagnostics Patch',
    subtitle: 'Internal testing enhancements for staging and preview channels.',
    targetEnv: 'preview',
    targetChannels: ['preview', 'development'],
    highlights: [
      {
        id: 'preview-diagnostics',
        title: 'Preview Channel Telemetry',
        description: 'Real-time telemetry and network diagnostics for internal testing validation.',
        iconName: 'cpu',
        category: 'improvement',
      },
    ],
  },
];
