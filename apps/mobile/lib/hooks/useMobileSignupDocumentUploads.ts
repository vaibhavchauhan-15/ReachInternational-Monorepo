/**
 * Reach International Mobile — Native Signup Document Upload Hook
 * Matches Web client functionality 100% with native adaptations:
 * - Background upload directly to doc_staging on image pick
 * - In-memory session tracking and per-file uploaded state
 * - Automatic session refresh if session exceeds 1.5 hours
 * - Offline queue fallback when device connection drops
 * - Submit gating: enabled only when mandatory files are ready
 * - Fully typed, user-friendly error messages at every failure stage
 */

import { useState, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { type DocType, fetchSignupUploadUrl } from '@reachinternational/utils';
import { getAppUrl } from '../env';
import {
  pickMobileDocumentImage,
  compressMobileImageForUpload,
  uploadMobileStagedImage,
  classifyUploadError,
  UploadError,
} from '../utils/mobileImageCompression';
import { offlineQueueManager } from '../offline/OfflineQueueManager';

export type MobileUploadSlotStatus = 'idle' | 'compressing' | 'uploading' | 'ready' | 'failed';

export interface MobileDocumentUploadSlot {
  docType: DocType;
  status: MobileUploadSlotStatus;
  previewUri: string | null;
  mainUri: string | null;
  thumbUri: string | null;
  /** User-facing error message shown in the failed-state card. */
  error: string | null;
  /** Whether tapping Retry makes sense for this error. */
  retryable: boolean;
  sizeBytes: number | null;
  uploadedAt: number | null;
}

const SESSION_MAX_AGE_MS = 1.5 * 60 * 60 * 1000; // 1.5 hours

const initialSlot = (docType: DocType): MobileDocumentUploadSlot => ({
  docType,
  status: 'idle',
  previewUri: null,
  mainUri: null,
  thumbUri: null,
  error: null,
  retryable: true,
  sizeBytes: null,
  uploadedAt: null,
});

/** Derives a friendly label for each DocType for use in error messages. */
function docTypeLabel(docType: DocType): string {
  switch (docType) {
    case 'aadhaar':       return 'Aadhaar';
    case 'driving_license': return 'Driving Licence';
    case 'bank_document': return 'Bank Document';
    default:              return 'Document';
  }
}

/** Applies a failed slot state from any UploadError or unknown error. */
function failedSlotState(
  prev: MobileDocumentUploadSlot,
  err: unknown,
  fallbackMsg: string
): Partial<MobileDocumentUploadSlot> {
  if (err instanceof UploadError) {
    return { status: 'failed', error: err.userMessage, retryable: err.retryable };
  }
  const msg = err instanceof Error ? err.message : fallbackMsg;
  return { status: 'failed', error: msg, retryable: true };
}

export function useMobileSignupDocumentUploads() {
  const [slots, setSlots] = useState<Record<DocType, MobileDocumentUploadSlot>>({
    bank_document:   initialSlot('bank_document'),
    aadhaar:         initialSlot('aadhaar'),
    driving_license: initialSlot('driving_license'),
  });

  const sessionTokenRef      = useRef<string | null>(null);
  const sessionCreatedAtRef  = useRef<number | null>(null);

  const getValidSession = useCallback((): string | undefined => {
    if (
      sessionTokenRef.current &&
      sessionCreatedAtRef.current &&
      Date.now() - sessionCreatedAtRef.current < SESSION_MAX_AGE_MS
    ) {
      return sessionTokenRef.current;
    }
    return undefined;
  }, []);

  // ─── pickAndUpload ──────────────────────────────────────────────────────────

  const pickAndUpload = useCallback(
    async (docType: DocType, source: 'camera' | 'gallery') => {
      const label = docTypeLabel(docType);

      // Phase 1: Image picking
      let asset: Awaited<ReturnType<typeof pickMobileDocumentImage>>;
      try {
        asset = await pickMobileDocumentImage(source);
      } catch (err) {
        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            ...failedSlotState(prev[docType], err, `Could not open ${source === 'camera' ? 'camera' : 'photo library'}. Please try again.`),
          },
        }));
        return;
      }

      if (!asset) return; // User cancelled — keep idle

      // Phase 2: Compression
      setSlots((prev) => ({
        ...prev,
        [docType]: {
          ...initialSlot(docType),
          status: 'compressing',
          previewUri: asset!.uri,
          retryable: true,
        },
      }));

      let compressed: Awaited<ReturnType<typeof compressMobileImageForUpload>>;
      try {
        compressed = await compressMobileImageForUpload({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
      } catch (err) {
        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            ...failedSlotState(prev[docType], err, `Could not process the ${label} photo. Please try a different image.`),
          },
        }));
        return;
      }

      // Phase 3: Uploading state — optimistic UI
      setSlots((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          status: 'uploading',
          previewUri: compressed.mainUri,
          mainUri:    compressed.mainUri,
          thumbUri:   compressed.thumbUri,
          sizeBytes:  compressed.sizeBytes,
          error:      null,
          retryable:  true,
        },
      }));

      // Phase 4: Connectivity check
      const netState = await NetInfo.fetch();
      const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

      if (!isOnline) {
        try {
          await offlineQueueManager.enqueue('UPLOAD_STAGING_DOCUMENT', {
            session:  getValidSession(),
            docType,
            mainUri:  compressed.mainUri,
            thumbUri: compressed.thumbUri,
          });
        } catch (queueErr) {
          console.warn('[MobileUploads] Offline queue enqueue error:', queueErr);
        }

        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status:    'uploading',
            error:     `No internet connection. Your ${label} photo will upload automatically when you're back online.`,
            retryable: true,
          },
        }));
        return;
      }

      // Phase 5: Signed URL fetch + storage upload
      try {
        const activeSession = getValidSession();
        let urlRes: Awaited<ReturnType<typeof fetchSignupUploadUrl>>;

        try {
          urlRes = await fetchSignupUploadUrl({
            baseUrl: getAppUrl(),
            session: activeSession,
            docType,
          });
        } catch (err) {
          const uploadErr = classifyUploadError(err, 'signed URL fetch');
          throw new UploadError(
            'SIGNED_URL_FAILED',
            uploadErr.code === 'NETWORK_TIMEOUT'
              ? 'Could not reach the upload server. Please check your connection and tap Retry.'
              : `Could not prepare the ${label} upload slot. Please tap Retry.`,
            true,
            err
          );
        }

        sessionTokenRef.current = urlRes.session;
        if (!activeSession) {
          sessionCreatedAtRef.current = Date.now();
        }

        const [mainResult, thumbResult] = await Promise.all([
          uploadMobileStagedImage(urlRes.main.signedUrl,  compressed.mainUri),
          uploadMobileStagedImage(urlRes.thumb.signedUrl, compressed.thumbUri),
        ]);

        // Both must succeed
        if (!mainResult.ok || !thumbResult.ok) {
          const failedPart = !mainResult.ok ? 'photo' : 'thumbnail';
          const rootErr = (!mainResult.ok ? mainResult.error : thumbResult.error);
          throw rootErr ?? new UploadError(
            'UPLOAD_PARTIAL',
            `The ${label} ${failedPart} could not be saved. Please tap Retry.`,
            true
          );
        }

        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status:     'ready',
            uploadedAt: Date.now(),
            error:      null,
            retryable:  true,
          },
        }));
      } catch (uploadErr) {
        console.warn(`[MobileUploads] Upload failed for ${docType}:`, uploadErr);

        // Best-effort offline queue
        try {
          await offlineQueueManager.enqueue('UPLOAD_STAGING_DOCUMENT', {
            session:  getValidSession(),
            docType,
            mainUri:  compressed.mainUri,
            thumbUri: compressed.thumbUri,
          });
        } catch { /* silent */ }

        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            ...failedSlotState(prev[docType], uploadErr, `${label} upload failed. Please tap Retry.`),
          },
        }));
      }
    },
    [getValidSession]
  );

  // ─── retryUpload ────────────────────────────────────────────────────────────

  const retryUpload = useCallback(
    async (docType: DocType) => {
      const slot = slots[docType];
      if (!slot.mainUri || !slot.thumbUri) return;

      const label = docTypeLabel(docType);

      setSlots((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          status:    'uploading',
          error:     null,
          retryable: true,
        },
      }));

      try {
        const activeSession = getValidSession();
        let urlRes: Awaited<ReturnType<typeof fetchSignupUploadUrl>>;

        try {
          urlRes = await fetchSignupUploadUrl({
            baseUrl: getAppUrl(),
            session: activeSession,
            docType,
          });
        } catch (err) {
          const uploadErr = classifyUploadError(err, 'signed URL fetch (retry)');
          throw new UploadError(
            'SIGNED_URL_FAILED',
            uploadErr.code === 'NETWORK_TIMEOUT'
              ? 'Could not reach the upload server. Please check your connection and try again.'
              : `Could not prepare a fresh upload slot for ${label}. Please try again.`,
            true,
            err
          );
        }

        sessionTokenRef.current = urlRes.session;
        if (!activeSession) {
          sessionCreatedAtRef.current = Date.now();
        }

        const [mainResult, thumbResult] = await Promise.all([
          uploadMobileStagedImage(urlRes.main.signedUrl,  slot.mainUri!),
          uploadMobileStagedImage(urlRes.thumb.signedUrl, slot.thumbUri!),
        ]);

        if (!mainResult.ok || !thumbResult.ok) {
          const rootErr = (!mainResult.ok ? mainResult.error : thumbResult.error);
          throw rootErr ?? new UploadError(
            'UPLOAD_PARTIAL',
            `${label} could not be saved completely. Please tap Retry.`,
            true
          );
        }

        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status:     'ready',
            uploadedAt: Date.now(),
            error:      null,
            retryable:  true,
          },
        }));
      } catch (err) {
        console.warn(`[MobileUploads] Retry failed for ${docType}:`, err);
        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            ...failedSlotState(prev[docType], err, `${label} upload failed. Please try again.`),
          },
        }));
      }
    },
    [slots, getValidSession]
  );

  // ─── removeFile ─────────────────────────────────────────────────────────────

  const removeFile = useCallback((docType: DocType) => {
    setSlots((prev) => ({
      ...prev,
      [docType]: initialSlot(docType),
    }));
  }, []);

  // ─── ensureFreshSessionForSubmit ────────────────────────────────────────────

  const ensureFreshSessionForSubmit = useCallback(async (): Promise<{
    ok: boolean;
    session: string | null;
    error?: string;
  }> => {
    const isExpired =
      !sessionTokenRef.current ||
      !sessionCreatedAtRef.current ||
      Date.now() - sessionCreatedAtRef.current >= SESSION_MAX_AGE_MS;

    if (!isExpired && sessionTokenRef.current) {
      return { ok: true, session: sessionTokenRef.current };
    }

    console.log('[MobileUploads] Session older than 1.5h — refreshing upload URLs…');
    sessionTokenRef.current    = null;
    sessionCreatedAtRef.current = null;

    const activeSlots = (Object.keys(slots) as DocType[]).filter(
      (k) => slots[k].mainUri && slots[k].thumbUri
    );

    for (const docType of activeSlots) {
      const slot = slots[docType];
      if (slot.mainUri && slot.thumbUri) {
        await retryUpload(docType);
      }
    }

    if (!sessionTokenRef.current) {
      return {
        ok:    false,
        session: null,
        error:
          'Your upload session expired. Please re-upload your documents to continue with registration.',
      };
    }

    return { ok: true, session: sessionTokenRef.current };
  }, [slots, retryUpload]);

  // ─── clearAll ───────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setSlots({
      bank_document:   initialSlot('bank_document'),
      aadhaar:         initialSlot('aadhaar'),
      driving_license: initialSlot('driving_license'),
    });
    sessionTokenRef.current    = null;
    sessionCreatedAtRef.current = null;
  }, []);

  // ─── Derived state ───────────────────────────────────────────────────────────

  const isMandatoryReady =
    slots.bank_document.status === 'ready' &&
    slots.aadhaar.status        === 'ready' &&
    (!slots.driving_license.mainUri || slots.driving_license.status === 'ready');

  const isAnyUploading =
    slots.bank_document.status   === 'compressing' ||
    slots.bank_document.status   === 'uploading'   ||
    slots.aadhaar.status         === 'compressing' ||
    slots.aadhaar.status         === 'uploading'   ||
    slots.driving_license.status === 'compressing' ||
    slots.driving_license.status === 'uploading';

  return {
    slots,
    sessionToken: sessionTokenRef.current,
    pickAndUpload,
    retryUpload,
    removeFile,
    ensureFreshSessionForSubmit,
    clearAll,
    isMandatoryReady,
    isAnyUploading,
  };
}
