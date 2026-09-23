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
  documentTypeCode: 'aadhaar' | 'driving_license';
  doc: MobilePickedDocument;
  onProgress?: (progressPercent: number) => void;
}): Promise<{ success: boolean; path?: string; error?: string }> {
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

    if (onProgress) onProgress(80);

    // Upsert into user_documents table
    const { error: dbErr } = await supabase.from('user_documents').upsert(
      {
        user_id: userId,
        document_type_code: documentTypeCode,
        storage_path: uploadData.path || filePath,
        mime_type: doc.mimeType,
        file_size_bytes: doc.size,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,document_type_code' }
    );

    if (dbErr) {
      console.error('[Document Upload] DB upsert error:', dbErr);
      return { success: false, error: dbErr.message };
    }

    if (onProgress) onProgress(100);
    return { success: true, path: uploadData.path || filePath };
  } catch (err: any) {
    console.error('[Document Upload] Exception:', err);
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

    const withUrls: UserDocumentInfo[] = await Promise.all(
      docs
        .filter((d: any) => d.document_type_code !== 'profile_photo')
        .map(async (d: any) => {
          const { data: signedData } = await supabase.storage
            .from('user_files')
            .createSignedUrl(d.storage_path, 3600);
          return {
            ...d,
            signed_url: signedData?.signedUrl || null,
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
    // 1. Delete from storage
    if (storagePath) {
      await supabase.storage.from('user_files').remove([storagePath]);
    }

    // 2. Delete from DB
    const { error } = await supabase
      .from('user_documents')
      .delete()
      .eq('user_id', userId)
      .eq('document_type_code', documentTypeCode);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete document' };
  }
}
