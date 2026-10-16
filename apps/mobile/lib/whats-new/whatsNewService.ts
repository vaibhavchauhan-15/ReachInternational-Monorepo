/**
 * ReachInternational Mobile — What's New Release Detection & Acknowledgement Service
 * Authoritative business logic for release note targeting, OTA matching,
 * AsyncStorage persistence, in-memory session protection, and RBAC highlight filtering.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import type { UserRole } from '@reachinternational/types';
import { getAppEnv, type AppEnvironment } from '../env';
import { RELEASE_MANIFEST } from './releaseManifest';
import type { ReleaseItem, ReleaseHighlight } from './types';

export const STORAGE_KEY_ACKNOWLEDGED_IDS = '@reach:whats_new:acknowledged_ids';
export const STORAGE_KEY_LAST_ACKNOWLEDGED_ID = '@reach:whats_new:last_acknowledged_id';

/**
 * In-memory session dismissal set.
 * Prevents re-prompting during the same app execution even if storage I/O fails or is delayed.
 */
const sessionDismissedReleaseIds = new Set<string>();

/**
 * Reads acknowledged release IDs from local persistent storage.
 */
export async function getAcknowledgedReleaseIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_ACKNOWLEDGED_IDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[WhatsNewService] Error reading acknowledged releases from storage:', err);
    return [];
  }
}

/**
 * Persists user acknowledgement for a specific release ID.
 */
export async function acknowledgeRelease(releaseId: string): Promise<boolean> {
  // Immediately register in session memory to prevent loops
  sessionDismissedReleaseIds.add(releaseId);

  try {
    const existing = await getAcknowledgedReleaseIds();
    if (!existing.includes(releaseId)) {
      const updated = [...existing, releaseId];
      await AsyncStorage.setItem(STORAGE_KEY_ACKNOWLEDGED_IDS, JSON.stringify(updated));
    }
    await AsyncStorage.setItem(STORAGE_KEY_LAST_ACKNOWLEDGED_ID, releaseId);
    return true;
  } catch (err) {
    console.warn(`[WhatsNewService] Failed to persist acknowledgement for release ${releaseId}:`, err);
    return false;
  }
}

/**
 * Checks whether a specific release has already been acknowledged.
 */
export async function isReleaseAcknowledged(releaseId: string): Promise<boolean> {
  if (sessionDismissedReleaseIds.has(releaseId)) {
    return true;
  }
  const acknowledged = await getAcknowledgedReleaseIds();
  return acknowledged.includes(releaseId);
}

/**
 * Evaluates whether a release item applies to the current environment and binary.
 */
export function isReleaseApplicable(
  release: ReleaseItem,
  options?: {
    currentEnv?: AppEnvironment;
    currentVersion?: string;
    currentVersionCode?: number;
    currentOtaUpdateId?: string | null;
    currentOtaChannel?: string | null;
  }
): boolean {
  const currentEnv = options?.currentEnv ?? getAppEnv();
  const currentVersion = options?.currentVersion ?? Constants.expoConfig?.version ?? '1.3.0';
  const currentVersionCode =
    options?.currentVersionCode ?? Constants.expoConfig?.android?.versionCode ?? 4;
  const currentOtaUpdateId =
    options?.currentOtaUpdateId ?? (Updates.isEnabled ? Updates.updateId : null);
  const currentOtaChannel =
    options?.currentOtaChannel ?? (Updates.isEnabled ? Updates.channel : null);

  // 1. Environment Isolation: Never show dev/preview release notes in production
  if (release.targetEnv && release.targetEnv !== 'all') {
    if (release.targetEnv !== currentEnv) {
      return false;
    }
  }

  // 2. Channel Matching (if specified on release)
  if (release.targetChannels && release.targetChannels.length > 0) {
    if (currentOtaChannel && !release.targetChannels.includes(currentOtaChannel)) {
      return false;
    }
  }

  // 3. Release Type Evaluation
  if (release.type === 'ota') {
    // If specific OTA Update ID is designated, match it against current OTA ID
    if (release.otaUpdateId && currentOtaUpdateId) {
      return release.otaUpdateId === currentOtaUpdateId;
    }
    // General OTA patch matching current runtime / version
    if (release.runtimeVersion) {
      const runtimeVersion = Constants.expoConfig?.runtimeVersion;
      if (typeof runtimeVersion === 'string' && runtimeVersion !== release.runtimeVersion) {
        return false;
      }
    }
  } else if (release.type === 'native') {
    // Native app release must match marketing version or build code
    if (release.version !== currentVersion) {
      return false;
    }
    if (release.versionCode !== undefined && release.versionCode !== currentVersionCode) {
      return false;
    }
  }

  return true;
}

/**
 * Determines the currently active release announcement that needs user acknowledgement.
 * Returns null if no eligible release exists or if the release is already acknowledged.
 */
export async function getActiveEligibleRelease(
  manifest: ReleaseItem[] = RELEASE_MANIFEST,
  options?: {
    currentEnv?: AppEnvironment;
    currentVersion?: string;
    currentVersionCode?: number;
    currentOtaUpdateId?: string | null;
    currentOtaChannel?: string | null;
  }
): Promise<ReleaseItem | null> {
  const acknowledged = await getAcknowledgedReleaseIds();

  for (const release of manifest) {
    // Skip if acknowledged in persistent storage or current session
    if (acknowledged.includes(release.releaseId) || sessionDismissedReleaseIds.has(release.releaseId)) {
      continue;
    }

    // Check environment, version, and channel eligibility
    if (isReleaseApplicable(release, options)) {
      return release;
    }
  }

  return null;
}

/**
 * Returns release history filtered for the current environment, sorted chronologically.
 */
export function getReleaseHistory(
  manifest: ReleaseItem[] = RELEASE_MANIFEST,
  currentEnv: AppEnvironment = getAppEnv()
): ReleaseItem[] {
  return manifest.filter((release) => {
    if (release.targetEnv && release.targetEnv !== 'all') {
      return release.targetEnv === currentEnv;
    }
    return true;
  });
}

/**
 * Filters release highlights based on the active user's authorized role.
 */
export function filterHighlightsForRole(
  highlights: ReleaseHighlight[],
  role?: UserRole | null
): ReleaseHighlight[] {
  if (!highlights || highlights.length === 0) return [];
  return highlights.filter((h) => {
    if (!h.roles || h.roles.length === 0) return true;
    if (!role) return false;
    return h.roles.includes(role);
  });
}

/**
 * Testing & Debugging helper: Resets acknowledged releases.
 */
export async function resetAcknowledgedReleases(): Promise<void> {
  sessionDismissedReleaseIds.clear();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_ACKNOWLEDGED_IDS);
    await AsyncStorage.removeItem(STORAGE_KEY_LAST_ACKNOWLEDGED_ID);
  } catch {
    // Non-fatal
  }
}
