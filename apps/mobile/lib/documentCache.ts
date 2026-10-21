/**
 * ReachInternational Mobile — Shared Document Cache & Transfer Service
 *
 * Lightweight, high-performance file-management service providing:
 * - Deterministic URL resolution & Supabase signed-URL caching
 * - In-flight request deduplication across concurrent Open, Download & Share calls
 * - Memory & FileSystem caching to eradicate redundant network downloads
 * - In-app, zero-browser-redirect downloads on Web (Blob-based) and Native (FileSystem + Share/Save)
 * - Native Share sheet integration on iOS/Android and Web Share API with Clipboard fallback on Web
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabase';
import { showToast } from '@/components/ui/overlay';
import { haptics } from './haptics';

interface SignedUrlCacheEntry {
  url: string;
  expiresAt: number; // Unix timestamp ms
}

// In-memory cache for signed URLs (valid for 50 minutes to stay safely below 1hr expiry)
const signedUrlCache = new Map<string, SignedUrlCacheEntry>();
// In-flight URL resolution promise deduplication
const resolvingPromises = new Map<string, Promise<string>>();

// Cache of local file URIs (URL -> local file URI)
const localFileCache = new Map<string, string>();
// In-flight download promise deduplication
const downloadingPromises = new Map<string, Promise<string>>();

/**
 * Sanitize and guarantee a clean filename with proper extension
 */
export function sanitizeDocumentFileName(
  fileName?: string,
  title?: string,
  mimeType?: string
): string {
  let baseName = (fileName || title || 'document').trim();
  // Strip illegal filesystem characters
  baseName = baseName.replace(/[/\\?%*:|"<>]/g, '_');

  const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(baseName);
  if (!hasExt) {
    let ext = 'pdf';
    const lowerMime = (mimeType || '').toLowerCase();
    if (lowerMime.includes('png')) ext = 'png';
    else if (lowerMime.includes('jpeg') || lowerMime.includes('jpg')) ext = 'jpg';
    else if (lowerMime.includes('webp')) ext = 'webp';
    else if (lowerMime.includes('gif')) ext = 'gif';
    else if (lowerMime.includes('word') || lowerMime.includes('doc')) ext = 'docx';
    else if (lowerMime.includes('sheet') || lowerMime.includes('xls')) ext = 'xlsx';

    baseName = `${baseName}.${ext}`;
  }

  return baseName;
}

/**
 * Determine if a URL is already a directly usable absolute URI
 */
export function isDirectUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('file://')
  );
}

/**
 * Resolve a document URL (storage path or signed URL) with deduplication & caching
 */
export async function resolveDocumentUrl(
  rawPathOrUrl: string,
  bucket = 'user_files'
): Promise<string> {
  const trimmed = (rawPathOrUrl || '').trim();
  if (!trimmed) return '';

  // Already a direct URL
  if (isDirectUrl(trimmed)) {
    return trimmed;
  }

  const cleanPath = trimmed.replace(/^\/+/, '');
  const cacheKey = `${bucket}:${cleanPath}`;

  // Check valid cache entry (valid for 50 min)
  const cached = signedUrlCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  // Deduplicate in-flight resolution for the same path
  if (resolvingPromises.has(cacheKey)) {
    return resolvingPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, 3600);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Failed to generate signed document URL');
      }

      // Cache for 50 minutes (3000 seconds)
      signedUrlCache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt: Date.now() + 50 * 60 * 1000,
      });

      return data.signedUrl;
    } finally {
      resolvingPromises.delete(cacheKey);
    }
  })();

  resolvingPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Fast in-app download reusing cached files, bypassing external browser redirects
 */
export async function downloadDocumentInApp(params: {
  url: string;
  fileName?: string;
  title?: string;
  mimeType?: string;
}): Promise<string> {
  const { url, title, mimeType } = params;
  if (!url) throw new Error('Document URL is required');

  const filename = sanitizeDocumentFileName(params.fileName, title, mimeType);

  // 1. Web Platform: Native in-app silent download via Blob (zero browser redirect!)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // If it's already a blob or data URI, trigger directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('success', 'Download Complete', filename);
      return url;
    }

    // Cross-origin URLs (Supabase storage): Fetch as blob to guarantee immediate in-app download
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file (${response.status})`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    // Strict requirement: Never use target="_blank" which redirects to external browser
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    showToast('success', 'Download Complete', filename);
    return blobUrl;
  }

  // 2. Native Mobile (iOS & Android): Local FileSystem caching + native save
  const finalUri = await ensureLocalDocumentFile(params);

  // Prompt native save/share sheet with the local file
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (isSharingAvailable) {
    const isPdf = filename.toLowerCase().endsWith('.pdf') || mimeType?.includes('pdf');
    await Sharing.shareAsync(finalUri, {
      dialogTitle: `Save ${filename}`,
      UTI: isPdf ? 'com.adobe.pdf' : 'public.image',
      mimeType: mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
    });
    showToast('success', 'File Ready', `${filename} ready on your device.`);
  } else {
    showToast('success', 'File Saved', `Saved to ${finalUri}`);
  }

  return finalUri;
}

/**
 * Ensure a document file is downloaded, validated, and cached on the local filesystem.
 * Returns the local file URI (e.g. file:///...).
 * On Web, returns the original/resolved URL.
 * Guarantees deduplicated concurrent requests and file integrity validation.
 */
export async function ensureLocalDocumentFile(params: {
  url: string;
  fileName?: string;
  title?: string;
  mimeType?: string;
}): Promise<string> {
  const { url, title, mimeType } = params;
  if (!url) throw new Error('Document URL is required');

  // Web Platform: use direct URL
  if (Platform.OS === 'web' || typeof window !== 'undefined') {
    return url;
  }

  // Already a local file URI
  if (url.startsWith('file://')) {
    return url;
  }

  const filename = sanitizeDocumentFileName(params.fileName, title, mimeType);
  const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const localUri = `${targetDir}doc_${filename}`;

  // 1. Check in-memory local file cache
  const existingLocalUri = localFileCache.get(url);
  if (existingLocalUri) {
    const info = await FileSystem.getInfoAsync(existingLocalUri).catch(() => null);
    if (info?.exists && (info as any).size > 0) {
      return existingLocalUri;
    }
    localFileCache.delete(url);
  }

  // 2. Check disk cache
  const diskInfo = await FileSystem.getInfoAsync(localUri).catch(() => null);
  if (diskInfo?.exists && (diskInfo as any).size > 0) {
    localFileCache.set(url, localUri);
    return localUri;
  } else if (diskInfo?.exists) {
    // Zero-byte corrupted/interrupted file: safely remove
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
  }

  // 3. Deduplicate in-flight downloads for the exact same URL
  let downloadPromise = downloadingPromises.get(url);
  if (!downloadPromise) {
    downloadPromise = (async () => {
      try {
        const downloadRes = await FileSystem.downloadAsync(url, localUri);
        if (downloadRes.status >= 200 && downloadRes.status < 300) {
          // Validate downloaded file integrity
          const verified = await FileSystem.getInfoAsync(downloadRes.uri).catch(() => null);
          if (verified?.exists && (verified as any).size > 0) {
            localFileCache.set(url, downloadRes.uri);
            return downloadRes.uri;
          }
          throw new Error('Downloaded document file was empty or corrupted');
        }
        throw new Error(`Document download failed with HTTP status ${downloadRes.status}`);
      } catch (err) {
        // Clean up partial file on error
        await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
        throw err;
      } finally {
        downloadingPromises.delete(url);
      }
    })();
    downloadingPromises.set(url, downloadPromise);
  }

  return downloadPromise;
}

/**
 * Get synchronously cached local document URI if available
 */
export function getCachedLocalDocumentUri(url: string): string | null {
  return localFileCache.get(url) || null;
}

/**
 * Reliable sharing reusing cached local files without browser navigation
 */
export async function shareDocumentReliable(params: {
  url: string;
  fileName?: string;
  title?: string;
  mimeType?: string;
}): Promise<void> {
  const { url, title, mimeType } = params;
  if (!url) throw new Error('Document URL is required');

  haptics.select();
  const filename = sanitizeDocumentFileName(params.fileName, title, mimeType);

  // 1. Web Platform: Web Share API with Clipboard copy fallback
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const nav = window.navigator as any;

    if (typeof nav?.share === 'function') {
      try {
        await nav.share({
          title: title || filename,
          url,
        });
        showToast('success', 'Document Shared');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // User closed share dialog, clean return
          return;
        }
      }
    }

    // Fallback: Copy link to clipboard
    try {
      await Clipboard.setStringAsync(url);
      showToast('success', 'Link Copied', 'Document preview link copied to clipboard.');
      return;
    } catch {
      showToast('info', 'Document Link', url);
      return;
    }
  }

  // 2. Native Mobile: Local cached file share
  try {
    const localUri = await ensureLocalDocumentFile(params);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable && localUri) {
      const isPdf = filename.toLowerCase().endsWith('.pdf') || mimeType?.includes('pdf');
      await Sharing.shareAsync(localUri, {
        dialogTitle: `Share ${title || filename}`,
        UTI: isPdf ? 'com.adobe.pdf' : 'public.image',
        mimeType: mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
      });
    } else {
      await Clipboard.setStringAsync(url);
      showToast('success', 'Link Copied', 'Document link copied to clipboard.');
    }
  } catch (err: any) {
    if (err?.message?.includes('User did not share') || err?.name === 'AbortError') {
      return;
    }
    // Fallback to clipboard without browser redirect
    await Clipboard.setStringAsync(url).catch(() => {});
    showToast('info', 'Link Copied', 'Document link copied to clipboard.');
  }
}
