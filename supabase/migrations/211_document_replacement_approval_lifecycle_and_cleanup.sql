-- ==============================================================================
-- Migration 207: Document Replacement Approval Lifecycle & Storage Cleanup
-- ==============================================================================
-- 1. Updates public.approval_apply_document_replace to atomically mark
--    document_change_requests as approved and enqueue file transfer.
-- 2. Updates public.approval_decide to handle document_replace rejection,
--    marking document_change_requests as rejected with reason.
-- 3. Reconciles existing pending document_change_requests with approval_requests
--    so all active replacement requests appear in admin approvals queue.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Update public.approval_apply_document_replace
-- ------------------------------------------------------------------------------
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

  -- Enqueue file transfer from staging to canonical storage
  INSERT INTO public.approval_outbox (topic, request_id, payload)
  VALUES (
    'file.transfer_staged_document',
    p_request_id,
    v_req.payload || jsonb_build_object('decided_by', v_req.decided_by)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Update public.approval_decide to handle document_replace rejection
-- ------------------------------------------------------------------------------
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
  v_new_version INT;
  v_votes_approved INT;
  v_votes_rejected INT;
  v_new_status public.approval_status;
  v_doc_id UUID;
  v_user_id UUID;
  v_type_code TEXT;
BEGIN
  -- 1. Resolve caller identity
  IF p_actor_id IS NOT NULL THEN
    SELECT id, role INTO v_caller_id, v_caller_role
    FROM public.users
    WHERE id = p_actor_id;

    IF v_caller_id IS NULL THEN
      v_caller_id := p_actor_id;
      v_caller_role := COALESCE(
        current_setting('request.jwt.claim.role', true),
        public.current_user_role()
      );
    END IF;
  ELSE
    v_caller_id := auth.uid();
    v_caller_role := COALESCE(
      current_setting('request.jwt.claim.role', true),
      public.current_user_role()
    );

    IF v_caller_id IS NOT NULL AND v_caller_role IS NULL THEN
      SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    END IF;
  END IF;

  IF v_caller_id IS NULL THEN
    SELECT id, role INTO v_caller_id, v_caller_role
    FROM public.users
    WHERE role IN ('super_admin', 'admin') AND status = 'active'
    ORDER BY role = 'super_admin' DESC, created_at ASC
    LIMIT 1;
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

  -- 4. Record decision in approval_decisions
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

      -- Resilient rejection side-effect for document_replace
      ELSIF v_req.type_key = 'document_replace' THEN
        BEGIN
          v_doc_id := COALESCE(
            (v_req.payload->>'request_id')::UUID,
            v_req.subject_id
          );
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
          UPDATE public.document_change_requests
          SET
            status = 'rejected',
            reviewed_by = v_caller_id,
            reviewed_at = now(),
            rejection_reason = p_note
          WHERE id = v_doc_id;
        END IF;

        IF v_user_id IS NOT NULL AND v_type_code IS NOT NULL THEN
          UPDATE public.document_change_requests
          SET
            status = 'rejected',
            reviewed_by = v_caller_id,
            reviewed_at = now(),
            rejection_reason = p_note
          WHERE user_id = v_user_id
            AND document_type_code = v_type_code
            AND status = 'pending';
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
          v_user_id := NULL;
        END;

        IF v_user_id IS NOT NULL THEN
          UPDATE public.users
          SET status = 'inactive', updated_at = now()
          WHERE id = v_user_id;

          UPDATE public.user_documents
          SET
            verification_status = 'rejected',
            status = 'rejected',
            verified_by = v_caller_id,
            verified_at = now(),
            rejection_reason = COALESCE(p_note, 'Registration rejected by administrator'),
            updated_at = now()
          WHERE user_id = v_user_id AND verification_status = 'pending';

          UPDATE public.approval_requests
          SET
            status = 'rejected',
            decided_by = v_caller_id,
            decided_at = now(),
            decision_note = COALESCE(p_note, 'Registration rejected by administrator'),
            updated_at = now()
          WHERE requested_by = v_user_id
            AND status = 'pending'
            AND id <> p_request_id;
        END IF;
      END IF;
    END IF;

    -- 7. Audit log event
    INSERT INTO public.approval_events (
      request_id,
      actor_id,
      actor_role,
      action,
      from_status,
      to_status,
      note,
      meta,
      created_at
    ) VALUES (
      p_request_id,
      v_caller_id,
      v_caller_role,
      'decide.' || p_decision,
      v_req.status,
      v_new_status,
      p_note,
      jsonb_build_object(
        'votes_approved', v_votes_approved,
        'votes_rejected', v_votes_rejected,
        'terminal', true
      ),
      now()
    );

    -- 8. Enqueue decided notification into outbox
    INSERT INTO public.approval_outbox (topic, request_id, payload)
    VALUES (
      'approval.decided',
      p_request_id,
      jsonb_build_object(
        'request_id', p_request_id,
        'type_key', v_req.type_key,
        'decision', p_decision,
        'status', v_new_status,
        'note', p_note,
        'decided_by', v_caller_id,
        'requested_by', v_req.requested_by
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'status', COALESCE(v_new_status, v_req.status),
    'version', v_new_version,
    'votes_approved', v_votes_approved,
    'votes_rejected', v_votes_rejected
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Reconcile existing pending document_change_requests
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_existing_req RECORD;
BEGIN
  FOR r IN
    SELECT dcr.id, dcr.user_id, dcr.document_type_code, dcr.staging_path, dcr.staging_thumb_path, dcr.created_at,
           u.full_name, u.role, u.employee_id, u.email, u.phone
    FROM public.document_change_requests dcr
    JOIN public.users u ON u.id = dcr.user_id
    WHERE dcr.status = 'pending'
  LOOP
    -- Look for existing approval_requests row
    SELECT id, status, version INTO v_existing_req
    FROM public.approval_requests
    WHERE type_key = 'document_replace'
      AND (
        subject_id = r.id
        OR (payload->>'user_id' = r.user_id::text AND payload->>'document_type_code' = r.document_type_code)
      )
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_req.id IS NOT NULL THEN
      -- Reset to pending with latest staging image
      UPDATE public.approval_requests
      SET
        status = 'pending',
        subject_id = r.id,
        subject_label = upper(replace(r.document_type_code, '_', ' ')) || ' replacement',
        summary = 'Document replacement request for ' || replace(r.document_type_code, '_', ' '),
        payload = jsonb_build_object(
          'user_id', r.user_id,
          'document_type_code', r.document_type_code,
          'staging_path', r.staging_path,
          'staging_thumb_path', r.staging_thumb_path,
          'request_id', r.id,
          'full_name', r.full_name,
          'role', r.role,
          'employee_id', r.employee_id,
          'email', r.email,
          'phone', r.phone
        ),
        decision_note = NULL,
        decided_by = NULL,
        decided_at = NULL,
        version = v_existing_req.version + 1,
        created_at = now(),
        updated_at = now()
      WHERE id = v_existing_req.id;
    ELSE
      -- Insert missing pending approval request
      INSERT INTO public.approval_requests (
        type_key,
        subject_type,
        subject_id,
        subject_label,
        requested_by,
        status,
        summary,
        payload,
        created_at,
        updated_at
      ) VALUES (
        'document_replace',
        'document',
        r.id,
        upper(replace(r.document_type_code, '_', ' ')) || ' replacement',
        r.user_id,
        'pending',
        'Document replacement request for ' || replace(r.document_type_code, '_', ' '),
        jsonb_build_object(
          'user_id', r.user_id,
          'document_type_code', r.document_type_code,
          'staging_path', r.staging_path,
          'staging_thumb_path', r.staging_thumb_path,
          'request_id', r.id,
          'full_name', r.full_name,
          'role', r.role,
          'employee_id', r.employee_id,
          'email', r.email,
          'phone', r.phone
        ),
        now(),
        now()
      );
    END IF;
  END LOOP;
END $$;
