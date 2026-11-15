"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DOC_UPLOAD,
  type DocType,
  fetchReplacementUploadUrl,
  uploadToSignedUrl,
  submitDocumentReplacementClient,
} from "@reachinternational/utils";
import { compressImageForUpload } from "@/lib/utils/image-compression";
import { getDocumentViewUrlAction } from "@/app/actions/documents";

export interface MyDocumentItem {
  id: string;
  user_id: string;
  document_type_code: DocType;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string;
  file_size_bytes: number;
  file_name: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  thumbSignedUrl: string | null;
  signedUrl?: string | null;
  hasPendingReplacement: boolean;
  pendingRequestId?: string | null;
  pendingThumbSignedUrl?: string | null;
  pendingSignedUrl?: string | null;
  pendingCreatedAt?: string | null;
  isPendingChangeRequest?: boolean;
}

export const MY_DOCUMENTS_QUERY_KEY = ["my-documents"] as const;

/**
 * React Query hook for user's personal documents.
 * 1. Fetches unified documents from /api/documents/my-documents.
 * 2. Incorporates both active user_documents and pending change requests.
 * 3. Shows new replacement thumbnails with "pending" review status.
 * 4. Caches signed URLs with staleTime of 45 seconds.
 */
export function useMyDocuments() {
  const supabase = createSupabaseBrowserClient();
  const queryClient = useQueryClient();

  const documentsQuery = useQuery({
    queryKey: MY_DOCUMENTS_QUERY_KEY,
    queryFn: async (): Promise<MyDocumentItem[]> => {
      try {
        const res = await fetch("/api/documents/my-documents", {
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.documents && Array.isArray(json.documents)) {
            return json.documents as MyDocumentItem[];
          }
        }
      } catch {
        // Direct browser client fallback below
      }

      // Direct fallback using browser client with batch createSignedUrls
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: docs } = await supabase
        .from("user_documents")
        .select("id, user_id, document_type_code, storage_path, thumb_path, mime_type, file_size_bytes, file_name, verification_status, rejection_reason, created_at, updated_at")
        .eq("user_id", user.id);

      if (!docs || docs.length === 0) return [];

      const thumbPaths = docs.map((d: any) => d.thumb_path || d.storage_path).filter(Boolean);
      const { data: signedThumbs } = await supabase.storage
        .from("user_files")
        .createSignedUrls(thumbPaths, 60);

      const thumbMap = new Map<string, string>();
      if (signedThumbs && Array.isArray(signedThumbs)) {
        for (const item of signedThumbs) {
          if (item?.signedUrl && item.path) thumbMap.set(item.path, item.signedUrl);
        }
      }

      return docs.map((d: any) => ({
        ...d,
        thumbSignedUrl: thumbMap.get(d.thumb_path || d.storage_path) || null,
        hasPendingReplacement: false,
      }));
    },
    staleTime: 45 * 1000,
    refetchInterval: 45 * 1000,
  });

  /**
   * Fetches full-resolution signed URL on demand for viewing.
   */
  const getFullImageUrl = async (storagePath: string, docId?: string, isStaging = false): Promise<string> => {
    // Check if doc item already has signedUrl in cache
    const cachedDoc = (documentsQuery.data || []).find((d) => d.id === docId || d.storage_path === storagePath);
    if (cachedDoc?.signedUrl) {
      return cachedDoc.signedUrl;
    }

    // Call server action for secure verified view link
    const actionRes = await getDocumentViewUrlAction({
      documentId: docId,
      isStaging,
    });

    if (actionRes.success && actionRes.signedUrl) {
      return actionRes.signedUrl;
    }

    const targetBucket = isStaging ? "doc_staging" : "user_files";
    const { data, error } = await supabase.storage
      .from(targetBucket)
      .createSignedUrl(storagePath, 120);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Failed to generate document view URL");
    }

    return data.signedUrl;
  };

  /**
   * Mutation to replace a document:
   * 1. Compresses via shared canvas compressor (JPEG, <= 1600px, 320px thumb).
   * 2. Requests signed upload URLs from POST /api/documents/upload-url.
   * 3. Uploads directly to doc_staging via PUT (no Vercel hop).
   * 4. Submits replacement to POST /api/documents/replace.
   * 5. Invalidates React Query cache on success.
   */
  const replaceMutation = useMutation({
    mutationFn: async ({
      docType,
      file,
    }: {
      docType: DocType;
      file: File;
    }): Promise<{
      success: boolean;
      approvedImmediately?: boolean;
      message?: string;
    }> => {
      // 1. Pick-time adaptive compression
      const compressed = await compressImageForUpload(file);

      // 2. Request staging upload URL
      const urlResponse = await fetchReplacementUploadUrl({ docType });
      if (!urlResponse.success || !urlResponse.uploadId) {
        throw new Error(urlResponse.error || "Failed to request replacement upload URL");
      }

      // 3. Direct upload to doc_staging for main and thumb
      const [mainOk, thumbOk] = await Promise.all([
        uploadToSignedUrl(urlResponse.main.signedUrl, compressed.mainBlob),
        uploadToSignedUrl(urlResponse.thumb.signedUrl, compressed.thumbBlob),
      ]);

      if (!mainOk) {
        throw new Error("Failed to upload replacement image to storage");
      }
      if (!thumbOk) {
        console.warn("[replaceDocument] Thumbnail upload failed, continuing with main file");
      }

      // 4. Submit replacement for server verification & review/swap
      const submitResult = await submitDocumentReplacementClient({
        docType,
        uploadId: urlResponse.uploadId,
      });

      if (!submitResult.success) {
        throw new Error(submitResult.error || "Failed to submit document replacement");
      }

      return submitResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_DOCUMENTS_QUERY_KEY });
    },
  });

  return {
    ...documentsQuery,
    documents: documentsQuery.data || [],
    getFullImageUrl,
    replaceDocument: replaceMutation.mutateAsync,
    replaceMutation,
    isReplacing: replaceMutation.isPending,
    replaceError: replaceMutation.error,
  };
}
