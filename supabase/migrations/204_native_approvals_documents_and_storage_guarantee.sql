-- ==============================================================================
-- Migration 204: Native Approvals Documents, Rich Metadata & Storage Policy Guarantee
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
--
-- Enhancements:
-- 1. Storage policy on storage.objects allowing privileged roles (super_admin, admin, manager, hr)
--    to read and create signed URLs for private 'doc_staging' bucket files.
-- 2. Enhanced public.approval_list RPC returning rich metadata: payload, role, employee_id,
--    email, phone, machine_category, and aggregated user documents for 100% web-mobile parity.
-- 3. Resilient approval_apply_registration ensuring attached documents are verified and
--    matching document_verify requests are approved by user_id or subject_id.
-- 4. Clean registration rejection handler in approval_decide synchronizing user status to inactive,
--    marking unverified documents rejected, and closing pending document_verify approvals.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Storage Policy: Privileged Roles Can Read doc_staging
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and HR can read doc_staging" ON storage.objects;

CREATE POLICY "Admins and HR can read doc_staging"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'doc_staging'
    AND (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
  );

-- ------------------------------------------------------------------------------
-- 2. Enhanced public.approval_list RPC with Rich Metadata & Documents
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approval_list(TEXT, TEXT, TIMESTAMPTZ, UUID, INT);

CREATE OR REPLACE FUNCTION public.approval_list(
  p_status TEXT DEFAULT 'pending',
  p_type_key TEXT DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  type_key TEXT,
  type_label TEXT,
  subject_type TEXT,
  subject_id UUID,
  subject_label TEXT,
  requested_by UUID,
  requester_name TEXT,
  status public.approval_status,
  summary TEXT,
  priority SMALLINT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  version INT,
  payload JSONB,
  role TEXT,
  employee_id TEXT,
  email TEXT,
  phone TEXT,
  machine_category TEXT,
  documents JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_limit INT;
BEGIN
  v_role := public.current_user_role();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);

  RETURN QUERY
  SELECT
    r.id,
    r.type_key,
    t.label AS type_label,
    r.subject_type,
    r.subject_id,
    r.subject_label,
    r.requested_by,
    COALESCE(u.full_name, r.payload->>'full_name', 'System') AS requester_name,
    r.status,
    r.summary,
    t.priority,
    r.created_at,
    r.expires_at,
    r.version,
    r.payload,
    COALESCE(u.role, r.payload->>'role') AS role,
    u.employee_id,
    COALESCE(u.email, r.payload->>'email') AS email,
    COALESCE(u.phone, r.payload->>'phone') AS phone,
    COALESCE(u.machine_category, r.payload->>'machine_category') AS machine_category,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ud.id,
          'document_type_code', ud.document_type_code,
          'label', upper(replace(ud.document_type_code, '_', ' ')),
          'storage_path', ud.storage_path,
          'thumb_path', ud.thumb_path,
          'verification_status', ud.verification_status,
          'file_size_bytes', ud.file_size_bytes
        )
      )
      FROM public.user_documents ud
      WHERE ud.user_id = COALESCE(
        (r.payload->>'user_id')::UUID,
        CASE WHEN r.subject_type = 'user' THEN r.subject_id ELSE NULL END,
        r.requested_by
      )
    ), '[]'::jsonb) AS documents
  FROM public.approval_requests r
  JOIN public.approval_types t ON t.key = r.type_key
  LEFT JOIN public.users u ON u.id = r.requested_by
  WHERE (p_status = 'all' OR r.status = p_status::public.approval_status)
    AND (p_type_key IS NULL OR r.type_key = p_type_key)
    AND (
      v_role IN ('super_admin', 'admin', 'hr', 'service_role', 'postgres')
      OR v_role IS NULL
      OR v_role = ANY(t.approver_roles)
      OR r.requested_by = auth.uid()
      OR r.subject_id = auth.uid()
    )
    AND (
      p_cursor_created_at IS NULL
      OR (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT v_limit;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Resilient approval_apply_registration
-- ------------------------------------------------------------------------------
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
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_target_user_id := (v_req.payload->>'user_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_target_user_id := NULL;
  END;

  IF v_target_user_id IS NOT NULL THEN
    -- 1. Activate user
    UPDATE public.users
    SET status = 'active', updated_at = now()
    WHERE id = v_target_user_id;

    -- 2. Mark any initial pending documents for this user as verified (documents preserved)
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

-- ------------------------------------------------------------------------------
-- 4. Enhanced approval_decide Rejection Handling
-- ------------------------------------------------------------------------------
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
  v_doc_id UUID;
  v_user_id UUID;
  v_type_code TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    v_caller_id := '00000000-0000-0000-0000-000000000000'::UUID;
    v_caller_role := 'super_admin';
  ELSE
    v_caller_role := public.current_user_role();
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid decision: % (must be approve or reject)', p_decision
      USING ERRCODE = '22023';
  END IF;

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

  INSERT INTO public.approval_decisions (
    request_id,
    approver_id,
    decision,
    note
  ) VALUES (
    p_request_id,
    v_caller_id,
    p_decision,
    p_note
  )
  ON CONFLICT (request_id, approver_id) DO UPDATE SET
    decision = EXCLUDED.decision,
    note = EXCLUDED.note,
    decided_at = now();

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
          v_user_id := (v_req.payload->>'user_id')::UUID;
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

  INSERT INTO public.approval_events (
    request_id,
    event_type,
    actor_id,
    actor_role,
    from_status,
    to_status,
    payload
  ) VALUES (
    p_request_id,
    'decided',
    v_caller_id,
    v_caller_role,
    v_req.status,
    COALESCE(v_new_status, v_req.status),
    jsonb_build_object(
      'decision', p_decision,
      'note', p_note,
      'votes_approved', v_votes_approved,
      'votes_rejected', v_votes_rejected,
      'required_approvals', v_type.required_approvals
    )
  );

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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.approval_list(TEXT, TEXT, TIMESTAMPTZ, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_apply_registration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_decide(UUID, TEXT, TEXT, INT) TO authenticated;
