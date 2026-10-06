import { Platform } from 'react-native';

/**
 * Universal browser file downloader for Expo web.
 * Triggers native browser download without third-party dependencies.
 */
export function downloadFileOnWeb(
  content: string,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[fileExport] Failed to trigger web download:', err);
    return false;
  }
}

/**
 * Sanitizes a filename string by replacing unsafe characters with underscores.
 */
export function sanitizeExportFilename(baseName: string, ext: string): string {
  const clean = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const cleanExt = ext.replace(/^\./, '');
  return `${clean || 'Export'}.${cleanExt}`;
}
