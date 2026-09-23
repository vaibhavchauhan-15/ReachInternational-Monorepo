# Current Task: Profile Documents Download Functionality & Responsive Layout Fixes

Status: COMPLETED (2026-09-23)

## Goal
Address user feedback on `/profile`:
1. **Modal Download Functionality**: Ensure clicking the "Download" button in `DocumentViewerModal` reliably downloads any file format (image, PDF, DOC, DOCX, TXT) to the user's local device instead of opening it in a new tab or failing cross-origin.
2. **Responsive Upload & Cancel Buttons**: Eliminate button container overflow where Cancel spilled out of the card.
3. **Upload Button Label**: Simplify label to strictly **"Upload"**.
4. **Remove File Size and Preview Subtitle**: Remove `"176 KB • Click to preview"` subtitle text during file selection.
5. **Format Badge Sizing & Desktop Grid**: Match Replace/Delete button dimensions and align cards in a 2-column grid on desktop.

## Delivered Solution

### 1. Web Application (`apps/web`)
- `apps/web/app/api/documents/[id]/download/route.ts`:
  - Created dedicated server-side download API route.
  - Verifies user authentication and checks ownership / staff permissions (`super_admin`, `admin`, `hr`).
  - Fetches binary file from Supabase storage using `createSupabaseAdminClient().storage.from("user_files").download(storage_path)`.
  - Streams the file with `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...` headers to force browser file download.
  - Logs `document.downloaded` to `public.audit_logs`.
- `apps/web/components/documents/DocumentViewerModal.tsx`:
  - Enhanced `handleDownload` to fetch from `/api/documents/${doc.id}/download`, create an object URL blob, and trigger native download with correct filename.
  - Added loading spinner and disabled state to download button while downloading.
  - Added 1-tap download trigger to mobile PDF helper strip.
- `apps/web/components/documents/DocumentUploadSection.tsx`:
  - Upload actions flex container: `flex items-center gap-2 pt-1 w-full`.
  - Upload button: `flex-1 min-w-0 h-9 text-xs font-semibold` with strictly `"Upload"` label.
  - Cancel button: `h-9 px-4 text-xs shrink-0`.
  - Removed file size and preview subtitle text during upload.
  - Sized `DocumentFormatIcon` to match action buttons.
  - Desktop 1-row grid: `grid grid-cols-1 md:grid-cols-2 gap-4`.

### 2. Verification & Quality Gates
- `pnpm --filter @reachinternational/web typecheck`: Passed with 0 errors.
- `pnpm --filter @reachinternational/mobile typecheck`: Passed with 0 errors.
- `pnpm --filter @reachinternational/permissions test`: 3/3 passed.