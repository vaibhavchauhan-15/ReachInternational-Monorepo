/**
 * ReachInternational Mobile — User Documents Manager
 * Handles picking, validating, uploading, and fetching user identity documents
 * (Aadhaar, Driving Licence) with full cross-platform parity (iOS, Android, Web).
 */

import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export interface MobilePickedDocument {
  name: string;
  size: number;
  mimeType: string;
  uri: string;
  file?: File;
}

export interface UserDocumentInfo {
  id: string;
  user_id: string;
  document_type_code: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
  signed_url?: string | null;
}

export const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/x-pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/**
 * Validate document file size and mime type
 */
export function validateDocument(
  mimeType: string,
  sizeBytes: number,
  fileName?: string
): { isValid: boolean; error?: string } {
  const normalizedMime = mimeType?.toLowerCase().trim() || '';
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf', 'doc', 'docx', 'txt'];

  const isAllowed =
    ALLOWED_DOCUMENT_MIME_TYPES.some((m) => normalizedMime.startsWith(m) || normalizedMime === m) ||
    normalizedMime.startsWith('image/') ||
    allowedExtensions.includes(ext);

  if (!isAllowed) {
    return {
      isValid: false,
      error: 'Invalid file format. Accepted: PDF, PNG, JPG, WEBP, DOC up to 2 MB.',
    };
  }

  if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File size (${sizeMb} MB) exceeds maximum limit of 2 MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Launch native / web document picker for identity documents
 */
export async function pickIdentityDocument(): Promise<MobilePickedDocument | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const size = asset.size || 0;

    const validation = validateDocument(mimeType, size, asset.name);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    return {
      name: asset.name,
      size,
      mimeType,
      uri: asset.uri,
      file: asset.file,
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to select document');
  }
}

/**
 * Convert picked document to binary payload (Uint8Array, Blob, or File)
 */
export async function getDocumentBinary(
  doc: MobilePickedDocument
): Promise<Uint8Array | Blob | File> {
  if (doc.file) {
    return doc.file;
  }

  if (Platform.OS === 'web') {
    const res = await fetch(doc.uri);
    return await res.blob();
  }

  // Native (iOS/Android): Use FileSystem base64 reading
  try {
    const base64 = await FileSystem.readAsStringAsync(doc.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch {
    // Fallback to fetch blob
    const res = await fetch(doc.uri);
    return await res.blob();
  }
}

/**
 * Upload a document directly to Supabase storage and upsert user_documents row
 */
export async function uploadUserDocumentDirect(params: {
  userId: string;
  documentTypeCode: 'aadhaar' | 'driving_license' | 'bank_document' | 'bank_passbook' | string;
  doc: MobilePickedDocument;
  onProgress?: (progressPercent: number) => void;
}): Promise<{ success: boolean; path?: string; signedUrl?: string; error?: string }> {
  const { userId, documentTypeCode, doc, onProgress } = params;

  try {
    if (onProgress) onProgress(20);

    const binaryData = await getDocumentBinary(doc);
    if (onProgress) onProgress(40);

    const extMatch = doc.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : doc.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    const filePath = `documents/${userId}/${documentTypeCode}.${ext}`;

    // Upload to user_files bucket
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('user_files')
      .upload(filePath, binaryData, {
        contentType: doc.mimeType,
        upsert: true,
      });

    if (uploadErr) {
      console.error('[Document Upload] Storage error:', uploadErr);
      return { success: false, error: uploadErr.message };
    }

    if (onProgress) onProgress(70);

    const finalStoragePath = uploadData?.path || filePath;

    // Clean up alternate extension files for this document slot asynchronously (non-blocking)
    const otherExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'].filter((e) => e !== ext);
    const stalePaths = otherExts.map((e) => `documents/${userId}/${documentTypeCode}.${e}`);
    void supabase.storage.from('user_files').remove(stalePaths).catch(() => {});

    if (onProgress) onProgress(85);

    // Upsert into user_documents table with file_name and uploaded_by
    const docPayload = {
      user_id: userId,
      document_type_code: documentTypeCode,
      storage_path: finalStoragePath,
      mime_type: doc.mimeType,
      file_size_bytes: doc.size,
      file_name: doc.name,
      status: 'verified',
      uploaded_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error: dbErr } = await supabase
      .from('user_documents')
      .upsert(docPayload, { onConflict: 'user_id,document_type_code' });

    if (dbErr) {
      console.warn('[Document Upload] Direct upsert warning, attempting RPC:', dbErr);
      // Fallback to secure RPC
      const { error: rpcErr } = await supabase.rpc('upsert_user_document', {
        p_user_id: userId,
        p_document_type_code: documentTypeCode,
        p_storage_path: finalStoragePath,
        p_mime_type: doc.mimeType,
        p_file_size_bytes: doc.size,
        p_file_name: doc.name,
      });

      if (rpcErr) {
        console.error('[Document Upload] RPC upsert error:', rpcErr);
        return { success: false, error: rpcErr.message || dbErr.message };
      }
    }

    // Generate signed preview URL immediately so caller can update state with zero extra query
    let signedUrl: string | undefined;
    try {
      const { data: signedData } = await supabase.storage
        .from('user_files')
        .createSignedUrl(finalStoragePath, 3600);
      signedUrl = signedData?.signedUrl || undefined;
    } catch {
      // Non-critical signed URL generation
    }

    if (onProgress) onProgress(100);
    return { success: true, path: finalStoragePath, signedUrl };
  } catch (err: any) {
    console.error('[Document Upload] Exception:', err);
    return { success: false, error: err?.message || 'Failed to upload document' };
  }
}

/**
 * Upload a pending replacement document to storage only without touching user_documents table.
 * Used for change requests where the document awaits management review.
 */
export async function uploadPendingDocumentToStorage(params: {
  userId: string;
  documentTypeCode: string;
  doc: MobilePickedDocument;
  onProgress?: (progressPercent: number) => void;
}): Promise<{
  success: boolean;
  docInfo?: {
    storage_path: string;
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
  };
  error?: string;
}> {
  const { userId, documentTypeCode, doc, onProgress } = params;

  try {
    if (onProgress) onProgress(20);

    const binaryData = await getDocumentBinary(doc);
    if (onProgress) onProgress(40);

    const extMatch = doc.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : doc.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    const filePath = `documents/${userId}/${documentTypeCode}_pending_${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('user_files')
      .upload(filePath, binaryData, {
        contentType: doc.mimeType,
        upsert: true,
      });

    if (uploadErr) {
      console.error('[Pending Document Upload] Storage error:', uploadErr);
      return { success: false, error: uploadErr.message };
    }

    if (onProgress) onProgress(100);

    return {
      success: true,
      docInfo: {
        storage_path: uploadData?.path || filePath,
        file_name: doc.name,
        file_size_bytes: doc.size,
        mime_type: doc.mimeType,
      },
    };
  } catch (err: any) {
    console.error('[Pending Document Upload] Exception:', err);
    return { success: false, error: err?.message || 'Failed to upload document' };
  }
}

/**
 * Fetch existing documents for a user with signed URLs
 */
export async function fetchUserDocuments(
  userId: string
): Promise<UserDocumentInfo[]> {
  try {
    const { data: docs, error } = await supabase
      .from('user_documents')
      .select('id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, created_at, updated_at')
      .eq('user_id', userId)
      .order('document_type_code');

    if (error || !docs) {
      return [];
    }

    const validDocs = docs.filter((d: any) => d.document_type_code !== 'profile_photo');
    if (validDocs.length === 0) return [];

    // 1. Batch generate signed URLs in a single round-trip
    const allPaths = validDocs.map((d: any) => d.storage_path);
    const { data: batchSigned } = await supabase.storage
      .from('user_files')
      .createSignedUrls(allPaths, 3600);

    const signedUrlMap = new Map<string, string>();
    if (batchSigned && Array.isArray(batchSigned)) {
      for (const item of batchSigned) {
        if (item.signedUrl && !item.error && item.path) {
          signedUrlMap.set(item.path, item.signedUrl);
        }
      }
    }

    // 2. Map documents with batch-signed URLs or perform fast targeted self-healing
    const withUrls: UserDocumentInfo[] = await Promise.all(
      validDocs.map(async (d: any) => {
        let signedUrl = signedUrlMap.get(d.storage_path) || null;
        let activeStoragePath = d.storage_path;
        let activeMimeType = d.mime_type;

        // If batch generation missed this file, attempt candidate self-healing
        if (!signedUrl) {
          const commonExts = ['png', 'jpg', 'jpeg', 'pdf', 'webp'];
          const candidatePaths = commonExts
            .map((ext) => `documents/${userId}/${d.document_type_code}.${ext}`)
            .filter((p) => p !== d.storage_path);

          const { data: candidateSigned } = await supabase.storage
            .from('user_files')
            .createSignedUrls(candidatePaths, 3600);

          if (candidateSigned && Array.isArray(candidateSigned)) {
            const found = candidateSigned.find((c) => c.signedUrl && !c.error && c.path);
            if (found && found.signedUrl && found.path) {
              signedUrl = found.signedUrl;
              activeStoragePath = found.path;
              const ext = found.path.split('.').pop()?.toLowerCase() || '';
              activeMimeType = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

              // Silently self-heal user_documents table so subsequent queries resolve immediately
              void supabase
                .from('user_documents')
                .update({
                  storage_path: activeStoragePath,
                  mime_type: activeMimeType,
                  file_name: `${d.document_type_code}.${ext}`,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', d.id);
            }
          }
        }

        return {
          ...d,
          storage_path: activeStoragePath,
          mime_type: activeMimeType,
          signed_url: signedUrl,
        };
      })
    );

    return withUrls;
  } catch (err) {
    console.error('[Document Upload] Error fetching user docs:', err);
    return [];
  }
}

/**
 * Delete a user document from storage and database
 */
export async function deleteUserDocument(
  userId: string,
  documentTypeCode: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Delete all possible file variations from storage (current path + common extensions)
    const pathsToRemove = [
      storagePath,
      `documents/${userId}/${documentTypeCode}.pdf`,
      `documents/${userId}/${documentTypeCode}.png`,
      `documents/${userId}/${documentTypeCode}.jpg`,
      `documents/${userId}/${documentTypeCode}.jpeg`,
      `documents/${userId}/${documentTypeCode}.webp`,
    ].filter(Boolean);

    const uniquePaths = Array.from(new Set(pathsToRemove));

    // Run DB deletion and storage removal concurrently for instant response
    const [dbResult] = await Promise.all([
      supabase
        .from('user_documents')
        .delete()
        .eq('user_id', userId)
        .eq('document_type_code', documentTypeCode),
      supabase.storage.from('user_files').remove(uniquePaths).catch(() => {}),
    ]);

    if (dbResult.error) {
      console.error('[Document Delete] DB delete error:', dbResult.error);
      return { success: false, error: dbResult.error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete document' };
  }
}
