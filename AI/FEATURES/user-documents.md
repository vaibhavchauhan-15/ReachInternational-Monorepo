# Feature: User Document Uploads

## Overview
Scalable, config-driven user file upload system supporting identity documents (Aadhaar, Driving Licence photos/PDFs), extensible to any future document type via a single `INSERT` — no migration or code change required.

## Architecture

```text
user_document_types (config — add a row, not a migration)
        │
        ▼
user_documents (one row per user × type, FK to the type)
        │
        ▼
Storage — user_files bucket (private, signed URL):
  documents/{user_id}/{type_code}.{ext}
```

## Database Tables

### `user_document_types` (Config/Reference)
| Column | Type | Description |
|--------|------|-------------|
| `code` | text PK | e.g. `'aadhaar'`, `'driving_license'` |
| `label` | text | Human-readable display name |
| `visibility` | text | `'private'` or `'public'` |
| `allowed_mime_types` | text[] | Per-type accepted MIME types |
| `max_size_bytes` | bigint | Per-type file size limit |
| `created_at` | timestamptz | Row creation timestamp |

**RLS**: SELECT for `authenticated`; no write policies (service_role only).

**Seed data**:
- `aadhaar`: Aadhaar Card (private, jpeg/png/pdf, 2MB)
- `driving_license`: Driving Licence (private, jpeg/png/pdf, 2MB)

### `user_documents` (Upload Records)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Auto-generated |
| `user_id` | uuid FK → users(id) | ON DELETE CASCADE |
| `document_type_code` | text FK → user_document_types(code) | Document type reference |
| `storage_path` | text | Path within bucket, e.g. `documents/{user_id}/aadhaar.pdf` |
| `mime_type` | text | Actual uploaded file MIME type |
| `file_size_bytes` | bigint | Actual uploaded file size |
| `uploaded_by` | uuid FK → users(id) | ON DELETE SET NULL — Account that uploaded file |
| `created_at` | timestamptz | Row creation timestamp |
| `updated_at` | timestamptz | Auto-updated via trigger |

**Constraints**: UNIQUE(user_id, document_type_code) — one file per user per type.
**Indexes**: `idx_user_documents_user_id`, `idx_user_documents_type_code`, `idx_user_documents_uploaded_by`.
**RLS**: Users read/write own; super_admin/admin/hr can read all.

## Storage Bucket

| Bucket | Public | Purpose | Access Pattern |
|--------|--------|---------|----------------|
| `user_files` | false | KYC & Identity documents (Aadhaar, Driving Licence) | `createSignedUrl(path, ttl=120)` on-demand |

**Path pattern**: `documents/{user_id}/{type_code}.{ext}` (inside folder `documents`).

## RLS Policies

### `user_documents` table
- Users read/insert/update/delete own documents (`user_id = (select auth.uid())`)
- Admins and HR can read all documents (`current_user_role() IN ('super_admin', 'admin', 'hr')`)

### `storage.objects` (`user_files` bucket)
- **Users manage own files**: Owner CRUD matching either `(storage.foldername(name))[1] = auth.uid()::text` or `(storage.foldername(name))[2] = auth.uid()::text` (supports `documents/{user_id}/*` and `{user_id}/documents/*`)
- **Admins and HR read**: Privileged roles can read documents for KYC verification

## Security & Short-Lived Access Pattern

```typescript
// All document views strictly require on-demand short-lived signed URLs (120s TTL)
// gated by server authorization and audited in public.audit_logs
const { signedUrl } = await getDocumentViewUrlAction({ documentId });
```

## Adding a New Document Type

One SQL `INSERT` — no migration, no code change, no redeploy:

```sql
INSERT INTO public.user_document_types (code, label, visibility, allowed_mime_types, max_size_bytes)
VALUES ('passport', 'Passport', 'private', ARRAY['image/jpeg','image/png','application/pdf'], 2097152);
```

## Migrations
- `099_user_document_upload_system.sql` (2026-09-22)
- `101_expand_user_document_mime_types.sql` (2026-09-23)
- `102_add_uploaded_by_to_user_documents.sql` (2026-09-23)

## Related Files
- Migrations: `supabase/migrations/099_user_document_upload_system.sql`, `101_expand_user_document_mime_types.sql`, `102_add_uploaded_by_to_user_documents.sql`
- Existing identity text fields: `users.aadhaar_number`, `users.license_number` (migration 025)
- Shared types: `packages/types/src/database.ts`
- Mobile storage helpers: `apps/mobile/lib/documents.ts`
- Web document viewer: `apps/web/components/documents/DocumentViewerModal.tsx`
- Mobile document viewer: `apps/mobile/components/documents/MobileDocumentViewerModal.tsx`
- Server Actions & REST API: `apps/web/app/actions/documents.ts`, `apps/web/app/api/documents/[id]/view/route.ts`

## Implementation Status: Completed (Phases 1–6)

### Implemented Files
- **Upload Utility (`apps/web/lib/upload.ts`)**: XHR upload using `createSignedUploadUrl` with real byte-level progress (`xhr.upload.onprogress`) and pre-flight validation.
- **Server Actions & API (`apps/web/app/actions/documents.ts`, `apps/web/app/api/documents/[id]/view/route.ts`)**: `getDocumentTypesAction`, `getUserDocumentsAction`, `confirmDocumentUploadAction` (upsert + audit + `uploaded_by`), `deleteDocumentAction`, and `getDocumentViewUrlAction` (120s TTL signed URL with authorization guard and audit logging).
- **Hybrid In-App Document Viewer (`apps/web/components/documents/DocumentViewerModal.tsx`)**: Zero-dependency viewer with Image zoom (50%-300%), pan, 90° rotation, fullscreen; native browser `<iframe>` PDF viewer; Office document fallback card.
- **Upload & Viewing Components (`apps/web/components/documents/DocumentUploadSection.tsx`, `ProfileDocumentsSection.tsx`)**: Format badges (`PDF`, `PNG`, `JPG`, `WEBP`, `DOC`), direct tap-to-view, single slot enforcement.
- **Profile Page Integration (`apps/web/app/(app)/profile/page.tsx`)**: User identity documents upload/view section.
- **Staff User Inspection (`apps/web/app/(app)/users/UserDetailSheet.tsx`)**: Staff document viewing with signed URLs and in-app `DocumentViewerModal`.
- **Mobile Cross-Platform Parity (`apps/mobile`)**:
  - `apps/mobile/lib/documents.ts`: Multi-format picker with 2MB cap.
  - `apps/mobile/components/documents/MobileDocumentViewerModal.tsx`: In-app React Native viewer with Image pinch-to-zoom (4x), pan, 90° rotation, `react-native-webview` PDF inline rendering, native share (`expo-sharing`), download (`expo-file-system`), and external launch (`expo-linking`).
  - `apps/mobile/components/documents/MobileDocumentUploadCard.tsx`: Touch card tap-to-view and format badges.
  - `apps/mobile/components/users/UserDetailModal.tsx`: Staff document viewing wired to `MobileDocumentViewerModal`.

## What's NOT Built (Ponytail & Security Principles)
- ❌ No public storage bucket exposure (all identity files are private)
- ❌ No permanent public or signed URLs (120-second short TTL strictly enforced)
- ❌ No heavy client-side JS PDF rendering libraries (mature native browser/OS engines only)
- ❌ No unauthenticated access (server authorization check on every view request)
