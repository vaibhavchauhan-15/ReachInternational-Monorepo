"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { type DocType, uploadToSignedUrl, fetchSignupUploadUrl } from "@reachinternational/utils";
import { compressImageForUpload } from "@/lib/utils/image-compression";

export type UploadSlotStatus = "idle" | "compressing" | "uploading" | "ready" | "failed";

export interface DocumentUploadSlot {
  docType: DocType;
  file: File | null;
  status: UploadSlotStatus;
  previewUrl: string | null;
  error: string | null;
  mainBlob: Blob | null;
  thumbBlob: Blob | null;
  mainPath: string | null;
  thumbPath: string | null;
  uploadedAt: number | null;
}

const SESSION_MAX_AGE_MS = 1.5 * 60 * 60 * 1000; // 1.5 hours

async function uploadWithBackoff(
  signedUrl: string,
  blob: Blob,
  maxRetries = 3
): Promise<boolean> {
  const delays = [500, 1000, 2000];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ok = await uploadToSignedUrl(signedUrl, blob, "image/jpeg");
      if (ok) return true;
    } catch (err) {
      console.warn(`[UploadSlot] Attempt ${attempt + 1} failed:`, err);
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, delays[attempt] || 1000));
    }
  }
  return false;
}

const initialSlot = (docType: DocType): DocumentUploadSlot => ({
  docType,
  file: null,
  status: "idle",
  previewUrl: null,
  error: null,
  mainBlob: null,
  thumbBlob: null,
  mainPath: null,
  thumbPath: null,
  uploadedAt: null,
});

export function useSignupDocumentUploads() {
  const [slots, setSlots] = useState<Record<DocType, DocumentUploadSlot>>({
    bank_document: initialSlot("bank_document"),
    aadhaar: initialSlot("aadhaar"),
    driving_license: initialSlot("driving_license"),
  });

  const sessionTokenRef = useRef<string | null>(null);
  const sessionCreatedAtRef = useRef<number | null>(null);

  // Revoke object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(slots).forEach((slot) => {
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      });
    };
  }, []);

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

  const uploadFile = useCallback(
    async (docType: DocType, file: File | null) => {
      // If user removed file
      if (!file) {
        setSlots((prev) => {
          const current = prev[docType];
          if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
          return {
            ...prev,
            [docType]: initialSlot(docType),
          };
        });
        return;
      }

      // Step 1: Compress at pick time
      setSlots((prev) => {
        const current = prev[docType];
        if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return {
          ...prev,
          [docType]: {
            ...initialSlot(docType),
            file,
            status: "compressing",
          },
        };
      });

      let compressionResult;
      try {
        compressionResult = await compressImageForUpload(file);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Image compression failed.";
        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status: "failed",
            error: errMsg,
          },
        }));
        return;
      }

      // Step 2: Upload in background
      setSlots((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          status: "uploading",
          previewUrl: compressionResult.previewUrl,
          mainBlob: compressionResult.mainBlob,
          thumbBlob: compressionResult.thumbBlob,
          error: null,
        },
      }));

      try {
        const activeSession = getValidSession();
        const urlRes = await fetchSignupUploadUrl({
          session: activeSession,
          docType,
        });

        // Store session token and creation epoch
        sessionTokenRef.current = urlRes.session;
        if (!activeSession) {
          sessionCreatedAtRef.current = Date.now();
        }

        // Direct PUT to Supabase Storage signed URLs
        const [mainOk, thumbOk] = await Promise.all([
          uploadWithBackoff(urlRes.main.signedUrl, compressionResult.mainBlob),
          uploadWithBackoff(urlRes.thumb.signedUrl, compressionResult.thumbBlob),
        ]);

        if (!mainOk || !thumbOk) {
          throw new Error("Upload to storage failed after 3 attempts.");
        }

        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status: "ready",
            mainPath: urlRes.main.path,
            thumbPath: urlRes.thumb.path,
            uploadedAt: Date.now(),
            error: null,
          },
        }));
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Upload failed. Please tap retry.";
        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status: "failed",
            error: errMsg,
          },
        }));
      }
    },
    [getValidSession]
  );

  const retryUpload = useCallback(
    async (docType: DocType) => {
      const slot = slots[docType];
      if (!slot.file) return;

      if (!slot.mainBlob || !slot.thumbBlob) {
        // Re-run from compression if blobs were lost
        await uploadFile(docType, slot.file);
        return;
      }

      setSlots((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          status: "uploading",
          error: null,
        },
      }));

      try {
        const activeSession = getValidSession();
        const urlRes = await fetchSignupUploadUrl({
          session: activeSession,
          docType,
        });

        sessionTokenRef.current = urlRes.session;
        if (!activeSession) {
          sessionCreatedAtRef.current = Date.now();
        }

        const [mainOk, thumbOk] = await Promise.all([
          uploadWithBackoff(urlRes.main.signedUrl, slot.mainBlob),
          uploadWithBackoff(urlRes.thumb.signedUrl, slot.thumbBlob),
        ]);

        if (!mainOk || !thumbOk) {
          throw new Error("Upload to storage failed after 3 attempts.");
        }

        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status: "ready",
            mainPath: urlRes.main.path,
            thumbPath: urlRes.thumb.path,
            uploadedAt: Date.now(),
            error: null,
          },
        }));
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Upload failed. Please tap retry.";
        setSlots((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status: "failed",
            error: errMsg,
          },
        }));
      }
    },
    [slots, getValidSession, uploadFile]
  );

  /**
   * Pre-submit check: if session is older than 1.5 h, requests fresh URLs and re-uploads
   */
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

    // Refresh needed
    console.log("[UploadSlots] Session is older than 1.5 hours, refreshing staging URLs...");
    sessionTokenRef.current = null;
    sessionCreatedAtRef.current = null;

    // Re-upload all ready slots
    const activeSlots = (Object.keys(slots) as DocType[]).filter(
      (k) => slots[k].file && slots[k].mainBlob && slots[k].thumbBlob
    );

    for (const docType of activeSlots) {
      const slot = slots[docType];
      if (slot.file) {
        await uploadFile(docType, slot.file);
      }
    }

    if (!sessionTokenRef.current) {
      return { ok: false, session: null, error: "Failed to establish upload session." };
    }

    return { ok: true, session: sessionTokenRef.current };
  }, [slots, uploadFile]);

  const clearAll = useCallback(() => {
    Object.values(slots).forEach((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });
    setSlots({
      bank_document: initialSlot("bank_document"),
      aadhaar: initialSlot("aadhaar"),
      driving_license: initialSlot("driving_license"),
    });
    sessionTokenRef.current = null;
    sessionCreatedAtRef.current = null;
  }, [slots]);

  const isMandatoryReady =
    slots.bank_document.status === "ready" &&
    slots.aadhaar.status === "ready" &&
    (!slots.driving_license.file || slots.driving_license.status === "ready");

  const isAnyUploading =
    slots.bank_document.status === "compressing" ||
    slots.bank_document.status === "uploading" ||
    slots.aadhaar.status === "compressing" ||
    slots.aadhaar.status === "uploading" ||
    slots.driving_license.status === "compressing" ||
    slots.driving_license.status === "uploading";

  return {
    slots,
    sessionToken: sessionTokenRef.current,
    uploadFile,
    retryUpload,
    ensureFreshSessionForSubmit,
    clearAll,
    isMandatoryReady,
    isAnyUploading,
  };
}
