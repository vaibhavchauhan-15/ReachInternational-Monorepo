-- ==============================================================================
-- Migration 218: Atomic Bulk "Approve All" Engine
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
--
-- Business Requirements:
-- 1. "in the approval page implemnet approve all"
-- 2. "if approval all then all the user documents should be pending only user is active"
-- 3. "also it should be fast responsive,optimize"
--
-- Invariants:
-- - Atomic single-transaction bulk approval execution.
-- - For all user registrations:
--     1. Registration approval request marked 'approved'.
--     2. User status set to 'active' immediately.
--     3. Statutory user documents (Aadhaar, Driving License, Bank Details)
--        MUST remain/be set to 'pending' (verification_status = 'pending').
--        Only the user is active!
--     4. A consolidated 'document_verify' request is created/updated for
--        subsequent manual document verification in the Document Verifications queue.
-- - Excludes standalone document verifications/replacements from bulk approval to
--   guarantee documents remain in pending status as requested.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.approval_approve_all(
  p_actor_id UUID DEFAULT NULL,
  p_type_key TEXT DEFAULT NULL,
  p_request_ids UUID[] DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
BEGIN
  -- 1. Resolve actor id and verify administrator role
  v_actor_id := COALESCE(p_actor_id, auth.uid());

  IF v_actor_id IS NOT NULL THEN
    SELECT role INTO v_actor_role
    FROM public.users
    WHERE id = v_actor_id;

    IF v_actor_role NOT IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Only administrators can perform bulk approval (caller role: %)', COALESCE(v_actor_role, 'unknown');
    END IF;
  END IF;

  -- 2. Process all qualifying pending requests with row-level locks
  FOR v_req IN
    SELECT id, type_key, subject_type, subject_id, payload, requested_by, version
    FROM public.approval_requests
    WHERE status = 'pending'
      AND (
        (p_type_key IS NOT NULL AND p_type_key <> 'all' AND type_key = p_type_key)
        OR
        ((p_type_key IS NULL OR p_type_key = 'all') AND type_key NOT IN ('document_verify', 'document_replace'))
      )
      AND (p_request_ids IS NULL OR id = ANY(p_request_ids))
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
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
    'activated_user_ids', v_activated_user_ids
  );
END;
$$;

-- Grant execution to authenticated, service_role, and postgres
GRANT EXECUTE ON FUNCTION public.approval_approve_all(UUID, TEXT, UUID[], TEXT) TO authenticated, service_role;
