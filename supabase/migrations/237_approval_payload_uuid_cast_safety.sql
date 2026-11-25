-- ==============================================================================
-- Migration: 237_approval_payload_uuid_cast_safety.sql
-- Description:
--   Hardening follow-up to 236. Every remaining `(x.payload->>'key')::uuid` cast
--   inside the approval_* SECURITY DEFINER functions is replaced with
--   public.approval_uuid_or_null(). A single malformed payload value previously
--   aborted the whole call with 22P02:
--     - public.approval_list: one bad row made the ENTIRE queue unreadable
--       (the cast runs inside the users JOIN and the documents subquery).
--     - public.approval_decide / approval_apply_*: a malformed payload made the
--       request permanently undecidable.
--   Non-destructive: CREATE OR REPLACE only. No data or privilege changes.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.approval_list(p_status text DEFAULT 'pending'::text, p_type_key text DEFAULT NULL::text, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT;
  v_caller_id UUID;
  v_limit INT;
  v_pending_total INT := 0;
  v_items JSONB := '[]'::jsonb;
  v_next_cursor JSONB := NULL;
  v_has_more BOOLEAN := false;
  v_last_created_at TIMESTAMPTZ;
  v_last_id UUID;
BEGIN
  -- Security check: Require authenticated user (or service_role/postgres for system/tests)
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    IF current_user_role() IN ('service_role', 'postgres') 
       OR current_setting('role', true) IN ('service_role', 'postgres') 
       OR current_user = 'postgres' THEN
      SELECT id INTO v_caller_id FROM public.users WHERE role IN ('super_admin', 'admin') AND status = 'active' ORDER BY created_at LIMIT 1;
    ELSE
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_caller_id;
  IF v_role IS NULL THEN
    v_role := public.current_user_role();
  END IF;

  -- RBAC guard: deny by default. An unresolvable (NULL) role is never authorised.
  IF v_role IS NULL
     OR (
       v_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres')
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_types t WHERE v_role = ANY(t.approver_roles)
       )
     ) THEN
    RAISE EXCEPTION 'Forbidden: Your role (%) is not authorized to access the approvals queue.', COALESCE(v_role, 'unknown')
      USING ERRCODE = '42501';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);

  -- Single round-trip: compute pending_total for the current type filter
  SELECT count(*)
  INTO v_pending_total
  FROM public.approval_requests r
  WHERE r.status = 'pending'
    AND r.parent_id IS NULL
    AND (p_type_key IS NULL OR p_type_key = 'all' OR r.type_key = p_type_key);

  -- Fetch up to v_limit + 1 rows to detect has_more
  WITH filtered AS (
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
      -- Supervisor resolution: users.supervisor_id, payload, or user_supervisors junction table
      COALESCE(
        sup.full_name,
        r.payload->>'supervisor_name',
        r.payload->>'supervisorName',
        (
          SELECT s2.full_name FROM public.users s2
          WHERE s2.id = COALESCE(
            NULLIF(r.payload->>'supervisor_id', '')::UUID,
            NULLIF(r.payload->>'supervisorId', '')::UUID,
            (SELECT us.supervisor_id FROM public.user_supervisors us WHERE us.user_id = u.id ORDER BY us.created_at DESC LIMIT 1)
          )
        )
      ) AS supervisor_name,
      COALESCE(
        sup.id,
        u.supervisor_id,
        NULLIF(r.payload->>'supervisor_id', '')::UUID,
        NULLIF(r.payload->>'supervisorId', '')::UUID
      ) AS supervisor_id,
      -- User documents attached to this item
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ud.id,
            'document_type_code', ud.document_type_code,
            'label', CASE
              WHEN ud.document_type_code = 'aadhaar' THEN 'Aadhaar Card'
              WHEN ud.document_type_code = 'driving_license' THEN 'Driving License'
              WHEN ud.document_type_code = 'bank_document' THEN 'Bank Details'
              ELSE upper(replace(ud.document_type_code, '_', ' '))
            END,
            'storage_path', ud.storage_path,
            'thumb_path', ud.thumb_path,
            'verification_status', ud.verification_status,
            'file_size_bytes', ud.file_size_bytes,
            'mime_type', ud.mime_type
          ) ORDER BY ud.created_at ASC
        )
        FROM public.user_documents ud
        WHERE ud.user_id = COALESCE(
          public.approval_uuid_or_null(r.payload->>'user_id'),
          CASE WHEN r.subject_type = 'user' THEN r.subject_id ELSE NULL END,
          r.requested_by
        )
      ), '[]'::jsonb) AS documents,
      -- Bound request IDs for grouped registration requests
      (
        ARRAY[r.id] || COALESCE((
          SELECT array_agg(child.id)
          FROM public.approval_requests child
          WHERE child.parent_id = r.id
        ), '{}'::uuid[])
      ) AS bound_request_ids
    FROM public.approval_requests r
    JOIN public.approval_types t ON t.key = r.type_key
    LEFT JOIN public.users u ON u.id = COALESCE(
      public.approval_uuid_or_null(r.payload->>'user_id'),
      CASE WHEN r.subject_type = 'user' THEN r.subject_id ELSE NULL END,
      r.requested_by
    )
    LEFT JOIN public.users sup ON sup.id = COALESCE(
      u.supervisor_id,
      NULLIF(r.payload->>'supervisor_id', '')::UUID,
      NULLIF(r.payload->>'supervisorId', '')::UUID
    )
    WHERE r.parent_id IS NULL
      AND (p_status = 'all' OR r.status = p_status::public.approval_status)
      AND (p_type_key IS NULL OR p_type_key = 'all' OR r.type_key = p_type_key)
      AND (
        p_cursor_created_at IS NULL
        OR (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT (v_limit + 1)
  ),
  enumerated AS (
    SELECT f.*, ROW_NUMBER() OVER () as rn
    FROM filtered f
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'type_key', e.type_key,
        'type_label', e.type_label,
        'subject_type', e.subject_type,
        'subject_id', e.subject_id,
        'subject_label', e.subject_label,
        'requested_by', e.requested_by,
        'requester_name', e.requester_name,
        'status', e.status,
        'summary', e.summary,
        'priority', e.priority,
        'created_at', e.created_at,
        'expires_at', e.expires_at,
        'version', e.version,
        'payload', e.payload,
        'role', e.role,
        'employee_id', e.employee_id,
        'email', e.email,
        'phone', e.phone,
        'machine_category', e.machine_category,
        'supervisor_name', e.supervisor_name,
        'supervisor_id', e.supervisor_id,
        'documents', e.documents,
        'bound_request_ids', to_jsonb(e.bound_request_ids)
      ) ORDER BY e.rn
    ) FILTER (WHERE e.rn <= v_limit), '[]'::jsonb),
    COALESCE(bool_or(e.rn > v_limit), false),
    (
      SELECT jsonb_build_object('created_at', e_last.created_at, 'id', e_last.id)
      FROM enumerated e_last
      WHERE e_last.rn = v_limit
    )
  INTO v_items, v_has_more, v_next_cursor
  FROM enumerated e;

  IF NOT v_has_more THEN
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'next_cursor', v_next_cursor,
    'has_more', v_has_more,
    'pending_total', v_pending_total
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approval_decide(p_request_id uuid, p_decision text, p_note text DEFAULT NULL::text, p_expected_version integer DEFAULT NULL::integer, p_actor_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
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
    -- Unauthenticated callers may only be resolved by a real service-role
    -- session. `current_user` is deliberately NOT used here: it is always
    -- the function owner inside a SECURITY DEFINER body (migration 235 bug).
    IF COALESCE(current_setting('role', true), 'none') IN ('postgres', 'service_role') THEN
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

  -- If child passed, operate on parent registration request
  IF v_req.parent_id IS NOT NULL THEN
    p_request_id := v_req.parent_id;
    SELECT * INTO v_req
    FROM public.approval_requests
    WHERE id = p_request_id
    FOR UPDATE;
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

    -- Update All Linked Child Requests Atomically
    FOR v_child_rec IN
      SELECT id FROM public.approval_requests
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
    END LOOP;

    -- Apply Domain Handlers
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
        SET status = 'rejected', rejection_reason = p_note, updated_at = now()
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
        'note', p_note,
        'requested_by', v_req.requested_by,
        'decided_by', v_caller_id,
        'bound_ids', to_jsonb(v_bound_ids)
      )
    );
  ELSE
    -- Dual control: vote recorded, threshold not yet reached
    UPDATE public.approval_requests
    SET version = v_new_version, updated_at = now()
    WHERE id = p_request_id;
  END IF;

  -- 8. Record Audit Event
  INSERT INTO public.approval_events (
    request_id, actor_id, actor_role, action, from_status, to_status, note, meta
  ) VALUES (
    p_request_id, v_caller_id, v_caller_role, p_decision, v_req.status, COALESCE(v_new_status, v_req.status), p_note,
    jsonb_build_object(
      'decision', p_decision,
      'note', p_note,
      'votes_approved', v_votes_approved,
      'votes_rejected', v_votes_rejected,
      'required_approvals', v_type.required_approvals,
      'idempotency_key', p_idempotency_key,
      'bound_ids', to_jsonb(v_bound_ids)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', COALESCE(v_new_status, v_req.status),
    'decision', p_decision,
    'version', v_new_version,
    'decided', v_new_status IS NOT NULL,
    'bound_request_ids', to_jsonb(v_bound_ids)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approval_approve_all(p_actor_id uuid DEFAULT NULL::uuid, p_type_key text DEFAULT NULL::text, p_request_ids uuid[] DEFAULT NULL::uuid[], p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_req RECORD;
  v_target_user_id UUID;
  v_user_name TEXT;
  v_doc_count INT;
  v_existing_doc_req_id UUID;
  v_approved_count INT := 0;
  v_approved_ids JSONB := '[]'::jsonb;
  v_activated_user_ids JSONB := '[]'::jsonb;
  v_caller_id UUID;
  v_skipped_ids JSONB := '[]'::jsonb;
  v_allow_self BOOLEAN;
BEGIN
  -- 1. Resolve actor id and verify administrator role (deny by default).
  -- p_actor_id is honoured only for a real service-role session, so an
  -- authenticated caller can never impersonate a different actor.
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    v_actor_id := v_caller_id;
  ELSIF COALESCE(current_setting('role', true), 'none') IN ('postgres', 'service_role') THEN
    v_actor_id := p_actor_id;
  END IF;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = v_actor_id;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Only administrators can perform bulk approval (caller role: %)', COALESCE(v_actor_role, 'unknown')
      USING ERRCODE = '42501';
  END IF;

  -- 2. Process all qualifying pending requests with row-level locks
  FOR v_req IN
    SELECT id, type_key, subject_type, subject_id, payload, requested_by, version
    FROM public.approval_requests
    WHERE status = 'pending'
      AND parent_id IS NULL
      AND (
        (p_type_key IS NOT NULL AND p_type_key <> 'all' AND type_key = p_type_key)
        OR
        ((p_type_key IS NULL OR p_type_key = 'all') AND type_key NOT IN ('document_verify', 'document_replace'))
      )
      AND (p_request_ids IS NULL OR id = ANY(p_request_ids))
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Self-approval guard: never bulk-approve the actor's own request
    -- unless the approval type explicitly allows it.
    SELECT allow_self_approve INTO v_allow_self
    FROM public.approval_types
    WHERE key = v_req.type_key;

    IF v_req.requested_by = v_actor_id AND COALESCE(v_allow_self, false) = false THEN
      v_skipped_ids := v_skipped_ids || jsonb_build_array(v_req.id);
      CONTINUE;
    END IF;

    -- A. Update approval request status to approved
    UPDATE public.approval_requests
    SET
      status = 'approved',
      decided_by = v_actor_id,
      decided_at = now(),
      decision_note = COALESCE(p_note, 'Bulk approved via Approve All'),
      version = version + 1,
      updated_at = now()
    WHERE id = v_req.id;

    -- Cascade to grouped child requests (registration + linked
    -- documents = one item, one action)
    UPDATE public.approval_requests
    SET
      status = 'approved',
      decided_by = v_actor_id,
      decided_at = now(),
      decision_note = COALESCE(p_note, 'Bulk approved via Approve All'),
      version = version + 1,
      updated_at = now()
    WHERE parent_id = v_req.id
      AND status = 'pending';

    v_approved_count := v_approved_count + 1;
    v_approved_ids := v_approved_ids || jsonb_build_array(v_req.id);

    -- B. Handle registration approvals specifically
    IF v_req.type_key = 'registration' THEN
      BEGIN
        v_target_user_id := COALESCE(
          public.approval_uuid_or_null(v_req.payload->>'user_id'),
          public.approval_uuid_or_null(v_req.payload->>'id'),
          v_req.subject_id,
          v_req.requested_by
        );
      EXCEPTION WHEN OTHERS THEN
        v_target_user_id := COALESCE(v_req.subject_id, v_req.requested_by);
      END;

      IF v_target_user_id IS NOT NULL THEN
        -- 1. ACTIVATE USER IMMEDIATELY
        UPDATE public.users
        SET status = 'active', updated_at = now()
        WHERE id = v_target_user_id;

        v_activated_user_ids := v_activated_user_ids || jsonb_build_array(v_target_user_id);

        -- Fetch user full name for logging and document summary
        SELECT full_name INTO v_user_name
        FROM public.users
        WHERE id = v_target_user_id;

        -- 2. MANDATORY RULE: ALL USER DOCUMENTS MUST REMAIN / BE SET TO PENDING
        -- "if approval all then all the user documents should be pending only user is active"
        UPDATE public.user_documents
        SET
          verification_status = 'pending',
          status = 'pending',
          verified_by = NULL,
          verified_at = NULL,
          updated_at = now()
        WHERE user_id = v_target_user_id;

        -- 3. Consolidate pending documents into a 'document_verify' request for later inspection
        SELECT count(*) INTO v_doc_count
        FROM public.user_documents
        WHERE user_id = v_target_user_id AND verification_status = 'pending';

        IF v_doc_count > 0 THEN
          SELECT id INTO v_existing_doc_req_id
          FROM public.approval_requests
          WHERE type_key = 'document_verify'
            AND (requested_by = v_target_user_id OR subject_id = v_target_user_id OR public.approval_uuid_or_null(payload->>'user_id') = v_target_user_id)
            AND status = 'pending'
          LIMIT 1;

          IF v_existing_doc_req_id IS NOT NULL THEN
            UPDATE public.approval_requests
            SET
              subject_type = 'user',
              subject_id = v_target_user_id,
              subject_label = format('%s (%s Documents)', COALESCE(v_user_name, 'User'), v_doc_count),
              summary = format('Document verification: %s (%s documents pending review)', COALESCE(v_user_name, 'User'), v_doc_count),
              payload = jsonb_build_object(
                'user_id', v_target_user_id,
                'full_name', v_user_name,
                'pending_document_ids', (
                  SELECT jsonb_agg(id) FROM public.user_documents
                  WHERE user_id = v_target_user_id AND verification_status = 'pending'
                )
              ),
              updated_at = now()
            WHERE id = v_existing_doc_req_id;
          ELSE
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
              'user',
              v_target_user_id,
              format('%s (%s Documents)', COALESCE(v_user_name, 'User'), v_doc_count),
              v_target_user_id,
              'pending',
              format('Document verification: %s (%s documents pending review)', COALESCE(v_user_name, 'User'), v_doc_count),
              jsonb_build_object(
                'user_id', v_target_user_id,
                'full_name', v_user_name,
                'pending_document_ids', (
                  SELECT jsonb_agg(id) FROM public.user_documents
                  WHERE user_id = v_target_user_id AND verification_status = 'pending'
                )
              )
            );
          END IF;
        END IF;
      END IF;

    -- C. Handle profile change requests
    ELSIF v_req.type_key = 'profile_change' THEN
      BEGIN
        PERFORM public.approval_apply_profile_change(v_req.id);
      EXCEPTION WHEN OTHERS THEN
        -- Profile change apply failure non-blocking for bulk loop
      END;
    END IF;

    -- D. Enqueue outbox event for notification dispatcher
    INSERT INTO public.approval_outbox (topic, request_id, payload)
    VALUES (
      'approval.decided',
      v_req.id,
      jsonb_build_object(
        'type_key', v_req.type_key,
        'decision', 'approve',
        'decided_by', v_actor_id,
        'bulk', true,
        'documents_status', 'pending'
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'approved_count', v_approved_count,
    'approved_ids', v_approved_ids,
    'activated_user_ids', v_activated_user_ids,
    'skipped_ids', v_skipped_ids
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approval_apply_registration(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      public.approval_uuid_or_null(v_req.payload->>'user_id'),
      public.approval_uuid_or_null(v_req.payload->>'id'),
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
        OR public.approval_uuid_or_null(payload->>'user_id') = v_target_user_id
        OR subject_id IN (SELECT id FROM public.user_documents WHERE user_id = v_target_user_id)
      )
      AND status = 'pending';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approval_apply_document_verify(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req RECORD;
  v_doc_id UUID;
  v_user_id UUID;
  v_type_code TEXT;
  v_doc_ids JSONB;
BEGIN
  SELECT id, payload, decided_by, requested_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_doc_id := public.approval_uuid_or_null(v_req.payload->>'document_id');
  EXCEPTION WHEN OTHERS THEN
    v_doc_id := NULL;
  END;

  BEGIN
    v_user_id := COALESCE(
      public.approval_uuid_or_null(v_req.payload->>'user_id'),
      (SELECT user_id FROM public.user_documents WHERE id = v_doc_id),
      v_req.requested_by
    );
  EXCEPTION WHEN OTHERS THEN
    v_user_id := v_req.requested_by;
  END;

  v_type_code := NULLIF(v_req.payload->>'document_type_code', '');
  v_doc_ids := v_req.payload->'pending_document_ids';

  -- If this request binds multiple pending documents:
  IF v_doc_ids IS NOT NULL AND jsonb_array_length(v_doc_ids) > 0 THEN
    UPDATE public.user_documents
    SET
      verification_status = 'verified',
      status = 'verified',
      verified_by = v_req.decided_by,
      verified_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id IN (
      SELECT value::text::uuid
      FROM jsonb_array_elements_text(v_doc_ids)
    );
  ELSIF v_doc_id IS NOT NULL THEN
    UPDATE public.user_documents
    SET
      verification_status = 'verified',
      status = 'verified',
      verified_by = v_req.decided_by,
      verified_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = v_doc_id;
  ELSIF v_user_id IS NOT NULL AND v_type_code IS NOT NULL THEN
    UPDATE public.user_documents
    SET
      verification_status = 'verified',
      status = 'verified',
      verified_by = v_req.decided_by,
      verified_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE user_id = v_user_id AND document_type_code = v_type_code;
  ELSIF v_user_id IS NOT NULL THEN
    UPDATE public.user_documents
    SET
      verification_status = 'verified',
      status = 'verified',
      verified_by = v_req.decided_by,
      verified_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE user_id = v_user_id AND verification_status = 'pending';
  END IF;

  INSERT INTO public.approval_outbox (topic, request_id, payload)
  VALUES (
    'approval.decided',
    p_request_id,
    jsonb_build_object(
      'type_key', 'document_verify',
      'decision', 'approve',
      'document_id', v_doc_id,
      'user_id', v_user_id,
      'document_type_code', v_type_code,
      'decided_by', v_req.decided_by
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approval_apply_document_replace(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    public.approval_uuid_or_null(v_req.payload->>'request_id'),
    v_req.subject_id
  );
  v_user_id := public.approval_uuid_or_null(v_req.payload->>'user_id');
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
$function$;

CREATE OR REPLACE FUNCTION public.approval_apply_profile_change(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req RECORD;
  v_target_user_id UUID;
  v_changes JSONB;
  v_key TEXT;
  v_val TEXT;
BEGIN
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  v_target_user_id := public.approval_uuid_or_null(v_req.payload->>'target_user_id');
  v_changes := v_req.payload->'changes';

  IF v_target_user_id IS NULL OR v_changes IS NULL THEN
    RETURN;
  END IF;

  -- Apply individual recognized user fields safely
  FOR v_key, v_val IN
    SELECT key, value->>'new_value'
    FROM jsonb_each(v_changes)
  LOOP
    IF v_key = 'full_name' AND v_val IS NOT NULL THEN
      UPDATE public.users SET full_name = v_val, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'phone' AND v_val IS NOT NULL THEN
      UPDATE public.users SET phone = v_val, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'address' AND v_val IS NOT NULL THEN
      UPDATE public.users SET address = v_val, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'city' AND v_val IS NOT NULL THEN
      UPDATE public.users SET city = v_val, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'district' AND v_val IS NOT NULL THEN
      UPDATE public.users SET district = v_val, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'state' AND v_val IS NOT NULL THEN
      UPDATE public.users SET state = v_val, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'state_id' AND v_val IS NOT NULL THEN
      UPDATE public.users SET state_id = v_val::INT, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'aadhaar_number' AND v_val IS NOT NULL THEN
      UPDATE public.users SET aadhaar_number = v_val, updated_at = now() WHERE id = v_target_user_id;
    ELSIF v_key = 'license_number' AND v_val IS NOT NULL THEN
      UPDATE public.users SET license_number = v_val, updated_at = now() WHERE id = v_target_user_id;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approval_apply_account_deletion(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req RECORD;
  v_user_id UUID;
BEGIN
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  v_user_id := public.approval_uuid_or_null(v_req.payload->>'user_id');

  IF v_user_id IS NOT NULL THEN
    -- Mark user account as pending deletion
    UPDATE public.users
    SET status = 'pending_deletion', updated_at = now()
    WHERE id = v_user_id;

    -- Enqueue delayed hard deletion after cooling-off period
    INSERT INTO public.approval_outbox (topic, request_id, payload)
    VALUES (
      'deletion.execute',
      p_request_id,
      jsonb_build_object('user_id', v_user_id)
    );
  END IF;
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
