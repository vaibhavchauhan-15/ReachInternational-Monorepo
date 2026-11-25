-- ==============================================================================
-- Migration: 241_approval_decide_document_replace_rejection_fix.sql
-- Description:
--   1. Fix PostgreSQL 42703 error in public.approval_decide on document_replace rejection:
--      Removes invalid reference to non-existent updated_at column on document_change_requests
--      and properly sets reviewed_at = now(), reviewed_by = v_caller_id, status = 'rejected',
--      and rejection_reason = p_note.
--   2. Domain handling for child requests in public.approval_decide:
--      Executes domain-specific handlers for child requests (document_replace and document_verify)
--      when deciding a parent request (both for approval and rejection).
--   3. Document Change Requests acknowledgment support:
--      Adds acknowledged_at column to document_change_requests and updates
--      document_change_requests_status_check constraint to permit 'acknowledged' and 'dismissed'.
-- ==============================================================================

BEGIN;

-- 1. Add acknowledged_at column and update status check constraint on document_change_requests
ALTER TABLE public.document_change_requests
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz DEFAULT NULL;

ALTER TABLE public.document_change_requests
  DROP CONSTRAINT IF EXISTS document_change_requests_status_check;

ALTER TABLE public.document_change_requests
  ADD CONSTRAINT document_change_requests_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'acknowledged'::text, 'dismissed'::text]));

-- 2. Update public.approval_decide with fixed rejection logic and child domain handling
CREATE OR REPLACE FUNCTION public.approval_decide(
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL::text,
  p_expected_version integer DEFAULT NULL::integer,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_idempotency_key text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req RECORD;
  v_type RECORD;
  v_caller_id UUID;
  v_caller_role TEXT;
  v_new_status public.approval_status;
  v_new_version INT;
  v_votes_approved INT;
  v_votes_rejected INT;
  v_target_user_id UUID;
  v_child_rec RECORD;
  v_bound_ids UUID[] := ARRAY[]::uuid[];
BEGIN
  -- 1. Security / Caller Resolution (deny by default)
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    -- Unauthenticated callers may only be resolved by a real service-role session.
    -- Include 'none' for direct connection / superuser sessions.
    IF COALESCE(current_setting('role', true), 'none') IN ('postgres', 'service_role', 'none') THEN
      v_caller_id := p_actor_id;
    END IF;
    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL THEN
    v_caller_role := public.current_user_role();
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid decision: % (must be approve or reject)', p_decision
      USING ERRCODE = '22023';
  END IF;

  -- 2. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.approval_events
      WHERE meta->>'idempotency_key' = p_idempotency_key
    ) THEN
      SELECT status, version INTO v_new_status, v_new_version
      FROM public.approval_requests WHERE id = p_request_id;

      RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', v_new_status,
        'decision', p_decision,
        'version', v_new_version,
        'idempotent', true
      );
    END IF;
  END IF;

  -- 3. Lock Row + Status Re-check
  SELECT * INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Approval request % not found', p_request_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Child requests (e.g. document_verify) are decided directly on their own record.
  -- Blanket parent redirection is intentionally removed so verifying an individual document
  -- does NOT prematurely decide the master registration and activate the user.

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is already in terminal state % (expected pending)', v_req.status
      USING ERRCODE = 'P0004';
  END IF;

  IF p_expected_version IS NOT NULL AND v_req.version <> p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: expected version %, current version %',
      p_expected_version, v_req.version
      USING ERRCODE = 'P0003';
  END IF;

  -- 4. Approver Role Pool Verification
  SELECT * INTO v_type
  FROM public.approval_types
  WHERE key = v_req.type_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval type % not found', v_req.type_key USING ERRCODE = '22023';
  END IF;

  -- Approver pool check: deny by default. A NULL role must never pass.
  IF v_caller_role IS NULL
     OR (
       v_caller_role NOT IN ('super_admin', 'postgres')
       AND NOT (v_caller_role = ANY(v_type.approver_roles))
     ) THEN
    RAISE EXCEPTION 'Role % is not authorized to decide % requests', COALESCE(v_caller_role, 'unknown'), v_req.type_key
      USING ERRCODE = '42501';
  END IF;

  -- Prevent Self-Approval
  IF (v_req.requested_by = v_caller_id OR public.approval_uuid_or_null(v_req.payload->>'user_id') = v_caller_id)
     AND NOT v_type.allow_self_approve
     AND v_caller_role NOT IN ('super_admin', 'postgres') THEN
    RAISE EXCEPTION 'Self-approval is prohibited for % requests', v_req.type_key
      USING ERRCODE = '42501';
  END IF;

  -- 5. Record Decision in approval_decisions
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

  -- 6. Dual Control (Required Approvals)
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

  v_bound_ids := ARRAY[p_request_id];

  -- 7. State Transition & Atomic Group Execution
  IF v_new_status IS NOT NULL THEN
    -- Update Master Request
    UPDATE public.approval_requests
    SET
      status = v_new_status,
      decided_by = v_caller_id,
      decided_at = now(),
      decision_note = p_note,
      version = v_new_version,
      updated_at = now()
    WHERE id = p_request_id;

    -- Update All Linked Child Requests Atomically (when deciding a parent request)
    FOR v_child_rec IN
      SELECT id, type_key, subject_id, payload FROM public.approval_requests
      WHERE parent_id = p_request_id AND status = 'pending'
      FOR UPDATE
    LOOP
      v_bound_ids := v_bound_ids || v_child_rec.id;

      UPDATE public.approval_requests
      SET
        status = v_new_status,
        decided_by = v_caller_id,
        decided_at = now(),
        decision_note = COALESCE(p_note, 'Decided with group request'),
        version = version + 1,
        updated_at = now()
      WHERE id = v_child_rec.id;

      INSERT INTO public.approval_decisions (
        request_id, approver_id, approver_role, decision, note, created_at
      ) VALUES (
        v_child_rec.id, v_caller_id, v_caller_role, p_decision, p_note, now()
      ) ON CONFLICT (request_id, approver_id) DO NOTHING;

      INSERT INTO public.approval_events (
        request_id, actor_id, actor_role, action, from_status, to_status, note, meta
      ) VALUES (
        v_child_rec.id, v_caller_id, v_caller_role, p_decision, 'pending', v_new_status, p_note,
        jsonb_build_object('parent_request_id', p_request_id, 'idempotency_key', p_idempotency_key)
      );

      -- Domain handling for child requests
      IF v_child_rec.type_key = 'document_replace' THEN
        IF v_new_status = 'approved' THEN
          PERFORM public.approval_apply_document_replace(v_child_rec.id);
        ELSE
          UPDATE public.document_change_requests
          SET status = 'rejected', rejection_reason = p_note, reviewed_at = now(), reviewed_by = v_caller_id
          WHERE id = COALESCE(public.approval_uuid_or_null(v_child_rec.payload->>'request_id'), v_child_rec.subject_id);
        END IF;
      ELSIF v_child_rec.type_key = 'document_verify' THEN
        IF v_new_status = 'approved' THEN
          PERFORM public.approval_apply_document_verify(v_child_rec.id);
        ELSE
          UPDATE public.user_documents
          SET verification_status = 'rejected', status = 'rejected', verified_by = v_caller_id, verified_at = now(), rejection_reason = p_note, updated_at = now()
          WHERE id = public.approval_uuid_or_null(v_child_rec.payload->>'document_id') AND verification_status = 'pending';
        END IF;
      END IF;
    END LOOP;

    -- Apply Domain Handlers for Target Request
    IF v_req.type_key = 'registration' THEN
      v_target_user_id := COALESCE(
        public.approval_uuid_or_null(v_req.payload->>'user_id'),
        v_req.subject_id,
        v_req.requested_by
      );

      IF v_new_status = 'approved' THEN
        -- Activate User Account
        UPDATE public.users SET status = 'active', updated_at = now() WHERE id = v_target_user_id;

        -- Verify All User Documents
        UPDATE public.user_documents
        SET verification_status = 'verified', status = 'verified', verified_by = v_caller_id, verified_at = now(), updated_at = now()
        WHERE user_id = v_target_user_id AND verification_status = 'pending';
      ELSE
        -- Deactivate / Inactivate User Account
        UPDATE public.users SET status = 'inactive', updated_at = now() WHERE id = v_target_user_id;

        -- Reject User Documents
        UPDATE public.user_documents
        SET verification_status = 'rejected', status = 'rejected', verified_by = v_caller_id, verified_at = now(), rejection_reason = p_note, updated_at = now()
        WHERE user_id = v_target_user_id AND verification_status = 'pending';
      END IF;

    ELSIF v_req.type_key = 'document_verify' THEN
      IF v_new_status = 'approved' THEN
        PERFORM public.approval_apply_document_verify(p_request_id);
      ELSE
        v_target_user_id := COALESCE(
          public.approval_uuid_or_null(v_req.payload->>'user_id'),
          (SELECT user_id FROM public.user_documents WHERE id = public.approval_uuid_or_null(v_req.payload->>'document_id')),
          v_req.requested_by
        );
        UPDATE public.user_documents
        SET verification_status = 'rejected', status = 'rejected', verified_by = v_caller_id, verified_at = now(), rejection_reason = p_note, updated_at = now()
        WHERE (id = public.approval_uuid_or_null(v_req.payload->>'document_id') OR user_id = v_target_user_id) AND verification_status = 'pending';
      END IF;

    ELSIF v_req.type_key = 'document_replace' THEN
      IF v_new_status = 'approved' THEN
        PERFORM public.approval_apply_document_replace(p_request_id);
      ELSE
        UPDATE public.document_change_requests
        SET status = 'rejected', rejection_reason = p_note, reviewed_at = now(), reviewed_by = v_caller_id
        WHERE id = COALESCE(public.approval_uuid_or_null(v_req.payload->>'request_id'), v_req.subject_id);
      END IF;

    ELSIF v_req.type_key = 'profile_change' THEN
      IF v_new_status = 'approved' THEN
        PERFORM public.approval_apply_profile_change(p_request_id);
      END IF;

    ELSIF v_req.type_key = 'account_deletion' THEN
      IF v_new_status = 'approved' THEN
        PERFORM public.approval_apply_account_deletion(p_request_id);
      END IF;
    END IF;

    -- Outbox Dispatch for Background Notification Worker
    INSERT INTO public.approval_outbox (topic, request_id, payload)
    VALUES (
      'approval.decided',
      p_request_id,
      jsonb_build_object(
        'type_key', v_req.type_key,
        'decision', p_decision,
        'status', v_new_status,
        'decided_by', v_caller_id,
        'subject_id', v_req.subject_id,
        'requested_by', v_req.requested_by,
        'payload', v_req.payload
      )
    );

    -- Audit Event
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
      v_new_status,
      p_note,
      jsonb_build_object('idempotency_key', p_idempotency_key)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', COALESCE(v_new_status, v_req.status),
    'decision', p_decision,
    'version', v_new_version,
    'decided', (v_new_status IS NOT NULL),
    'bound_request_ids', v_bound_ids
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.approval_decide(uuid, text, text, integer, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.approval_decide(uuid, text, text, integer, uuid, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
