-- ==============================================================================
-- Migration 174: Fix User Documents RLS Policies, Storage Permissions & Self-Service
--
-- Root Cause Resolution:
-- 1. Migration 166 accidentally restricted INSERT, UPDATE, and DELETE on public.user_documents
--    to 'super_admin', 'admin', 'manager' with:
--      WITH CHECK (user_id = auth.uid() AND current_user_role() IN ('super_admin', 'admin', 'manager'))
--    This completely blocked Operators, Supervisors, and newly registering users from:
--      - Uploading their own KYC/identity/banking documents (DB upsert error 42501).
--      - Updating/replacing their own documents.
--      - Deleting their own documents from Supabase.
--
-- 2. Storage policies on storage.objects for 'user_files' only checked auth.uid()
--    and did not grant management capabilities to super_admin, admin, or manager.
--
-- 3. Provide atomic SECURITY DEFINER RPC functions:
--      - public.upsert_user_document
--      - public.delete_user_document
--    for bulletproof cross-platform execution with server-side validation.
--
-- 4. Self-heal any mismatched file records in public.user_documents against storage.objects.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RLS POLICIES: public.user_documents
-- ------------------------------------------------------------------------------

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- 1.1 SELECT: Owners can read their own documents; super_admin, admin, manager, hr can read all
DROP POLICY IF EXISTS "Users can read own documents" ON public.user_documents;
DROP POLICY IF EXISTS "Admins and HR can read all documents" ON public.user_documents;

CREATE POLICY "Users can read own documents"
  ON public.user_documents
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
  );

-- 1.2 INSERT: Any authenticated user can insert their OWN documents; super_admin, admin, manager can insert for any user
DROP POLICY IF EXISTS "Users can insert own documents" ON public.user_documents;

CREATE POLICY "Users can insert own documents"
  ON public.user_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
  );

-- 1.3 UPDATE: Any authenticated user can update/replace their OWN documents; super_admin, admin, manager can update for any user
DROP POLICY IF EXISTS "Users can update own documents" ON public.user_documents;

CREATE POLICY "Users can update own documents"
  ON public.user_documents
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
  )
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
  );

-- 1.4 DELETE: Any authenticated user can delete their OWN documents; super_admin, admin, manager can delete for any user
DROP POLICY IF EXISTS "Users can delete own documents" ON public.user_documents;

CREATE POLICY "Users can delete own documents"
  ON public.user_documents
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
  );


-- ------------------------------------------------------------------------------
-- 2. STORAGE POLICIES: storage.objects ('user_files' bucket)
-- ------------------------------------------------------------------------------

-- Update storage.objects management policy for user_files
DROP POLICY IF EXISTS "Users manage own files in user_files" ON storage.objects;

CREATE POLICY "Users manage own files in user_files"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'user_files' AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text OR
      (storage.foldername(name))[2] = (SELECT auth.uid())::text OR
      (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    bucket_id = 'user_files' AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text OR
      (storage.foldername(name))[2] = (SELECT auth.uid())::text OR
      (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and HR can read user_files" ON storage.objects;

CREATE POLICY "Admins and HR can read user_files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user_files' AND
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
  );


-- ------------------------------------------------------------------------------
-- 3. SECURITY DEFINER RPCs: Atomic Document Upsert & Delete
-- ------------------------------------------------------------------------------

-- 3.1 public.upsert_user_document
CREATE OR REPLACE FUNCTION public.upsert_user_document(
  p_user_id UUID,
  p_document_type_code TEXT,
  p_storage_path TEXT,
  p_mime_type TEXT,
  p_file_size_bytes BIGINT,
  p_file_name TEXT DEFAULT NULL
)
RETURNS public.user_documents AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_result public.user_documents;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to manage documents.';
  END IF;

  v_caller_role := public.current_user_role();

  -- Authorization check: Caller must be owner or manager/admin
  IF v_caller_id != p_user_id AND (v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager')) THEN
    RAISE EXCEPTION 'FORBIDDEN: You do not have permission to upload documents for this user.';
  END IF;

  -- Validate document type exists
  IF NOT EXISTS (SELECT 1 FROM public.user_document_types WHERE code = p_document_type_code) THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE: Document type code % is not registered.', p_document_type_code;
  END IF;

  -- Upsert document record
  INSERT INTO public.user_documents (
    user_id,
    document_type_code,
    storage_path,
    mime_type,
    file_size_bytes,
    file_name,
    status,
    uploaded_by,
    updated_at
  ) VALUES (
    p_user_id,
    p_document_type_code,
    p_storage_path,
    p_mime_type,
    p_file_size_bytes,
    COALESCE(p_file_name, split_part(p_storage_path, '/', 3)),
    'verified',
    v_caller_id,
    now()
  )
  ON CONFLICT (user_id, document_type_code) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    mime_type = EXCLUDED.mime_type,
    file_size_bytes = EXCLUDED.file_size_bytes,
    file_name = EXCLUDED.file_name,
    uploaded_by = EXCLUDED.uploaded_by,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.upsert_user_document IS
  'Securely upsert a user document record with caller validation and auto-populated audit fields.';

GRANT EXECUTE ON FUNCTION public.upsert_user_document TO authenticated;


-- 3.2 public.delete_user_document
CREATE OR REPLACE FUNCTION public.delete_user_document(
  p_user_id UUID,
  p_document_type_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to delete documents.';
  END IF;

  v_caller_role := public.current_user_role();

  -- Authorization check: Caller must be owner or manager/admin
  IF v_caller_id != p_user_id AND (v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager')) THEN
    RAISE EXCEPTION 'FORBIDDEN: You do not have permission to delete documents for this user.';
  END IF;

  DELETE FROM public.user_documents
  WHERE user_id = p_user_id AND document_type_code = p_document_type_code;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.delete_user_document IS
  'Securely delete a user document record from user_documents table with caller authorization check.';

GRANT EXECUTE ON FUNCTION public.delete_user_document TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. DATA RECONCILIATION: Synchronize Existing Mismatched Records
-- ------------------------------------------------------------------------------

-- Update user_documents storage_path to match actual existing storage.objects
-- when users uploaded .png files but the database upsert was blocked by previous RLS
UPDATE public.user_documents ud
SET 
  storage_path = 'documents/' || ud.user_id || '/bank_document.png',
  mime_type = 'image/png',
  file_name = 'bank_document.png',
  updated_at = now()
WHERE ud.document_type_code = 'bank_document'
  AND ud.storage_path LIKE '%.pdf'
  AND EXISTS (
    SELECT 1 FROM storage.objects so
    WHERE so.bucket_id = 'user_files'
      AND so.name = 'documents/' || ud.user_id || '/bank_document.png'
  );

UPDATE public.user_documents ud
SET 
  storage_path = 'documents/' || ud.user_id || '/aadhaar.png',
  mime_type = 'image/png',
  file_name = 'aadhaar.png',
  updated_at = now()
WHERE ud.document_type_code = 'aadhaar'
  AND ud.storage_path LIKE '%.pdf'
  AND EXISTS (
    SELECT 1 FROM storage.objects so
    WHERE so.bucket_id = 'user_files'
      AND so.name = 'documents/' || ud.user_id || '/aadhaar.png'
  );

-- Remove dangling dummy records where the file does not exist anywhere in storage
DELETE FROM public.user_documents ud
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects so
  WHERE so.bucket_id = 'user_files' AND so.name = ud.storage_path
) AND NOT EXISTS (
  SELECT 1 FROM storage.objects so
  WHERE so.bucket_id = 'user_files'
    AND so.name LIKE 'documents/' || ud.user_id || '/' || ud.document_type_code || '.%'
);
