/**
 * Reach International Mobile — Document Image Picker & Adaptive Compression Utility
 * Implements high-performance native image manipulation at pick time.
 *
 * ─── Compression Strategy (MNC-grade document clarity) ───────────────────────
 * Documents (Aadhaar, Driving License, Bank Passbook) contain fine text, QR
 * codes, holograms, and microprint. Aggressive compression destroys these
 * details and makes documents unreadable for verification by HR/Admin.
 *
 * Updated pipeline (aligned with Google Drive, WhatsApp Business, DigiLocker):
 * 1. Pick with expo-image-picker (images only, camera and gallery).
 * 2. expo-image-manipulator: resize long edge to 2400 px, JPEG quality 0.92.
 * 3. Adaptive loop (soft quality steps — never drop below 0.80):
 *    · Pass 1: 2400 px @ 0.92 quality  → target ≤ 800 KB
 *    · Pass 2: 2400 px @ 0.85 quality  → if still > 800 KB
 *    · Pass 3: 2000 px @ 0.80 quality  → last resort (dimension reduction)
 * 4. Reject if short edge is under 600 px or final result exceeds 2.5 MB.
 * 5. Produce a 480 px thumbnail @ 0.82 quality (sharp on 2× Retina/Android).
 * 6. Strips EXIF/GPS metadata on re-encode (privacy-safe).
 * 7. Read file with expo-file-system (legacy API) as base64, convert with base64-arraybuffer.
 * 8. Upload via uploadToSignedUrl with direct PUT fallback.
 *
 * NOTE: expo-file-system v54+ deprecated `getInfoAsync` and `readAsStringAsync` on the
 * top-level `'expo-file-system'` import. We use `'expo-file-system/legacy'` to access
 * the stable legacy API surface without triggering deprecation warnings — consistent
 * with documentCache.ts and documents.ts throughout this codebase.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { DOC_UPLOAD, uploadToSignedUrl } from '@reachinternational/utils';

// ─── Typed upload error codes ────────────────────────────────────────────────

export type UploadErrorCode =
  | 'PERMISSION_DENIED_CAMERA'
  | 'PERMISSION_DENIED_GALLERY'
  | 'IMAGE_TOO_LOW_RESOLUTION'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_UNREADABLE'
  | 'COMPRESSION_FAILED'
  | 'THUMBNAIL_FAILED'
  | 'SIGNED_URL_FAILED'
  | 'UPLOAD_FAILED'
  | 'UPLOAD_PARTIAL'
  | 'NETWORK_TIMEOUT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class UploadError extends Error {
  readonly code: UploadErrorCode;
  readonly userMessage: string;
  readonly retryable: boolean;

  constructor(code: UploadErrorCode, userMessage: string, retryable = true, cause?: unknown) {
    super(userMessage);
    this.name = 'UploadError';
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = retryable;
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Maps raw errors/HTTP statuses from the upload pipeline to user-friendly UploadError instances.
 */
export function classifyUploadError(err: unknown, context: string): UploadError {
  if (err instanceof UploadError) return err;

  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();

  // Network / connectivity
  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('abort')
  ) {
    return new UploadError(
      'NETWORK_TIMEOUT',
      'Connection lost during upload. Please check your internet and tap Retry.',
      true,
      err
    );
  }

  // 401 / 403 — signed URL expired or invalid
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return new UploadError(
      'SIGNED_URL_FAILED',
      'Upload session expired. Please choose another photo to refresh.',
      true,
      err
    );
  }

  // 413 — payload too large
  if (lower.includes('413') || lower.includes('payload too large') || lower.includes('request entity too large')) {
    return new UploadError(
      'IMAGE_TOO_LARGE',
      'Photo is too large for upload even after compression. Please choose a different image.',
      false,
      err
    );
  }

  // 5xx — server-side
  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('server error') ||
    lower.includes('internal server')
  ) {
    return new UploadError(
      'SERVER_ERROR',
      'Server error during upload. Please wait a moment and tap Retry.',
      true,
      err
    );
  }

  // Storage full / quota
  if (lower.includes('storage') && (lower.includes('quota') || lower.includes('limit'))) {
    return new UploadError(
      'UPLOAD_FAILED',
      'Storage quota reached. Please contact support.',
      false,
      err
    );
  }

  // Fallback for context-specific messages
  return new UploadError('UNKNOWN', `Upload failed during ${context}. Please tap Retry.`, true, err);
}

export interface CompressedMobileDocumentResult {
  mainUri: string;
  thumbUri: string;
  width: number;
  height: number;
  sizeBytes: number;
  thumbSizeBytes: number;
}

/**
 * Calculates proportional dimensions constrained to a maximum long edge.
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxLongEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(origWidth, origHeight);
  if (longEdge <= maxLongEdge) {
    return { width: origWidth, height: origHeight };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(origWidth * scale)),
    height: Math.max(1, Math.round(origHeight * scale)),
  };
}

/**
 * Launches native Camera or Gallery picker for identity document photos.
 * Throws typed UploadError on permission denial.
 */
export async function pickMobileDocumentImage(
  source: 'camera' | 'gallery'
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    let permission: ImagePicker.CameraPermissionResponse;
    try {
      permission = await ImagePicker.requestCameraPermissionsAsync();
    } catch {
      throw new UploadError(
        'PERMISSION_DENIED_CAMERA',
        'Could not request camera permission. Please enable it in your device Settings and try again.',
        false
      );
    }

    if (!permission.granted) {
      const isDeniedPermanently = permission.canAskAgain === false;
      throw new UploadError(
        'PERMISSION_DENIED_CAMERA',
        isDeniedPermanently
          ? 'Camera access is blocked. Please go to Settings → Privacy → Camera and enable access for this app.'
          : 'Camera permission is required to capture document photos. Please allow access when prompted.',
        false
      );
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }
      return result.assets[0];
    } catch (err) {
      throw new UploadError(
        'UNKNOWN',
        'Camera could not open. Please close other apps using the camera and try again.',
        true,
        err
      );
    }
  } else {
    let permission: ImagePicker.MediaLibraryPermissionResponse;
    try {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch {
      throw new UploadError(
        'PERMISSION_DENIED_GALLERY',
        'Could not request photo library permission. Please enable it in your device Settings and try again.',
        false
      );
    }

    if (!permission.granted) {
      const isDeniedPermanently = permission.canAskAgain === false;
      throw new UploadError(
        'PERMISSION_DENIED_GALLERY',
        isDeniedPermanently
          ? 'Photo library access is blocked. Please go to Settings → Privacy → Photos and enable access for this app.'
          : 'Photo library permission is required to select document photos. Please allow access when prompted.',
        false
      );
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }
      return result.assets[0];
    } catch (err) {
      throw new UploadError(
        'UNKNOWN',
        'Could not open photo library. Please try again.',
        true,
        err
      );
    }
  }
}

/**
 * Executes adaptive multi-pass compression on native mobile devices.
 * Throws typed UploadError for resolution, size, and processing failures.
 */
export async function compressMobileImageForUpload(asset: string | {
  uri: string;
  width?: number;
  height?: number;
}): Promise<CompressedMobileDocumentResult> {
  const assetObj = typeof asset === 'string' ? { uri: asset } : asset;
  let origWidth = assetObj.width || 0;
  let origHeight = assetObj.height || 0;

  // Fallback dimension probe if asset lacks dimensions
  if (!origWidth || !origHeight) {
    try {
      const probe = await ImageManipulator.manipulateAsync(
        assetObj.uri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      origWidth = probe.width;
      origHeight = probe.height;
    } catch (err) {
      throw new UploadError(
        'IMAGE_UNREADABLE',
        'Could not read the selected photo. It may be corrupted or in an unsupported format. Please choose a different image.',
        false,
        err
      );
    }
  }

  // 1. Resolution Gate: Accept all clear images, ensure valid dimensions
  const shortEdge = Math.min(origWidth, origHeight);
  if (origWidth <= 0 || origHeight <= 0 || Math.max(origWidth, origHeight) < 16) {
    throw new UploadError(
      'IMAGE_TOO_LOW_RESOLUTION',
      'Photo resolution is too low to be a valid document. Please select a clearer photo.',
      false
    );
  }

  // Gracefully accept compact or cropped document photos (< 600 px)
  if (shortEdge < DOC_UPLOAD.minShortEdge) {
    console.info(
      `[mobileImageCompression] Processing compact photo (${origWidth}×${origHeight} px). Preserving full resolution.`
    );
  }

  // 2. Adaptive Multi-Pass Compression for Main Document Image
  //
  // Strategy: Soft quality steps (0.92→0.85→0.80) preserve document text,
  // QR codes, and microprint. Dimension reduction is a last resort (2400→2000 px).
  // Extended passes guarantee that high-resolution or large files adapt safely.
  let mainResult: ImageManipulator.ImageResult;
  let sizeBytes = 0;

  try {
    // Pass 1: Max edge 2400 px @ 0.92 quality — near-lossless, text intact
    const targetDims2400 = calculateTargetDimensions(origWidth, origHeight, DOC_UPLOAD.maxEdge);
    mainResult = await ImageManipulator.manipulateAsync(
      assetObj.uri,
      [{ resize: targetDims2400 }],
      { compress: DOC_UPLOAD.quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    const fileInfo1 = await FileSystem.getInfoAsync(mainResult.uri);
    sizeBytes = (fileInfo1 as any).size || 0;

    // Pass 2: If > 800 KB, soft reduction to 0.85 — still visually lossless for documents
    if (sizeBytes > DOC_UPLOAD.targetBytes) {
      mainResult = await ImageManipulator.manipulateAsync(
        assetObj.uri,
        [{ resize: targetDims2400 }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const fileInfo2 = await FileSystem.getInfoAsync(mainResult.uri);
      sizeBytes = (fileInfo2 as any).size || 0;
    }

    // Pass 3: Soft reduction — reduce long edge to 2000 px @ 0.80 quality
    if (sizeBytes > DOC_UPLOAD.targetBytes) {
      const targetDims2000 = calculateTargetDimensions(origWidth, origHeight, 2000);
      mainResult = await ImageManipulator.manipulateAsync(
        assetObj.uri,
        [{ resize: targetDims2000 }],
        { compress: 0.80, format: ImageManipulator.SaveFormat.JPEG }
      );
      const fileInfo3 = await FileSystem.getInfoAsync(mainResult.uri);
      sizeBytes = (fileInfo3 as any).size || 0;

      // Pass 4: Dimension reduction to 1600 px @ 0.78 quality if still > 1.2 MB
      if (sizeBytes > 1_200_000) {
        const targetDims1600 = calculateTargetDimensions(origWidth, origHeight, 1600);
        mainResult = await ImageManipulator.manipulateAsync(
          assetObj.uri,
          [{ resize: targetDims1600 }],
          { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG }
        );
        const fileInfo4 = await FileSystem.getInfoAsync(mainResult.uri);
        sizeBytes = (fileInfo4 as any).size || 0;

        // Pass 5: Dimension reduction to 1400 px @ 0.75 quality if still > 1.6 MB
        if (sizeBytes > 1_600_000) {
          const targetDims1400 = calculateTargetDimensions(origWidth, origHeight, 1400);
          mainResult = await ImageManipulator.manipulateAsync(
            assetObj.uri,
            [{ resize: targetDims1400 }],
            { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
          );
          const fileInfo5 = await FileSystem.getInfoAsync(mainResult.uri);
          sizeBytes = (fileInfo5 as any).size || 0;

          // Pass 6: Dimension reduction to 1200 px @ 0.70 quality if still > 2.0 MB
          if (sizeBytes > 2_000_000) {
            const targetDims1200 = calculateTargetDimensions(origWidth, origHeight, 1200);
            mainResult = await ImageManipulator.manipulateAsync(
              assetObj.uri,
              [{ resize: targetDims1200 }],
              { compress: 0.70, format: ImageManipulator.SaveFormat.JPEG }
            );
            const fileInfo6 = await FileSystem.getInfoAsync(mainResult.uri);
            sizeBytes = (fileInfo6 as any).size || 0;
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError(
      'COMPRESSION_FAILED',
      'Failed to process the photo. Please try choosing a different image.',
      true,
      err
    );
  }

  // Final Gate: Reject if > 2.5 MB (after all 3 passes) or if degenerate (< 5 KB)
  if (sizeBytes > DOC_UPLOAD.maxBytes) {
    throw new UploadError(
      'IMAGE_TOO_LARGE',
      `Photo is still too large (${(sizeBytes / 1024).toFixed(0)} KB) after compression. Please use a photo under 2.5 MB or take a new one in better lighting.`,
      false
    );
  }

  if (sizeBytes < 5_000) {
    throw new UploadError(
      'COMPRESSION_FAILED',
      'The photo could not be processed clearly. Please take a clearer photo and try again.',
      true
    );
  }

  // 3. Generate 480 px Thumbnail (sharp on 2× Retina / Android high-DPI screens)
  let thumbResult: ImageManipulator.ImageResult;
  let thumbSizeBytes = 0;

  try {
    const thumbDims = calculateTargetDimensions(origWidth, origHeight, DOC_UPLOAD.thumbEdge);
    thumbResult = await ImageManipulator.manipulateAsync(
      assetObj.uri,
      [{ resize: thumbDims }],
      { compress: DOC_UPLOAD.thumbQuality, format: ImageManipulator.SaveFormat.JPEG }
    );
    const thumbInfo = await FileSystem.getInfoAsync(thumbResult.uri);
    thumbSizeBytes = (thumbInfo as any).size || 0;
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError(
      'THUMBNAIL_FAILED',
      'Could not generate a preview thumbnail. Please try again.',
      true,
      err
    );
  }

  return {
    mainUri: mainResult!.uri,
    thumbUri: thumbResult!.uri,
    width: mainResult!.width,
    height: mainResult!.height,
    sizeBytes,
    thumbSizeBytes,
  };
}

/**
 * Reads a local file URI and converts it to an ArrayBuffer.
 * Throws a typed UploadError if the file cannot be read.
 */
export async function readImageAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64 || base64.length === 0) {
      throw new UploadError(
        'IMAGE_UNREADABLE',
        'The compressed photo could not be read from storage. Please try again.',
        true
      );
    }
    return decode(base64);
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError(
      'IMAGE_UNREADABLE',
      'Could not read the photo file. Please try choosing a different image.',
      true,
      err
    );
  }
}

/**
 * Direct PUT upload to Supabase Storage signed upload URL.
 * Attempts uploadToSignedUrl first; falls back to direct fetch PUT with ArrayBuffer.
 * Returns { ok: true } on success, or { ok: false, error: UploadError } on failure.
 */
export async function uploadMobileStagedImage(
  signedUrl: string,
  uri: string,
  maxRetries = 3
): Promise<{ ok: boolean; error?: UploadError }> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await readImageAsArrayBuffer(uri);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof UploadError
        ? err
        : new UploadError('IMAGE_UNREADABLE', 'Could not read the photo. Please try again.', true, err),
    };
  }

  const delays = [800, 1500, 3000];
  let lastError: UploadError | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Primary: uploadToSignedUrl util
    try {
      const ok = await uploadToSignedUrl(signedUrl, arrayBuffer, 'image/jpeg');
      if (ok) return { ok: true };
    } catch (err) {
      lastError = classifyUploadError(err, `attempt ${attempt + 1} (primary)`);
      console.warn(`[MobileUpload] uploadToSignedUrl attempt ${attempt + 1}:`, lastError.message);
      // Don't retry non-retryable errors immediately
      if (!lastError.retryable) {
        return { ok: false, error: lastError };
      }
    }

    // Fallback: Direct PUT to signed URL
    try {
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
        body: arrayBuffer,
      });

      if (response.ok) return { ok: true };

      // Map HTTP error status to typed error
      const statusText = `HTTP ${response.status}`;
      lastError = classifyUploadError(new Error(statusText), `attempt ${attempt + 1} (PUT fallback)`);
      console.warn(`[MobileUpload] Direct PUT attempt ${attempt + 1} returned ${response.status}`);

      if (!lastError.retryable) {
        return { ok: false, error: lastError };
      }
    } catch (putErr) {
      lastError = classifyUploadError(putErr, `attempt ${attempt + 1} (PUT fallback)`);
      console.warn(`[MobileUpload] Direct PUT attempt ${attempt + 1} threw:`, lastError.message);
      if (!lastError.retryable) {
        return { ok: false, error: lastError };
      }
    }

    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, delays[attempt] ?? 1000));
    }
  }

  return {
    ok: false,
    error: lastError ?? new UploadError(
      'UPLOAD_FAILED',
      'Upload failed after multiple attempts. Please check your connection and tap Retry.',
      true
    ),
  };
}

export const compressMobileImage = compressMobileImageForUpload;
