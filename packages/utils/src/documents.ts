/**
 * ReachInternational Document Utilities & Cross-Platform Upload Configuration
 * Single source of truth for document types, staging paths, sizing, quality,
 * and universal API transport client functions.
 */

export const DOC_UPLOAD = {
  docTypes: ["bank_document", "aadhaar", "driving_license"] as const,
  maxEdge: 1600,
  thumbEdge: 320,
  minShortEdge: 600,
  quality: 0.8,
  thumbQuality: 0.7,
  targetBytes: 400_000,
  maxBytes: 1_000_000,
  mime: "image/jpeg",
} as const;

export type DocType = (typeof DOC_UPLOAD.docTypes)[number];

/**
 * Returns the temporary staging path for a document or thumbnail.
 * Pattern: <prefix>/<docType>[_thumb].jpg
 */
export const stagingPath = (prefix: string, docType: DocType, thumb = false): string =>
  `${prefix}/${docType}${thumb ? "_thumb" : ""}.jpg`;

/**
 * Returns the canonical, immutable final storage path in user_files.
 * Pattern: documents/<userId>/<docType>/<uuid>[_thumb].jpg
 */
export const finalDocumentPath = (
  userId: string,
  docType: DocType,
  fileUuid: string,
  thumb = false
): string => `documents/${userId}/${docType}/${fileUuid}${thumb ? "_thumb" : ""}.jpg`;

/**
 * Standardized cross-platform error message strings.
 */
export const DOCUMENT_ERROR_MESSAGES = {
  INVALID_DOC_TYPE: "Invalid document type selected.",
  IMAGE_TOO_LARGE: "Document image exceeds maximum size of 1 MB.",
  DIMENSIONS_TOO_SMALL: "Image resolution is too low. Minimum dimension is 600 px.",
  UNSUPPORTED_MIME: "Only JPEG images are supported for document uploads.",
  UPLOAD_FAILED: "Document upload failed. Please check your connection and try again.",
  STAGING_SESSION_EXPIRED: "Upload session expired. Please reselect your documents.",
  UNAUTHORIZED_VIEW: "You are not authorized to view this document.",
  DOCUMENT_NOT_FOUND: "Document not found.",
  DUPLICATE_PENDING_REQUEST: "A replacement request for this document is already pending review.",
  MISSING_REQUIRED_DOCUMENT: "All mandatory verification documents are required.",
  STAGING_FILE_MISSING: "Uploaded document file was not found in staging.",
} as const;

/**
 * Checks whether a given string is a valid canonical DocType.
 */
export function isDocType(val: unknown): val is DocType {
  return typeof val === "string" && (DOC_UPLOAD.docTypes as readonly string[]).includes(val);
}

// ─── Shared Universal API Client Transport Calls ─────────────────────────────

export interface StagingUploadToken {
  path: string;
  token: string;
  signedUrl: string;
}

export interface SignupUploadSlot {
  main: StagingUploadToken;
  thumb: StagingUploadToken;
}

export interface SignupUploadUrlResponse {
  session: string;
  main: StagingUploadToken;
  thumb: StagingUploadToken;
  error?: string;
}

export interface SignupUploadUrlsResponse {
  success: boolean;
  sessionId: string;
  uploads: Record<DocType, SignupUploadSlot>;
  error?: string;
}

export interface ReplacementUploadUrlResponse {
  success: boolean;
  uploadId?: string;
  docType: DocType;
  main: StagingUploadToken;
  thumb: StagingUploadToken;
  error?: string;
}

/**
 * Universal API Client: Request pre-signed upload URLs for a single document.
 * Follows zero-byte-pass-through architecture: returns signed upload URLs
 * directly pointing to Supabase storage `doc_staging`.
 */
export async function fetchSignupUploadUrl(params: {
  baseUrl?: string;
  session?: string;
  docType: DocType;
  turnstileToken?: string;
}): Promise<SignupUploadUrlResponse> {
  const base = params.baseUrl || "";
  const url = `${base}/api/signup/upload-urls`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: params.session,
      docType: params.docType,
      turnstileToken: params.turnstileToken,
    }),
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errorJson.message || errorJson.error || `HTTP ${response.status} failed to fetch upload URL`);
  }

  return response.json();
}

/**
 * API Client Call: Request pre-signed upload URLs from /api/signup/upload-urls
 * Takes a tiny JSON payload: { sessionId, docTypes }
 */
export async function fetchSignupUploadUrls(params: {
  baseUrl?: string;
  sessionId: string;
  docTypes: DocType[];
}): Promise<SignupUploadUrlsResponse> {
  const base = params.baseUrl || "";
  const url = `${base}/api/signup/upload-urls`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      docTypes: params.docTypes,
    }),
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errorJson.message || errorJson.error || `HTTP ${response.status} failed to fetch upload URLs`);
  }

  return response.json();
}

/**
 * API Client Call: Upload binary JPEG data directly to Supabase Storage signed upload URL.
 * Never passes through Vercel. Direct PUT to storage endpoint.
 */
export async function uploadToSignedUrl(
  signedUrl: string,
  binaryData: ArrayBuffer | Blob | Uint8Array,
  mime: string = DOC_UPLOAD.mime
): Promise<boolean> {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mime,
      "x-upsert": "true",
    },
    body: binaryData as any,
  });

  return response.ok;
}

/**
 * API Client Call: Finalize staging signup documents and move them to canonical storage.
 */
export async function finalizeSignupDocuments(params: {
  baseUrl?: string;
  userId: string;
  session: string;
}): Promise<{
  success: boolean;
  finalizedCount?: number;
  documents?: Array<{ docType: string; mainPath: string; thumbPath: string | null; sizeBytes: number }>;
  error?: string;
}> {
  const base = params.baseUrl || "";
  const url = `${base}/api/signup/finalize`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: params.userId,
      session: params.session,
    }),
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errorJson.message || errorJson.error || `HTTP ${response.status} failed to finalize documents`);
  }

  return response.json();
}

/**
 * Universal API Client: Request pre-signed replacement upload URLs for a single document.
 * Calls POST /api/documents/upload-url
 */
export async function fetchReplacementUploadUrl(params: {
  baseUrl?: string;
  docType: DocType;
  token?: string;
}): Promise<ReplacementUploadUrlResponse> {
  const base = params.baseUrl || "";
  const url = `${base}/api/documents/upload-url`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (params.token) {
    headers["Authorization"] = `Bearer ${params.token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      docType: params.docType,
    }),
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errorJson.message || errorJson.error || `HTTP ${response.status} failed to fetch replacement upload URL`);
  }

  return response.json();
}

/**
 * Universal API Client: Submit document replacement once uploaded to staging.
 * Calls POST /api/documents/replace
 */
export async function submitDocumentReplacementClient(params: {
  baseUrl?: string;
  docType: DocType;
  uploadId: string;
  token?: string;
}): Promise<{
  success: boolean;
  action?: "approved_immediate" | "pending_review";
  approvedImmediately?: boolean;
  message?: string;
  error?: string;
}> {
  const base = params.baseUrl || "";
  const url = `${base}/api/documents/replace`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (params.token) {
    headers["Authorization"] = `Bearer ${params.token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      docType: params.docType,
      uploadId: params.uploadId,
    }),
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errorJson.message || errorJson.error || `HTTP ${response.status} failed to submit replacement`);
  }

  return response.json();
}

// ─── Phase 8: Admin & HR Read & Inspection Transport ─────────────────────────

export interface AdminDocumentItem {
  id: string;
  user_id: string;
  document_type_code: string;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string;
  file_size_bytes: number;
  verification_status: "pending" | "verified" | "rejected";
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  thumb_signed_url: string | null;
}

export interface AdminPendingChangeRequestItem {
  id: string;
  user_id: string;
  document_type_code: string;
  staging_path: string;
  staging_thumb_path: string | null;
  status: "pending";
  created_at: string;
}

export interface AdminUserDocumentsResponse {
  success: boolean;
  userId: string;
  documents: AdminDocumentItem[];
  pendingChangeRequests: AdminPendingChangeRequestItem[];
  error?: string;
}

/**
 * Universal API Client: Admin/HR reads user's documents with 60s thumbnail pre-signed URLs.
 * Calls GET /api/admin/documents/<userId>
 */
export async function fetchAdminUserDocuments(
  userId: string,
  options?: { baseUrl?: string; token?: string }
): Promise<AdminUserDocumentsResponse> {
  const base = options?.baseUrl || "";
  const url = `${base}/api/admin/documents/${userId}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errorJson.message || errorJson.error || `HTTP ${response.status} failed to fetch user documents`);
  }

  return response.json();
}

/**
 * Universal API Client: Admin/HR gets a 60s pre-signed URL for the full-resolution document image.
 * Calls GET /api/admin/documents/<userId>/<docType>
 */
export async function fetchAdminDocumentUrl(
  userId: string,
  docType: DocType,
  options?: { baseUrl?: string; token?: string }
): Promise<{
  success: boolean;
  docType: DocType;
  signedUrl: string;
  expiresIn: number;
  error?: string;
}> {
  const base = options?.baseUrl || "";
  const url = `${base}/api/admin/documents/${userId}/${docType}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errorJson.message || errorJson.error || `HTTP ${response.status} failed to fetch document URL`);
  }

  return response.json();
}
