-- ==============================================================================
-- Migration: 234_rebuild_approvals_engine_grouping_and_pagination.sql
-- Description:
--   1. Add parent_id column and self-referential foreign key on public.approval_requests
--      for DB-level grouping of registrations + linked document verification requests.
--   2. Backfill existing linked document verification requests under registration requests.
--   3. Upgrade trg_auto_create_document_verification_approval to link any new document
--      verification requests directly to the user's pending registration request.
--   4. Drop stale overloads and recreate approval_list RPC with keyset pagination
--      (created_at, id), returning rows + next_cursor + pending_total in one round trip.
--   5. Drop stale overloads and recreate approval_counts RPC with parent_id IS NULL filter.
--   6. Drop stale overloads and recreate approval_decide RPC with atomic group action,
--      idempotency, row lock, dual-control, and server-enforced RBAC.
--   7. Add composite/partial indexes matching the keyset sort and filters.
--   8. Revoke anon/public execution permissions on all approval RPCs and set search_path.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Schema: Add parent_id to public.approval_requests
-- ------------------------------------------------------------------------------
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.approval_requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_approval_parent_id
  ON public.approval_requests(parent_id)
  WHERE (parent_id IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 2. Backfill: Link existing document_verify requests to pending registration requests
-- ------------------------------------------------------------------------------
UPDATE public.approval_requests dvr
SET parent_id = reg.id
FROM public.approval_requests reg
WHERE dvr.type_key = 'document_verify'
  AND reg.type_key = 'registration'
  AND dvr.parent_id IS NULL
  AND dvr.id <> reg.id
  AND (
    dvr.subject_id = reg.subject_id
    OR dvr.requested_by = reg.requested_by
    OR (dvr.payload->>'user_id')::uuid = reg.subject_id
    OR (dvr.payload->>'user_id')::uuid = (reg.payload->>'user_id')::uuid
    OR dvr.subject_id IN (SELECT ud.id FROM public.user_documents ud WHERE ud.user_id = reg.subject_id)
  );

-- ------------------------------------------------------------------------------
-- 3. Composite / Partial Indexes for Keyset Pagination & Filtering
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_approval_queue_toplevel
  ON public.approval_requests(status, created_at DESC, id DESC)
  WHERE (parent_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_approval_queue_toplevel_type
  ON public.approval_requests(status, type_key, created_at DESC, id DESC)
  WHERE (parent_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_approval_queue_all_toplevel
  ON public.approval_requests(created_at DESC, id DESC)
  WHERE (parent_id IS NULL);

-- ------------------------------------------------------------------------------
-- 4. Update Document Verification Trigger to Guarantee DB-Level Grouping
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_create_document_verification_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_name TEXT;
  v_user_status TEXT;
  v_reg_req_id UUID;
  v_existing_req_id UUID;
  v_existing_payload JSONB;
  v_doc_count INT;
BEGIN
  IF NEW.verification_status = 'pending' THEN
    SELECT full_name, status INTO v_user_name, v_user_status
    FROM public.users
    WHERE id = NEW.user_id;

    -- 1. Check if user has an active pending registration approval request
    SELECT id INTO v_reg_req_id
    FROM public.approval_requests
    WHERE type_key = 'registration'
      AND (subject_id = NEW.user_id OR requested_by = NEW.user_id OR (payload->>'user_id')::UUID = NEW.user_id)
      AND status = 'pending'
    LIMIT 1;

    -- If user is in pending registration:
    -- Their documents belong to the registration request. We do NOT create separate top-level items.
    IF v_user_status = 'pending' OR v_reg_req_id IS NOT NULL THEN
      -- If registration request exists, link any newly created document_verify request as a child
      IF v_reg_req_id IS NOT NULL THEN
        INSERT INTO public.approval_requests (
          type_key,
          subject_type,
          subject_id,
          subject_label,
          requested_by,
          status,
          summary,
          payload,
          parent_id
        ) VALUES (
          'document_verify',
          'document',
          NEW.id,
          format('%s - %s', upper(replace(NEW.document_type_code, '_', ' ')), COALESCE(v_user_name, 'User')),
          NEW.user_id,
          'pending',
          format('Document verification for %s (%s)', NEW.document_type_code, COALESCE(v_user_name, 'User')),
          jsonb_build_object(
            'document_id', NEW.id,
            'user_id', NEW.user_id,
            'document_type_code', NEW.document_type_code,
            'storage_path', NEW.storage_path,
            'thumb_path', NEW.thumb_path,
            'file_size_bytes', NEW.file_size_bytes
          ),
          v_reg_req_id
        );
      END IF;
      RETURN NEW;
    END IF;

    -- 2. Standalone document_verify for active users: bind into existing pending standalone request
    SELECT id, payload INTO v_existing_req_id, v_existing_payload
    FROM public.approval_requests
    WHERE type_key = 'document_verify'
      AND parent_id IS NULL
      AND (requested_by = NEW.user_id OR (payload->>'user_id')::UUID = NEW.user_id)
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_req_id IS NOT NULL THEN
      SELECT count(*) INTO v_doc_count
      FROM public.user_documents
      WHERE user_id = NEW.user_id AND verification_status = 'pending';

      UPDATE public.approval_requests
      SET
        subject_type = 'user',
        subject_id = NEW.user_id,
        subject_label = format('%s (%s Documents)', COALESCE(v_user_name, 'User'), v_doc_count),
        summary = format('Document verification: %s (%s documents pending review)', COALESCE(v_user_name, 'User'), v_doc_count),
        payload = jsonb_set(
          COALESCE(v_existing_payload, '{}'::jsonb),
          '{pending_document_ids}',
          (
            SELECT jsonb_agg(id)
            FROM public.user_documents
            WHERE user_id = NEW.user_id AND verification_status = 'pending'
          )
        ),
        updated_at = now()
      WHERE id = v_existing_req_id;

      RETURN NEW;
    END IF;

    -- 3. Otherwise, create ONE new standalone document_verify request
    SELECT count(*) INTO v_doc_count
    FROM public.user_documents
    WHERE user_id = NEW.user_id AND verification_status = 'pending';

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
      NEW.user_id,
      CASE
        WHEN v_doc_count > 1 THEN format('%s (%s Documents)', COALESCE(v_user_name, 'User'), v_doc_count)
        ELSE format('%s - %s', upper(replace(NEW.document_type_code, '_', ' ')), COALESCE(v_user_name, 'User'))
      END,
      NEW.user_id,
      'pending',
      CASE
        WHEN v_doc_count > 1 THEN format('Document verification: %s (%s documents pending review)', COALESCE(v_user_name, 'User'), v_doc_count)
        ELSE format('Initial verification for %s (%s)', NEW.document_type_code, COALESCE(v_user_name, 'User'))
      END,
      jsonb_build_object(
        'document_id', NEW.id,
        'user_id', NEW.user_id,
        'document_type_code', NEW.document_type_code,
        'storage_path', NEW.storage_path,
        'thumb_path', NEW.thumb_path,
        'file_size_bytes', NEW.file_size_bytes,
        'pending_document_ids', (
          SELECT jsonb_agg(id)
          FROM public.user_documents
          WHERE user_id = NEW.user_id AND verification_status = 'pending'
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 5. Drop Stale Overloads to Prevent PostgREST Ambiguity
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approval_list(text, text, timestamp with time zone, uuid, integer);
DROP FUNCTION IF EXISTS public.approval_counts();
DROP FUNCTION IF EXISTS public.approval_decide(uuid, text, text, integer, uuid);
DROP FUNCTION IF EXISTS public.approval_decide(uuid, text, text, integer, uuid, text);

-- ------------------------------------------------------------------------------
-- 6. Canonical approval_list RPC (Keyset pagination, rows + next_cursor + pending_total)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approval_list(
  p_status text DEFAULT 'pending'::text,
  p_type_key text DEFAULT NULL::text,
  p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 20
)
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

  -- RBAC guard: Only approver roles or admin tier may review the queue
  IF v_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres')
     AND NOT EXISTS (
       SELECT 1 FROM public.approval_types t WHERE v_role = ANY(t.approver_roles)
     ) THEN
    RAISE EXCEPTION 'Forbidden: Your role (%) is not authorized to access the approvals queue.', v_role
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

-- ------------------------------------------------------------------------------
-- 7. Canonical approval_counts RPC (Guarantees DB-level grouping parity)
-- ------------------------------------------------------------------------------
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

  -- Non-approvers safely receive zero counts
  IF v_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres')
     AND NOT EXISTS (
       SELECT 1 FROM public.approval_types t WHERE v_role = ANY(t.approver_roles)
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

-- ------------------------------------------------------------------------------
-- 8. Canonical approval_decide RPC (Atomic group action, dual control, RBAC)
-- ------------------------------------------------------------------------------
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
  -- 1. Security / Caller Resolution
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    IF p_actor_id IS NOT NULL AND (current_user_role() = 'service_role' OR current_setting('role', true) = 'service_role' OR current_user = 'postgres') THEN
      v_caller_id := p_actor_id;
    ELSIF current_user = 'postgres' OR current_user_role() = 'service_role' THEN
      SELECT id INTO v_caller_id FROM public.users WHERE role IN ('super_admin', 'admin') AND status = 'active' ORDER BY created_at LIMIT 1;
    ELSE
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

  IF v_caller_role NOT IN ('super_admin', 'postgres') AND v_caller_role <> ALL(v_type.approver_roles) THEN
    RAISE EXCEPTION 'Role % is not authorized to decide % requests', v_caller_role, v_req.type_key
      USING ERRCODE = '42501';
  END IF;

  -- Prevent Self-Approval
  IF (v_req.requested_by = v_caller_id OR (v_req.payload->>'user_id')::uuid = v_caller_id)
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
        (v_req.payload->>'user_id')::UUID,
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
          (v_req.payload->>'user_id')::UUID,
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

-- ------------------------------------------------------------------------------
-- 9. Enforce RLS and Permissions
-- ------------------------------------------------------------------------------
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_types ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.approval_list(text, text, timestamp with time zone, uuid, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.approval_counts() FROM anon, public;
REVOKE ALL ON FUNCTION public.approval_decide(uuid, text, text, integer, uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.approval_list(text, text, timestamp with time zone, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_decide(uuid, text, text, integer, uuid, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
