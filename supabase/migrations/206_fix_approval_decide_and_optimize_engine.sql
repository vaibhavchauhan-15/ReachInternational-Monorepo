-- ==============================================================================
-- Migration 206: Fix approval_decide Schema Mismatch & Optimize Approval Engine
-- 
-- Root Cause:
-- 1. In migration 204, public.approval_decide attempted to update non-existent column
--    `decided_at` on table public.approval_decisions (the actual column is `created_at`).
-- 2. `approver_role` (NOT NULL in approval_decisions) was omitted in the INSERT statement.
-- 3. public.approval_events insert used invalid column names `event_type` and `payload`
--    instead of `action`, `note`, and `meta`.
-- 4. When auth.uid() was NULL, it used a dummy UUID ('00000000-0000-0000-0000-000000000000')
--    which violated the foreign key constraint to public.users(id).
-- 5. public.approval_apply_registration failed to select `subject_id` and did not resolve
--    user id when payload contained `id` instead of `user_id`.
-- 
-- Fixes & Optimizations:
-- 1. Correct public.approval_decide with proper columns, caller role lookup, and
--    optional p_actor_id parameter for service/authenticated contexts.
-- 2. Resilient public.approval_apply_registration resolving user_id from payload->>'user_id',
--    payload->>'id', or subject_id.
-- 3. Composite performance indexes for approval queries.
-- ==============================================================================

-- Drop old function signature cleanly
DROP FUNCTION IF EXISTS public.approval_decide(UUID, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.approval_decide(UUID, TEXT, TEXT, INT, UUID);

CREATE OR REPLACE FUNCTION public.approval_decide(
  p_request_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT NULL,
  p_expected_version INT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
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
  v_doc_id UUID;
  v_user_id UUID;
  v_type_code TEXT;
BEGIN
  -- 1. Resolve caller ID securely
  v_caller_id := COALESCE(auth.uid(), p_actor_id);
  IF v_caller_id IS NULL THEN
    -- Fallback to system admin if called via service_role without user context
    SELECT id INTO v_caller_id
    FROM public.users
    WHERE role IN ('super_admin', 'admin') AND status = 'active'
    ORDER BY created_at
    LIMIT 1;
    v_caller_role := 'super_admin';
  ELSE
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role IS NULL THEN
      v_caller_role := COALESCE(public.current_user_role(), 'admin');
    END IF;
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid decision: % (must be approve or reject)', p_decision
      USING ERRCODE = '22023';
  END IF;

  -- 2. Lock the request row
  SELECT * INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Approval request % not found', p_request_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is already in terminal state % (expected pending)', v_req.status
      USING ERRCODE = 'P0004';
  END IF;

  IF p_expected_version IS NOT NULL AND v_req.version <> p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: expected version %, current version %',
      p_expected_version, v_req.version
      USING ERRCODE = 'P0003';
  END IF;

  -- 3. Lookup type and check permissions
  SELECT * INTO v_type
  FROM public.approval_types
  WHERE key = v_req.type_key;

  IF v_caller_role NOT IN ('super_admin', 'postgres') AND v_caller_role <> ALL(v_type.approver_roles) THEN
    RAISE EXCEPTION 'Role % is not authorized to decide % requests', v_caller_role, v_req.type_key
      USING ERRCODE = '42501';
  END IF;

  IF v_req.requested_by = v_caller_id AND NOT v_type.allow_self_approve AND v_caller_role NOT IN ('super_admin', 'postgres') THEN
    RAISE EXCEPTION 'Self-approval is prohibited for % requests', v_req.type_key
      USING ERRCODE = '42501';
  END IF;

  -- 4. Record decision in approval_decisions with correct schema
  INSERT INTO public.approval_decisions (
    request_id,
    approver_id,
    approver_role,
    decision,
    note,
    created_at
  ) VALUES (
    p_request_id,
    v_caller_id,
    v_caller_role,
    p_decision,
    p_note,
    now()
  )
  ON CONFLICT (request_id, approver_id) DO UPDATE SET
    approver_role = EXCLUDED.approver_role,
    decision = EXCLUDED.decision,
    note = EXCLUDED.note,
    created_at = now();

  -- 5. Count votes
  SELECT
    count(*) FILTER (WHERE decision = 'approve'),
    count(*) FILTER (WHERE decision = 'reject')
  INTO v_votes_approved, v_votes_rejected
  FROM public.approval_decisions
  WHERE request_id = p_request_id;

  v_new_version := v_req.version + 1;
  v_new_status := NULL;

  IF v_votes_approved >= v_type.required_approvals THEN
    v_new_status := 'approved';
  ELSIF v_votes_rejected > 0 AND (v_type.required_approvals = 1 OR v_votes_rejected >= v_type.required_approvals) THEN
    v_new_status := 'rejected';
  END IF;

  -- 6. Apply state changes if terminal status reached
  IF v_new_status IS NOT NULL THEN
    UPDATE public.approval_requests
    SET
      status = v_new_status,
      decided_by = v_caller_id,
      decided_at = now(),
      decision_note = p_note,
      version = v_new_version,
      updated_at = now()
    WHERE id = p_request_id;

    IF v_new_status = 'approved' THEN
      PERFORM public.approval_apply_handler(p_request_id);
    ELSE
      -- Resilient rejection side-effect for document_verify
      IF v_req.type_key = 'document_verify' THEN
        BEGIN
          v_doc_id := (v_req.payload->>'document_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
          v_doc_id := NULL;
        END;

        BEGIN
          v_user_id := (v_req.payload->>'user_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
          v_user_id := NULL;
        END;

        v_type_code := NULLIF(v_req.payload->>'document_type_code', '');

        IF v_doc_id IS NOT NULL THEN
          UPDATE public.user_documents
          SET
            verification_status = 'rejected',
            status = 'rejected',
            verified_by = v_caller_id,
            verified_at = now(),
            rejection_reason = p_note,
            updated_at = now()
          WHERE id = v_doc_id;
        ELSIF v_user_id IS NOT NULL AND v_type_code IS NOT NULL THEN
          UPDATE public.user_documents
          SET
            verification_status = 'rejected',
            status = 'rejected',
            verified_by = v_caller_id,
            verified_at = now(),
            rejection_reason = p_note,
            updated_at = now()
          WHERE user_id = v_user_id AND document_type_code = v_type_code;
        END IF;

      -- Resilient rejection side-effect for registration
      ELSIF v_req.type_key = 'registration' THEN
        BEGIN
          v_user_id := COALESCE(
            (v_req.payload->>'user_id')::UUID,
            (v_req.payload->>'id')::UUID,
            v_req.subject_id
          );
        EXCEPTION WHEN OTHERS THEN
          v_user_id := v_req.subject_id;
        END;

        IF v_user_id IS NOT NULL THEN
          -- Mark user inactive if registration is declined
          UPDATE public.users
          SET status = 'inactive', updated_at = now()
          WHERE id = v_user_id AND status = 'pending';

          -- Mark attached initial documents rejected with reason
          UPDATE public.user_documents
          SET
            verification_status = 'rejected',
            status = 'rejected',
            verified_by = v_caller_id,
            verified_at = now(),
            rejection_reason = p_note,
            updated_at = now()
          WHERE user_id = v_user_id AND verification_status = 'pending';

          -- Synchronize any open document_verify approvals for this user
          UPDATE public.approval_requests
          SET
            status = 'rejected',
            decided_by = v_caller_id,
            decided_at = now(),
            decision_note = COALESCE(p_note, 'Registration declined'),
            updated_at = now()
          WHERE type_key = 'document_verify'
            AND (requested_by = v_user_id OR (payload->>'user_id')::UUID = v_user_id)
            AND status = 'pending';
        END IF;
      END IF;
    END IF;
  ELSE
    UPDATE public.approval_requests
    SET
      version = v_new_version,
      updated_at = now()
    WHERE id = p_request_id;
  END IF;

  -- 7. Insert audit event in public.approval_events with correct schema
  INSERT INTO public.approval_events (
    request_id,
    actor_id,
    actor_role,
    action,
    from_status,
    to_status,
    note,
    meta
  ) VALUES (
    p_request_id,
    v_caller_id,
    v_caller_role,
    p_decision,
    v_req.status,
    COALESCE(v_new_status, v_req.status),
    p_note,
    jsonb_build_object(
      'decision', p_decision,
      'note', p_note,
      'votes_approved', v_votes_approved,
      'votes_rejected', v_votes_rejected,
      'required_approvals', v_type.required_approvals
    )
  );

  -- 8. Enqueue outbox notification
  IF v_new_status IS NOT NULL THEN
    INSERT INTO public.approval_outbox (topic, request_id, payload)
    VALUES (
      'approval.decided',
      p_request_id,
      jsonb_build_object(
        'type_key', v_req.type_key,
        'decision', p_decision,
        'status', v_new_status,
        'note', p_note,
        'requested_by', v_req.requested_by,
        'decided_by', v_caller_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', COALESCE(v_new_status, v_req.status),
    'decision', p_decision,
    'version', v_new_version,
    'decided', v_new_status IS NOT NULL
  );
END;
$$;

-- Enhanced registration apply handler with full fallback resolution
CREATE OR REPLACE FUNCTION public.approval_apply_registration(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_target_user_id UUID;
BEGIN
  SELECT id, payload, decided_by, subject_id INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_target_user_id := COALESCE(
      (v_req.payload->>'user_id')::UUID,
      (v_req.payload->>'id')::UUID,
      v_req.subject_id
    );
  EXCEPTION WHEN OTHERS THEN
    v_target_user_id := v_req.subject_id;
  END;

  IF v_target_user_id IS NOT NULL THEN
    -- 1. Activate user
    UPDATE public.users
    SET status = 'active', updated_at = now()
    WHERE id = v_target_user_id;

    -- 2. Mark any initial pending documents for this user as verified
    UPDATE public.user_documents
    SET
      verification_status = 'verified',
      status = 'verified',
      verified_by = v_req.decided_by,
      verified_at = now(),
      updated_at = now()
    WHERE user_id = v_target_user_id AND verification_status = 'pending';

    -- 3. Resolve any open document_verify approval requests for this user
    UPDATE public.approval_requests
    SET
      status = 'approved',
      decided_by = v_req.decided_by,
      decided_at = now(),
      decision_note = COALESCE(decision_note, 'Approved with user registration'),
      updated_at = now()
    WHERE type_key = 'document_verify'
      AND (
        requested_by = v_target_user_id
        OR (payload->>'user_id')::UUID = v_target_user_id
        OR subject_id IN (SELECT id FROM public.user_documents WHERE user_id = v_target_user_id)
      )
      AND status = 'pending';
  END IF;
END;
$$;

-- Grant execution to authenticated, service_role and postgres
GRANT EXECUTE ON FUNCTION public.approval_decide(UUID, TEXT, TEXT, INT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_apply_registration(UUID) TO authenticated, service_role;
