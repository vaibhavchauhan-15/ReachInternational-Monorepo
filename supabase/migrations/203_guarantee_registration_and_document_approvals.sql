-- ==============================================================================
-- Migration 203: Guarantee Registration & Document Approvals
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
--
-- Fixes:
-- 1. Automatic registration approval creation via trigger on public.users
-- 2. Automatic document verification approval creation via trigger on public.user_documents
-- 3. Resilient approval_apply_document_verify supporting document_id and (user_id, document_type_code)
-- 4. approval_apply_registration activates user AND marks initial documents verified (never lost)
-- 5. Resilient approval_decide rejection handler for document_verify
-- 6. Immediate reconciliation/backfill of existing pending users and documents
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Resilient approval_apply_document_verify Apply Handler
-- ------------------------------------------------------------------------------
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
  v_type_code TEXT;
BEGIN
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RETURN;
  END IF;

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

  -- Update user_documents: by document_id if available, or by (user_id, document_type_code)
  IF v_doc_id IS NOT NULL THEN
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
$$;

-- ------------------------------------------------------------------------------
-- 2. Enhanced approval_apply_registration Apply Handler
-- When registration is approved:
-- - Activates user (status = 'active')
-- - Marks initial uploaded documents as verified (never lost or stuck in pending)
-- - Synchronizes any open document_verify approval requests for this user
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
    WHERE type_key = 'document_verify' AND requested_by = v_target_user_id AND status = 'pending';
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Resilient approval_decide Rejection Update
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

-- ------------------------------------------------------------------------------
-- 4. Database Trigger: Auto-Create Registration Approval on User Insert
-- Whenever any user enters public.users with status = 'pending',
-- an approval_request of type 'registration' is GUARANTEED to be created.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_create_registration_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only trigger for users in pending status
  IF NEW.status = 'pending' THEN
    -- Prevent duplicate pending registration approval requests
    IF NOT EXISTS (
      SELECT 1 FROM public.approval_requests
      WHERE type_key = 'registration'
        AND subject_id = NEW.id
        AND status = 'pending'
    ) THEN
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
        'registration',
        'user',
        NEW.id,
        format('%s (%s)', COALESCE(NULLIF(NEW.full_name, ''), 'User'), NEW.role),
        NEW.id,
        'pending',
        format('New registration: %s (%s)', COALESCE(NULLIF(NEW.full_name, ''), 'User'), NEW.role),
        jsonb_build_object(
          'user_id', NEW.id,
          'full_name', NEW.full_name,
          'email', NEW.email,
          'phone', NEW.phone,
          'role', NEW.role,
          'supervisor_id', NEW.supervisor_id,
          'address', NEW.street,
          'city', NEW.city,
          'district', NEW.district,
          'state', NEW.state,
          'machine_category', NEW.machine_category
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_auto_create_registration_approval ON public.users;
CREATE TRIGGER trg_users_auto_create_registration_approval
  AFTER INSERT OR UPDATE OF status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_create_registration_approval();

-- ------------------------------------------------------------------------------
-- 5. Database Trigger: Auto-Create Document Verification Approval on Document Insert
-- Whenever a document enters public.user_documents with verification_status = 'pending',
-- an approval_request of type 'document_verify' is GUARANTEED to be created.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_create_document_verification_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_name TEXT;
  v_type_label TEXT;
BEGIN
  IF NEW.verification_status = 'pending' THEN
    -- Lookup user name for human-readable summary
    SELECT full_name INTO v_user_name FROM public.users WHERE id = NEW.user_id;

    v_type_label := upper(replace(NEW.document_type_code, '_', ' '));

    -- Check if an open verification approval already exists for this document ID
    IF NOT EXISTS (
      SELECT 1 FROM public.approval_requests
      WHERE type_key = 'document_verify'
        AND subject_id = NEW.id
        AND status = 'pending'
    ) THEN
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
        'document',
        NEW.id,
        format('%s - %s', v_type_label, COALESCE(v_user_name, 'User')),
        NEW.user_id,
        'pending',
        format('Initial verification for %s (%s)', NEW.document_type_code, COALESCE(v_user_name, 'User')),
        jsonb_build_object(
          'document_id', NEW.id,
          'user_id', NEW.user_id,
          'document_type_code', NEW.document_type_code,
          'storage_path', NEW.storage_path,
          'thumb_path', NEW.thumb_path,
          'file_size_bytes', NEW.file_size_bytes
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_documents_auto_create_verification_approval ON public.user_documents;
CREATE TRIGGER trg_user_documents_auto_create_verification_approval
  AFTER INSERT OR UPDATE OF verification_status ON public.user_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_create_document_verification_approval();

-- ------------------------------------------------------------------------------
-- 6. Immediate Backfill & Reconciliation
-- Reconcile any existing pending users and unverified documents so they appear
-- in the approval queue immediately with zero lost records.
-- ------------------------------------------------------------------------------

-- 6.1 Backfill pending users into approval_requests
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
)
SELECT
  'registration',
  'user',
  u.id,
  format('%s (%s)', COALESCE(NULLIF(u.full_name, ''), 'User'), u.role),
  u.id,
  'pending',
  format('New registration: %s (%s)', COALESCE(NULLIF(u.full_name, ''), 'User'), u.role),
  jsonb_build_object(
    'user_id', u.id,
    'full_name', u.full_name,
    'email', u.email,
    'phone', u.phone,
    'role', u.role,
    'supervisor_id', u.supervisor_id,
    'address', u.street,
    'city', u.city,
    'district', u.district,
    'state', u.state,
    'machine_category', u.machine_category
  ),
  u.created_at,
  u.created_at
FROM public.users u
WHERE u.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.approval_requests ar
    WHERE ar.type_key = 'registration'
      AND ar.subject_id = u.id
      AND ar.status = 'pending'
  );

-- 6.2 Backfill pending documents into approval_requests
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
)
SELECT
  'document_verify',
  'document',
  d.id,
  format('%s - %s', upper(replace(d.document_type_code, '_', ' ')), COALESCE(u.full_name, 'User')),
  d.user_id,
  'pending',
  format('Initial verification for %s (%s)', d.document_type_code, COALESCE(u.full_name, 'User')),
  jsonb_build_object(
    'document_id', d.id,
    'user_id', d.user_id,
    'document_type_code', d.document_type_code,
    'storage_path', d.storage_path,
    'thumb_path', d.thumb_path,
    'file_size_bytes', d.file_size_bytes
  ),
  d.created_at,
  d.created_at
FROM public.user_documents d
LEFT JOIN public.users u ON u.id = d.user_id
WHERE d.verification_status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.approval_requests ar
    WHERE ar.type_key = 'document_verify'
      AND ar.subject_id = d.id
      AND ar.status = 'pending'
  );

-- 6.3 Synchronize user_documents status column with verification_status
UPDATE public.user_documents
SET status = verification_status
WHERE status IS DISTINCT FROM verification_status;
