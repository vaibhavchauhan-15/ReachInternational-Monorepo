-- ==============================================================================
-- Rollback Migration 209: Normalize and Deduplicate Approval Requests
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- ==============================================================================

-- Revert trg_auto_create_document_verification_approval to Migration 203 definition
CREATE OR REPLACE FUNCTION public.trg_auto_create_document_verification_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_name TEXT;
  v_type_label TEXT;
BEGIN
  IF NEW.verification_status = 'pending' THEN
    SELECT full_name INTO v_user_name FROM public.users WHERE id = NEW.user_id;
    v_type_label := upper(replace(NEW.document_type_code, '_', ' '));

    IF NOT EXISTS (
      SELECT 1 FROM public.approval_requests
      WHERE type_key = 'document_verify'
        AND subject_id = NEW.id
        AND status = 'pending'
    ) THEN
      INSERT INTO public.approval_requests (
        type_key,
        subject_type,
        subject_id,
        subject_label,
        requested_by,
        status,
        summary,
        payload
      ) VALUES (
        'document_verify',
        'document',
        NEW.id,
        format('%s - %s', v_type_label, COALESCE(v_user_name, 'User')),
        NEW.user_id,
        'pending',
        format('Initial verification for %s (%s)', NEW.document_type_code, COALESCE(v_user_name, 'User')),
        jsonb_build_object(
          'document_id', NEW.id,
          'user_id', NEW.user_id,
          'document_type_code', NEW.document_type_code,
          'storage_path', NEW.storage_path,
          'thumb_path', NEW.thumb_path,
          'file_size_bytes', NEW.file_size_bytes
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
