/**
 * ReachInternational Mobile — What's New & Release Notes System
 * Strong TypeScript contracts for release metadata, highlights, and detection state.
 */

import type { UserRole } from '@reachinternational/types';

export type ReleaseType = 'native' | 'ota' | 'announcement';

export type TargetEnvironment = 'all' | 'production' | 'preview' | 'development';

export type HighlightCategory = 'performance' | 'feature' | 'improvement' | 'security' | 'fix';

export interface ReleaseHighlight {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: HighlightCategory;
  /**
   * Optional RBAC restriction. If specified, only users with these roles will see this highlight.
   * If omitted, visible to all authenticated roles.
   */
  roles?: UserRole[];
}

export interface ReleaseItem {
  /**
   * Stable, unique identifier for release detection and acknowledgement tracking.
   * Examples: 'v1.3.0-native-launch', 'ota-1.3.0-hotfix-1'
   */
  releaseId: string;
  /**
   * Semver display string, e.g. '1.3.0'
   */
  version: string;
  /**
   * Native build number / Android versionCode (e.g. 4)
   */
  versionCode?: number;
  /**
   * EAS Runtime version string
   */
  runtimeVersion?: string;
  /**
   * ISO 8601 release date string (YYYY-MM-DD)
   */
  releaseDate: string;
  /**
   * Classification of release delivery
   */
  type: ReleaseType;
  /**
   * Heading for the release
   */
  title: string;
  /**
   * Optional introductory subtitle
   */
  subtitle?: string;
  /**
   * List of specific changes and feature highlights
   */
  highlights: ReleaseHighlight[];
  /**
   * Target environment filter. Defaults to 'all'.
   */
  targetEnv?: TargetEnvironment;
  /**
   * Target EAS release channels (e.g. ['production', 'preview']).
   */
  targetChannels?: string[];
  /**
   * Minimum native semver required for this release notice to apply
   */
  minVersion?: string;
  /**
   * Maximum native semver for this release notice to apply
   */
  maxVersion?: string;
  /**
   * Explicit OTA Update UUID string for EAS Update matching
   */
  otaUpdateId?: string;
  /**
   * High-priority or major milestone release
   */
  isMajor?: boolean;
}

export interface WhatsNewState {
  isEligible: boolean;
  isLoading: boolean;
  activeRelease: ReleaseItem | null;
  acknowledgedReleaseIds: string[];
}
