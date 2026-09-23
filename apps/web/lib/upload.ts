/**
 * Client-side file upload utility with real XHR progress.
 *
 * Uses XMLHttpRequest (NOT fetch) because fetch has no upload progress event.
 * Uploads directly to a Supabase Storage signed upload URL.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ─── File validation ────────────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/x-pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export function validateDocumentFile(
  file: File,
  allowedMimeTypes: string[],
  maxSizeBytes: number
): FileValidationResult {
  if (file.size > maxSizeBytes) {
    const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File too large. Maximum size: ${maxMB} MB` };
  }
  if (file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  const effectiveAllowed =
    allowedMimeTypes && allowedMimeTypes.length > 0
      ? allowedMimeTypes
      : DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES;

  const normalizedType = file.type?.toLowerCase() || "";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const allowedExtensions = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "heic",
    "heif",
    "pdf",
    "doc",
    "docx",
    "txt",
  ];

  const mimeMatches =
    effectiveAllowed.includes("*/*") ||
    effectiveAllowed.some(
      (m) =>
        m.toLowerCase() === normalizedType ||
        (m.endsWith("/*") && normalizedType.startsWith(m.slice(0, -1)))
    );

  const extMatches = allowedExtensions.includes(ext);

  if (!mimeMatches && !extMatches) {
    return {
      valid: false,
      error:
        "File format not supported. Allowed formats: PDF, JPEG, PNG, WEBP, DOC, DOCX up to 2 MB.",
    };
  }

  return { valid: true };
}

// ─── Real XHR upload with progress ──────────────────────────────────

/**
 * Upload a file to Supabase Storage with real byte-level progress.
 *
 * 1. Gets a signed upload URL from Supabase Storage (browser client, auth required)
 * 2. PUTs the file via XMLHttpRequest — the only way to get real upload progress in a browser
 * 3. Calls onProgress with actual percentage from xhr.upload.onprogress
 *
 * @returns The storage path that was uploaded to
 */
export async function uploadFileWithProgress(
  bucket: string,
  storagePath: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<string> {
  const supabase = createSupabaseBrowserClient();

  // Get signed upload URL from Supabase — this validates auth + storage policies
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(error?.message || "Failed to get upload URL");
  }

  const { signedUrl, token } = data;

  // PUT the file via XHR for real progress — NOT fetch (fetch has no upload progress)
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    // ponytail: Supabase signed upload URLs include the token in the URL itself,
    // but we also send it as a header for compatibility with different Supabase versions
    if (token) {
      xhr.setRequestHeader("x-upsert", "true");
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(storagePath);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));

    xhr.send(file);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Build the canonical storage path for a user document */
export function buildDocumentPath(userId: string, typeCode: string, file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  return `documents/${userId}/${typeCode}.${ext}`;
}
