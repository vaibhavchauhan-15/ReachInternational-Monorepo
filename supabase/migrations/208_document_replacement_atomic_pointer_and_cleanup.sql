-- ==============================================================================
-- Migration 208: Document Replacement Atomic Pointer & Storage Cleanup Guarantee
-- ==============================================================================
-- 1. Creates public.apply_document_replacement_pointer:
--    Atomically upserts user_documents with non-null mime_type and file_size_bytes,
--    marks document_change_requests as approved, and logs to audit_logs.
-- 2. Updates public.approval_apply_document_replace:
--    Ensures payload contains decided_by and metadata.
-- 3. Grants execute permissions to authenticated, service_role, and postgres.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.apply_document_replacement_pointer(
  p_user_id UUID,
  p_doc_type TEXT,
  p_final_storage_path TEXT,
  p_final_thumb_path TEXT DEFAULT NULL,
  p_decided_by UUID DEFAULT NULL,
  p_mime_type TEXT DEFAULT 'image/jpeg',
  p_file_size_bytes BIGINT DEFAULT 0,
  p_file_name TEXT DEFAULT NULL,
  p_change_request_id UUID DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Atomically upsert user_documents
  INSERT INTO public.user_documents (
    user_id,
    document_type_code,
    storage_path,
    thumb_path,
    mime_type,
    file_size_bytes,
    file_name,
    verification_status,
    status,
    verified_by,
    verified_at,
    rejection_reason,
    updated_at
  ) VALUES (
    p_user_id,
    p_doc_type,
    p_final_storage_path,
    p_final_thumb_path,
    COALESCE(p_mime_type, 'image/jpeg'),
    COALESCE(p_file_size_bytes, 0),
    COALESCE(p_file_name, p_doc_type || '.jpg'),
    'verified',
    'verified',
    p_decided_by,
    now(),
    NULL,
    now()
  )
  ON CONFLICT (user_id, document_type_code) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    thumb_path = EXCLUDED.thumb_path,
    mime_type = COALESCE(EXCLUDED.mime_type, user_documents.mime_type, 'image/jpeg'),
    file_size_bytes = COALESCE(EXCLUDED.file_size_bytes, user_documents.file_size_bytes, 0),
    file_name = COALESCE(EXCLUDED.file_name, user_documents.file_name, p_doc_type || '.jpg'),
    verification_status = 'verified',
    status = 'verified',
    verified_by = EXCLUDED.verified_by,
    verified_at = EXCLUDED.verified_at,
    rejection_reason = NULL,
    updated_at = now();

  -- 2. Mark document_change_requests as approved
  IF p_change_request_id IS NOT NULL THEN
    UPDATE public.document_change_requests
    SET
      status = 'approved',
      reviewed_by = p_decided_by,
      reviewed_at = now()
    WHERE id = p_change_request_id;
  END IF;

  UPDATE public.document_change_requests
  SET
    status = 'approved',
    reviewed_by = p_decided_by,
    reviewed_at = now()
  WHERE user_id = p_user_id
    AND document_type_code = p_doc_type
    AND status = 'pending';

  -- 3. Record audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    target_user_id,
    metadata
  ) VALUES (
    COALESCE(p_decided_by, p_user_id),
    'document.replacement_applied',
    'user_documents',
    p_user_id::text,
    p_user_id,
    jsonb_build_object(
      'document_type_code', p_doc_type,
      'storage_path', p_final_storage_path,
      'thumb_path', p_final_thumb_path,
      'change_request_id', p_change_request_id
    )
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_document_replacement_pointer TO authenticated, service_role, postgres;

-- Update public.approval_apply_document_replace to ensure payload contains all metadata
CREATE OR REPLACE FUNCTION public.approval_apply_document_replace(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_change_req_id UUID;
  v_user_id UUID;
  v_doc_type TEXT;
BEGIN
  SELECT id, payload, decided_by, subject_id INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RETURN;
  END IF;

  v_change_req_id := COALESCE(
    (v_req.payload->>'request_id')::UUID,
    v_req.subject_id
  );
  v_user_id := (v_req.payload->>'user_id')::UUID;
  v_doc_type := v_req.payload->>'document_type_code';

  -- Mark corresponding document_change_requests as approved
  IF v_change_req_id IS NOT NULL THEN
    UPDATE public.document_change_requests
    SET
      status = 'approved',
      reviewed_by = v_req.decided_by,
      reviewed_at = now()
    WHERE id = v_change_req_id;
  END IF;

  IF v_user_id IS NOT NULL AND v_doc_type IS NOT NULL THEN
    UPDATE public.document_change_requests
    SET
      status = 'approved',
      reviewed_by = v_req.decided_by,
      reviewed_at = now()
    WHERE user_id = v_user_id
      AND document_type_code = v_doc_type
      AND status = 'pending';
  END IF;

  -- Enqueue file transfer from staging to canonical storage with decided_by
  INSERT INTO public.approval_outbox (topic, request_id, payload)
  VALUES (
    'file.transfer_staged_document',
    p_request_id,
    v_req.payload || jsonb_build_object('decided_by', v_req.decided_by)
  );
END;
$$;
