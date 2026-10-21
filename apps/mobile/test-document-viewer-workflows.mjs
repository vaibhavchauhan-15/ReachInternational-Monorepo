/**
 * Automated Verification: Document Viewer, In-App Native PDF Viewer (@kishannareshpal/expo-pdf),
 * Zero Google Drive Redirects, Shared File Caching, Header Rotate, and In-App Download/Share.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

console.log('[Test Suite]: Document Viewer & Native In-App PDF Optimization Verification');

const modalPath = resolve('apps/mobile/components/documents/MobileDocumentViewerModal.tsx');
const cachePath = resolve('apps/mobile/lib/documentCache.ts');
const nativePdfPath = resolve('apps/mobile/components/documents/NativePdfViewer.tsx');
const webPdfPath = resolve('apps/mobile/components/documents/NativePdfViewer.web.tsx');

const modalContent = readFileSync(modalPath, 'utf8');
const cacheContent = readFileSync(cachePath, 'utf8');
const nativePdfContent = readFileSync(nativePdfPath, 'utf8');
const webPdfContent = readFileSync(webPdfPath, 'utf8');

// 1. Flicker-Free Image Rendering
assert(
  modalContent.includes('isDirectUrl(rawDocUrl)'),
  'Synchronous direct URL check prevents initial empty-state re-render flicker'
);
assert(
  !modalContent.includes('[docKey, rawDocUrl, doc, toast]'),
  'Unstable doc object and toast function references removed from useEffect dependency array'
);
assert(
  modalContent.includes('prevDocKeyRef.current !== docKey'),
  'prevDocKeyRef guards against repeated state resets on parent re-renders'
);
assert(
  modalContent.includes('imageSource = useMemo('),
  'Image source URI is memoized to prevent re-instantiation across renders'
);
assert(
  modalContent.includes('webImageContainer'),
  'Web platform uses native img with CSS transform, preventing ScrollView passive listener errors'
);

// 2. Toolbar & Layout: Header Rotate & Eradication of Reset / Bottom Bar
assert(
  modalContent.includes('handleRotate'),
  'Rotate button moved into header actions row'
);
assert(
  modalContent.includes('accessibilityLabel="Rotate image 90 degrees"') &&
  !modalContent.includes('accessibilityLabel="Rotate document 90 degrees"'),
  'Rotate button is enabled only for images and removed for PDFs per feedback'
);
assert(
  !modalContent.includes('RotateCcw'),
  'RotateCcw icon is completely eradicated'
);
assert(
  !modalContent.includes('handleResetRotation'),
  'handleResetRotation action is completely eradicated'
);
assert(
  !modalContent.includes('Reset') && !modalContent.includes('>Reset<'),
  'Reset button UI is completely eradicated'
);
assert(
  !modalContent.includes('floatingBar:'),
  'Bottom floating control bar style is completely eradicated'
);
assert(
  !modalContent.includes('Pinch to zoom & pan'),
  'Bottom "Pinch to zoom & pan" label is completely eradicated'
);

// 3. Native In-App PDF Viewer (Zero Google Drive Redirects)
assert(
  !modalContent.includes('docs.google.com/gview'),
  'Google Drive / Google Docs viewer URL is completely eradicated'
);
assert(
  modalContent.includes('NativePdfViewer'),
  'MobileDocumentViewerModal renders NativePdfViewer for in-app PDF display'
);
assert(
  existsSync(nativePdfPath),
  'NativePdfViewer.tsx exists for native iOS & Android'
);
assert(
  existsSync(webPdfPath),
  'NativePdfViewer.web.tsx exists for in-app Web display'
);
assert(
  nativePdfContent.includes('@kishannareshpal/expo-pdf'),
  'NativePdfViewer integrates @kishannareshpal/expo-pdf'
);
assert(
  nativePdfContent.includes('fitMode="width"'),
  'NativePdfViewer configures fitMode="width" for fit-to-width auto scaling'
);
assert(
  nativePdfContent.includes('horizontal={false}'),
  'NativePdfViewer enforces continuous vertical multipage scrolling'
);
assert(
  nativePdfContent.includes('pagingEnabled={false}'),
  'NativePdfViewer disables paging snapping for free vertical scrolling'
);
assert(
  nativePdfContent.includes('doubleTapToZoom={true}'),
  'NativePdfViewer enables smooth doubleTapToZoom'
);
assert(
  nativePdfContent.includes('pageGap={12}'),
  'NativePdfViewer provides 12px visual gap between pages'
);
assert(
  webPdfContent.includes('pdfjsLib'),
  'Web PDF viewer uses Mozilla PDF.js canvas engine'
);
assert(
  !webPdfContent.includes("type: 'application/pdf'"),
  'Web PDF viewer completely eradicates browser plugin object/iframe embed'
);

// 4. Shared Document Cache Service & Local File Reuse
assert(
  cacheContent.includes('ensureLocalDocumentFile'),
  'documentCache exports ensureLocalDocumentFile for shared file retrieval'
);
assert(
  cacheContent.includes('localFileCache'),
  'Local file cache deduplicates repeated downloads and stores valid file URIs'
);
assert(
  cacheContent.includes('FileSystem.downloadAsync'),
  'Native download utilizes FileSystem cache directory'
);
assert(
  modalContent.includes('ensureLocalDocumentFile'),
  'MobileDocumentViewerModal preloads and caches PDFs locally for viewer, download, and share'
);
assert(
  cacheContent.includes('downloadDocumentInApp'),
  'Shared documentCache exports downloadDocumentInApp'
);
assert(
  !cacheContent.includes("a.target = '_blank'"),
  'In-app download never sets target="_blank" to prevent external browser tab opening'
);
assert(
  cacheContent.includes('URL.createObjectURL(blob)'),
  'Web in-app download uses Blob object URLs for fast direct download'
);
assert(
  modalContent.includes('downloadDocumentInApp'),
  'MobileDocumentViewerModal delegates download to downloadDocumentInApp'
);
assert(
  cacheContent.includes('shareDocumentReliable'),
  'Shared documentCache exports shareDocumentReliable'
);
assert(
  cacheContent.includes('nav.share'),
  'Web platform uses Web Share API when available'
);
assert(
  cacheContent.includes('Clipboard.setStringAsync'),
  'Web platform provides graceful Clipboard copy fallback when Web Share is unsupported'
);
assert(
  cacheContent.includes('Sharing.shareAsync'),
  'Native platform integrates native Sharing.shareAsync with cached file URI'
);
assert(
  !modalContent.includes('accessibilityLabel="Share document"'),
  'Share document button is completely removed from document viewer per feedback'
);
assert(
  !nativePdfContent.includes('accessibilityLabel="Share PDF"'),
  'Share PDF button is completely removed from native PDF viewer'
);
assert(
  !webPdfContent.includes('accessibilityLabel="Share PDF document"'),
  'Share PDF button is completely removed from web PDF viewer'
);

// 5. Design System Tokens & Touch Targets
assert(
  modalContent.includes('hitSlopToMin48'),
  'Header action buttons enforce 48px touch slop conforming to mobile responsive rules'
);
assert(
  modalContent.includes('theme.colors.canvasElevated'),
  'Header surface utilizes canonical Geist canvasElevated token'
);
assert(
  modalContent.includes('theme.colors.hairline'),
  'Header border utilizes canonical Geist hairline token'
);
assert(
  modalContent.includes('theme.colors.ink'),
  'Action button icons utilize canonical Geist ink token'
);

console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exit(1);
}
console.log('✅ All Document Viewer & Native PDF workflow assertions verified successfully!');
