-- ==============================================================================
-- Migration 207 Rollback: Document Replacement Approval Lifecycle & Storage Cleanup
-- ==============================================================================

-- Restore Migration 201 implementation of approval_apply_document_replace
CREATE OR REPLACE FUNCTION public.approval_apply_document_replace(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  INSERT INTO public.approval_outbox (topic, request_id, payload)
  VALUES (
    'file.transfer_staged_document',
    p_request_id,
    v_req.payload
  );
END;
$$;
