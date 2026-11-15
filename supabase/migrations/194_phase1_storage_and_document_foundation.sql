-- ==============================================================================
-- Migration 194: Phase 1 — Database and Storage Foundation
--
-- 1. Storage Buckets:
--    - Creates 'doc_staging': private, 1MB limit, allowed_mime_types: ['image/jpeg']
--    - Updates storage policies on 'user_files': authenticated users can only READ
--      their own files at documents/<userId>/...; no INSERT/UPDATE/DELETE for authenticated
--      (only service role can mutate user_files).
--
-- 2. Tables & Schema Extensions:
--    - Extends public.user_documents with thumb_path, verification_status, verified_by,
--      verified_at, rejection_reason.
--    - Extends public.user_document_types with requires_approval (default true).
--    - Creates public.document_change_requests with unique index for pending status.
--    - Extends public.audit_logs with target_user_id and composite index.
--
-- 3. Uniqueness as Source of Truth:
--    - Adds phone_normalized column with trigger + unique partial index.
--    - Cleanses legacy dummy identity placeholders (Migration 113) & resolves duplicates.
--    - Adds unique partial indexes on phone_normalized, aadhaar_number, and upper(license_number).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STORAGE BUCKET: doc_staging
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'doc_staging',
  'doc_staging',
  false,
  1048576, -- 1MB limit
  ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/jpeg'];

-- No RLS policies on doc_staging for authenticated users.
-- Only the service role and signed upload tokens can read/write to doc_staging.


-- ------------------------------------------------------------------------------
-- 2. STORAGE POLICIES: user_files (Read-only for authenticated users)
-- ------------------------------------------------------------------------------

-- Drop existing broad management policies
DROP POLICY IF EXISTS "Users manage own files in user_files" ON storage.objects;
DROP POLICY IF EXISTS "users read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and HR can read user_files" ON storage.objects;

-- Users can read only their own documents
CREATE POLICY "users read own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user_files'
    AND (storage.foldername(name))[1] = 'documents'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  );

-- Privileged staff (super_admin, admin, manager, hr) can read all files in user_files
CREATE POLICY "Admins and HR can read user_files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user_files'
    AND (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
  );

-- NOTE: No INSERT, UPDATE, or DELETE policy is created for authenticated users on user_files.
-- Mutations to user_files are strictly executed by server code via the Supabase Service Role.


-- ------------------------------------------------------------------------------
-- 3. EXTEND user_documents & user_document_types
-- ------------------------------------------------------------------------------

ALTER TABLE public.user_documents
  ADD COLUMN IF NOT EXISTS thumb_path TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Enforce verification_status constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_documents_verification_status'
  ) THEN
    ALTER TABLE public.user_documents
      ADD CONSTRAINT chk_user_documents_verification_status
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

-- Initialize verification_status for existing rows
UPDATE public.user_documents
SET verification_status = 'verified'
WHERE status = 'verified' AND verification_status = 'pending';

-- Extend user_document_types
ALTER TABLE public.user_document_types
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true;


-- ------------------------------------------------------------------------------
-- 4. TABLE: document_change_requests
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type_code TEXT NOT NULL REFERENCES public.user_document_types(code),
  staging_path TEXT NOT NULL,
  staging_thumb_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_dcr_user_doc_pending
  ON public.document_change_requests (user_id, document_type_code)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dcr_status_created_at
  ON public.document_change_requests (status, created_at);

-- RLS
ALTER TABLE public.document_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own change requests" ON public.document_change_requests;
CREATE POLICY "users read own change requests"
  ON public.document_change_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
  );

-- No INSERT, UPDATE, or DELETE policies for authenticated users.
-- Staging requests and approvals are performed via server actions using service role.


-- ------------------------------------------------------------------------------
-- 5. EXTEND audit_logs (target_user_id & Index)
-- ------------------------------------------------------------------------------

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id_created_at
  ON public.audit_logs (target_user_id, created_at DESC);


-- ------------------------------------------------------------------------------
-- 6. UNIQUENESS AS SOURCE OF TRUTH (users table)
-- ------------------------------------------------------------------------------

-- 6.1 Normalized Phone Function & Column
CREATE OR REPLACE FUNCTION public.extract_normalized_phone(p text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN p IS NOT NULL AND length(regexp_replace(p, '\D', '', 'g')) >= 10
    THEN right(regexp_replace(p, '\D', '', 'g'), 10)
    ELSE NULL
  END;
$$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

CREATE OR REPLACE FUNCTION public.sync_user_phone_normalized()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.phone_normalized := public.extract_normalized_phone(NEW.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_phone_normalized ON public.users;
CREATE TRIGGER trg_sync_user_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_phone_normalized();

-- Backfill phone_normalized
UPDATE public.users
SET phone_normalized = public.extract_normalized_phone(phone)
WHERE phone IS NOT NULL AND phone_normalized IS NULL;

-- 6.2 Pre-Index Data Hygiene & Deduplication
-- Step A: Nullify legacy dummy placeholder values seeded for non-operator staff (Migration 113)
UPDATE public.users
SET aadhaar_number = NULL
WHERE regexp_replace(COALESCE(aadhaar_number, ''), '\D', '', 'g') = '987654321098';

UPDATE public.users
SET license_number = NULL
WHERE upper(regexp_replace(trim(COALESCE(license_number, '')), '[^a-zA-Z0-9]', '', 'g')) = 'MH0120240012345';

-- Step B: Deduplicate any other existing duplicate aadhaar_number values across users
-- Preserves the most authoritative account (active > operator > oldest account), clearing duplicates.
WITH ranked_aadhaar AS (
  SELECT
    id,
    aadhaar_number,
    ROW_NUMBER() OVER (
      PARTITION BY regexp_replace(trim(aadhaar_number), '\D', '', 'g')
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        CASE WHEN role = 'operator' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.users
  WHERE aadhaar_number IS NOT NULL AND trim(aadhaar_number) <> ''
)
UPDATE public.users u
SET aadhaar_number = NULL
FROM ranked_aadhaar r
WHERE u.id = r.id AND r.rn > 1;

-- Step C: Deduplicate any other existing duplicate license_number values across users
-- Preserves the most authoritative account (active > operator > oldest account), clearing duplicates.
WITH ranked_license AS (
  SELECT
    id,
    license_number,
    ROW_NUMBER() OVER (
      PARTITION BY upper(regexp_replace(trim(license_number), '[^a-zA-Z0-9]', '', 'g'))
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        CASE WHEN role = 'operator' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.users
  WHERE license_number IS NOT NULL AND trim(license_number) <> ''
)
UPDATE public.users u
SET license_number = NULL
FROM ranked_license r
WHERE u.id = r.id AND r.rn > 1;

-- Step D: Deduplicate any duplicate phone_normalized values across users
-- Preserves the most authoritative account (active > oldest account), clearing duplicates.
WITH ranked_phone AS (
  SELECT
    id,
    phone_normalized,
    ROW_NUMBER() OVER (
      PARTITION BY phone_normalized
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.users
  WHERE phone_normalized IS NOT NULL
)
UPDATE public.users u
SET phone_normalized = NULL
FROM ranked_phone r
WHERE u.id = r.id AND r.rn > 1;

-- 6.3 Unique Partial Indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_normalized_unique_idx
  ON public.users (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_aadhaar_number_unique_idx
  ON public.users (aadhaar_number)
  WHERE (aadhaar_number IS NOT NULL AND trim(aadhaar_number) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS users_license_number_unique_idx
  ON public.users (upper(trim(license_number)))
  WHERE (license_number IS NOT NULL AND trim(license_number) <> '');
