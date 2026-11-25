import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getAppUrl } from '../env';
import {
  DOC_UPLOAD,
  type DocType,
  fetchReplacementUploadUrl,
  uploadToSignedUrl,
  submitDocumentReplacementClient,
  acknowledgeRejectedDocumentReplacementClient,
} from '@reachinternational/utils';
import { compressMobileImage } from '../utils/mobileImageCompression';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export interface MobileRejectedReplacementInfo {
  id: string;
  document_type_code: DocType;
  rejectionReason: string;
  reviewedAt?: string | null;
  stagingPath: string;
  signedUrl?: string | null;
  thumbSignedUrl?: string | null;
}

export interface MobileMyDocumentItem {
  id: string;
  user_id: string;
  document_type_code: DocType;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string;
  file_size_bytes: number;
  file_name: string;
  verification_status: 'pending' | 'verified' | 'rejected';
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
  hasRejectedReplacement?: boolean;
  rejectedReplacement?: MobileRejectedReplacementInfo | null;
}

export const MOBILE_MY_DOCUMENTS_QUERY_KEY = ['mobile-my-documents'] as const;

/**
 * Reads binary file as ArrayBuffer for direct streaming to Supabase Storage signed upload URL.
 */
async function readMobileFileAsArrayBuffer(fileUri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
}

/**
 * TanStack Query hook for native user documents.
 * 1. Selects user_documents straight from Supabase.
 * 2. Calls createSignedUrls(thumbPaths, 60) directly against user_files bucket via 3.2 policy (no server hop).
 * 3. Caches signed URLs with staleTime of 45 seconds.
 * 4. Displays verification status (pending, verified, rejected with reason) and pending replacement requests.
 */
export function useMobileMyDocuments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: MOBILE_MY_DOCUMENTS_QUERY_KEY,
    queryFn: async (): Promise<MobileMyDocumentItem[]> => {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr || !user) {
        throw new Error('Unauthenticated user session');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // 1. First attempt fast unified server API (includes pending change request thumbnails)
      try {
        const appUrl = getAppUrl();
        if (appUrl) {
          const res = await fetch(`${appUrl}/api/documents/my-documents`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'Cache-Control': 'no-cache',
            },
          });

          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.documents)) {
              return json.documents as MobileMyDocumentItem[];
            }
          }
        }
      } catch {
        // Fallback below to direct Supabase query
      }

      // 2. Direct Supabase fallback
      const [docsResult, pendingResult] = await Promise.all([
        supabase
          .from('user_documents')
          .select(
            'id, user_id, document_type_code, storage_path, thumb_path, mime_type, file_size_bytes, file_name, verification_status, rejection_reason, created_at, updated_at'
          )
          .eq('user_id', user.id)
          .order('document_type_code'),
        supabase
          .from('document_change_requests')
          .select('id, document_type_code, staging_path, staging_thumb_path, status, rejection_reason, reviewed_at, created_at')
          .eq('user_id', user.id)
          .in('status', ['pending', 'rejected']),
      ]);

      if (docsResult.error) {
        console.error('[useMobileMyDocuments] Error loading documents:', docsResult.error);
        throw docsResult.error;
      }

      const docs = docsResult.data || [];
      const pendingMap = new Map<string, any>();
      const rejectedMap = new Map<string, any>();
      (pendingResult.data || []).forEach((r) => {
        if (r.status === 'pending' && !pendingMap.has(r.document_type_code)) {
          pendingMap.set(r.document_type_code, r);
        } else if (r.status === 'rejected' && !rejectedMap.has(r.document_type_code)) {
          rejectedMap.set(r.document_type_code, r);
        }
      });

      // Batch generate signed thumbnail URLs straight to Supabase
      const thumbPaths = docs
        .map((d: any) => d.thumb_path || d.storage_path)
        .filter(Boolean);

      const thumbUrlMap = new Map<string, string>();

      if (thumbPaths.length > 0) {
        try {
          const { data: signedThumbs } = await supabase.storage
            .from('user_files')
            .createSignedUrls(thumbPaths, 60);

          if (signedThumbs && Array.isArray(signedThumbs)) {
            for (const item of signedThumbs) {
              if (item?.signedUrl && item.path) {
                thumbUrlMap.set(item.path, item.signedUrl);
              }
            }
          }
        } catch {}
      }

      // Also sign staging thumbs if available
      const stagingPaths = (pendingResult.data || [])
        .map((r: any) => r.staging_thumb_path || r.staging_path)
        .filter(Boolean);

      if (stagingPaths.length > 0) {
        try {
          const { data: signedStaging } = await supabase.storage
            .from('doc_staging')
            .createSignedUrls(stagingPaths, 60);
          if (signedStaging && Array.isArray(signedStaging)) {
            for (const item of signedStaging) {
              if (item?.signedUrl && item.path) {
                thumbUrlMap.set(item.path, item.signedUrl);
              }
            }
          }
        } catch {}
      }

      const covered = new Set<string>();
      const list: MobileMyDocumentItem[] = docs.map((doc: any) => {
        covered.add(doc.document_type_code);
        const thumbKey = doc.thumb_path || doc.storage_path;
        const pendingReq = pendingMap.get(doc.document_type_code);
        const rejectedReq = rejectedMap.get(doc.document_type_code);
        const pendingThumbKey = pendingReq ? (pendingReq.staging_thumb_path || pendingReq.staging_path) : null;
        const rejectedThumbKey = rejectedReq ? (rejectedReq.staging_thumb_path || rejectedReq.staging_path) : null;

        const hasPendingReplacement = Boolean(pendingReq);
        const hasRejectedReplacement = Boolean(rejectedReq);

        return {
          id: doc.id,
          user_id: doc.user_id,
          document_type_code: doc.document_type_code as DocType,
          storage_path: doc.storage_path,
          thumb_path: doc.thumb_path,
          mime_type: doc.mime_type,
          file_size_bytes: doc.file_size_bytes,
          file_name: doc.file_name,
          verification_status: hasPendingReplacement ? 'pending' : (doc.verification_status as 'pending' | 'verified' | 'rejected'),
          rejection_reason: hasPendingReplacement ? null : doc.rejection_reason,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          thumbSignedUrl: (hasPendingReplacement && pendingThumbKey && thumbUrlMap.get(pendingThumbKey)) || thumbUrlMap.get(thumbKey) || null,
          hasPendingReplacement,
          pendingRequestId: pendingReq?.id || null,
          hasRejectedReplacement,
          rejectedReplacement: hasRejectedReplacement ? {
            id: rejectedReq.id,
            document_type_code: doc.document_type_code as DocType,
            rejectionReason: rejectedReq.rejection_reason || 'Document replacement rejected by administrator.',
            reviewedAt: rejectedReq.reviewed_at,
            stagingPath: rejectedReq.staging_path,
            thumbSignedUrl: rejectedThumbKey ? thumbUrlMap.get(rejectedThumbKey) || null : null,
          } : null,
        };
      });

      // Include pending change requests that don't have user_documents row yet
      pendingMap.forEach((req, code) => {
        if (!covered.has(code)) {
          const pendingThumbKey = req.staging_thumb_path || req.staging_path;
          list.push({
            id: req.id,
            user_id: user.id,
            document_type_code: code as DocType,
            storage_path: req.staging_path,
            thumb_path: req.staging_thumb_path,
            mime_type: 'image/jpeg',
            file_size_bytes: 0,
            file_name: `${code}.jpg`,
            verification_status: 'pending',
            rejection_reason: null,
            created_at: req.created_at,
            updated_at: req.created_at,
            thumbSignedUrl: (pendingThumbKey && thumbUrlMap.get(pendingThumbKey)) || null,
            hasPendingReplacement: true,
            isPendingChangeRequest: true,
            pendingRequestId: req.id,
          });
        }
      });

      return list;
    },
    staleTime: 45 * 1000, // 45 seconds staleTime cache
    refetchInterval: 45 * 1000,
  });

  /**
   * Fetches full-resolution signed URL straight from Supabase Storage on demand.
   * Direct 3.2 policy evaluation, 60s validity, no server hop.
   */
  const getFullImageUrl = async (storagePath: string, doc?: MobileMyDocumentItem): Promise<string> => {
    if (doc?.signedUrl) {
      return doc.signedUrl;
    }
    if (doc?.pendingSignedUrl) {
      return doc.pendingSignedUrl;
    }

    const bucket = storagePath.startsWith('replace/') ? 'doc_staging' : 'user_files';
    let { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);

    if ((error || !data?.signedUrl) && bucket === 'doc_staging') {
      const alt = await supabase.storage.from('user_files').createSignedUrl(storagePath, 60);
      if (alt.data?.signedUrl) {
        data = alt.data;
        error = null;
      }
    } else if ((error || !data?.signedUrl) && bucket === 'user_files') {
      const alt = await supabase.storage.from('doc_staging').createSignedUrl(storagePath, 60);
      if (alt.data?.signedUrl) {
        data = alt.data;
        error = null;
      }
    }

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Failed to generate document view URL');
    }

    return data.signedUrl;
  };

  /**
   * Native mutation to replace a document:
   * 1. Compresses picked image via expo-image-manipulator (JPEG 0.8, <= 1600px, 320px thumb).
   * 2. Requests signed upload URLs from POST /api/documents/upload-url.
   * 3. Streams directly to doc_staging via PUT (no server hop).
   * 4. Submits replacement to POST /api/documents/replace.
   * 5. Invalidates TanStack Query cache on success.
   */
  const replaceMutation = useMutation({
    mutationFn: async ({
      docType,
      uri,
    }: {
      docType: DocType;
      uri: string;
    }): Promise<{
      success: boolean;
      approvedImmediately?: boolean;
      message?: string;
    }> => {
      // 1. Native image compression
      const compressed = await compressMobileImage(uri);

      // Get session access token for authenticated API calls
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // 2. Request staging upload URL
      const urlResponse = await fetchReplacementUploadUrl({
        baseUrl: getAppUrl(),
        docType,
        token,
      });

      if (!urlResponse.success || !urlResponse.uploadId) {
        throw new Error(urlResponse.error || 'Failed to request replacement upload URL');
      }

      // Read binary ArrayBuffers
      const [mainBuffer, thumbBuffer] = await Promise.all([
        readMobileFileAsArrayBuffer(compressed.mainUri),
        readMobileFileAsArrayBuffer(compressed.thumbUri),
      ]);

      // 3. Direct upload to doc_staging for main and thumb
      const [mainOk, thumbOk] = await Promise.all([
        uploadToSignedUrl(urlResponse.main.signedUrl, mainBuffer),
        uploadToSignedUrl(urlResponse.thumb.signedUrl, thumbBuffer),
      ]);

      if (!mainOk) {
        throw new Error('Failed to upload replacement image to storage');
      }
      if (!thumbOk) {
        console.warn('[replaceMobileDocument] Thumbnail upload failed, continuing with main file');
      }

      // 4. Submit replacement for server verification & review/swap
      const submitResult = await submitDocumentReplacementClient({
        baseUrl: getAppUrl(),
        docType,
        uploadId: urlResponse.uploadId,
        token,
      });

      if (!submitResult.success) {
        throw new Error(submitResult.error || 'Failed to submit document replacement');
      }

      return submitResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_MY_DOCUMENTS_QUERY_KEY });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({
      changeRequestId,
      docType,
    }: {
      changeRequestId?: string;
      docType?: DocType;
    }): Promise<{ success: boolean; error?: string }> => {
      const appUrl = getAppUrl();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      return await acknowledgeRejectedDocumentReplacementClient({
        baseUrl: appUrl || '',
        changeRequestId,
        docType,
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_MY_DOCUMENTS_QUERY_KEY });
    },
  });

  return {
    ...query,
    documents: query.data || [],
    getFullImageUrl,
    replaceDocument: replaceMutation.mutateAsync,
    isReplacing: replaceMutation.isPending,
    replaceError: replaceMutation.error,
    acknowledgeRejectedReplacement: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
  };
}
