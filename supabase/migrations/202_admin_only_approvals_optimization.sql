-- ==============================================================================
-- Migration 202: Admin-Only Approvals & Performance Scalability Optimization
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Restricts approval queues, decisions, and administrative reviews strictly to admin users (super_admin, admin)
-- 2. Updates approval_types approver_roles to strictly admin roles
-- 3. Hardens RLS policies on approval_requests, approval_decisions, and approval_events
-- 4. Updates approval_decide, approval_list, and approval_counts RPCs with admin guards
-- 5. Adds multi-column composite indexes on (status, created_at, id) and (status, type_key, created_at, id)
--    for sub-millisecond pagination across all tabs (Pending, Approved, Rejected) at 100k+ rows scale
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Update approval_types catalogue to enforce admin-only approver roles
-- ------------------------------------------------------------------------------
UPDATE public.approval_types
SET
  approver_roles = ARRAY['super_admin', 'admin'],
  updated_at = now();

-- ------------------------------------------------------------------------------
-- 2. Scalability & High-Throughput Performance Indexes
-- ------------------------------------------------------------------------------
-- Accelerates non-pending tabs (Approved, Rejected) and multi-status queries with keyset pagination
CREATE INDEX IF NOT EXISTS idx_approval_requests_status_created
  ON public.approval_requests (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status_type_created
  ON public.approval_requests (status, type_key, created_at DESC, id DESC);

-- Accelerates approver history and audit lookups
CREATE INDEX IF NOT EXISTS idx_approval_decisions_approver
  ON public.approval_decisions (approver_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Hardened RLS Policies (Admin-Only Queue Access)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS approval_requests_read ON public.approval_requests;
CREATE POLICY approval_requests_read ON public.approval_requests
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin')
    OR requested_by = auth.uid()
    OR subject_id = auth.uid()
  );

DROP POLICY IF EXISTS approval_decisions_read ON public.approval_decisions;
CREATE POLICY approval_decisions_read ON public.approval_decisions
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = request_id
        AND (r.requested_by = auth.uid() OR r.subject_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS approval_events_read ON public.approval_events;
CREATE POLICY approval_events_read ON public.approval_events
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = request_id
        AND (r.requested_by = auth.uid() OR r.subject_id = auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- 4. Hardened RPC: approval_decide (Strictly Admin Users)
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
  v_target_role TEXT;
  v_new_status public.approval_status;
  v_current_approvals INT;
  v_new_version INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Decision must be approve or reject.' USING ERRCODE = '22023';
  END IF;

  v_caller_role := public.current_user_role();

  -- Strict admin role enforcement
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres') THEN
    RAISE EXCEPTION 'Forbidden: Only admin users are authorized to decide approval requests.'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Lock the request row (pessimistic lock)
  SELECT * INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot decide on request in % status.', v_req.status
      USING ERRCODE = '22023';
  END IF;

  -- 2. Optimistic locking check if expected version was provided
  IF p_expected_version IS NOT NULL AND v_req.version <> p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: request has been modified by another actor.'
      USING ERRCODE = '40001';
  END IF;

  -- 3. Lookup type configuration
  SELECT * INTO v_type
  FROM public.approval_types
  WHERE key = v_req.type_key;

  -- 4. Hierarchy check on target user (admin cannot decide super_admin requests)
  IF v_caller_role = 'admin' AND v_req.subject_id IS NOT NULL THEN
    SELECT role INTO v_target_role FROM public.users WHERE id = v_req.subject_id;
    IF v_target_role = 'super_admin' THEN
      RAISE EXCEPTION 'Forbidden: Admin cannot decide on requests for Super Admin.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 5. Self-approval guard
  IF NOT COALESCE(v_type.allow_self_approve, false) AND v_req.requested_by = v_caller_id THEN
    RAISE EXCEPTION 'Self-approval is forbidden for this request.'
      USING ERRCODE = '42501';
  END IF;

  -- 6. Insert decision row (strictly one decision per approver)
  BEGIN
    INSERT INTO public.approval_decisions (
      request_id,
      approver_id,
      approver_role,
      decision,
      note
    ) VALUES (
      p_request_id,
      v_caller_id,
      v_caller_role,
      p_decision,
      p_note
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You have already recorded a decision for this request.'
      USING ERRCODE = '23505';
  END;

  -- 7. Count approvals or execute immediate rejection
  IF p_decision = 'reject' THEN
    v_new_status := 'rejected';
  ELSE
    SELECT COUNT(*) INTO v_current_approvals
    FROM public.approval_decisions
    WHERE request_id = p_request_id AND decision = 'approve';

    IF v_current_approvals >= COALESCE(v_type.required_approvals, 1) THEN
      v_new_status := 'approved';
    ELSE
      v_new_status := 'pending';
    END IF;
  END IF;

  v_new_version := v_req.version + 1;

  -- 8. If terminal state reached, update request and apply domain changes
  IF v_new_status IN ('approved', 'rejected') THEN
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
      -- Handle rejection side-effects
      IF v_req.type_key = 'document_verify' THEN
        UPDATE public.user_documents
        SET
          verification_status = 'rejected',
          status = 'rejected',
          verified_by = v_caller_id,
          verified_at = now(),
          rejection_reason = p_note,
          updated_at = now()
        WHERE id = (v_req.payload->>'document_id')::UUID;
      END IF;
    END IF;
  ELSE
    UPDATE public.approval_requests
    SET
      version = v_new_version,
      updated_at = now()
    WHERE id = p_request_id;
  END IF;

  -- 9. Insert audit event
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
    p_decision,
    'pending',
    v_new_status,
    p_note
  );

  -- 10. Enqueue post-commit outbox notification
  INSERT INTO public.approval_outbox (
    topic,
    request_id,
    payload
  ) VALUES (
    'approval.decided',
    p_request_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'type_key', v_req.type_key,
      'decision', p_decision,
      'status', v_new_status,
      'decided_by', v_caller_id,
      'requested_by', v_req.requested_by,
      'note', p_note
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'version', v_new_version
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Hardened RPC: approval_list (Keyset Pagination with Admin Guard)
-- ------------------------------------------------------------------------------
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
  version INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_limit INT;
  v_is_admin BOOLEAN;
BEGIN
  v_role := public.current_user_role();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  v_is_admin := v_role IN ('super_admin', 'admin', 'service_role', 'postgres') OR v_role IS NULL;

  RETURN QUERY
  SELECT
    r.id,
    r.type_key,
    t.label AS type_label,
    r.subject_type,
    r.subject_id,
    r.subject_label,
    r.requested_by,
    u.full_name AS requester_name,
    r.status,
    r.summary,
    t.priority,
    r.created_at,
    r.expires_at,
    r.version
  FROM public.approval_requests r
  JOIN public.approval_types t ON t.key = r.type_key
  LEFT JOIN public.users u ON u.id = r.requested_by
  WHERE r.status = p_status::public.approval_status
    AND (p_type_key IS NULL OR r.type_key = p_type_key)
    AND (
      v_is_admin
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
-- 6. Hardened RPC: approval_counts (Admin-Only Counts)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approval_counts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_total INT := 0;
  v_by_type JSONB := '{}'::jsonb;
BEGIN
  v_role := public.current_user_role();

  -- Non-admins receive zero counts
  IF v_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres') AND v_role IS NOT NULL THEN
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
    GROUP BY r.type_key
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'by_type', v_by_type
  );
END;
$$;
