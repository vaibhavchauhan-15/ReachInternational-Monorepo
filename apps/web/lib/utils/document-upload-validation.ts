export const ALLOWED_DOCUMENT_MIMES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateDocumentUpload(
  file: File | null,
  required: boolean,
  label: string
): { error?: string; safeExt?: string } {
  if (!file || file.size === 0) {
    if (required) return { error: `${label} is required.` };
    return {};
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      error: `${label} must be smaller than 2 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }
  const safeExt = ALLOWED_DOCUMENT_MIMES[file.type.toLowerCase()];
  if (!safeExt) {
    return {
      error: `${label} must be a valid document file (JPG, PNG, WebP, or PDF).`,
    };
  }
  return { safeExt };
}
