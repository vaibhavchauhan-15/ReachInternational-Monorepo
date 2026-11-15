-- ==============================================================================
-- Migration 197: Phase 8 — Document Verification & Replacement Approval RPCs
--
-- 1. Atomic RPCs:
--    - approve_document_change: In one atomic transaction, repoints user_documents
--      to final paths, marks verified, updates document_change_requests to 'approved',
--      and logs document.replacement_approved audit trail.
--    - reject_document_change: Updates document_change_requests to 'rejected'
--      with reason, and logs audit trail.
--    - verify_user_document_atomic: Marks user_documents as 'verified' with
--      verified_by and verified_at timestamps, logging document.verified.
--    - reject_user_document_atomic: Marks user_documents as 'rejected' with
--      rejection_reason, logging document.rejected.
--
-- Security: SECURITY DEFINER with search_path = public, pg_temp.
-- Restricted to privileged staff: super_admin, admin, hr (and service role).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: approve_document_change
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_document_change(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_final_storage_path TEXT,
  p_final_thumb_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_req RECORD;
BEGIN
  -- 1. Authorization check: must be super_admin, admin, hr, or executed by service_role
  v_caller_role := COALESCE(
    current_setting('request.jwt.claim.role', true),
    public.current_user_role()
  );

  IF v_caller_role NOT IN ('super_admin', 'admin', 'hr', 'service_role') THEN
    RAISE EXCEPTION 'Access denied. Only super_admin, admin, or hr can approve document replacements.';
  END IF;

  -- 2. Fetch and lock pending change request
  SELECT id, user_id, document_type_code, staging_path, staging_thumb_path, status
  INTO v_req
  FROM public.document_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document change request not found with ID %', p_request_id;
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Document change request % is not in pending status (currently %)', p_request_id, v_req.status;
  END IF;

  -- 3. Atomically update document_change_requests
  UPDATE public.document_change_requests
  SET
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now()
  WHERE id = p_request_id;

  -- 4. Atomically repoint user_documents pointer and set status to verified
  INSERT INTO public.user_documents (
    user_id,
    document_type_code,
    storage_path,
    thumb_path,
    mime_type,
    file_size_bytes,
    verification_status,
    verified_by,
    verified_at,
    rejection_reason,
    updated_at
  ) VALUES (
    v_req.user_id,
    v_req.document_type_code,
    p_final_storage_path,
    p_final_thumb_path,
    'image/jpeg',
    0,
    'verified',
    p_reviewer_id,
    now(),
    NULL,
    now()
  )
  ON CONFLICT (user_id, document_type_code) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    thumb_path = EXCLUDED.thumb_path,
    verification_status = 'verified',
    verified_by = EXCLUDED.verified_by,
    verified_at = EXCLUDED.verified_at,
    rejection_reason = NULL,
    updated_at = now();

  -- 5. Record tamper-proof audit trail
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    target_user_id,
    metadata
  ) VALUES (
    p_reviewer_id,
    'document.replacement_approved',
    'document_change_requests',
    p_request_id::text,
    v_req.user_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'document_type_code', v_req.document_type_code,
      'final_storage_path', p_final_storage_path,
      'final_thumb_path', p_final_thumb_path
    )
  );

  RETURN true;
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. RPC: reject_document_change
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_document_change(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_rejection_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_req RECORD;
BEGIN
  -- 1. Authorization check
  v_caller_role := COALESCE(
    current_setting('request.jwt.claim.role', true),
    public.current_user_role()
  );

  IF v_caller_role NOT IN ('super_admin', 'admin', 'hr', 'service_role') THEN
    RAISE EXCEPTION 'Access denied. Only super_admin, admin, or hr can reject document replacements.';
  END IF;

  -- 2. Fetch and lock pending request
  SELECT id, user_id, document_type_code, status
  INTO v_req
  FROM public.document_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document change request not found with ID %', p_request_id;
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Document change request % is not in pending status (currently %)', p_request_id, v_req.status;
  END IF;

  -- 3. Update status to rejected
  UPDATE public.document_change_requests
  SET
    status = 'rejected',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    rejection_reason = p_rejection_reason
  WHERE id = p_request_id;

  -- 4. Record audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    target_user_id,
    metadata
  ) VALUES (
    p_reviewer_id,
    'document.replacement_rejected',
    'document_change_requests',
    p_request_id::text,
    v_req.user_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'document_type_code', v_req.document_type_code,
      'rejection_reason', p_rejection_reason
    )
  );

  RETURN true;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. RPC: verify_user_document_atomic
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_user_document_atomic(
  p_document_id UUID,
  p_reviewer_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_doc RECORD;
BEGIN
  -- 1. Authorization check
  v_caller_role := COALESCE(
    current_setting('request.jwt.claim.role', true),
    public.current_user_role()
  );

  IF v_caller_role NOT IN ('super_admin', 'admin', 'hr', 'service_role') THEN
    RAISE EXCEPTION 'Access denied. Only super_admin, admin, or hr can verify documents.';
  END IF;

  -- 2. Fetch and lock document
  SELECT id, user_id, document_type_code
  INTO v_doc
  FROM public.user_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User document not found with ID %', p_document_id;
  END IF;

  -- 3. Update status
  UPDATE public.user_documents
  SET
    verification_status = 'verified',
    verified_by = p_reviewer_id,
    verified_at = now(),
    rejection_reason = NULL,
    updated_at = now()
  WHERE id = p_document_id;

  -- 4. Audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    target_user_id,
    metadata
  ) VALUES (
    p_reviewer_id,
    'document.verified',
    'user_documents',
    p_document_id::text,
    v_doc.user_id,
    jsonb_build_object(
      'document_id', p_document_id,
      'document_type_code', v_doc.document_type_code
    )
  );

  RETURN true;
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. RPC: reject_user_document_atomic
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_user_document_atomic(
  p_document_id UUID,
  p_reviewer_id UUID,
  p_rejection_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_doc RECORD;
BEGIN
  -- 1. Authorization check
  v_caller_role := COALESCE(
    current_setting('request.jwt.claim.role', true),
    public.current_user_role()
  );

  IF v_caller_role NOT IN ('super_admin', 'admin', 'hr', 'service_role') THEN
    RAISE EXCEPTION 'Access denied. Only super_admin, admin, or hr can reject documents.';
  END IF;

  -- 2. Fetch and lock document
  SELECT id, user_id, document_type_code
  INTO v_doc
  FROM public.user_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User document not found with ID %', p_document_id;
  END IF;

  -- 3. Update status
  UPDATE public.user_documents
  SET
    verification_status = 'rejected',
    verified_by = p_reviewer_id,
    verified_at = now(),
    rejection_reason = p_rejection_reason,
    updated_at = now()
  WHERE id = p_document_id;

  -- 4. Audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    target_user_id,
    metadata
  ) VALUES (
    p_reviewer_id,
    'document.rejected',
    'user_documents',
    p_document_id::text,
    v_doc.user_id,
    jsonb_build_object(
      'document_id', p_document_id,
      'document_type_code', v_doc.document_type_code,
      'rejection_reason', p_rejection_reason
    )
  );

  RETURN true;
END;
$$;

-- Grant execution to authenticated users (role check inside function body guards access)
GRANT EXECUTE ON FUNCTION public.approve_document_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_document_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_document_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user_document_atomic TO authenticated;
