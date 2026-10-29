/**
 * Reach International Mobile — Form Draft Persistence Hook
 *
 * Implements 100% Web & Mobile Parity for Draft Restoration across all 8 dimensions:
 * - Persists all entered registration details (Account, Shift, Address, Banking, Identity, Terms)
 * - Persists all picked document metadata and local cache URIs (Bank document, Aadhaar, Licence)
 * - Restores complete form state seamlessly across app minimize, backgrounding, re-opens, and reloads
 * - 300ms optimal debounce while typing, with immediate synchronous flush on AppState backgrounding/unmount
 * - Safeguards against race conditions: isDirtyRef prevents uninitialized default state from overwriting drafts
 * - Exposes clearDraft() for automated cleanup on successful submission or "Start fresh"
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobilePickedDocument } from '../documents';

export const SIGNUP_DRAFT_KEY = 'signup_draft_v1';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24-hour lifetime
const DEBOUNCE_MS = 300; // 300ms optimal debounce for mobile typing

export interface MobileSignupDraftValues {
  fullName: string;
  email: string;
  phone: string;
  selectedRole: string;
  selectedSupervisorId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  street: string;
  city: string;
  district: string;
  stateVal: string;
  stateId: number | null;
  bankAccountNumber: string;
  bankIfscCode: string;
  aadhaarNumber: string;
  licenseNumber: string;
  agreedToTerms: boolean;
  bankDoc: MobilePickedDocument | null;
  aadhaarDoc: MobilePickedDocument | null;
  licenseDoc: MobilePickedDocument | null;
}

/**
 * Validates whether the draft object contains real user-entered content,
 * rather than only initial default states like role: 'operator'.
 */
export function hasMeaningfulMobileDraft(d: Partial<MobileSignupDraftValues> | null | undefined): boolean {
  if (!d || typeof d !== 'object') return false;

  // Picked documents count as meaningful content
  if (d.bankDoc || d.aadhaarDoc || d.licenseDoc) return true;

  // Check text cells
  if (d.fullName && d.fullName.trim().length > 0) return true;
  if (d.email && d.email.trim().length > 0) return true;
  if (d.phone && d.phone.trim().length > 0) return true;
  if (d.street && d.street.trim().length > 0) return true;
  if (d.city && d.city.trim().length > 0) return true;
  if (d.district && d.district.trim().length > 0) return true;
  if (d.stateVal && d.stateVal.trim().length > 0) return true;
  if (d.bankAccountNumber && d.bankAccountNumber.trim().length > 0) return true;
  if (d.bankIfscCode && d.bankIfscCode.trim().length > 0) return true;
  if (d.aadhaarNumber && d.aadhaarNumber.trim().length > 0) return true;
  if (d.licenseNumber && d.licenseNumber.trim().length > 0) return true;
  if (d.agreedToTerms) return true;

  // Role changed from operator
  if (d.selectedRole && d.selectedRole !== 'operator') return true;
  if (d.selectedSupervisorId && d.selectedSupervisorId.trim().length > 0) return true;

  // Shift times changed from default
  if (d.shiftStartTime && d.shiftStartTime !== '08:00 AM' && d.shiftStartTime !== '08:00') return true;
  if (d.shiftEndTime && d.shiftEndTime !== '08:00 PM' && d.shiftEndTime !== '20:00') return true;

  return false;
}

export interface UseMobileFormDraftReturn {
  restoredAt: number | null;
  clearDraft: () => Promise<void>;
  saveNow: () => Promise<void>;
}

export function useMobileFormDraft(
  values: MobileSignupDraftValues,
  restore: (draft: Partial<MobileSignupDraftValues>) => void,
  storageKey: string = SIGNUP_DRAFT_KEY,
): UseMobileFormDraftReturn {
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const latestRef = useRef<MobileSignupDraftValues>(values);
  const hasRestoredRef = useRef(false);
  const isDirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronously update ref on each render
  latestRef.current = values;

  // Save current values to AsyncStorage
  const writeNow = useCallback(async () => {
    // CRITICAL: Never write before initial hydration from storage finishes
    // AND only write if user has modified something in this session
    if (!hasRestoredRef.current) return;
    if (!isDirtyRef.current) return;

    const data = latestRef.current;
    if (!hasMeaningfulMobileDraft(data)) return;

    try {
      // Exclude passwords/credentials for security
      const payload = {
        savedAt: Date.now(),
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          selectedRole: data.selectedRole,
          selectedSupervisorId: data.selectedSupervisorId,
          shiftStartTime: data.shiftStartTime,
          shiftEndTime: data.shiftEndTime,
          street: data.street,
          city: data.city,
          district: data.district,
          stateVal: data.stateVal,
          stateId: data.stateId,
          bankAccountNumber: data.bankAccountNumber,
          bankIfscCode: data.bankIfscCode,
          aadhaarNumber: data.aadhaarNumber,
          licenseNumber: data.licenseNumber,
          agreedToTerms: data.agreedToTerms,
          bankDoc: data.bankDoc
            ? {
              name: data.bankDoc.name,
              size: data.bankDoc.size,
              mimeType: data.bankDoc.mimeType,
              uri: data.bankDoc.uri,
            }
            : null,
          aadhaarDoc: data.aadhaarDoc
            ? {
              name: data.aadhaarDoc.name,
              size: data.aadhaarDoc.size,
              mimeType: data.aadhaarDoc.mimeType,
              uri: data.aadhaarDoc.uri,
            }
            : null,
          licenseDoc: data.licenseDoc
            ? {
              name: data.licenseDoc.name,
              size: data.licenseDoc.size,
              mimeType: data.licenseDoc.mimeType,
              uri: data.licenseDoc.uri,
            }
            : null,
        },
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('[useMobileFormDraft] Failed to write draft:', err);
    }
  }, [storageKey]);

  // 1) Hydrate draft once on mount
  useEffect(() => {
    let cancelled = false;

    async function loadDraft() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw || cancelled) return;

        const parsed = JSON.parse(raw);
        if (typeof parsed?.savedAt !== 'number' || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
          await AsyncStorage.removeItem(storageKey);
          return;
        }

        const draftData = parsed.data as Partial<MobileSignupDraftValues>;
        if (hasMeaningfulMobileDraft(draftData) && !cancelled) {
          latestRef.current = { ...latestRef.current, ...draftData };
          restore(draftData);
          setRestoredAt(parsed.savedAt);
        }
      } catch (err) {
        console.warn('[useMobileFormDraft] Failed to load draft:', err);
      } finally {
        if (!cancelled) {
          hasRestoredRef.current = true;
        }
      }
    }

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Debounced save while typing or modifying documents (300ms)
  useEffect(() => {
    if (!hasRestoredRef.current) return;

    if (!hasMeaningfulMobileDraft(values)) return;

    isDirtyRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      writeNow();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [values, writeNow]);

  // 3) AppState listener: immediately flush when app goes to background / inactive
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        if (!isDirtyRef.current) return;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        writeNow();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // Flush on unmount if dirty
      if (isDirtyRef.current) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        writeNow();
      }
      sub.remove();
    };
  }, [writeNow]);

  // Clear draft from storage on successful submission or "Start fresh"
  const clearDraft = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isDirtyRef.current = false;
    hasRestoredRef.current = false;
    setRestoredAt(null);
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch { }
  }, [storageKey]);

  return {
    restoredAt,
    clearDraft,
    saveNow: writeNow,
  };
}
