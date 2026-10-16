/**
 * ReachInternational Mobile — useWhatsNew Hook
 * React hook exposing release announcement eligibility, active release data,
 * acknowledgement mutations, and role-filtered highlights.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  getActiveEligibleRelease,
  acknowledgeRelease as serviceAcknowledgeRelease,
  getReleaseHistory,
  filterHighlightsForRole,
} from './whatsNewService';
import type { ReleaseItem, ReleaseHighlight, WhatsNewState } from './types';

export interface UseWhatsNewReturn extends WhatsNewState {
  acknowledge: () => Promise<void>;
  checkEligibility: () => Promise<void>;
  releaseHistory: ReleaseItem[];
  getFilteredHighlights: (release: ReleaseItem) => ReleaseHighlight[];
}

export function useWhatsNew(): UseWhatsNewReturn {
  const { session, role, isProfileComplete } = useAuth();
  const [state, setState] = useState<WhatsNewState>({
    isEligible: false,
    isLoading: true,
    activeRelease: null,
    acknowledgedReleaseIds: [],
  });

  const checkEligibility = useCallback(async () => {
    // Only check release announcements once the user is authenticated with completed profile
    if (!session || !isProfileComplete) {
      setState((prev) => ({
        ...prev,
        isEligible: false,
        isLoading: false,
        activeRelease: null,
      }));
      return;
    }

    try {
      const active = await getActiveEligibleRelease();
      setState({
        isEligible: !!active,
        isLoading: false,
        activeRelease: active,
        acknowledgedReleaseIds: [],
      });
    } catch (err) {
      console.warn('[useWhatsNew] Error evaluating active release eligibility:', err);
      setState({
        isEligible: false,
        isLoading: false,
        activeRelease: null,
        acknowledgedReleaseIds: [],
      });
    }
  }, [session, isProfileComplete]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  const acknowledge = useCallback(async () => {
    if (!state.activeRelease) return;
    const releaseId = state.activeRelease.releaseId;
    await serviceAcknowledgeRelease(releaseId);
    setState((prev) => ({
      ...prev,
      isEligible: false,
      activeRelease: null,
    }));
  }, [state.activeRelease]);

  const getFilteredHighlights = useCallback(
    (release: ReleaseItem) => {
      return filterHighlightsForRole(release.highlights, role);
    },
    [role]
  );

  const releaseHistory = getReleaseHistory();

  return {
    ...state,
    acknowledge,
    checkEligibility,
    releaseHistory,
    getFilteredHighlights,
  };
}
