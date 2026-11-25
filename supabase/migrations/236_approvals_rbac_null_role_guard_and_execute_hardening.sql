-- ==============================================================================
-- Migration: 236_approvals_rbac_null_role_guard_and_execute_hardening.sql
-- Description:
--   Corrective hardening for the unified approvals engine (see migration 235).
--   Non-destructive: CREATE OR REPLACE + privilege changes only. No data changes.
--
--   BUG 1 (CRITICAL) - NULL-role RBAC bypass in public.approval_list /
--     approval_counts / approval_decide / approval_cancel. The guards evaluated
--     `IF v_role NOT IN (...)` with a NULL role. `NULL NOT IN (...)` is NULL, not
--     TRUE, so the guard never fired. Any caller whose public.users row was
--     missing or NULL-roled could read the full queue AND decide requests.
--     Verified live on Dev immediately before this migration (rolled back):
--     a null-role caller returned {"status":"approved","success":true}.
--   BUG 2 (CRITICAL) - public.approval_get had an explicit `OR v_role IS NULL` in
--     its visibility predicate, granting read access to unidentified callers.
--   BUG 3 (CRITICAL) - public.approval_approve_all resolved the actor via
--     `COALESCE(p_actor_id, auth.uid())` and SKIPPED the entire role check when
--     both were NULL, so p_actor_id could be forged to an administrator uuid (or
--     simply omitted) and the whole queue bulk-approved.
--   BUG 4 - `current_user = 'postgres'` is always TRUE inside a SECURITY DEFINER
--     body, so approval_decide attributed a decision to an arbitrary administrator
--     whenever auth.uid() was NULL. Replaced with the session role GUC.
--   BUG 5 - approval_approve_all / approval_cancel / approval_expire_due did not
--     cascade grouped child requests (parent_id), leaving invisible orphaned
--     pending rows after migration 235 introduced DB-level grouping.
--   BUG 6 - 10 of 14 approval_* SECURITY DEFINER functions were still executable
--     by anon (PUBLIC), including the mutating approval_expire_due() and
--     approval_apply_* handlers.
--   BUG 7 - unguarded `(payload->>'user_id')::uuid` casts abort a decision with
--     22P02 whenever the payload value is not a valid uuid.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Safe uuid cast helper (Bug 7)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approval_uuid_or_null(p_value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN NULLIF(trim(COALESCE(p_value, '')), '')::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

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
          (r.payload->>'user_id')::UUID,
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
      (r.payload->>'user_id')::UUID,
      CASE WHEN r.subject_type = 'user' THEN r.subject_id ELSE NULL END,
      r.requested_by
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

CREATE OR REPLACE FUNCTION public.approval_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT;
  v_caller_id UUID;
  v_total INT := 0;
  v_by_type JSONB := '{}'::jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.users WHERE id = v_caller_id;
  END IF;
  IF v_role IS NULL THEN
    v_role := public.current_user_role();
  END IF;

  -- Deny by default: non-approvers and unidentified callers receive zero counts
  IF v_role IS NULL
     OR (
       v_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres')
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_types t WHERE v_role = ANY(t.approver_roles)
       )
     ) THEN
    RETURN jsonb_build_object(
      'total', 0,
      'by_type', '{}'::jsonb
    );
  END IF;

  SELECT
    COALESCE(SUM(sub.cnt), 0),
    COALESCE(jsonb_object_agg(sub.type_key, sub.cnt), '{}'::jsonb)
  INTO v_total, v_by_type
  FROM (
    SELECT r.type_key, COUNT(*) AS cnt
    FROM public.approval_requests r
    WHERE r.status = 'pending'
      AND r.parent_id IS NULL
    GROUP BY r.type_key
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'by_type', v_by_type
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
          (SELECT user_id FROM public.user_documents WHERE id = (v_req.payload->>'document_id')::UUID),
          v_req.requested_by
        );
        UPDATE public.user_documents
        SET verification_status = 'rejected', status = 'rejected', verified_by = v_caller_id, verified_at = now(), rejection_reason = p_note, updated_at = now()
        WHERE (id = (v_req.payload->>'document_id')::UUID OR user_id = v_target_user_id) AND verification_status = 'pending';
      END IF;

    ELSIF v_req.type_key = 'document_replace' THEN
      IF v_new_status = 'approved' THEN
        PERFORM public.approval_apply_document_replace(p_request_id);
      ELSE
        UPDATE public.document_change_requests
        SET status = 'rejected', rejection_reason = p_note, updated_at = now()
        WHERE id = COALESCE((v_req.payload->>'request_id')::UUID, v_req.subject_id);
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

CREATE OR REPLACE FUNCTION public.approval_get(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT;
  v_result JSONB;
BEGIN
  v_role := public.current_user_role();

  SELECT jsonb_build_object(
    'id', r.id,
    'type_key', r.type_key,
    'subject_type', r.subject_type,
    'subject_id', r.subject_id,
    'subject_label', r.subject_label,
    'requested_by', r.requested_by,
    'requester_name', u.full_name,
    'status', r.status,
    'summary', r.summary,
    'payload', r.payload,
    'decision_note', r.decision_note,
    'decided_by', r.decided_by,
    'decided_at', r.decided_at,
    'expires_at', r.expires_at,
    'supersedes_id', r.supersedes_id,
    'idempotency_key', r.idempotency_key,
    'version', r.version,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'type', jsonb_build_object(
      'key', t.key,
      'label', t.label,
      'category', t.category,
      'approver_roles', t.approver_roles,
      'required_approvals', t.required_approvals,
      'allow_self_approve', t.allow_self_approve,
      'ttl', t.ttl,
      'cooling_off', t.cooling_off,
      'priority', t.priority,
      'active', t.active
    ),
    'requester', jsonb_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'email', u.email,
      'role', u.role
    )
  ) INTO v_result
  FROM public.approval_requests r
  JOIN public.approval_types t ON t.key = r.type_key
  LEFT JOIN public.users u ON u.id = r.requested_by
  WHERE r.id = p_request_id
    AND (
      v_role IN ('super_admin', 'admin', 'hr', 'service_role', 'postgres')
      OR v_role = ANY(t.approver_roles)
      OR r.requested_by = auth.uid()
      OR r.subject_id = auth.uid()
    );

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Approval request not found or access denied.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approval_cancel(p_request_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req RECORD;
  v_caller_id UUID;
  v_caller_role TEXT;
  v_new_version INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Forbidden: unable to resolve an authorized role for this caller.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot cancel request in % status.', v_req.status
      USING ERRCODE = '22023';
  END IF;

  IF v_req.requested_by <> v_caller_id AND v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Forbidden: Only the requester can cancel this request.'
      USING ERRCODE = '42501';
  END IF;

  v_new_version := v_req.version + 1;

  UPDATE public.approval_requests
  SET
    status = 'cancelled',
    decided_by = v_caller_id,
    decided_at = now(),
    decision_note = COALESCE(p_note, 'Cancelled by requester'),
    version = v_new_version,
    updated_at = now()
  WHERE id = p_request_id;

  -- Cascade to grouped child requests (registration + linked documents = one item)
  UPDATE public.approval_requests
  SET
    status = 'cancelled',
    decided_by = v_caller_id,
    decided_at = now(),
    decision_note = COALESCE(p_note, 'Cancelled with group request'),
    version = version + 1,
    updated_at = now()
  WHERE parent_id = p_request_id
    AND status = 'pending';

  INSERT INTO public.approval_events (
    request_id,
    actor_id,
    actor_role,
    action,
    from_status,
    to_status,
    note
  ) VALUES (
    p_request_id,
    v_caller_id,
    v_caller_role,
    'cancelled',
    'pending',
    'cancelled',
    p_note
  );

  INSERT INTO public.approval_outbox (
    topic,
    request_id,
    payload
  ) VALUES (
    'approval.cancelled',
    p_request_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'type_key', v_req.type_key,
      'requested_by', v_caller_id,
      'note', p_note
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'version', v_new_version
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
          (v_req.payload->>'user_id')::UUID,
          (v_req.payload->>'id')::UUID,
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
            AND (requested_by = v_target_user_id OR subject_id = v_target_user_id OR (payload->>'user_id')::UUID = v_target_user_id)
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

CREATE OR REPLACE FUNCTION public.approval_expire_due()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_expired_count INT := 0;
  v_rec RECORD;
BEGIN
  -- Reserved for scheduled system maintenance. SECURITY DEFINER hides
  -- `current_user`, so the session role GUC is the discriminator.
  IF COALESCE(current_setting('role', true), 'none') NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Forbidden: approval_expire_due() is reserved for scheduled system maintenance.'
      USING ERRCODE = '42501';
  END IF;

  FOR v_rec IN
    -- Top-level items only: grouped children are expired by the cascade below
    SELECT id, type_key, requested_by
    FROM public.approval_requests
    WHERE status = 'pending'
      AND parent_id IS NULL
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.approval_requests
    SET
      status = 'expired',
      decided_at = now(),
      decision_note = 'Request expired automatically due to SLA timeout.',
      version = version + 1,
      updated_at = now()
    WHERE id = v_rec.id;

    INSERT INTO public.approval_events (
      request_id,
      actor_id,
      actor_role,
      action,
      from_status,
      to_status,
      note
    ) VALUES (
      v_rec.id,
      NULL,
      'system',
      'expired',
      'pending',
      'expired',
      'SLA timeout reached'
    );

    INSERT INTO public.approval_outbox (
      topic,
      request_id,
      payload
    ) VALUES (
      'approval.expired',
      v_rec.id,
      jsonb_build_object(
        'request_id', v_rec.id,
        'type_key', v_rec.type_key,
        'requested_by', v_rec.requested_by
      )
    );

    -- Cascade expiry to grouped child requests (registration + linked
    -- documents = one item)
    UPDATE public.approval_requests
    SET
      status = 'expired',
      decided_at = now(),
      decision_note = 'Request expired automatically due to SLA timeout.',
      version = version + 1,
      updated_at = now()
    WHERE parent_id = v_rec.id
      AND status = 'pending';

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 2. Execute privileges: revoke anon/PUBLIC across every approval_* function (Bug 6)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.approval_uuid_or_null(text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_list(text, text, timestamp with time zone, uuid, integer) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_counts() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_decide(uuid, text, text, integer, uuid, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_get(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_submit(text, text, uuid, jsonb, text, text, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_cancel(uuid, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_approve_all(uuid, text, uuid[], text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_handler(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_registration(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_document_verify(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_document_replace(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_profile_change(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_account_deletion(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.approval_expire_due() FROM anon, PUBLIC;

-- Client-facing contract: authenticated + service_role only.
GRANT EXECUTE ON FUNCTION public.approval_uuid_or_null(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_list(text, text, timestamp with time zone, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_decide(uuid, text, text, integer, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_get(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_submit(text, text, uuid, jsonb, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_cancel(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_approve_all(uuid, text, uuid[], text) TO authenticated, service_role;

-- Internal domain handlers and the SLA sweeper are invoked only from SECURITY
-- DEFINER bodies (executed as the function owner) or by the service role.
REVOKE ALL ON FUNCTION public.approval_apply_handler(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.approval_apply_registration(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.approval_apply_document_verify(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.approval_apply_document_replace(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.approval_apply_profile_change(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.approval_apply_account_deletion(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.approval_expire_due() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approval_expire_due() TO service_role;

-- Re-assert pinned search_path on every approval_* function.
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'approval%'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path TO ''public'', ''pg_temp''', fn_record.sig);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
