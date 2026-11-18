-- ==============================================================================
-- Migration 206 Rollback: Fix approval_decide Schema Mismatch & Optimize Approval Engine
-- ==============================================================================

DROP FUNCTION IF EXISTS public.approval_decide(UUID, TEXT, TEXT, INT, UUID);

-- Restore prior 4-parameter signature from migration 204
CREATE OR REPLACE FUNCTION public.approval_decide(
  p_request_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT NULL,
  p_expected_version INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_type RECORD;
  v_caller_id UUID;
  v_caller_role TEXT;
  v_new_status public.approval_status;
  v_new_version INT;
  v_votes_approved INT;
  v_votes_rejected INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    SELECT id INTO v_caller_id FROM public.users WHERE role IN ('super_admin', 'admin') LIMIT 1;
    v_caller_role := 'super_admin';
  ELSE
    v_caller_role := public.current_user_role();
  END IF;

  SELECT * INTO v_req FROM public.approval_requests WHERE id = p_request_id FOR UPDATE;
  SELECT * INTO v_type FROM public.approval_types WHERE key = v_req.type_key;

  INSERT INTO public.approval_decisions (
    request_id, approver_id, approver_role, decision, note, created_at
  ) VALUES (
    p_request_id, v_caller_id, v_caller_role, p_decision, p_note, now()
  )
  ON CONFLICT (request_id, approver_id) DO UPDATE SET
    approver_role = EXCLUDED.approver_role, decision = EXCLUDED.decision, note = EXCLUDED.note, created_at = now();

  SELECT
    count(*) FILTER (WHERE decision = 'approve'),
    count(*) FILTER (WHERE decision = 'reject')
  INTO v_votes_approved, v_votes_rejected
  FROM public.approval_decisions WHERE request_id = p_request_id;

  v_new_version := v_req.version + 1;
  v_new_status := CASE
    WHEN v_votes_approved >= v_type.required_approvals THEN 'approved'::public.approval_status
    WHEN v_votes_rejected > 0 THEN 'rejected'::public.approval_status
    ELSE NULL
  END;

  IF v_new_status IS NOT NULL THEN
    UPDATE public.approval_requests
    SET status = v_new_status, decided_by = v_caller_id, decided_at = now(), decision_note = p_note, version = v_new_version, updated_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.approval_requests SET version = v_new_version, updated_at = now() WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', COALESCE(v_new_status, v_req.status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.approval_decide(UUID, TEXT, TEXT, INT) TO authenticated, service_role;
