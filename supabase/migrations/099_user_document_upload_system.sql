-- ==============================================================================
-- Migration 099: User Document Upload System
--
-- Scalable, config-driven user file upload infrastructure:
-- 1. user_document_types — reference/config table (add a type = INSERT, not a migration)
-- 2. user_documents — one row per user × type, FK to type, RLS-protected
-- 3. Storage bucket: user_files (private, KYC & identity documents)
--    Path convention: documents/{user_id}/{type_code}.{ext}
-- 4. Storage RLS policies: owner-write/read + admin/HR read
--
-- Supported document types:
-- - 'aadhaar': Aadhaar Card (JPEG, PNG, PDF up to 2MB)
-- - 'driving_license': Driving Licence (JPEG, PNG, PDF up to 2MB)
--
-- Adding a new document type (e.g. "passport", "pan_card") requires only:
--   INSERT INTO public.user_document_types (...) VALUES (...);
-- No schema migration, no app code change, no redeploy.
-- ==============================================================================


-- ============================================================
-- 1. REFERENCE TABLE: user_document_types (config-driven scalability)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_document_types (
  code               TEXT PRIMARY KEY,
  label              TEXT NOT NULL,
  visibility         TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  allowed_mime_types  TEXT[] NOT NULL,
  max_size_bytes      BIGINT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_document_types IS
  'Config table: defines allowed document types, accepted MIME types, and size limits. Add a row to support a new type — no migration needed.';

-- RLS: readable by authenticated (needed for client-side validation), writable only by service_role
ALTER TABLE public.user_document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read document type config" ON public.user_document_types;
CREATE POLICY "Authenticated users can read document type config"
  ON public.user_document_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Clean up legacy profile_photo type if present
DELETE FROM public.user_document_types WHERE code = 'profile_photo';

-- Seed initial document types (Aadhaar & Driving Licence)
INSERT INTO public.user_document_types (code, label, visibility, allowed_mime_types, max_size_bytes) VALUES
  ('aadhaar',         'Aadhaar Card',     'private', ARRAY['image/jpeg','image/png','application/pdf'], 2097152),
  ('driving_license', 'Driving Licence',  'private', ARRAY['image/jpeg','image/png','application/pdf'], 2097152)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  visibility = EXCLUDED.visibility,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  max_size_bytes = EXCLUDED.max_size_bytes;


-- ============================================================
-- 2. DOCUMENTS TABLE: user_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type_code  TEXT NOT NULL REFERENCES public.user_document_types(code),
  storage_path        TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  file_size_bytes     BIGINT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, document_type_code)
);

COMMENT ON TABLE public.user_documents IS
  'Stores one uploaded file per user per document type. Replace-on-reupload semantics via UNIQUE(user_id, document_type_code).';

-- FK indexes: 10-100x faster JOINs and CASCADE operations (Supabase best practice)
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_type_code ON public.user_documents(document_type_code);

-- Auto-update updated_at trigger (reuses existing function from migration 001)
DROP TRIGGER IF EXISTS trigger_user_documents_updated_at ON public.user_documents;
CREATE TRIGGER trigger_user_documents_updated_at
  BEFORE UPDATE ON public.user_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 3. RLS POLICIES: user_documents
-- ============================================================

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- Users can read their own documents
DROP POLICY IF EXISTS "Users can read own documents" ON public.user_documents;
CREATE POLICY "Users can read own documents"
  ON public.user_documents
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users can insert their own documents
DROP POLICY IF EXISTS "Users can insert own documents" ON public.user_documents;
CREATE POLICY "Users can insert own documents"
  ON public.user_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can update their own documents (replace-on-reupload)
DROP POLICY IF EXISTS "Users can update own documents" ON public.user_documents;
CREATE POLICY "Users can update own documents"
  ON public.user_documents
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete their own documents
DROP POLICY IF EXISTS "Users can delete own documents" ON public.user_documents;
CREATE POLICY "Users can delete own documents"
  ON public.user_documents
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins and HR can read all user documents (identity verification workflows)
-- Uses existing STABLE SECURITY DEFINER function public.current_user_role() from migration 021
DROP POLICY IF EXISTS "Admins and HR can read all documents" ON public.user_documents;
CREATE POLICY "Admins and HR can read all documents"
  ON public.user_documents
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'hr')
  );


-- ============================================================
-- 4. STORAGE BUCKET: user_files
-- ============================================================

-- Private bucket for user documents (Aadhaar, Driving Licence, etc.)
-- Accessed via signed URLs only — never public
-- Canonical path inside bucket: documents/{user_id}/{type_code}.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user_files',
  'user_files',
  false,
  2097152,  -- 2MB limit per file
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];


-- ============================================================
-- 5. STORAGE RLS POLICIES: user_files
-- ============================================================

-- Users can manage (CRUD) their own files in user_files
-- Supports both folder conventions:
--   1. documents/{user_id}/{type_code}.{ext}  -> (storage.foldername(name))[2] = (SELECT auth.uid())::text
--   2. {user_id}/documents/{type_code}.{ext}  -> (storage.foldername(name))[1] = (SELECT auth.uid())::text
DROP POLICY IF EXISTS "Users manage own files in user_files" ON storage.objects;
CREATE POLICY "Users manage own files in user_files"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'user_files'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (storage.foldername(name))[2] = (SELECT auth.uid())::text
    )
  )
  WITH CHECK (
    bucket_id = 'user_files'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (storage.foldername(name))[2] = (SELECT auth.uid())::text
    )
  );

-- Admins and HR can read all files in user_files (identity verification)
DROP POLICY IF EXISTS "Admins and HR can read user_files" ON storage.objects;
CREATE POLICY "Admins and HR can read user_files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user_files'
    AND (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'hr')
  );
