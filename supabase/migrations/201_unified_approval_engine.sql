-- ==============================================================================
-- Migration 200: Unified Approval & Verification Engine
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Creates core approval enum: public.approval_status
-- 2. Creates core engine tables:
--    - public.approval_types (configurable catalogue & rules)
--    - public.approval_requests (central unified request ledger)
--    - public.approval_decisions (multi-approver & dual-control support)
--    - public.approval_events (immutable append-only audit trail)
--    - public.approval_outbox (transactional outbox for post-commit side-effects)
-- 3. Creates high-performance partial indexes for keyset pagination and queue scanning
-- 4. Creates tamper-proof immutable trigger on public.approval_events
-- 5. Defines domain apply handlers:
--    - approval_apply_document_verify
--    - approval_apply_profile_change
--    - approval_apply_registration
--    - approval_apply_document_replace
--    - approval_apply_account_deletion
--    - approval_apply_handler (dispatcher)
-- 6. Defines atomic Postgres RPCs (single-transaction state machine):
--    - public.approval_submit
--    - public.approval_decide
--    - public.approval_cancel
--    - public.approval_expire_due
--    - public.approval_list (keyset pagination)
--    - public.approval_get
--    - public.approval_counts
-- 7. Enables RLS on all 5 tables and revokes direct table mutation privileges
-- 8. Seeds approval types for initial inventory
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Approval Status Enum
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'expired'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Core Tables
-- ------------------------------------------------------------------------------

-- 2.1 Approval Types (Configurable Type Catalogue)
CREATE TABLE IF NOT EXISTS public.approval_types (
  key                 TEXT PRIMARY KEY,
  label               TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT 'operations',
  approver_roles      TEXT[] NOT NULL,
  required_approvals  SMALLINT NOT NULL DEFAULT 1 CHECK (required_approvals >= 1),
  allow_self_approve  BOOLEAN NOT NULL DEFAULT false,
  ttl                 INTERVAL,
  cooling_off         INTERVAL,
  priority            SMALLINT NOT NULL DEFAULT 0,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Approval Requests (Unified Central Ledger)
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key            TEXT NOT NULL REFERENCES public.approval_types(key) ON DELETE RESTRICT,
  subject_type        TEXT NOT NULL,
  subject_id          UUID,
  subject_label       TEXT,
  requested_by        UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status              public.approval_status NOT NULL DEFAULT 'pending',
  summary             TEXT NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_note       TEXT,
  decided_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  supersedes_id       UUID REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  idempotency_key     TEXT,
  version             INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 Approval Decisions (Multi-approver & Dual-control Support)
CREATE TABLE IF NOT EXISTS public.approval_decisions (
  request_id          UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  approver_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approver_role       TEXT NOT NULL,
  decision            TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, approver_id)
);

-- 2.4 Approval Events (Immutable Append-Only Audit Ledger)
CREATE TABLE IF NOT EXISTS public.approval_events (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id          UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role          TEXT,
  action              TEXT NOT NULL,
  from_status         public.approval_status,
  to_status           public.approval_status,
  note                TEXT,
  meta                JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 Approval Outbox (Transactional Outbox for Post-Commit Side Effects)
CREATE TABLE IF NOT EXISTS public.approval_outbox (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic               TEXT NOT NULL,
  request_id          UUID REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  payload             JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 3. High-Performance Partial Indexes
-- ------------------------------------------------------------------------------

-- Prevent duplicate open requests for the same entity and type
CREATE UNIQUE INDEX IF NOT EXISTS approval_one_open_per_subject
  ON public.approval_requests (type_key, subject_type, subject_id)
  WHERE status = 'pending' AND subject_id IS NOT NULL;

-- Prevent duplicate submissions with idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS approval_idem
  ON public.approval_requests (requested_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Keyset-paginated Approver Queue per type
CREATE INDEX IF NOT EXISTS approval_queue
  ON public.approval_requests (type_key, created_at DESC, id DESC)
  WHERE status = 'pending';

-- Keyset-paginated Approver Queue across all types
CREATE INDEX IF NOT EXISTS approval_queue_all_pending
  ON public.approval_requests (created_at DESC, id DESC)
  WHERE status = 'pending';

-- Requester personal submissions index
CREATE INDEX IF NOT EXISTS approval_by_requester
  ON public.approval_requests (requested_by, created_at DESC, id DESC);

-- Target entity query (e.g. user detail page active check)
CREATE INDEX IF NOT EXISTS approval_by_target_user
  ON public.approval_requests (subject_id, status)
  WHERE status = 'pending';

-- SLA Expiry Scanner index
CREATE INDEX IF NOT EXISTS approval_expiry
  ON public.approval_requests (expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

-- Event stream order per request
CREATE INDEX IF NOT EXISTS approval_events_req
  ON public.approval_events (request_id, id ASC);

-- Outbox unhandled items queue
CREATE INDEX IF NOT EXISTS approval_outbox_pending
  ON public.approval_outbox (id ASC)
  WHERE processed_at IS NULL;

-- ------------------------------------------------------------------------------
-- 4. Immutable Event Ledger Protection Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_block_approval_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'approval_events is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_events_immutable ON public.approval_events;
CREATE TRIGGER trg_approval_events_immutable
  BEFORE UPDATE OR DELETE ON public.approval_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_block_approval_events_mutation();

-- ------------------------------------------------------------------------------
-- 5. Domain Apply Handlers (Executed inside the approval transaction)
-- ------------------------------------------------------------------------------

-- 5.1 Document Verification Apply Handler
CREATE OR REPLACE FUNCTION public.approval_apply_document_verify(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_doc_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  v_doc_id := (v_req.payload->>'document_id')::UUID;
  v_user_id := (v_req.payload->>'user_id')::UUID;

  UPDATE public.user_documents
  SET
    verification_status = 'verified',
    status = 'verified',
    verified_by = v_req.decided_by,
    verified_at = now(),
    rejection_reason = NULL,
    updated_at = now()
  WHERE id = v_doc_id;

  INSERT INTO public.approval_outbox (topic, request_id, payload)
  VALUES (
    'approval.decided',
    p_request_id,
    jsonb_build_object(
      'type_key', 'document_verify',
      'decision', 'approve',
      'document_id', v_doc_id,
      'user_id', v_user_id,
      'decided_by', v_req.decided_by
    )
  );
END;
$$;

-- 5.2 Profile Change Apply Handler
CREATE OR REPLACE FUNCTION public.approval_apply_profile_change(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  v_target_user_id := (v_req.payload->>'target_user_id')::UUID;
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
$$;

-- 5.3 Registration Apply Handler
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

  v_target_user_id := (v_req.payload->>'user_id')::UUID;

  IF v_target_user_id IS NOT NULL THEN
    UPDATE public.users
    SET status = 'active', updated_at = now()
    WHERE id = v_target_user_id;
  END IF;
END;
$$;

-- 5.4 Document Replace Apply Handler
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

  -- Enqueue file transfer from staging to canonical storage
  INSERT INTO public.approval_outbox (topic, request_id, payload)
  VALUES (
    'file.transfer_staged_document',
    p_request_id,
    v_req.payload
  );
END;
$$;

-- 5.5 Account Deletion Apply Handler
CREATE OR REPLACE FUNCTION public.approval_apply_account_deletion(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_user_id UUID;
BEGIN
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  v_user_id := (v_req.payload->>'user_id')::UUID;

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
$$;

-- 5.6 Apply Handler Dispatcher
CREATE OR REPLACE FUNCTION public.approval_apply_handler(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type_key TEXT;
BEGIN
  SELECT type_key INTO v_type_key
  FROM public.approval_requests
  WHERE id = p_request_id;

  IF v_type_key = 'document_verify' THEN
    PERFORM public.approval_apply_document_verify(p_request_id);
  ELSIF v_type_key = 'profile_change' THEN
    PERFORM public.approval_apply_profile_change(p_request_id);
  ELSIF v_type_key = 'registration' THEN
    PERFORM public.approval_apply_registration(p_request_id);
  ELSIF v_type_key = 'document_replace' THEN
    PERFORM public.approval_apply_document_replace(p_request_id);
  ELSIF v_type_key = 'account_deletion' THEN
    PERFORM public.approval_apply_account_deletion(p_request_id);
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Core Atomic RPCs
-- ------------------------------------------------------------------------------

-- 6.1 Submit Approval Request
CREATE OR REPLACE FUNCTION public.approval_submit(
  p_type_key TEXT,
  p_subject_type TEXT,
  p_subject_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_summary TEXT DEFAULT NULL,
  p_subject_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req_id UUID;
  v_type RECORD;
  v_caller_id UUID;
  v_caller_role TEXT;
  v_summary TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_caller_role := public.current_user_role();

  -- 1. Validate type existence and active state
  SELECT * INTO v_type
  FROM public.approval_types
  WHERE key = p_type_key AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or inactive approval type: %', p_type_key
      USING ERRCODE = '22023';
  END IF;

  -- 2. Idempotency check: if existing with same key for this user, return existing ID
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_req_id
    FROM public.approval_requests
    WHERE requested_by = v_caller_id
      AND idempotency_key = p_idempotency_key;

    IF v_req_id IS NOT NULL THEN
      RETURN v_req_id;
    END IF;
  END IF;

  -- 3. Calculate SLA expiration if TTL is set
  IF v_type.ttl IS NOT NULL THEN
    v_expires_at := now() + v_type.ttl;
  END IF;

  -- 4. Default summary if omitted
  v_summary := COALESCE(
    NULLIF(trim(p_summary), ''),
    v_type.label || ' request for ' || COALESCE(p_subject_label, p_subject_type)
  );

  -- 5. Insert approval request
  INSERT INTO public.approval_requests (
    type_key,
    subject_type,
    subject_id,
    subject_label,
    requested_by,
    status,
    summary,
    payload,
    expires_at,
    idempotency_key
  ) VALUES (
    p_type_key,
    p_subject_type,
    p_subject_id,
    p_subject_label,
    v_caller_id,
    'pending',
    v_summary,
    p_payload,
    v_expires_at,
    p_idempotency_key
  )
  RETURNING id INTO v_req_id;

  -- 6. Insert audit event
  INSERT INTO public.approval_events (
    request_id,
    actor_id,
    actor_role,
    action,
    from_status,
    to_status,
    note
  ) VALUES (
    v_req_id,
    v_caller_id,
    v_caller_role,
    'submitted',
    NULL,
    'pending',
    v_summary
  );

  -- 7. Enqueue outbox notification topic
  INSERT INTO public.approval_outbox (
    topic,
    request_id,
    payload
  ) VALUES (
    'approval.submitted',
    v_req_id,
    jsonb_build_object(
      'request_id', v_req_id,
      'type_key', p_type_key,
      'requested_by', v_caller_id,
      'subject_type', p_subject_type,
      'subject_id', p_subject_id,
      'summary', v_summary,
      'priority', v_type.priority
    )
  );

  RETURN v_req_id;
END;
$$;

-- 6.2 Decide Approval Request (Approve or Reject)
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

  -- 4. Verify caller authorization: role check
  IF NOT (
    v_caller_role IN ('super_admin', 'admin')
    OR v_caller_role = ANY(v_type.approver_roles)
  ) THEN
    RAISE EXCEPTION 'Forbidden: Your role (%) is not authorized to decide % requests.',
      v_caller_role, v_req.type_key
      USING ERRCODE = '42501';
  END IF;

  -- 5. Self-approval guard
  IF NOT v_type.allow_self_approve AND v_req.requested_by = v_caller_id THEN
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

    IF v_current_approvals >= v_type.required_approvals THEN
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
      -- Handle rejection side-effects (e.g. document rejected)
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

-- 6.3 Cancel Approval Request (Requester or Admin)
CREATE OR REPLACE FUNCTION public.approval_cancel(
  p_request_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- 6.4 Expiry Scanner Job
CREATE OR REPLACE FUNCTION public.approval_expire_due()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expired_count INT := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, type_key, requested_by
    FROM public.approval_requests
    WHERE status = 'pending'
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

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

-- 6.5 Keyset-Paginated Request List
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

-- 6.6 Single Request Lookup with Metadata
CREATE OR REPLACE FUNCTION public.approval_get(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
      OR v_role IS NULL
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
$$;

-- 6.7 Aggregated Counts
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

  SELECT
    COALESCE(SUM(sub.cnt), 0),
    COALESCE(jsonb_object_agg(sub.type_key, sub.cnt), '{}'::jsonb)
  INTO v_total, v_by_type
  FROM (
    SELECT r.type_key, COUNT(*) AS cnt
    FROM public.approval_requests r
    JOIN public.approval_types t ON t.key = r.type_key
    WHERE r.status = 'pending'
      AND (
        v_role IN ('super_admin', 'admin', 'hr', 'service_role', 'postgres')
        OR v_role IS NULL
        OR v_role = ANY(t.approver_roles)
      )
    GROUP BY r.type_key
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'by_type', v_by_type
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RLS Policies and Privilege Hardening
-- ------------------------------------------------------------------------------
ALTER TABLE public.approval_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_outbox ENABLE ROW LEVEL SECURITY;

-- Revoke direct mutation from clients; all writes MUST pass through RPCs
REVOKE INSERT, UPDATE, DELETE ON public.approval_types FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.approval_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.approval_decisions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.approval_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.approval_outbox FROM anon, authenticated;

-- Policies for approval_types (active types viewable by authenticated users)
DROP POLICY IF EXISTS approval_types_read ON public.approval_types;
CREATE POLICY approval_types_read ON public.approval_types
  FOR SELECT TO authenticated
  USING (active = true);

-- Policies for approval_requests
DROP POLICY IF EXISTS approval_requests_read ON public.approval_requests;
CREATE POLICY approval_requests_read ON public.approval_requests
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'hr')
    OR requested_by = auth.uid()
    OR subject_id = auth.uid()
    OR public.current_user_role() IN (
      SELECT unnest(approver_roles) FROM public.approval_types WHERE key = type_key
    )
  );

-- Policies for approval_decisions
DROP POLICY IF EXISTS approval_decisions_read ON public.approval_decisions;
CREATE POLICY approval_decisions_read ON public.approval_decisions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = request_id
        AND (
          public.current_user_role() IN ('super_admin', 'admin', 'hr')
          OR r.requested_by = auth.uid()
          OR r.subject_id = auth.uid()
        )
    )
  );

-- Policies for approval_events
DROP POLICY IF EXISTS approval_events_read ON public.approval_events;
CREATE POLICY approval_events_read ON public.approval_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = request_id
        AND (
          public.current_user_role() IN ('super_admin', 'admin', 'hr')
          OR r.requested_by = auth.uid()
          OR r.subject_id = auth.uid()
        )
    )
  );

-- Outbox is strictly internal / service_role
DROP POLICY IF EXISTS approval_outbox_deny ON public.approval_outbox;
CREATE POLICY approval_outbox_deny ON public.approval_outbox
  FOR ALL TO authenticated, anon
  USING (false);

-- Grant execute permissions on RPCs
GRANT EXECUTE ON FUNCTION public.approval_submit TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_decide TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_cancel TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_expire_due TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_list TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_get TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_counts TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. Seed Initial Approval Types
-- ------------------------------------------------------------------------------
INSERT INTO public.approval_types (
  key,
  label,
  category,
  approver_roles,
  required_approvals,
  allow_self_approve,
  ttl,
  cooling_off,
  priority,
  active
) VALUES
  (
    'document_verify',
    'Document Initial Verification',
    'document',
    ARRAY['super_admin', 'admin', 'hr'],
    1,
    false,
    INTERVAL '7 days',
    NULL,
    1,
    true
  ),
  (
    'profile_change',
    'Profile Sensitive Info Change',
    'user',
    ARRAY['super_admin', 'admin', 'manager', 'hr'],
    1,
    false,
    INTERVAL '7 days',
    NULL,
    0,
    true
  ),
  (
    'registration',
    'New User Registration',
    'user',
    ARRAY['super_admin', 'admin', 'manager', 'hr'],
    1,
    false,
    INTERVAL '14 days',
    NULL,
    2,
    true
  ),
  (
    'document_replace',
    'Document Replacement Request',
    'document',
    ARRAY['super_admin', 'admin', 'hr'],
    1,
    false,
    INTERVAL '7 days',
    NULL,
    1,
    true
  ),
  (
    'account_deletion',
    'Account Deletion Request',
    'security',
    ARRAY['super_admin', 'admin'],
    1,
    false,
    NULL,
    INTERVAL '7 days',
    3,
    true
  ),
  (
    'shift_conflict',
    'Shift Overlap / Conflict',
    'operations',
    ARRAY['super_admin', 'admin', 'manager', 'supervisor'],
    1,
    false,
    INTERVAL '3 days',
    NULL,
    2,
    true
  )
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  approver_roles = EXCLUDED.approver_roles,
  required_approvals = EXCLUDED.required_approvals,
  allow_self_approve = EXCLUDED.allow_self_approve,
  ttl = EXCLUDED.ttl,
  cooling_off = EXCLUDED.cooling_off,
  priority = EXCLUDED.priority,
  active = EXCLUDED.active,
  updated_at = now();
