# Current Task

## Task: 229 — Document Viewer: Rotate Button Strictly for Images (Removed for PDFs) & Comprehensive Profile/Document Pipeline Optimization
**Status**: 🟢 COMPLETED
**Date**: 2026-10-21

**User Objectives & Implementation**:
1. **Rotate Button Configuration**:
   - In `MobileDocumentViewerModal.tsx`:
     - Changed the Rotate action button (`<RotateCw />`) condition from `{isPdf && (` to strictly `{isImage && (`.
     - **Images** (`JPG`, `PNG`, `WEBP`): Rotate button IS displayed in the header toolbar (`accessibilityLabel="Rotate image 90 degrees"`).
     - **PDFs**: Rotate button is completely removed.
     - **Share Button**: Stays completely removed across all documents.
     - **Download & Close**: Preserved symmetrically with 48px touch targets.

2. **Document Fetching & Opening Optimization (`fetchUserDocuments`, `apps/mobile/lib/documents.ts`)**:
   - Replaced multiple individual document signed URL requests with a single batch `supabase.storage.from('user_files').createSignedUrls(allPaths, 3600)` call, reducing N storage network round-trips to exactly 1 batch request.
   - Optimized self-healing resolution to check candidate extension paths in batch rather than sequential loops.
   - Pre-resolved signed URLs pass directly into `MobileDocumentViewerModal` for instant opening with zero lag.

3. **Document Uploading Optimization (`uploadUserDocumentDirect`, `apps/mobile/lib/documents.ts`, `apps/mobile/app/(app)/profile/index.tsx`)**:
   - Converted stale extension file cleanup to a non-blocking background task (`void supabase.storage.from('user_files').remove(stalePaths).catch(...)`), preventing storage purge latency from stalling upload response.
   - Generated signed preview URLs immediately upon upload completion and returned `{ success: true, path, signedUrl }`.
   - In `handleUploadDocument`: Optimistically updated `userDocuments` state immediately with the new file and signed URL, providing instantaneous UI reset and checkmark feedback without waiting for full profile refetches.
   - Triggered lightweight background document synchronization (`fetchUserDocuments(user.id).then(setUserDocuments)`).

4. **Document Deleting Optimization (`deleteUserDocument`, `apps/mobile/lib/documents.ts`, `apps/mobile/app/(app)/profile/index.tsx`)**:
   - Executed database record deletion and storage file purge in parallel via `Promise.all` rather than sequential blocking steps.
   - In `handleConfirmDeleteDocument`: Streamlined post-delete refresh to document-only synchronization, eliminating heavy 5-query profile refetches.

5. **Profile Screen & API Optimization (`apps/mobile/app/(app)/profile/index.tsx`, `edit.tsx`, `apps/web/app/actions/documents.ts`)**:
   - Cached static reference data (`user_document_types`) in module-level `cachedDocumentTypes`, eliminating redundant database round-trips on subsequent profile visits and tab transitions.
   - Fixed `apps/mobile/app/(app)/profile/edit.tsx` to use explicit column projections instead of `select('*')`.
   - Optimized web Server Action `getUserDocumentsAction` in `apps/web/app/actions/documents.ts` with batch signed URL generation via `createSignedUrls`.

6. **Automated Verification**:
   - `node apps/mobile/test-document-viewer-workflows.mjs`: **PASS** (43/43 assertions verified, 100%).
   - `node apps/mobile/test-document-crud-workflows.mjs`: **PASS** (100% assertions verified).
   - `node apps/mobile/run-tests.mjs`: **PASS** (357/357 test scenarios passed, 100%).
   - `node scripts/check-typography.mjs`: **PASS** (0 raw typography violations).
   - `pnpm --filter @reachinternational/mobile typecheck`: **PASS** (`tsc --noEmit` -> 0 errors, exit code 0).
   - `pnpm --filter @reachinternational/web typecheck`: **PASS** (`tsc --noEmit` -> 0 errors, exit code 0).
   - `pnpm --filter @reachinternational/permissions test`: **PASS** (5/5 passed).
   - `pnpm --filter @reachinternational/utils test`: **PASS** (25/25 passed).
