-- ==============================================================================
-- Migration 209: Normalize and Deduplicate Approval Requests & Consolidate Multi-Document Approvals
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
--
-- Fixes:
-- 1. Prevent duplicate document_verify requests for users in pending registration.
--    When a user registers, their documents are reviewed directly within the New User Registration card.
-- 2. Consolidate multiple document verification requests for the same user into a single unified card.
-- 3. Enhance approval_apply_document_verify to verify multiple documents via pending_document_ids.
-- 4. Enhance approval_decide rejection side-effect for multi-document document_verify.
-- 5. Clean up existing orphan/duplicate document_verify requests for users with pending registrations.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enhanced Trigger: trg_auto_create_document_verification_approval
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_create_document_verification_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_name TEXT;
  v_user_status TEXT;
  v_existing_req_id UUID;
  v_existing_payload JSONB;
  v_doc_count INT;
BEGIN
  IF NEW.verification_status = 'pending' THEN
    -- Check user existence and registration status
    SELECT full_name, status INTO v_user_name, v_user_status
    FROM public.users
    WHERE id = NEW.user_id;

    -- 1. If user is in pending registration, or has an active pending registration approval request:
    -- Their documents are reviewed directly within the "New User Registration" card.
    -- DO NOT create duplicate standalone document_verify requests!
    IF v_user_status = 'pending' OR EXISTS (
      SELECT 1 FROM public.approval_requests
      WHERE type_key = 'registration'
        AND (subject_id = NEW.user_id OR requested_by = NEW.user_id OR (payload->>'user_id')::UUID = NEW.user_id)
        AND status = 'pending'
    ) THEN
      RETURN NEW;
    END IF;

    -- 2. Check if a pending document_verify request already exists for this USER
    SELECT id, payload INTO v_existing_req_id, v_existing_payload
    FROM public.approval_requests
    WHERE type_key = 'document_verify'
      AND (requested_by = NEW.user_id OR (payload->>'user_id')::UUID = NEW.user_id)
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_req_id IS NOT NULL THEN
      -- BIND this document into the existing pending request for this user!
      -- Count total pending documents for this user
      SELECT count(*) INTO v_doc_count
      FROM public.user_documents
      WHERE user_id = NEW.user_id AND verification_status = 'pending';

      -- Update the existing request with normalized multi-document summary and payload
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

    -- 3. Otherwise, create ONE new document_verify request for this user
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
$$;

-- ------------------------------------------------------------------------------
-- 2. Enhanced Handler: approval_apply_document_verify
-- Supports verifying multiple documents bound into a single approval request
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
  v_doc_ids JSONB;
BEGIN
  SELECT id, payload, decided_by, requested_by INTO v_req
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
    v_user_id := COALESCE(
      (v_req.payload->>'user_id')::UUID,
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
$$;

-- ------------------------------------------------------------------------------
-- 3. Enhanced Rejection Side-Effects in approval_decide
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
  v_new_status public.approval_status;
  v_new_version INT;
  v_votes_approved INT;
  v_votes_rejected INT;
  v_doc_id UUID;
  v_user_id UUID;
  v_type_code TEXT;
  v_doc_ids JSONB;
BEGIN
  -- 1. Resolve caller ID securely
  v_caller_id := COALESCE(auth.uid(), p_actor_id);
  IF v_caller_id IS NULL THEN
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
          v_user_id := COALESCE(
            (v_req.payload->>'user_id')::UUID,
            (SELECT user_id FROM public.user_documents WHERE id = v_doc_id),
            v_req.requested_by
          );
        EXCEPTION WHEN OTHERS THEN
          v_user_id := v_req.requested_by;
        END;

        v_type_code := NULLIF(v_req.payload->>'document_type_code', '');
        v_doc_ids := v_req.payload->'pending_document_ids';

        IF v_doc_ids IS NOT NULL AND jsonb_array_length(v_doc_ids) > 0 THEN
          UPDATE public.user_documents
          SET
            verification_status = 'rejected',
            status = 'rejected',
            verified_by = v_caller_id,
            verified_at = now(),
            rejection_reason = p_note,
            updated_at = now()
          WHERE id IN (
            SELECT value::text::uuid
            FROM jsonb_array_elements_text(v_doc_ids)
          );
        ELSIF v_doc_id IS NOT NULL THEN
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
        ELSIF v_user_id IS NOT NULL THEN
          UPDATE public.user_documents
          SET
            verification_status = 'rejected',
            status = 'rejected',
            verified_by = v_caller_id,
            verified_at = now(),
            rejection_reason = p_note,
            updated_at = now()
          WHERE user_id = v_user_id AND verification_status = 'pending';
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
          UPDATE public.users
          SET status = 'inactive', updated_at = now()
          WHERE id = v_user_id AND status = 'pending';

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

      -- Resilient rejection side-effect for document_replace
      ELSIF v_req.type_key = 'document_replace' THEN
        BEGIN
          v_doc_id := (v_req.payload->>'document_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
          v_doc_id := NULL;
        END;

        IF v_doc_id IS NOT NULL THEN
          UPDATE public.document_change_requests
          SET
            status = 'rejected',
            rejection_reason = p_note,
            updated_at = now()
          WHERE id = v_doc_id;
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

  -- 7. Insert audit event in public.approval_events
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

-- ------------------------------------------------------------------------------
-- 4. Immediate Reconciliation & Deduplication of Existing Database Rows
-- Automatically resolves any duplicate document_verify requests for users
-- who have a pending or approved registration request.
-- ------------------------------------------------------------------------------
DELETE FROM public.approval_requests
WHERE type_key = 'document_verify'
  AND status = 'pending'
  AND (
    requested_by IN (
      SELECT subject_id FROM public.approval_requests WHERE type_key = 'registration'
    )
    OR (payload->>'user_id')::UUID IN (
      SELECT subject_id FROM public.approval_requests WHERE type_key = 'registration'
    )
    OR requested_by IN (
      SELECT id FROM public.users WHERE status = 'pending'
    )
  );
